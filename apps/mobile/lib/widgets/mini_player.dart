import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/audio_player_service.dart';
import '../theme/app_colors.dart';
import '../screens/player_screen.dart';
import 'book_cover.dart';

class MiniPlayer extends StatelessWidget {
  final Book? book;

  const MiniPlayer({super.key, this.book});

  @override
  Widget build(BuildContext context) {
    final playerService = context.watch<AudioPlayerService>();
    final token = playerService.currentToken;

    // Only show when audio is loaded
    if (token == null) {
      return const SizedBox.shrink();
    }

    final isPlaying = playerService.isPlaying;
    final pos = playerService.position;
    final dur = playerService.duration;
    final progress = dur.inMilliseconds > 0
        ? (pos.inMilliseconds / dur.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    final currentBook = book ??
        Book(
          id: token.bookId,
          title: token.title,
          titleUrdu: token.titleUrdu ?? '',
          author: 'Sun Tzu',
          narratorName: 'Bob Neufeld',
          language: 'en',
          durationSeconds: token.durationMs ~/ 1000,
          priceCents: 0,
          status: 'active',
        );

    final currentChapter = ChapterItem(
      id: token.chapterId,
      chapterNum: token.chapterNum,
      title: token.title,
      titleUrdu: token.titleUrdu,
      startMs: token.startMs,
      durationMs: token.durationMs,
      isPreviewFree: true,
      isApproved: true,
    );

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.darkPlayerCard : AppColors.surfaceCard;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.emeraldSoft.withValues(alpha: 0.25),
          width: 1.2,
        ),
        boxShadow: isDark
            ? []
            : const [
                BoxShadow(
                  color: AppColors.shadowElevated,
                  blurRadius: 18,
                  offset: Offset(0, 6),
                ),
              ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => PlayerScreen(
                  book: currentBook,
                  chapter: currentChapter,
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    // Mini artwork
                    Hero(
                      tag: 'mini-player-cover',
                      child: BookCover(
                        title: currentBook.title,
                        size: CoverSize.tiny,
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Title & Section
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            token.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'serif',
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            currentBook.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: AppColors.emeraldSoft,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Play/pause button
                    IconButton(
                      icon: playerService.isLoading
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                              ),
                            )
                          : Icon(
                              isPlaying
                                  ? Icons.pause_circle_filled_rounded
                                  : Icons.play_circle_fill_rounded,
                              color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                              size: 34,
                            ),
                      onPressed: () {
                        if (isPlaying) {
                          playerService.pause();
                        } else {
                          playerService.play();
                        }
                      },
                    ),
                  ],
                ),
              ),

              // Tiny progress line
              ClipRRect(
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(16)),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 2.5,
                  backgroundColor: isDark ? AppColors.darkBorder : AppColors.emeraldLight,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isDark ? AppColors.darkEmerald : AppColors.emerald,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
