import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum CoverSize {
  tiny,    // mini player (44x44)
  small,   // list row (64x88)
  medium,  // grid card (110x150)
  large,   // hero / detail (150x210)
  hero,    // full player (240x310)
}

class BookCover extends StatelessWidget {
  final String title;
  final String? titleUrdu;
  final String? author;
  final CoverSize size;
  final VoidCallback? onTap;

  const BookCover({
    super.key,
    required this.title,
    this.titleUrdu,
    this.author,
    this.size = CoverSize.medium,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final double width;
    final double height;
    final double radius;

    switch (size) {
      case CoverSize.tiny:
        width = 44;
        height = 44;
        radius = 8;
        break;
      case CoverSize.small:
        width = 68;
        height = 92;
        radius = 10;
        break;
      case CoverSize.medium:
        width = 114;
        height = 156;
        radius = 14;
        break;
      case CoverSize.large:
        width = 150;
        height = 210;
        radius = 16;
        break;
      case CoverSize.hero:
        width = 240;
        height = 310;
        radius = 20;
        break;
    }

    final isTiny = size == CoverSize.tiny;
    final isCompact = size == CoverSize.small || size == CoverSize.tiny;

    final widget = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: const LinearGradient(
          colors: [
            Color(0xFF1E3A2F), // Deep rich forest
            Color(0xFF162D24), // Shadowed emerald spine
            Color(0xFF0F1E19), // Midnight moss
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.45, 1.0],
        ),
        boxShadow: isTiny
            ? [
                const BoxShadow(
                  color: AppColors.shadowWarm,
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ]
            : [
                BoxShadow(
                  color: AppColors.shadowWarm.withValues(alpha: 0.18),
                  blurRadius: 18,
                  offset: const Offset(0, 10),
                  spreadRadius: -2,
                ),
                BoxShadow(
                  color: const Color(0xFF1E3A2F).withValues(alpha: 0.22),
                  blurRadius: 28,
                  offset: const Offset(0, 14),
                  spreadRadius: -4,
                ),
              ],
        border: Border.all(
          color: const Color(0xFF4A8870).withValues(alpha: 0.35),
          width: 1.2,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Stack(
          children: [
            // Left book spine simulated shadow
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: width * 0.09,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.black.withValues(alpha: 0.35),
                      Colors.transparent,
                    ],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                ),
              ),
            ),

            // Subtle gold/sage foil accent line
            if (!isCompact)
              Positioned(
                left: width * 0.12,
                top: 14,
                bottom: 14,
                width: 1,
                child: Container(
                  color: const Color(0xFFD4AF37).withValues(alpha: 0.3),
                ),
              ),

            // Content
            Center(
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: isTiny ? 4 : (isCompact ? 8 : 16),
                  vertical: isTiny ? 4 : 12,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    if (!isTiny) ...[
                      // Literary emblem
                      Icon(
                        Icons.auto_stories_rounded,
                        color: const Color(0xFFE4C988),
                        size: isCompact ? 22 : (size == CoverSize.hero ? 44 : 32),
                      ),
                      SizedBox(height: isCompact ? 4 : 8),
                    ],

                    // Title
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      maxLines: isCompact ? 2 : 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'serif',
                        fontSize: isTiny ? 9 : (isCompact ? 10 : (size == CoverSize.hero ? 18 : 13)),
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFFFAF7F2),
                        height: 1.2,
                        letterSpacing: 0.1,
                      ),
                    ),

                    if (titleUrdu != null && titleUrdu!.isNotEmpty && !isCompact) ...[
                      const SizedBox(height: 4),
                      Text(
                        titleUrdu!,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'sans-serif',
                          fontSize: size == CoverSize.hero ? 16 : 12,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFBCE3D2),
                        ),
                      ),
                    ],

                    if (author != null && size != CoverSize.small && size != CoverSize.tiny) ...[
                      SizedBox(height: size == CoverSize.hero ? 14 : 8),
                      Text(
                        author!,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        style: TextStyle(
                          fontSize: size == CoverSize.hero ? 12 : 9,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFFE0DDD5).withValues(alpha: 0.8),
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: widget,
      );
    }

    return widget;
  }
}
