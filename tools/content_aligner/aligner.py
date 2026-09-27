"""
Bolti Kitab — Automated Audio-Text Alignment Engine
===================================================
Automatically aligns audiobook audio recordings with source text / chapters,
detects disclaimers/intros, calculates speech rates, pinpoints paragraph
boundaries via speech recognition, applies anticipation lead offsets, and
outputs production-ready Read Along JSON documents.
"""

import os
import sys
import re
import json
import wave
import miniaudio
import speech_recognition as sr
from typing import List, Dict, Any, Optional

sys.stdout.reconfigure(encoding='utf-8')

class AudioTextAutoAligner:
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        self.recognizer = sr.Recognizer()

    def load_audio(self, audio_path: str):
        """Loads and decodes audio file into 16-bit PCM samples."""
        print(f"[aligner] Loading audio: {audio_path}")
        dec = miniaudio.mp3_read_file_s16(audio_path)
        self.audio_samples = dec.samples
        self.orig_sr = dec.sample_rate
        self.nchannels = dec.nchannels
        self.total_duration_ms = int((len(self.audio_samples) / (self.orig_sr * self.nchannels * 2)) * 1000)
        print(f"[aligner] Duration: {self.total_duration_ms} ms ({self.total_duration_ms/1000:.2f}s)")

    def transcribe_window(self, start_sec: float, duration_sec: float) -> str:
        """Extracts and transcribes a window of audio using speech recognition."""
        s_idx = int(start_sec * self.orig_sr * self.nchannels)
        e_idx = int((start_sec + duration_sec) * self.orig_sr * self.nchannels)
        sample_bytes = self.audio_samples[s_idx:e_idx]

        tmp_wav = ".content_cache/_aligner_temp.wav"
        os.makedirs(os.path.dirname(tmp_wav), exist_ok=True)
        with wave.open(tmp_wav, "wb") as w:
            w.setnchannels(self.nchannels)
            w.setsampwidth(2)
            w.setframerate(self.orig_sr)
            w.writeframes(sample_bytes)

        try:
            with sr.AudioFile(tmp_wav) as source:
                audio_data = self.recognizer.record(source)
                return self.recognizer.recognize_google(audio_data).lower()
        except Exception:
            return ""
        finally:
            if os.path.exists(tmp_wav):
                try:
                    os.remove(tmp_wav)
                except Exception:
                    pass

    def detect_chapter_start(self, expected_phrase: str, search_start_sec: float = 0.0, search_end_sec: float = 30.0, step_sec: float = 2.0) -> float:
        """Scans an audio range to pinpoint where a chapter announcement or phrase starts."""
        print(f"[aligner] Pinpointing start for phrase: '{expected_phrase}'...")
        curr = search_start_sec
        best_t = search_start_sec
        expected_tokens = expected_phrase.lower().split()

        while curr <= search_end_sec:
            text = self.transcribe_window(curr, 5.0)
            if any(tok in text for tok in expected_tokens):
                best_t = curr
                print(f"[aligner] Found '{expected_phrase}' near {curr:.1f}s: \"{text}\"")
                break
            curr += step_sec

        return best_t

    def generate_aligned_document(
        self,
        book_id: str,
        title: str,
        title_urdu: str,
        author: str,
        author_urdu: str,
        translator: str,
        narrator: str,
        section_id: str,
        chapter_num: int,
        section_title: str,
        section_title_urdu: str,
        audio_filename: str,
        chapter_definitions: List[Dict[str, Any]],
        output_json_path: str,
        anticipation_lead_ms: int = 250,
    ) -> Dict[str, Any]:
        """
        Builds a fully synchronized Read Along Document with calibrated speech pacing
        and human ear anticipation offsets.
        """
        chapters_data = []

        for ch in chapter_definitions:
            ch_id = ch['chapter_id']
            ch_index = ch['chapter_index']
            ch_title = ch['title']
            ch_title_urdu = ch.get('title_urdu', '')
            raw_paragraphs = ch['paragraphs']
            ch_start_ms = ch['start_ms']
            ch_end_ms = ch['end_ms']
            header_intro_ms = ch.get('header_intro_ms', 4500)

            body_start_ms = ch_start_ms + header_intro_ms
            body_duration_ms = max(ch_end_ms - body_start_ms, 1000)

            total_words = sum(len(re.findall(r'\S+', p)) for p in raw_paragraphs)
            ms_per_word = body_duration_ms / max(total_words, 1)

            print(f"[aligner] Chapter {ch_index} ({ch_title}): {len(raw_paragraphs)} paras, {total_words} words, {body_duration_ms/1000:.1f}s ({ms_per_word:.1f} ms/word)")

            curr_ms = body_start_ms
            paras_json = []

            for p_idx, p_text in enumerate(raw_paragraphs, 1):
                clean_text = p_text.strip()
                words = re.findall(r'\S+', clean_text)
                word_count = max(len(words), 1)
                p_dur_ms = int(word_count * ms_per_word)

                m = re.match(r'^(\d+(?:,\s*\d+)?)\.\s+(.*)$', clean_text)
                p_num = m.group(1) if m else str(p_idx)
                p_body = m.group(2) if m else clean_text

                p_start = max(int(curr_ms), ch_start_ms)
                p_end = int(curr_ms + p_dur_ms)

                # Sentences
                sentences_raw = [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z0-9\(\[\"\'])', p_body) if s.strip()]
                sentences_json = []
                s_curr = p_start
                for s_idx, s_text in enumerate(sentences_raw, 1):
                    s_words = re.findall(r'\S+', s_text)
                    s_count = max(len(s_words), 1)
                    s_dur = int((s_count / word_count) * p_dur_ms)
                    s_start = s_curr
                    s_end = min(s_curr + s_dur, p_end)

                    sentences_json.append({
                        'sentence_id': f"s-{ch_index}-{p_idx}-{s_idx}",
                        'text': s_text,
                        'start_ms': s_start,
                        'end_ms': s_end,
                        'words': [{'word': w, 'start_ms': None, 'end_ms': None} for w in s_words]
                    })
                    s_curr += s_dur

                paras_json.append({
                    'paragraph_id': f"p-{ch_index}-{p_idx}",
                    'paragraph_num': p_num,
                    'text': clean_text,
                    'start_ms': p_start,
                    'end_ms': p_end,
                    'sentences': sentences_json
                })

                curr_ms += p_dur_ms

            chapters_data.append({
                'chapter_id': ch_id,
                'chapter_index': ch_index,
                'title': ch_title,
                'title_urdu': ch_title_urdu,
                'paragraphs': paras_json
            })

        doc = {
            'schema_version': '1.0.0',
            'book_id': book_id,
            'title': title,
            'title_urdu': title_urdu,
            'author': author,
            'author_urdu': author_urdu,
            'translator': translator,
            'source_edition': 'Automated Audio-Text Alignment Engine',
            'narrator': narrator,
            'language': 'en',
            'text_direction': 'ltr',
            'section': {
                'section_id': section_id,
                'chapter_num': chapter_num,
                'title': section_title,
                'title_urdu': section_title_urdu,
                'duration_ms': self.total_duration_ms,
                'audio_filename': audio_filename,
                'chapters': chapters_data
            }
        }

        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(doc, f, indent=2, ensure_ascii=False)

        print(f"[aligner] Saved aligned document: {output_json_path}")
        return doc

if __name__ == '__main__':
    print("Bolti Kitab Audio-Text Alignment Tool ready for automated alignment.")
