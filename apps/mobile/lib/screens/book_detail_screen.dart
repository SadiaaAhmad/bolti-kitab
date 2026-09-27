import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../services/audio_player_service.dart';
import '../services/bookmark_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/book_cover.dart';
import '../widgets/part_chapter_widgets.dart';
import 'player_screen.dart';
import 'read_along_screen.dart';

class BookDetailScreen extends StatefulWidget {
  final Book book;

  const BookDetailScreen({super.key, required this.book});

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> {
  late Future<Map<String, dynamic>> _overviewFuture;
  bool _isNavigating = false;

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  void _loadOverview() {
    final token = context.read<AuthProvider>().token;
    if (token != null) {
      setState(() {
        _overviewFuture = ApiService.getPlaybackOverview(token, widget.book.id);
      });
    }
  }

  Future<void> _playChapter(ChapterItem chapter, int initialPosMs) async {
    if (_isNavigating) return;
    _isNavigating = true;

    final token = context.read<AuthProvider>().token;
    if (token == null) {
      _isNavigating = false;
      return;
    }

    final playerService = context.read<AudioPlayerService>();

    // Instant zero-lag navigation to PlayerScreen
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PlayerScreen(book: widget.book, chapter: chapter),
      ),
    ).then((_) {
      _isNavigating = false;
      if (mounted) _loadOverview();
    });

    try {
      final pbToken = await ApiService.getChapterPlaybackToken(
        token,
        widget.book.id,
        chapter.id,
      );

      await playerService.loadAndPlay(
        token: pbToken,
        bookId: widget.book.id,
        authToken: token,
        initialPositionMs: initialPosMs,
      );

      if (initialPosMs == 0) {
        await playerService.syncExplicitProgress(pbToken.startMs);
      }
    } catch (e) {
      if (mounted) {
        final errText = e.toString().replaceAll('Exception: ', '');
        final isAuthErr = errText.contains('expired') || errText.contains('Unauthorized');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isAuthErr ? 'Session expired. Please log in again.' : errText),
            backgroundColor: const Color(0xFFC53030),
          ),
        );
        if (isAuthErr) {
          context.read<AuthProvider>().logout();
          Navigator.pop(context);
        }
      }
    }
  }

  void _openReadAlong(ChapterItem chapter) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReadAlongScreen(
          book: widget.book,
          chapter: chapter,
        ),
      ),
    ).then((_) {
      if (mounted) _loadOverview();
    });
  }

  String _formatTime(int ms) {
    final totalSec = ms ~/ 1000;
    final m = totalSec ~/ 60;
    final s = totalSec % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final totalMinutes = (widget.book.durationSeconds / 60).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_rounded,
            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          Consumer<BookmarkProvider>(
            builder: (context, bookmarkProvider, _) {
              final isSaved = bookmarkProvider.isBookmarked(widget.book.id);
              return IconButton(
                icon: Icon(
                  isSaved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                  color: isSaved
                      ? (isDark ? AppColors.darkEmerald : AppColors.emerald)
                      : (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary),
                ),
                tooltip: isSaved ? 'Remove from Saved' : 'Save Book to Library',
                onPressed: () async {
                  await bookmarkProvider.toggleBookmark(widget.book.id);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(isSaved ? 'Removed from Saved Library' : 'Added to Saved in Your Library'),
                        duration: const Duration(seconds: 2),
                      ),
                    );
                  }
                },
              );
            },
          ),
          IconButton(
            icon: Icon(
              Icons.share_outlined,
              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
            ),
            onPressed: () {},
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _overviewFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.emerald),
            );
          }

          if (snapshot.hasError) {
            final isExpired = snapshot.error.toString().contains('Token has expired');
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Failed to load book: ${snapshot.error}', textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () {
                        if (isExpired) {
                          context.read<AuthProvider>().logout();
                          Navigator.pop(context);
                        } else {
                          _loadOverview();
                        }
                      },
                      child: Text(isExpired ? 'Log In Again' : 'Retry'),
                    ),
                  ],
                ),
              ),
            );
          }

          final data = snapshot.data!;
          final chaptersRaw = data['chapters'] as List<dynamic>? ?? [];
          final chapters = chaptersRaw.map((c) => ChapterItem.fromJson(c as Map<String, dynamic>)).toList();
          final progressRaw = data['progress'] as Map<String, dynamic>?;
          final progress = progressRaw != null ? ListeningProgress.fromJson(progressRaw) : null;

          final playerService = context.watch<AudioPlayerService>();
          final currentPlayingChapterId = playerService.currentToken?.chapterId;

          final part1 = chapters.firstWhere(
            (c) => c.chapterNum == 1,
            orElse: () => ChapterItem(
              id: 'part-1-default',
              chapterNum: 1,
              title: 'Part 1: Laying Plans & Waging War',
              titleUrdu: 'حصہ اول: منصوبہ بندی اور جنگ',
              durationMs: 1219301,
              isPreviewFree: true,
              isApproved: true,
            ),
          );

          // Part 2 verification: check if approved in DB
          final part2InDb = chapters.where((c) => c.chapterNum == 2).firstOrNull;
          final isPart2Playable = part2InDb != null && part2InDb.isApproved;

          final part2 = part2InDb ??
              ChapterItem(
                id: 'part-2-default',
                chapterNum: 2,
                title: 'Part 2: The Army on the March & Terrain',
                titleUrdu: 'حصہ دوم: فوج کی پیش قدمی اور میدانِ جنگ',
                durationMs: 1142874,
                isPreviewFree: false,
                isApproved: false, // Locked until verified
              );

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            children: [
              // Large Cover Artwork at Top
              Center(
                child: Hero(
                  tag: 'book-cover-${widget.book.id}',
                  child: BookCover(
                    title: widget.book.title,
                    titleUrdu: widget.book.titleUrdu,
                    author: widget.book.author,
                    size: CoverSize.large,
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Title
              Text(
                widget.book.title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                  height: 1.25,
                ),
              ),

              // Urdu Title (first-class bilingual layout)
              if (widget.book.titleUrdu.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  widget.book.titleUrdu,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                  ),
                ),
              ],
              const SizedBox(height: 10),

              // Author & Narrator
              Text(
                'By ${widget.book.author}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Narrated by ${widget.book.narratorName}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 14),

              // Metadata pills row (Wrap prevents any overflow on narrow screens / font scaling)
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _MetadataPill(
                    icon: Icons.language_rounded,
                    label: widget.book.language.toUpperCase(),
                  ),
                  _MetadataPill(
                    icon: Icons.schedule_rounded,
                    label: '$totalMinutes mins',
                  ),
                  const _MetadataPill(
                    icon: Icons.check_circle_outline_rounded,
                    label: '2 Audio Sections',
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Primary Action: Listen / Resume and Read Along
              // Both buttons are flex-expanded so they never overflow
              Builder(
                builder: (context) {
                  final hasSavedProgress = progress != null && progress.positionMs > 15000;
                  return Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: SizedBox(
                              height: 52,
                              child: ElevatedButton.icon(
                                onPressed: () {
                                  if (hasSavedProgress) {
                                    final target = chapters.firstWhere(
                                      (c) => c.id == progress.chapterId,
                                      orElse: () => part1,
                                    );
                                    _playChapter(target, progress.positionMs);
                                  } else {
                                    _playChapter(part1, 0);
                                  }
                                },
                                icon: const Icon(Icons.play_arrow_rounded, size: 22),
                                label: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    hasSavedProgress
                                        ? 'Resume • ${_formatTime(progress.positionMs)}'
                                        : 'Listen Now',
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: isDark ? AppColors.darkGreenBg : AppColors.castletonGreen,
                                  foregroundColor: isDark ? AppColors.darkGreenText : Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          // Read Along direct action
                          Expanded(
                            flex: 2,
                            child: SizedBox(
                              height: 52,
                              child: OutlinedButton.icon(
                                onPressed: () => _openReadAlong(part1),
                                icon: Icon(
                                  Icons.auto_stories_rounded,
                                  size: 18,
                                  color: isDark ? AppColors.darkEmerald : AppColors.castletonGreen,
                                ),
                                label: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    'Read Along',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: isDark ? AppColors.darkEmerald : AppColors.castletonGreen,
                                    ),
                                  ),
                                ),
                                style: OutlinedButton.styleFrom(
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  side: BorderSide(
                                    color: isDark ? AppColors.darkEmerald : AppColors.castletonGreen,
                                    width: 1.5,
                                  ),
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (hasSavedProgress) ...[
                        const SizedBox(height: 10),
                        Center(
                          child: TextButton.icon(
                            onPressed: () => _playChapter(part1, 0),
                            icon: Icon(
                              Icons.replay_rounded,
                              size: 16,
                              color: isDark ? AppColors.darkEmerald : AppColors.castletonGreen,
                            ),
                            label: Text(
                              'Start from Beginning (0:00)',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isDark ? AppColors.darkEmerald : AppColors.castletonGreen,
                              ),
                            ),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                            ),
                          ),
                        ),
                      ],
                    ],
                  );
                },
              ),
              const SizedBox(height: 24),

              // Synopsis
              if (widget.book.synopsis != null && widget.book.synopsis!.isNotEmpty) ...[
                Text(
                  'About this Book',
                  style: TextStyle(
                    fontFamily: 'serif',
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  widget.book.synopsis!,
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // "Parts & Chapters" Section
              // CRUCIAL: Natural distinction between Audio Sections and Textual Chapters!
              Text(
                'Parts & Chapters',
                style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'The audiobook is recorded in two sections, containing all 13 textual chapters.',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 14),

              // PART 1 (Audio Section 1 - Playable Free Preview with Chapters 1 to 5)
              AudioSectionCard(
                section: part1,
                isPlayable: true,
                isCurrentlyPlaying: currentPlayingChapterId == part1.id,
                onPlay: () => _playChapter(part1, 0),
                onSelectTextChapter: (offsetMs) => _playChapter(part1, offsetMs),
                onOpenReadAlong: () => _openReadAlong(part1),
              ),

              // PART 2 (Audio Section 2 - Playable ONLY if audio exists in storage!)
              AudioSectionCard(
                section: part2,
                isPlayable: isPart2Playable,
                isCurrentlyPlaying: currentPlayingChapterId == part2.id,
                onPlay: isPart2Playable ? () => _playChapter(part2, 0) : null,
                onSelectTextChapter: isPart2Playable ? (offsetMs) => _playChapter(part2, offsetMs) : null,
                onOpenReadAlong: () => _openReadAlong(part2),
              ),

              const SizedBox(height: 80),
            ],
          );
        },
      ),
    );
  }
}

class _MetadataPill extends StatelessWidget {
  final IconData icon;
  final String label;

  const _MetadataPill({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.borderLight),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
