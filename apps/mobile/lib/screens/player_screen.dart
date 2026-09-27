import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/audio_player_service.dart';
import '../services/bookmark_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/book_cover.dart';
import '../widgets/common_components.dart';
import '../widgets/part_chapter_widgets.dart';
import 'read_along_screen.dart';

class PlayerScreen extends StatefulWidget {
  final Book book;
  final ChapterItem chapter;

  const PlayerScreen({super.key, required this.book, required this.chapter});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  double? _dragValue;
  double _currentSpeed = 1.0;

  void _openReadAlong(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ReadAlongScreen(
          book: widget.book,
          chapter: widget.chapter,
        ),
      ),
    );
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = d.inHours;
    if (hours > 0) {
      return '$hours:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  void _showSettingsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return PlayerSettingsSheet(
          currentSpeed: _currentSpeed,
          onSpeedChanged: (spd) {
            setState(() {
              _currentSpeed = spd;
            });
            context.read<AudioPlayerService>().player.setSpeed(spd);
          },
        );
      },
    );
  }

  void _showChaptersSheet() {
    final isPart1 = widget.chapter.chapterNum == 1;
    final textChapters = isPart1 ? kPart1TextualChapters : kPart2TextualChapters;
    final playerService = context.read<AudioPlayerService>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.75,
          ),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkPlayerCard : AppColors.surfaceWhite,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 20,
                offset: Offset(0, -4),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 5,
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkBorder : AppColors.borderLight,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Chapters in ${widget.chapter.title}',
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap any chapter to jump directly to its audio bookmark.',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: textChapters.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 8),
                      itemBuilder: (ctx, index) {
                        final ch = textChapters[index];
                        return InkWell(
                          onTap: () {
                            playerService.seek(Duration(milliseconds: ch.startOffsetMs));
                            Navigator.pop(ctx);
                          },
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isDark ? AppColors.darkBorder : AppColors.borderLight,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                                    ),
                                  ),
                                  child: Center(
                                    child: Text(
                                      '${ch.chapterIndex}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        ch.title,
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                                        ),
                                      ),
                                      if (ch.titleUrdu != null) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          ch.titleUrdu!,
                                          style: const TextStyle(
                                            fontFamily: 'sans-serif',
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: AppColors.emeraldSoft,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: isDark ? AppColors.darkCard : AppColors.surfaceWhite,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: isDark ? AppColors.darkBorder : AppColors.borderLight,
                                    ),
                                  ),
                                  child: Text(
                                    '${(ch.startOffsetMs / 1000 / 60).toStringAsFixed(1)}m',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final playerService = context.watch<AudioPlayerService>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isThisChapterActive = playerService.currentToken?.chapterId == widget.chapter.id;
    final isPlaying = isThisChapterActive && playerService.isPlaying;
    final isLoading = !isThisChapterActive || playerService.isLoading;

    final startMs = isThisChapterActive
        ? (playerService.currentToken?.startMs ?? widget.chapter.startMs)
        : widget.chapter.startMs;
    final totalDurationMs = widget.chapter.durationMs > 0
        ? widget.chapter.durationMs
        : (playerService.duration.inMilliseconds > startMs
            ? playerService.duration.inMilliseconds - startMs
            : playerService.duration.inMilliseconds);

    final currentPositionMs = isThisChapterActive ? playerService.position.inMilliseconds : startMs;
    final chapterElapsedMs = (currentPositionMs - startMs).clamp(0, totalDurationMs);

    final progressRatio = totalDurationMs > 0
        ? (chapterElapsedMs / totalDurationMs).clamp(0.0, 1.0)
        : 0.0;

    final currentSliderVal = (_dragValue ?? progressRatio).clamp(0.0, 1.0);
    final displayedPosition = _dragValue != null
        ? Duration(milliseconds: (_dragValue! * totalDurationMs).round())
        : Duration(milliseconds: chapterElapsedMs);
    final displayedDuration = Duration(milliseconds: totalDurationMs);
    final remainingDuration = displayedDuration > displayedPosition
        ? displayedDuration - displayedPosition
        : Duration.zero;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkPlayerBg : AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.keyboard_arrow_down_rounded,
            size: 30,
            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          children: [
            const Text(
              'PLAYING AUDIO SECTION',
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: AppColors.emeraldSoft),
            ),
            const SizedBox(height: 1),
            Text(
              widget.book.title,
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkGreenBg : AppColors.emerald.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isDark ? AppColors.darkGreenBorder : Colors.transparent,
                  ),
                ),
                child: Icon(
                  Icons.auto_stories_rounded,
                  size: 20,
                  color: isDark ? AppColors.darkGreenText : AppColors.emerald,
                ),
              ),
              tooltip: 'Read Along',
              onPressed: () => _openReadAlong(context),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const SizedBox(height: 8),

              // Centered Large Artwork
              Center(
                child: Hero(
                  tag: 'player-cover',
                  child: BookCover(
                    title: widget.book.title,
                    titleUrdu: widget.book.titleUrdu,
                    author: widget.book.author,
                    size: CoverSize.hero,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Section & Chapter Information
              Column(
                children: [
                  Text(
                    widget.chapter.title,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                      height: 1.25,
                    ),
                  ),
                  if (widget.chapter.titleUrdu != null && widget.chapter.titleUrdu!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      widget.chapter.titleUrdu!,
                      style: const TextStyle(
                        fontFamily: 'sans-serif',
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.emeraldSoft,
                      ),
                    ),
                  ],
                  const SizedBox(height: 6),
                  Text(
                    'Narrated by ${widget.book.narratorName}',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Progress Slider & Timestamps
              Column(
                children: [
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      thumbColor: isDark ? AppColors.darkEmerald : AppColors.emerald,
                      activeTrackColor: isDark ? AppColors.darkEmerald : AppColors.emerald,
                      inactiveTrackColor: isDark ? AppColors.darkBorder : AppColors.borderLight,
                      trackHeight: 4,
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                      overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                    ),
                    child: Slider(
                      value: currentSliderVal,
                      onChanged: (val) {
                        setState(() {
                          _dragValue = val;
                        });
                      },
                      onChangeEnd: (val) {
                        final targetChapterMs = (val * totalDurationMs).round();
                        final targetFileMs = startMs + targetChapterMs;
                        playerService.seek(Duration(milliseconds: targetFileMs));
                        setState(() {
                          _dragValue = null;
                        });
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _formatDuration(displayedPosition),
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          '-${_formatDuration(remainingDuration)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Primary Player Controls: Previous, -10s, Play/Pause, +10s, Next
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Previous
                  IconButton(
                    iconSize: 28,
                    icon: Icon(
                      Icons.skip_previous_rounded,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                    onPressed: () => playerService.seek(Duration(milliseconds: startMs)),
                  ),
                  const SizedBox(width: 8),

                  // 10s Skip Back
                  IconButton(
                    iconSize: 38,
                    icon: Icon(
                      Icons.replay_10_rounded,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                    ),
                    onPressed: () => playerService.seekRelative(-10),
                  ),
                  const SizedBox(width: 16),

                  // Play/Pause Emerald Circle
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: (isDark ? AppColors.darkEmerald : AppColors.emerald).withValues(alpha: 0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: IconButton(
                      iconSize: 42,
                      color: Colors.white,
                      icon: isLoading
                          ? const SizedBox(
                              width: 28,
                              height: 28,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 3),
                            )
                          : Icon(isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded),
                      onPressed: () {
                        if (isPlaying) {
                          playerService.pause();
                        } else {
                          playerService.play();
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 16),

                  // 10s Skip Forward
                  IconButton(
                    iconSize: 38,
                    icon: Icon(
                      Icons.forward_10_rounded,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                    ),
                    onPressed: () => playerService.seekRelative(10),
                  ),
                  const SizedBox(width: 8),

                  // Next
                  IconButton(
                    iconSize: 28,
                    icon: Icon(
                      Icons.skip_next_rounded,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                    onPressed: () => playerService.seekRelative(30),
                  ),
                ],
              ),

              // Secondary Controls Row (Bottom Sheet for settings, Chapters, Speed)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  TextButton(
                    onPressed: _showSettingsSheet,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    child: Text(
                      '${_currentSpeed}x',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.format_list_bulleted_rounded,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                    tooltip: 'Textual Chapters',
                    onPressed: _showChaptersSheet,
                  ),
                  IconButton(
                    icon: Icon(
                      Icons.bedtime_outlined,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                    tooltip: 'Sleep Timer',
                    onPressed: _showSettingsSheet,
                  ),
                  Consumer<BookmarkProvider>(
                    builder: (context, bookmarkProvider, _) {
                      final isSaved = bookmarkProvider.isBookmarked(widget.book.id);
                      return IconButton(
                        icon: Icon(
                          isSaved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                          color: isSaved
                              ? (isDark ? AppColors.darkEmerald : AppColors.emerald)
                              : (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                        ),
                        tooltip: isSaved ? 'Remove from Saved' : 'Save Book to Library',
                        onPressed: () async {
                          await bookmarkProvider.toggleBookmark(widget.book.id);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(isSaved ? 'Removed from Saved Library' : 'Saved to Your Library'),
                                duration: const Duration(seconds: 2),
                              ),
                            );
                          }
                        },
                      );
                    },
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
