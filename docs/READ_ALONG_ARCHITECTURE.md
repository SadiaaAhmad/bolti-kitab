# Read Along Feature: Architecture, Content Model & Synchronization Boundary

## 1. Product Concept & Overview

The **Read Along (ساتھ پڑھیں)** feature provides listeners with a dedicated, focused reading view of the authoritative source text corresponding to the currently playing audiobook section.

```
┌────────────────────────────────────────────────────────┐
│                     PLAYER SCREEN                      │
│   • Artwork & Metadata                                 │
│   • Play/Pause, 10s Rewind/Forward, Seek Slider        │
│   • 📖 Read Along Button (AppBar & Action Pill)        │
└──────────────────────────┬─────────────────────────────┘
                           │
                 [User taps Read Along]
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   READ ALONG SCREEN                    │
│   • Clean, readable typography                         │
│   • Multi-chapter layout within audio section          │
│   • Font scaling controls (A- / A+)                    │
│   • Full English (LTR) & Urdu (RTL) support            │
│   • Reading position locally persisted                 │
│   • Sticky Bottom Audio HUD (Mini-Player):             │
│       - Real-time time elapsed / remaining             │
│       - Play / Pause toggle                            │
│       - Seek / Progress bar                            │
│       - "Tap for player" return action                 │
└────────────────────────────────────────────────────────┘
```

---

## 2. Ingested Content & Production Reality

### 2.1 Audio Recording Provenance
- **Work**: *The Art of War* (*فنِ حرب*)
- **Author**: Sun Tzu (~5th Century BCE, Public Domain worldwide)
- **Translator**: Lionel Giles (1910 Translation, Project Gutenberg eBook #17405, Public Domain)
- **Audio Source**: LibriVox [The Art of War (Version 4)](https://librivox.org/the-art-of-war-version-4-by-sun-tzu/) (Catalog ID: 8650, Internet Archive: `artofwar_1402_librivox`)
- **Narrator**: Bob Neufeld

### 2.2 Audio Ingestion Breakdown
The LibriVox recording contains **two audio files / sections**, spanning 13 underlying textual chapters:
1. **Part 1** (`artofwar_01_suntzu_64kb.mp3`):
   - Duration: 2,133.95 seconds (~35:34)
   - Textual coverage: **Chapters 1 through 8**
     1. Chapter 1: Laying Plans (*حصہ اول: منصوبہ بندی*)
     2. Chapter 2: Waging War (*حصہ دوم: جنگ چھیڑنا*)
     3. Chapter 3: Attack by Stratagem (*حصہ سوم: حکمت عملی سے حملہ*)
     4. Chapter 4: Tactical Dispositions (*حصہ چہارم: جنگی صف بندی*)
     5. Chapter 5: Energy (*حصہ پنجم: قوت اور توانائی*)
     6. Chapter 6: Weak Points and Strong (*حصہ ششم: کمزور اور مضبوط پہلو*)
     7. Chapter 7: Manœuvering (*حصہ ہفتم: پینترا بازی*)
     8. Chapter 8: Variation of Tactics (*حصہ ہشتم: جنگی تدابیر میں تبدیلیاں*)
2. **Part 2** (`artofwar_02_suntzu_64kb.mp3`):
   - Duration: 2,000.20 seconds (~33:20)
   - Textual coverage: **Chapters 9 through 13**
     9. Chapter 9: The Army on the March
     10. Chapter 10: Terrain
     11. Chapter 11: The Nine Situations
     12. Chapter 12: The Attack by Fire
     13. Chapter 13: The Use of Spies

> [!IMPORTANT]
> **Current Ingestion Reality**: Only **Part 1** is currently ingested into Bolti Kitab's storage and catalog. The system explicitly records Part 1 as a single 35:34 audio chapter and does not fabricate missing chapters or split the audio artificially.

---

## 3. Data Model & Future Synchronization Boundary

Bolti Kitab strictly avoids **fake timing or synthetic interpolation**. The Read Along data model is structured with explicit synchronization boundaries ready for Phase 2 automated speech recognition (ASR) / forced alignment.

### 3.1 Content Schema

```json
{
  "schema_version": "1.0.0",
  "book_id": "the-art-of-war",
  "title": "The Art of War",
  "title_urdu": "فنِ حرب",
  "author": "Sun Tzu",
  "author_urdu": "سن تزو",
  "translator": "Lionel Giles",
  "source_edition": "Project Gutenberg eBook #17405 (Public Domain)",
  "narrator": "Bob Neufeld (LibriVox Version 4)",
  "language": "en",
  "text_direction": "ltr",
  "section": {
    "section_id": "part-1",
    "chapter_num": 1,
    "title": "Part 1: Laying Plans & Waging War",
    "title_urdu": "حصہ اول: منصوبہ بندی اور جنگ",
    "duration_ms": 2133950,
    "audio_filename": "artofwar_01_suntzu_64kb.mp3",
    "chapters": [
      {
        "chapter_id": "ch-1",
        "chapter_index": 1,
        "title": "I. LAYING PLANS",
        "title_urdu": "حصہ اول: منصوبہ بندی",
        "paragraphs": [
          {
            "paragraph_id": "p-1-1",
            "paragraph_num": "1",
            "text": "1. Sun Tzŭ said: The art of war is of vital importance to the State.",
            "start_ms": null,
            "end_ms": null,
            "sentences": [
              {
                "sentence_id": "s-1-1-1",
                "text": "Sun Tzŭ said: The art of war is of vital importance to the State.",
                "start_ms": null,
                "end_ms": null,
                "words": [
                  { "word": "Sun", "start_ms": null, "end_ms": null },
                  { "word": "Tzŭ", "start_ms": null, "end_ms": null },
                  { "word": "said:", "start_ms": null, "end_ms": null },
                  { "word": "The", "start_ms": null, "end_ms": null },
                  { "word": "art", "start_ms": null, "end_ms": null },
                  { "word": "of", "start_ms": null, "end_ms": null },
                  { "word": "war", "start_ms": null, "end_ms": null },
                  { "word": "is", "start_ms": null, "end_ms": null },
                  { "word": "of", "start_ms": null, "end_ms": null },
                  { "word": "vital", "start_ms": null, "end_ms": null },
                  { "word": "importance", "start_ms": null, "end_ms": null },
                  { "word": "to", "start_ms": null, "end_ms": null },
                  { "word": "the", "start_ms": null, "end_ms": null },
                  { "word": "State.", "start_ms": null, "end_ms": null }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### 3.2 Synchronization Boundary Fields
- **`paragraph_id`**: Deterministic unique identifier for every paragraph (`p-{chapter}-{index}`).
- **`sentence_id`**: Deterministic unique identifier for every sentence (`s-{chapter}-{para}-{index}`).
- **`start_ms` & `end_ms`**: Explicitly set to `null` in Phase 1. When forced alignment is applied in Phase 2, millisecond-accurate timestamps will populate these fields without requiring any UI code refactoring.
- **`words`**: Contains every token with placeholders for word-level timestamps.

---

## 4. Architectural Separation: Content Layer vs Database

1. **Phase 1 (Current Vertical Slice)**:
   - Packaged as an asset document: `assets/content/the_art_of_war_part_1.json`.
   - Loaded asynchronously by `ReadAlongService`.
   - Client-side reading position stored locally in `SharedPreferences` (per book and section ID).
   - **PostgreSQL Schema Status**: No modification needed for the client-side reading view vertical slice.

2. **Phase 2 (Future Persistent Synchronized Transcripts)**:
   - When automated alignment is integrated, the transcript will be stored persistently in PostgreSQL.
   - Proposed schema additions for future review:
     ```sql
     CREATE TABLE transcripts (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
         chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
         language VARCHAR(10) NOT NULL DEFAULT 'en',
         text_direction VARCHAR(3) NOT NULL DEFAULT 'ltr',
         alignment_status VARCHAR(20) NOT NULL DEFAULT 'unaligned', -- unaligned, processing, aligned
         created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
     );

     CREATE TABLE transcript_cues (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
         cue_index INT NOT NULL,
         paragraph_id VARCHAR(64) NOT NULL,
         sentence_id VARCHAR(64),
         start_ms INT,
         end_ms INT,
         text TEXT NOT NULL,
         words_json JSONB
     );

     CREATE INDEX idx_transcript_cues_time ON transcript_cues(transcript_id, start_ms, end_ms);
     ```

---

## 5. UI & UX Architecture

- **Clean Typography**: High contrast readability on dark slate (`#0F172A`), customizable font sizes (`A-` / `A+`).
- **Bi-directional Text**: Full native support for Left-to-Right (`ltr`) English and Right-to-Left (`rtl`) Urdu text directions.
- **Persistent Mini-Player**: Real-time listening time, duration, play/pause controls, and instant return-to-player tap gesture.
- **Local Position Memory**: Debounced scroll position tracking saved into `SharedPreferences` with automatic scroll restoration upon returning to the screen.
