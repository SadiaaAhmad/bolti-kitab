import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'book_cover.dart';

class BookCard extends StatelessWidget {
  final Book book;
  final VoidCallback onTap;

  const BookCard({
    super.key,
    required this.book,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final minutes = (book.durationSeconds / 60).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.darkCard : AppColors.surfaceCard;
    final cardBorder = isDark ? AppColors.darkBorder : AppColors.borderLight;
    final textPri = isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    final textMut = isDark ? AppColors.darkTextMuted : AppColors.textMuted;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: cardBorder, width: 1.2),
            boxShadow: const [
              BoxShadow(
                color: AppColors.shadowWarm,
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Cover
              BookCover(
                title: book.title,
                titleUrdu: book.titleUrdu,
                author: book.author,
                size: CoverSize.small,
              ),
              const SizedBox(width: 14),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      book.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'serif',
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: textPri,
                        height: 1.25,
                      ),
                    ),

                    if (book.titleUrdu.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        book.titleUrdu,
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
                      '${book.author} • Narrated by ${book.narratorName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodySmall.copyWith(color: textSec),
                    ),

                    const SizedBox(height: 10),
                    // Badges row
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        _Badge(
                          label: book.language.toUpperCase(),
                          bg: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                          fg: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                          border: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                        ),
                        _Badge(
                          label: '$minutes mins',
                          bg: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                          fg: textSec,
                          border: isDark ? AppColors.darkBorder : null,
                        ),
                        _Badge(
                          label: 'Free Preview',
                          bg: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                          fg: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                          border: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 4),
              Icon(
                Icons.chevron_right_rounded,
                color: textMut,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bespoke Editorial Spotlight Card for intentional single/featured book display
class BespokeSpotlightCard extends StatelessWidget {
  final Book book;
  final VoidCallback onTap;
  final VoidCallback onPlay;

  const BespokeSpotlightCard({
    super.key,
    required this.book,
    required this.onTap,
    required this.onPlay,
  });

  @override
  Widget build(BuildContext context) {
    final minutes = (book.durationSeconds / 60).round();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.darkCard : AppColors.surfaceCard;
    final cardBorder = isDark ? AppColors.darkBorder : AppColors.borderLight;
    final textPri = isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;
    final textSec = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;
    final textMut = isDark ? AppColors.darkTextMuted : AppColors.textMuted;
    final bannerColors = isDark
        ? [const Color(0xFF142421), const Color(0xFF19222C)]
        : [const Color(0xFFEAF4EE), const Color(0xFFF3F0EB)];

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: cardBorder, width: 1.2),
            boxShadow: const [
              BoxShadow(
                color: AppColors.shadowWarm,
                blurRadius: 16,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Hero cover presentation
              Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkSurface : AppColors.emeraldLight,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(21)),
                  gradient: LinearGradient(
                    colors: bannerColors,
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Decorative literary background rings
                    Positioned(
                      top: -40,
                      right: -30,
                      child: Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppColors.emeraldSoft.withValues(alpha: 0.08),
                        ),
                      ),
                    ),

                    // Centered Book Cover
                    Positioned(
                      bottom: 12,
                      child: Hero(
                        tag: 'spotlight-cover-${book.id}',
                        child: BookCover(
                          title: book.title,
                          titleUrdu: book.titleUrdu,
                          author: book.author,
                          size: CoverSize.medium,
                        ),
                      ),
                    ),

                    // Top badge
                    Positioned(
                      top: 14,
                      left: 16,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isDark ? AppColors.darkGreenBg : AppColors.castletonGreen,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                          ),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 13, color: AppColors.butterBg),
                            SizedBox(width: 4),
                            Text(
                              'COLLECTIBLE EDITION',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Details
              Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                book.title,
                                style: TextStyle(
                                  fontFamily: 'serif',
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: textPri,
                                  height: 1.2,
                                ),
                              ),
                              if (book.titleUrdu.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  book.titleUrdu,
                                  style: const TextStyle(
                                    fontFamily: 'sans-serif',
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.emeraldSoft,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        // Listen button
                        ElevatedButton.icon(
                          onPressed: onPlay,
                          icon: const Icon(Icons.play_arrow_rounded, size: 20),
                          label: const Text('Listen'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: isDark ? AppColors.darkGreenBg : AppColors.castletonGreen,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),
                    Text(
                      'By ${book.author} • Narrated by ${book.narratorName}',
                      style: AppTypography.bodySmall.copyWith(color: textSec),
                    ),

                    if (book.synopsis != null && book.synopsis!.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        book.synopsis!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          color: textSec,
                          height: 1.4,
                        ),
                      ),
                    ],

                    const SizedBox(height: 14),
                    Divider(height: 1, color: cardBorder),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        const Icon(Icons.headphones_rounded, size: 16, color: AppColors.darkEmerald),
                        const SizedBox(width: 6),
                        Text(
                          '2 Audio Sections • 13 Chapters',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.darkEmerald : AppColors.darkEmeraldDark,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '$minutes mins total',
                          style: AppTypography.caption.copyWith(color: textMut),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final String label;
  final Color bg;
  final Color fg;
  final Color? border;

  const _Badge({
    required this.label,
    required this.bg,
    required this.fg,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: border != null ? Border.all(color: border!, width: 1.0) : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

class SkeletonBookCard extends StatelessWidget {
  const SkeletonBookCard({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final skeletonBg = isDark ? AppColors.darkCard : AppColors.surfaceCard;
    final skeletonMuted = isDark ? AppColors.darkSurface : AppColors.surfaceMuted;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: skeletonBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.borderLight),
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 76,
            decoration: BoxDecoration(
              color: skeletonMuted,
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 160,
                  height: 16,
                  decoration: BoxDecoration(
                    color: skeletonMuted,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  width: 100,
                  height: 12,
                  decoration: BoxDecoration(
                    color: skeletonMuted,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
