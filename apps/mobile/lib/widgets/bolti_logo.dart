import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum LogoSize { small, medium, large }

class BoltiLogo extends StatelessWidget {
  final LogoSize size;
  final bool showTagline;

  const BoltiLogo({
    super.key,
    this.size = LogoSize.medium,
    this.showTagline = true,
  });

  @override
  Widget build(BuildContext context) {
    final double iconSize;
    final double titleSize;
    final double urduSize;

    switch (size) {
      case LogoSize.small:
        iconSize = 22;
        titleSize = 16;
        urduSize = 13;
        break;
      case LogoSize.medium:
        iconSize = 32;
        titleSize = 22;
        urduSize = 16;
        break;
      case LogoSize.large:
        iconSize = 46;
        titleSize = 30;
        urduSize = 20;
        break;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        // Emblem: Cozy open book with subtle emerald gradient circle
        Container(
          width: iconSize * 1.8,
          height: iconSize * 1.8,
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
            shape: BoxShape.circle,
            border: Border.all(
              color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
              width: 1.5,
            ),
            boxShadow: isDark
                ? []
                : const [
                    BoxShadow(
                      color: AppColors.shadowWarm,
                      blurRadius: 10,
                      offset: Offset(0, 4),
                    ),
                  ],
          ),
          child: Center(
            child: Icon(
              Icons.auto_stories_rounded,
              size: iconSize,
              color: isDark ? AppColors.darkGreenText : AppColors.castletonGreen,
            ),
          ),
        ),
        SizedBox(height: size == LogoSize.large ? 14 : 8),

        // Brand Title
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              'Bolti Kitab',
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: titleSize,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.3,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'بولتی کتاب',
              style: TextStyle(
                fontFamily: 'sans-serif',
                fontSize: urduSize,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
              ),
            ),
          ],
        ),

        if (showTagline && size != LogoSize.small) ...[
          const SizedBox(height: 4),
          Text(
            'a tiny beautiful place where stories live',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w400,
              fontStyle: FontStyle.italic,
              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ],
    );
  }
}
