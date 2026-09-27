class Book {
  final String id;
  final String title;
  final String titleUrdu;
  final String author;
  final String narratorName;
  final String? synopsis;
  final String language;
  final int durationSeconds;
  final int priceCents;
  final String status;
  final String? coverObjectKey;

  Book({
    required this.id,
    required this.title,
    required this.titleUrdu,
    required this.author,
    required this.narratorName,
    this.synopsis,
    required this.language,
    required this.durationSeconds,
    required this.priceCents,
    required this.status,
    this.coverObjectKey,
  });

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: json['id'] as String,
      title: json['title'] as String,
      titleUrdu: json['title_urdu'] as String? ?? '',
      author: json['author'] as String,
      narratorName: json['narrator_name'] as String,
      synopsis: json['synopsis'] as String?,
      language: json['language'] as String? ?? 'ur',
      durationSeconds: json['duration_seconds'] as int? ?? 0,
      priceCents: json['price_cents'] as int? ?? 0,
      status: json['status'] as String? ?? 'active',
      coverObjectKey: json['cover_object_key'] as String?,
    );
  }
}

class ChapterItem {
  final String id;
  final int chapterNum;
  final String title;
  final String? titleUrdu;
  final int startMs;
  final int durationMs;
  final bool isPreviewFree;
  final bool isApproved;

  ChapterItem({
    required this.id,
    required this.chapterNum,
    required this.title,
    this.titleUrdu,
    this.startMs = 0,
    required this.durationMs,
    required this.isPreviewFree,
    required this.isApproved,
  });

  factory ChapterItem.fromJson(Map<String, dynamic> json) {
    return ChapterItem(
      id: json['id'] as String,
      chapterNum: json['chapter_num'] as int,
      title: json['title'] as String,
      titleUrdu: json['title_urdu'] as String?,
      startMs: json['start_ms'] as int? ?? 0,
      durationMs: json['duration_ms'] as int? ?? 0,
      isPreviewFree: json['is_preview_free'] as bool? ?? false,
      isApproved: json['is_approved'] as bool? ?? true,
    );
  }
}

class PlaybackToken {
  final String bookId;
  final String chapterId;
  final int chapterNum;
  final String title;
  final String? titleUrdu;
  final int startMs;
  final int durationMs;
  final String playbackUrl;
  final String expiresAt;
  final String format;

  PlaybackToken({
    required this.bookId,
    required this.chapterId,
    required this.chapterNum,
    required this.title,
    this.titleUrdu,
    this.startMs = 0,
    required this.durationMs,
    required this.playbackUrl,
    required this.expiresAt,
    required this.format,
  });

  factory PlaybackToken.fromJson(Map<String, dynamic> json) {
    return PlaybackToken(
      bookId: json['book_id'] as String,
      chapterId: json['chapter_id'] as String,
      chapterNum: json['chapter_num'] as int,
      title: json['title'] as String,
      titleUrdu: json['title_urdu'] as String?,
      startMs: json['start_ms'] as int? ?? 0,
      durationMs: json['duration_ms'] as int,
      playbackUrl: json['playback_url'] as String,
      expiresAt: json['expires_at'] as String,
      format: json['format'] as String? ?? 'audio/mpeg',
    );
  }
}

class ListeningProgress {
  final String userId;
  final String bookId;
  final String chapterId;
  final int positionMs;
  final int updateSeq;
  final bool isCompleted;

  ListeningProgress({
    required this.userId,
    required this.bookId,
    required this.chapterId,
    required this.positionMs,
    required this.updateSeq,
    required this.isCompleted,
  });

  factory ListeningProgress.fromJson(Map<String, dynamic> json) {
    return ListeningProgress(
      userId: json['user_id'] as String,
      bookId: json['book_id'] as String,
      chapterId: json['chapter_id'] as String,
      positionMs: json['position_ms'] as int,
      updateSeq: json['update_seq'] as int? ?? 1,
      isCompleted: json['is_completed'] as bool? ?? false,
    );
  }
}
