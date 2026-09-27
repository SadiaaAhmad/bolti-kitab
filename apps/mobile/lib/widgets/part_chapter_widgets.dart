import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';

/// Textual chapter descriptor inside an audio section
class TextChapterInfo {
  final int chapterIndex;
  final String title;
  final String? titleUrdu;
  final int startOffsetMs;

  const TextChapterInfo({
    required this.chapterIndex,
    required this.title,
    this.titleUrdu,
    required this.startOffsetMs,
  });
}

/// Static map of textual chapters inside Sun Tzu's 2 audio sections
final List<TextChapterInfo> kPart1TextualChapters = [
  const TextChapterInfo(
    chapterIndex: 1,
    title: 'Chapter 1 — Laying Plans',
    titleUrdu: 'حصہ اول: منصوبہ بندی',
    startOffsetMs: 23200,
  ),
  const TextChapterInfo(
    chapterIndex: 2,
    title: 'Chapter 2 — Waging War',
    titleUrdu: 'حصہ دوم: جنگ چھیڑنا',
    startOffsetMs: 256000,
  ),
  const TextChapterInfo(
    chapterIndex: 3,
    title: 'Chapter 3 — Attack by Stratagem',
    titleUrdu: 'حصہ سوم: حکمتِ عملی سے حملہ',
    startOffsetMs: 489000,
  ),
  const TextChapterInfo(
    chapterIndex: 4,
    title: 'Chapter 4 — Tactical Dispositions',
    titleUrdu: 'حصہ چہارم: جنگی صف بندی',
    startOffsetMs: 760000,
  ),
  const TextChapterInfo(
    chapterIndex: 5,
    title: 'Chapter 5 — Energy',
    titleUrdu: 'حصہ پنجم: قوت اور تحریک',
    startOffsetMs: 980000,
  ),
];

final List<TextChapterInfo> kPart2TextualChapters = [
  const TextChapterInfo(
    chapterIndex: 9,
    title: 'Chapter 9 — The Army on the March',
    titleUrdu: 'حصہ نہم: فوج کی پیش قدمی',
    startOffsetMs: 10900,
  ),
  const TextChapterInfo(
    chapterIndex: 10,
    title: 'Chapter 10 — Terrain',
    titleUrdu: 'حصہ دہم: میدانِ جنگ اور زمین',
    startOffsetMs: 340000,
  ),
  const TextChapterInfo(
    chapterIndex: 11,
    title: 'Chapter 11 — The Nine Situations',
    titleUrdu: 'حصہ یازدہم: نو مختلف حالات',
    startOffsetMs: 650000,
  ),
];

class AudioSectionCard extends StatefulWidget {
  final ChapterItem section;
  final bool isPlayable;
  final bool isCurrentlyPlaying;
  final VoidCallback? onPlay;
  final void Function(int offsetMs)? onSelectTextChapter;
  final VoidCallback? onOpenReadAlong;

  const AudioSectionCard({
    super.key,
    required this.section,
    required this.isPlayable,
    this.isCurrentlyPlaying = false,
    this.onPlay,
    this.onSelectTextChapter,
    this.onOpenReadAlong,
  });

  @override
  State<AudioSectionCard> createState() => _AudioSectionCardState();
}

class _AudioSectionCardState extends State<AudioSectionCard> {
  bool _isExpanded = true;

  @override
  Widget build(BuildContext context) {
    final minutes = (widget.section.durationMs / 1000 / 60).round();
    final isPart1 = widget.section.chapterNum == 1;
    final textChapters = isPart1 ? kPart1TextualChapters : kPart2TextualChapters;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.darkCard : AppColors.surfaceCard;
    final borderColor = widget.isCurrentlyPlaying
        ? AppColors.emeraldSoft
        : (isDark ? AppColors.darkBorder : AppColors.borderLight);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: borderColor,
          width: widget.isCurrentlyPlaying ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: widget.isCurrentlyPlaying
                ? AppColors.emerald.withValues(alpha: 0.08)
                : AppColors.shadowWarm,
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Audio Section Header
          InkWell(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Audio section badge
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: widget.isPlayable
                          ? (isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight)
                          : (isDark ? AppColors.darkSurface : AppColors.surfaceMuted),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: widget.isPlayable
                            ? (isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight)
                            : (isDark ? AppColors.darkBorder : AppColors.borderLight),
                      ),
                    ),
                    child: Center(
                      child: Icon(
                        widget.isPlayable
                            ? Icons.headphones_rounded
                            : Icons.lock_outline_rounded,
                        color: widget.isPlayable
                            ? (isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight)
                            : (isDark ? AppColors.darkTextMuted : AppColors.textMuted),
                        size: 22,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),

                  // Section Title and Metadata
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.section.title,
                          style: TextStyle(
                            fontFamily: 'serif',
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                            height: 1.25,
                          ),
                        ),
                        if (widget.section.titleUrdu != null &&
                            widget.section.titleUrdu!.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            widget.section.titleUrdu!,
                            style: const TextStyle(
                              fontFamily: 'sans-serif',
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.emeraldSoft,
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            Text(
                              '$minutes mins',
                              style: AppTypography.caption.copyWith(
                                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                              ),
                            ),
                            Text(
                              '•',
                              style: TextStyle(color: isDark ? AppColors.darkBorder : AppColors.borderLight),
                            ),
                            if (widget.isPlayable)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                                  ),
                                ),
                                child: Text(
                                  widget.section.isPreviewFree ? 'Free Preview' : 'Audio Ready',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                                  ),
                                ),
                              )
                            else
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'Audio in production',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Play Button (ONLY when playable!)
                  if (widget.isPlayable)
                    IconButton.filled(
                      onPressed: widget.onPlay,
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.emerald,
                        foregroundColor: Colors.white,
                      ),
                      icon: Icon(
                        widget.isCurrentlyPlaying
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        size: 24,
                      ),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.borderLight),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.lock_rounded,
                              size: 14,
                              color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Locked',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Nested Textual Chapters (The 13 chapters naturally nested inside)
          if (_isExpanded) ...[
            Divider(height: 1, color: isDark ? AppColors.darkBorder : AppColors.borderLight),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.paperLight,
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(18)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.menu_book_rounded, size: 14, color: AppColors.emeraldSoft),
                      const SizedBox(width: 6),
                      const Expanded(
                        child: Text(
                          'CHAPTERS IN THIS SECTION',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.4,
                            color: AppColors.emeraldSoft,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (widget.onOpenReadAlong != null)
                        InkWell(
                          onTap: widget.onOpenReadAlong,
                          child: const Row(
                            children: [
                              Text(
                                'Read Along',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.emerald,
                                ),
                              ),
                              SizedBox(width: 2),
                              Icon(Icons.arrow_forward_rounded, size: 13, color: AppColors.emerald),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // Chapters tree rows
                  ...textChapters.map((ch) {
                    final isLast = ch == textChapters.last;
                    final prefix = isLast ? '└  ' : '├  ';

                    return InkWell(
                      onTap: widget.isPlayable && widget.onSelectTextChapter != null
                          ? () => widget.onSelectTextChapter!(ch.startOffsetMs)
                          : null,
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                        child: Row(
                          children: [
                            Text(
                              prefix,
                              style: TextStyle(
                                fontFamily: 'monospace',
                                color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                ch.title,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: widget.isPlayable
                                      ? (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary)
                                      : (isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
                                ),
                              ),
                            ),
                            if (widget.isPlayable)
                              Text(
                                '${(ch.startOffsetMs / 1000 / 60).toStringAsFixed(1)}m',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
