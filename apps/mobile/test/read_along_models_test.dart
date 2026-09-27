import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bolti_kitab_mobile/models/read_along_models.dart';
import 'package:bolti_kitab_mobile/models/models.dart';

void main() {
  group('Read Along Data Models', () {
    test('Correctly deserializes ReadAlongDocument from JSON', () {
      final sampleJson = {
        'schema_version': '1.0.0',
        'book_id': 'the-art-of-war',
        'title': 'The Art of War',
        'title_urdu': 'فنِ حرب',
        'author': 'Sun Tzu',
        'author_urdu': 'سن تزو',
        'translator': 'Lionel Giles',
        'source_edition': 'Project Gutenberg eBook #17405',
        'narrator': 'Bob Neufeld',
        'language': 'en',
        'text_direction': 'ltr',
        'section': {
          'section_id': 'part-1',
          'chapter_num': 1,
          'title': 'Part 1: Laying Plans & Waging War',
          'title_urdu': 'حصہ اول: منصوبہ بندی اور جنگ',
          'duration_ms': 2133950,
          'audio_filename': 'artofwar_01_suntzu_64kb.mp3',
          'chapters': [
            {
              'chapter_id': 'ch-1',
              'chapter_index': 1,
              'title': 'I. LAYING PLANS',
              'title_urdu': 'حصہ اول: منصوبہ بندی',
              'paragraphs': [
                {
                  'paragraph_id': 'p-1-1',
                  'paragraph_num': '1',
                  'text': 'Sun Tzŭ said: The art of war is of vital importance to the State.',
                  'start_ms': null,
                  'end_ms': null,
                  'sentences': [
                    {
                      'sentence_id': 's-1-1-1',
                      'text': 'Sun Tzŭ said: The art of war is of vital importance to the State.',
                      'start_ms': null,
                      'end_ms': null,
                      'words': [
                        {'word': 'Sun', 'start_ms': null, 'end_ms': null},
                        {'word': 'Tzŭ', 'start_ms': null, 'end_ms': null},
                        {'word': 'said:', 'start_ms': null, 'end_ms': null},
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      final doc = ReadAlongDocument.fromJson(sampleJson);

      expect(doc.schemaVersion, '1.0.0');
      expect(doc.bookId, 'the-art-of-war');
      expect(doc.title, 'The Art of War');
      expect(doc.titleUrdu, 'فنِ حرب');
      expect(doc.author, 'Sun Tzu');
      expect(doc.authorUrdu, 'سن تزو');
      expect(doc.translator, 'Lionel Giles');
      expect(doc.textDirection, TextDirection.ltr);
      expect(doc.section.sectionId, 'part-1');
      expect(doc.section.chapterNum, 1);
      expect(doc.section.chapters.length, 1);

      final ch = doc.section.chapters.first;
      expect(ch.chapterId, 'ch-1');
      expect(ch.paragraphs.length, 1);

      final p = ch.paragraphs.first;
      expect(p.paragraphId, 'p-1-1');
      expect(p.paragraphNum, '1');
      expect(p.startMs, isNull);
      expect(p.endMs, isNull);
      expect(p.sentences.length, 1);

      final s = p.sentences.first;
      expect(s.sentenceId, 's-1-1-1');
      expect(s.words.length, 3);
      expect(s.words[0].word, 'Sun');
      expect(s.words[0].startMs, isNull);
    });

    test('Supports RTL text direction parsing for Urdu content', () {
      final urduJson = {
        'schema_version': '1.0.0',
        'book_id': 'urdu-sample',
        'title': 'بولتی کتاب',
        'author': 'مصنف',
        'language': 'ur',
        'text_direction': 'rtl',
        'section': {
          'section_id': 'sec-1',
          'chapter_num': 1,
          'title': 'باب اول',
          'duration_ms': 100000,
          'chapters': [],
        },
      };

      final doc = ReadAlongDocument.fromJson(urduJson);
      expect(doc.textDirection, TextDirection.rtl);
    });

    test('Round trips toJson and fromJson without data loss', () {
      final word = ReadAlongWord(word: 'victory', startMs: 1200, endMs: 1800);
      final sentence = ReadAlongSentence(
        sentenceId: 's-1',
        text: 'Victory awaits.',
        startMs: 1000,
        endMs: 2500,
        words: [word],
      );
      final para = ReadAlongParagraph(
        paragraphId: 'p-1',
        paragraphNum: '1',
        text: 'Victory awaits.',
        startMs: 1000,
        endMs: 2500,
        sentences: [sentence],
      );
      final ch = ReadAlongChapter(
        chapterId: 'ch-1',
        chapterIndex: 1,
        title: 'Chapter 1',
        paragraphs: [para],
      );
      final section = ReadAlongSection(
        sectionId: 'sec-1',
        chapterNum: 1,
        title: 'Part 1',
        durationMs: 30000,
        chapters: [ch],
      );
      final doc = ReadAlongDocument(
        schemaVersion: '1.0.0',
        bookId: 'b-1',
        title: 'Book 1',
        author: 'Author',
        language: 'en',
        textDirection: TextDirection.ltr,
        section: section,
      );

      final encoded = json.encode(doc.toJson());
      final decodedDoc = ReadAlongDocument.fromJson(json.decode(encoded) as Map<String, dynamic>);

      expect(decodedDoc.bookId, 'b-1');
      expect(decodedDoc.section.chapters.first.paragraphs.first.sentences.first.words.first.startMs, 1200);
    });

    test('ChapterItem correctly parses start_ms', () {
      final json = {
        'id': 'ch-uuid-1',
        'chapter_num': 1,
        'title': 'Part 1: Laying Plans',
        'title_urdu': 'حصہ اول',
        'start_ms': 18200,
        'duration_ms': 1201101,
        'is_preview_free': true,
        'is_approved': true,
      };
      final item = ChapterItem.fromJson(json);
      expect(item.startMs, 18200);
      expect(item.durationMs, 1201101);
    });

    test('PlaybackToken correctly parses start_ms to skip disclaimer', () {
      final json = {
        'book_id': 'b-uuid-1',
        'chapter_id': 'ch-uuid-1',
        'chapter_num': 1,
        'title': 'Part 1: Laying Plans',
        'start_ms': 18200,
        'duration_ms': 1201101,
        'playback_url': 'https://f000.backblazeb2.com/file/...',
        'expires_at': '2026-09-26T20:00:00Z',
        'format': 'audio/mpeg',
      };
      final token = PlaybackToken.fromJson(json);
      expect(token.startMs, 18200);
      expect(token.durationMs, 1201101);
    });
  });
}
