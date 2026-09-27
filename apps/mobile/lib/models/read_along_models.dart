import 'package:flutter/widgets.dart';

/// Bolti Kitab — Read Along Data Models
///
/// Designed to represent authoritative book source text decoupled from audio playback UI,
/// while providing strict future-compatible synchronization boundaries:
///   - paragraph_id
///   - start_ms (future alignment)
///   - end_ms (future alignment)
///   - sentence_id
///   - word timestamps (future word-level ASR / forced alignment)
///
/// Supports LTR (English) and RTL (Urdu) text directions.

class ReadAlongWord {
  final String word;
  final int? startMs;
  final int? endMs;

  ReadAlongWord({
    required this.word,
    this.startMs,
    this.endMs,
  });

  factory ReadAlongWord.fromJson(Map<String, dynamic> json) {
    return ReadAlongWord(
      word: json['word'] as String? ?? '',
      startMs: json['start_ms'] as int?,
      endMs: json['end_ms'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
    'word': word,
    'start_ms': startMs,
    'end_ms': endMs,
  };
}

class ReadAlongSentence {
  final String sentenceId;
  final String text;
  final int? startMs;
  final int? endMs;
  final List<ReadAlongWord> words;

  ReadAlongSentence({
    required this.sentenceId,
    required this.text,
    this.startMs,
    this.endMs,
    this.words = const [],
  });

  factory ReadAlongSentence.fromJson(Map<String, dynamic> json) {
    final rawWords = json['words'] as List<dynamic>? ?? [];
    return ReadAlongSentence(
      sentenceId: json['sentence_id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      startMs: json['start_ms'] as int?,
      endMs: json['end_ms'] as int?,
      words: rawWords.map((w) => ReadAlongWord.fromJson(w as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'sentence_id': sentenceId,
    'text': text,
    'start_ms': startMs,
    'end_ms': endMs,
    'words': words.map((w) => w.toJson()).toList(),
  };
}

class ReadAlongParagraph {
  final String paragraphId;
  final String? paragraphNum;
  final String text;
  final int? startMs;
  final int? endMs;
  final List<ReadAlongSentence> sentences;

  ReadAlongParagraph({
    required this.paragraphId,
    this.paragraphNum,
    required this.text,
    this.startMs,
    this.endMs,
    this.sentences = const [],
  });

  factory ReadAlongParagraph.fromJson(Map<String, dynamic> json) {
    final rawSents = json['sentences'] as List<dynamic>? ?? [];
    return ReadAlongParagraph(
      paragraphId: json['paragraph_id'] as String? ?? '',
      paragraphNum: json['paragraph_num'] as String?,
      text: json['text'] as String? ?? '',
      startMs: json['start_ms'] as int?,
      endMs: json['end_ms'] as int?,
      sentences: rawSents.map((s) => ReadAlongSentence.fromJson(s as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'paragraph_id': paragraphId,
    'paragraph_num': paragraphNum,
    'text': text,
    'start_ms': startMs,
    'end_ms': endMs,
    'sentences': sentences.map((s) => s.toJson()).toList(),
  };
}

class ReadAlongChapter {
  final String chapterId;
  final int chapterIndex;
  final String title;
  final String? titleUrdu;
  final List<ReadAlongParagraph> paragraphs;

  ReadAlongChapter({
    required this.chapterId,
    required this.chapterIndex,
    required this.title,
    this.titleUrdu,
    required this.paragraphs,
  });

  factory ReadAlongChapter.fromJson(Map<String, dynamic> json) {
    final rawParas = json['paragraphs'] as List<dynamic>? ?? [];
    return ReadAlongChapter(
      chapterId: json['chapter_id'] as String? ?? '',
      chapterIndex: json['chapter_index'] as int? ?? 1,
      title: json['title'] as String? ?? '',
      titleUrdu: json['title_urdu'] as String?,
      paragraphs: rawParas.map((p) => ReadAlongParagraph.fromJson(p as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'chapter_id': chapterId,
    'chapter_index': chapterIndex,
    'title': title,
    'title_urdu': titleUrdu,
    'paragraphs': paragraphs.map((p) => p.toJson()).toList(),
  };
}

class ReadAlongSection {
  final String sectionId;
  final int chapterNum;
  final String title;
  final String? titleUrdu;
  final int durationMs;
  final String? audioFilename;
  final List<ReadAlongChapter> chapters;

  ReadAlongSection({
    required this.sectionId,
    required this.chapterNum,
    required this.title,
    this.titleUrdu,
    required this.durationMs,
    this.audioFilename,
    required this.chapters,
  });

  factory ReadAlongSection.fromJson(Map<String, dynamic> json) {
    final rawChapters = json['chapters'] as List<dynamic>? ?? [];
    return ReadAlongSection(
      sectionId: json['section_id'] as String? ?? '',
      chapterNum: json['chapter_num'] as int? ?? 1,
      title: json['title'] as String? ?? '',
      titleUrdu: json['title_urdu'] as String?,
      durationMs: json['duration_ms'] as int? ?? 0,
      audioFilename: json['audio_filename'] as String?,
      chapters: rawChapters.map((c) => ReadAlongChapter.fromJson(c as Map<String, dynamic>)).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'section_id': sectionId,
    'chapter_num': chapterNum,
    'title': title,
    'title_urdu': titleUrdu,
    'duration_ms': durationMs,
    'audio_filename': audioFilename,
    'chapters': chapters.map((c) => c.toJson()).toList(),
  };
}

class ReadAlongDocument {
  final String schemaVersion;
  final String bookId;
  final String title;
  final String? titleUrdu;
  final String author;
  final String? authorUrdu;
  final String? translator;
  final String? sourceEdition;
  final String? narrator;
  final String language;
  final TextDirection textDirection;
  final ReadAlongSection section;

  ReadAlongDocument({
    required this.schemaVersion,
    required this.bookId,
    required this.title,
    this.titleUrdu,
    required this.author,
    this.authorUrdu,
    this.translator,
    this.sourceEdition,
    this.narrator,
    required this.language,
    required this.textDirection,
    required this.section,
  });

  factory ReadAlongDocument.fromJson(Map<String, dynamic> json) {
    final dirStr = json['text_direction'] as String? ?? 'ltr';
    final textDir = dirStr.toLowerCase() == 'rtl' ? TextDirection.rtl : TextDirection.ltr;
    final sectionMap = json['section'] as Map<String, dynamic>? ?? {};

    return ReadAlongDocument(
      schemaVersion: json['schema_version'] as String? ?? '1.0.0',
      bookId: json['book_id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      titleUrdu: json['title_urdu'] as String?,
      author: json['author'] as String? ?? '',
      authorUrdu: json['author_urdu'] as String?,
      translator: json['translator'] as String?,
      sourceEdition: json['source_edition'] as String?,
      narrator: json['narrator'] as String?,
      language: json['language'] as String? ?? 'en',
      textDirection: textDir,
      section: ReadAlongSection.fromJson(sectionMap),
    );
  }

  Map<String, dynamic> toJson() => {
    'schema_version': schemaVersion,
    'book_id': bookId,
    'title': title,
    'title_urdu': titleUrdu,
    'author': author,
    'author_urdu': authorUrdu,
    'translator': translator,
    'source_edition': sourceEdition,
    'narrator': narrator,
    'language': language,
    'text_direction': textDirection == TextDirection.rtl ? 'rtl' : 'ltr',
    'section': section.toJson(),
  };
}
