import 'package:flutter/material.dart';

/// Bolti Kitab Color System
/// "a tiny beautiful place where stories live."
/// Warm ivory/book-paper cream base, deep charcoal/plum text,
/// restrained emerald signature accent, and soft supporting pastels.
class AppColors {
  AppColors._();

  // Primary base backgrounds
  static const Color warmIvory = Color(0xFFFAF7F2);
  static const Color bookPaper = Color(0xFFFBF9F5);
  static const Color paperLight = Color(0xFFFFFDF9);
  static const Color paperDark = Color(0xFFF3ECE2);
  static const Color surfaceWhite = Color(0xFFFFFFFF);
  static const Color surfaceCard = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF6F2EC);

  // Text hierarchy (deep charcoal / deep plum, never harsh black)
  static const Color textPrimary = Color(0xFF23272F);
  static const Color textPlum = Color(0xFF2C2434);
  static const Color textSecondary = Color(0xFF655F6E);
  static const Color textMuted = Color(0xFF9891A2);
  static const Color textLight = Color(0xFFB5AFBF);
  static const Color textInverse = Color(0xFFFAF7F2);

  // Signature Bolti Kitab Emerald
  static const Color emerald = Color(0xFF1B4D3E);
  static const Color emeraldSoft = Color(0xFF2E7D5E);
  static const Color emeraldLight = Color(0xFFE9F3EE);
  static const Color emeraldMuted = Color(0xFF5B9B82);
  static const Color emeraldAccent = Color(0xFF10B981);

  // Soft supporting pastels (calm, literary - use one dominant accent per screen)
  // Sage
  static const Color sageBg = Color(0xFFEEF4EE);
  static const Color sageBorder = Color(0xFFD6E6D7);
  static const Color sageText = Color(0xFF385E42);

  // Lavender
  static const Color lavenderBg = Color(0xFFF3F0F9);
  static const Color lavenderBorder = Color(0xFFE0D8F1);
  static const Color lavenderText = Color(0xFF5A4974);

  // Muted Peach
  static const Color peachBg = Color(0xFFFDF0EA);
  static const Color peachBorder = Color(0xFFF8DCcf);
  static const Color peachText = Color(0xFF8A533E);

  // Powder Blue
  static const Color blueBg = Color(0xFFEDF3F8);
  static const Color blueBorder = Color(0xFFD3E3F0);
  static const Color blueText = Color(0xFF3B5E7A);

  // Butter Yellow
  static const Color butterBg = Color(0xFFFAF7E6);
  static const Color butterBorder = Color(0xFFF3EDBF);
  static const Color butterText = Color(0xFF756A2C);

  // Dusty Rose
  static const Color roseBg = Color(0xFFF9EBEF);
  static const Color roseBorder = Color(0xFFF3D2DC);
  static const Color roseText = Color(0xFF7F3B52);

  // UI Borders, dividers & subtle shadows
  static const Color borderLight = Color(0xFFEDE7DE);
  static const Color borderSubtle = Color(0xFFF2ECE3);
  static const Color shadowWarm = Color(0x0F382618);
  static const Color shadowElevated = Color(0x182C1F15);

  // Highlight color for Read Along (Spotify-like soft paper glow)
  static const Color highlightBg = Color(0xFFE6F3ED);
  static const Color highlightBorder = Color(0xFF34A853);
  static const Color highlightText = Color(0xFF11382A);

  // -------------------------------------------------------------
  // SPECIFIED DARK MODE PALETTE ("Cozy literary reading space at night")
  // -------------------------------------------------------------
  // Backgrounds
  static const Color darkScaffold = Color(0xFF121218);       // Main app background
  static const Color darkSurface = Color(0xFF181820);        // Secondary sections / page surfaces
  static const Color darkCard = Color(0xFF20202A);           // Cards / elevated surfaces
  static const Color darkCardElevated = Color(0xFF262631);

  // Primary brand (Emerald & Castleton Green)
  static const Color darkEmerald = Color(0xFF5FB89A);         // Bolti Kitab emerald accent (dark green shade kept)
  static const Color darkEmeraldLight = Color(0xFF00563F);    // Castleton Green #00563F (replaces turquoise light accent)
  static const Color darkEmeraldDark = Color(0xFF3F8F73);     // Darker accent for contrast
  static const Color castletonGreen = Color(0xFF00563F);      // Castleton Green #00563F

  // Literary accent colors
  static const Color darkLavender = Color(0xFFB7A1E8);       // Soft lavender
  static const Color darkPeach = Color(0xFFE7A58F);          // Muted peach
  static const Color darkSage = Color(0xFFA9C7B2);           // Pale sage
  static const Color darkButter = Color(0xFFE6C978);         // Butter yellow
  static const Color darkRose = Color(0xFFD99AAE);           // Dusty rose
  static const Color darkBlue = Color(0xFF91B9D8);           // Powder blue

  // Text hierarchy
  static const Color darkTextPrimary = Color(0xFFF5F1E8);     // Primary text, warm off-white
  static const Color darkTextSecondary = Color(0xFFD8D3CC);   // Secondary text
  static const Color darkTextMuted = Color(0xFFA9A5A0);       // Muted text
  static const Color darkTextDisabled = Color(0xFF77747A);    // Disabled text

  // Borders & dividers
  static const Color darkBorder = Color(0xFF2E2E39);          // Standard border
  static const Color darkBorderStrong = Color(0xFF393946);    // Stronger border

  // Player
  static const Color darkPlayerBg = Color(0xFF1A1A23);        // Player background
  static const Color darkPlayerCard = Color(0xFF262631);      // Player controls / cards

  // Navigation
  static const Color darkNavBg = Color(0xFF17171F);           // Bottom navigation background
  static const Color darkNavInactive = Color(0xFFA9A5A0);     // Inactive icon/text
  static const Color darkNavActive = Color(0xFF5FB89A);       // Active icon/text in dark green shade

  // Semantic
  static const Color darkError = Color(0xFFE78B8B);
  static const Color darkSuccess = Color(0xFF79C6A3);
  static const Color darkWarning = Color(0xFFE5C979);

  // Read Along (Gentle, cozy #181820 with #F5F1E8 text and subtle emerald/lavender accents)
  static const Color darkReadAlongScaffold = Color(0xFF181820);
  static const Color darkHighlightBg = Color(0xFF262631);
  static const Color darkHighlightText = Color(0xFFF5F1E8);

  // Dark Green Badge & Avatar System (Castleton Green #00563F with maximum contrast)
  static const Color darkGreenBg = Color(0xFF00563F);          // Dark mode Castleton Green #00563F
  static const Color darkGreenBorder = Color(0xFF0D7857);      // Distinct accent border for contrast
  static const Color darkGreenText = Color(0xFFF5F1E8);        // Warm off-white text (super readable on #00563F)
  static const Color darkGreenBgLight = Color(0xFFE8F5EE);     // Light mode soft green tint
  static const Color darkGreenTextLight = Color(0xFF00563F);   // Light mode Castleton Green text
  static const Color darkGreenBorderLight = Color(0xFFB3DEC7); // Light mode border

  // Legacy navy aliases mapped to darkGreen to ensure consistency
  static const Color navyPrimary = Color(0xFF00563F);
  static const Color navyBlue = Color(0xFF00563F);
  static const Color darkNavyBg = Color(0xFF00563F);
  static const Color darkNavyBorder = Color(0xFF0D7857);
  static const Color darkNavyText = Color(0xFFF5F1E8);
  static const Color navyBgLight = Color(0xFFE8F5EE);
  static const Color navyTextLight = Color(0xFF00563F);
  static const Color navyBorderLight = Color(0xFFB3DEC7);
}
