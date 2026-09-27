import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Bolti Kitab Typography
/// Literary display serif for hero headers & major titles.
/// Crisp, legible sans-serif for UI labels, metadata & buttons.
/// Genuine RTL Urdu typography support.
class AppTypography {
  AppTypography._();

  // Literary Serif Display (for book titles, hero headings)
  static const TextStyle displayLarge = TextStyle(
    fontFamily: 'serif',
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    color: AppColors.textPrimary,
    height: 1.25,
  );

  static const TextStyle displayMedium = TextStyle(
    fontFamily: 'serif',
    fontSize: 22,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
    color: AppColors.textPrimary,
    height: 1.3,
  );

  static const TextStyle displaySmall = TextStyle(
    fontFamily: 'serif',
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    height: 1.35,
  );

  // UI Headings & Section Titles
  static const TextStyle sectionTitle = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
    color: AppColors.textPrimary,
  );

  static const TextStyle sectionSubtitle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  // Body Text
  static const TextStyle bodyLarge = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
    height: 1.55,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
    height: 1.5,
  );

  static const TextStyle bodySmall = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textMuted,
    height: 1.4,
  );

  // UI Labels, Buttons & Badges
  static const TextStyle button = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.2,
  );

  static const TextStyle badge = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.3,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.textMuted,
  );

  // First-Class Urdu Typography
  static const TextStyle urduTitleLarge = TextStyle(
    fontFamily: 'sans-serif',
    fontSize: 22,
    fontWeight: FontWeight.w700,
    color: AppColors.emerald,
    height: 1.7,
  );

  static const TextStyle urduTitleMedium = TextStyle(
    fontFamily: 'sans-serif',
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppColors.emeraldSoft,
    height: 1.65,
  );

  static const TextStyle urduBody = TextStyle(
    fontFamily: 'sans-serif',
    fontSize: 15,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
    height: 1.8,
  );

  // Read Along Digital Book Surface Typography
  static TextStyle readAlongSentence({required bool isHighlighted, double fontSize = 17}) {
    return TextStyle(
      fontSize: fontSize,
      fontWeight: isHighlighted ? FontWeight.w600 : FontWeight.w400,
      color: isHighlighted ? AppColors.highlightText : AppColors.textPrimary,
      height: 1.65,
      letterSpacing: 0.15,
    );
  }
}
