import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class TopicChip extends StatelessWidget {
  final String label;
  final String? urduLabel;
  final bool isSelected;
  final VoidCallback? onTap;
  final Color? accentBg;
  final Color? accentText;

  const TopicChip({
    super.key,
    required this.label,
    this.urduLabel,
    this.isSelected = false,
    this.onTap,
    this.accentBg,
    this.accentText,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bg = isSelected
        ? (isDark ? AppColors.darkGreenBg : AppColors.castletonGreen)
        : (accentBg ?? (isDark ? AppColors.darkCard : AppColors.surfaceWhite));
    final fg = isSelected
        ? (isDark ? AppColors.darkGreenText : Colors.white)
        : (accentText ?? (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary));
    final border = isSelected
        ? (isDark ? AppColors.darkGreenBorder : AppColors.castletonGreen)
        : (isDark ? AppColors.darkBorder : AppColors.borderLight);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: border, width: 1.2),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: (isDark ? AppColors.darkGreenBorder : AppColors.castletonGreen).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : (isDark
                    ? []
                    : const [
                        BoxShadow(
                          color: AppColors.shadowWarm,
                          blurRadius: 4,
                          offset: Offset(0, 2),
                        ),
                      ]),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: fg,
                ),
              ),
              if (urduLabel != null) ...[
                const SizedBox(width: 6),
                Text(
                  urduLabel!,
                  style: TextStyle(
                    fontFamily: 'sans-serif',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isSelected
                        ? (isDark ? AppColors.darkScaffold : AppColors.textInverse)
                        : (isDark ? AppColors.darkEmerald : AppColors.emeraldSoft),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
