import 'package:flutter/material.dart';
import '../models/models.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'book_cover.dart';

class ContinueListeningCard extends StatelessWidget {
  final Book book;
  final ListeningProgress progress;
  final VoidCallback onResume;

  const ContinueListeningCard({
    super.key,
    required this.book,
    required this.progress,
    required this.onResume,
  });

  @override
  Widget build(BuildContext context) {
    final totalSecs = book.durationSeconds > 0 ? book.durationSeconds : 1200;
    final percent = ((progress.positionMs / 1000) / totalSecs).clamp(0.0, 1.0);
    final String resumeText;
    if (progress.positionMs < 60000) {
      final s = (progress.positionMs / 1000).round();
      resumeText = s <= 5 ? 'Just started' : 'Resumes at ${s}s';
    } else {
      final playedMins = (progress.positionMs / 1000 / 60).toStringAsFixed(1);
      resumeText = 'Resumes at $playedMins mins';
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? AppColors.darkCard : AppColors.peachBg;
    final cardBorder = isDark ? AppColors.darkBorder : AppColors.peachBorder;
    final headerColor = isDark ? AppColors.darkEmerald : AppColors.peachText;
    final trackColor = isDark ? AppColors.darkSurface : AppColors.peachBorder;
    final titleColor = isDark ? AppColors.darkTextPrimary : AppColors.textPrimary;
    final subtitleColor = isDark ? AppColors.darkTextSecondary : AppColors.textSecondary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onResume,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: cardBorder, width: 1.2),
            boxShadow: isDark
                ? []
                : const [
                    BoxShadow(
                      color: AppColors.shadowWarm,
                      blurRadius: 10,
                      offset: Offset(0, 3),
                    ),
                  ],
          ),
          child: Row(
            children: [
              // Small cover
              BookCover(
                title: book.title,
                titleUrdu: book.titleUrdu,
                size: CoverSize.tiny,
              ),
              const SizedBox(width: 14),

              // Title and progress bar
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'CONTINUE LISTENING',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                            color: headerColor,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${(percent * 100).round()}%',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: headerColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      book.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'serif',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    // Progress indicator
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: percent,
                        minHeight: 5,
                        backgroundColor: trackColor,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          isDark ? AppColors.darkEmerald : AppColors.castletonGreen,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      resumeText,
                      style: AppTypography.caption.copyWith(color: subtitleColor),
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 12),

              // Play icon button
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkGreenBg : AppColors.castletonGreen,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isDark ? AppColors.darkGreenBorder : AppColors.castletonGreen,
                    width: 1.2,
                  ),
                  boxShadow: isDark
                      ? []
                      : const [
                          BoxShadow(
                            color: AppColors.shadowWarm,
                            blurRadius: 6,
                            offset: Offset(0, 2),
                          ),
                        ],
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  color: Colors.white,
                  size: 24,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
