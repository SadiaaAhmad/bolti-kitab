import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../widgets/bolti_logo.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onFinish;

  const OnboardingScreen({super.key, required this.onFinish});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, dynamic>> _pages = [
    {
      'icon': Icons.auto_stories_rounded,
      'title': 'Discover stories that speak to you',
      'titleUrdu': 'کہانیاں جو آپ کے دل میں اتر جائیں',
      'description':
          'Immerse yourself in timeless literature, Urdu classics, and captivating tales narrated by master storytellers.',
      'accentBg': AppColors.sageBg,
      'accentColor': AppColors.emerald,
    },
    {
      'icon': Icons.headphones_rounded,
      'title': 'Listen anywhere, anytime',
      'titleUrdu': 'جہاں بھی آپ ہوں، اپنی رفتار سے سنیں',
      'description':
          'Crystal clear audio playback crafted for mindful listening, daily commutes, and quiet evenings.',
      'accentBg': AppColors.blueBg,
      'accentColor': AppColors.blueText,
    },
    {
      'icon': Icons.bookmark_added_rounded,
      'title': 'Continue right where you left off',
      'titleUrdu': 'جہاں چھوڑا تھا، وہیں سے آگے بڑھیں',
      'description':
          'Seamless synchronization with sentence-level Read Along brings the written word alive.',
      'accentBg': AppColors.peachBg,
      'accentColor': AppColors.peachText,
    },
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.warmIvory,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (_currentPage < _pages.length - 1)
            TextButton(
              onPressed: widget.onFinish,
              child: const Text(
                'Skip',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            const BoltiLogo(size: LogoSize.small, showTagline: false),
            const SizedBox(height: 16),

            // Page carousel
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _pages.length,
                onPageChanged: (idx) {
                  setState(() {
                    _currentPage = idx;
                  });
                },
                itemBuilder: (context, index) {
                  final item = _pages[index];
                  final icon = item['icon'] as IconData;
                  final title = item['title'] as String;
                  final titleUrdu = item['titleUrdu'] as String;
                  final description = item['description'] as String;
                  final accentBg = item['accentBg'] as Color;
                  final accentColor = item['accentColor'] as Color;

                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Soft literary motif container
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            color: accentBg,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: accentColor.withValues(alpha: 0.2),
                              width: 2,
                            ),
                            boxShadow: const [
                              BoxShadow(
                                color: AppColors.shadowWarm,
                                blurRadius: 16,
                                offset: Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Icon(icon, size: 60, color: accentColor),
                          ),
                        ),
                        const SizedBox(height: 36),

                        // Title
                        Text(
                          title,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontFamily: 'serif',
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Urdu subtitle
                        Text(
                          titleUrdu,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontFamily: 'sans-serif',
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: accentColor,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Description
                        Text(
                          description,
                          textAlign: TextAlign.center,
                          style: AppTypography.bodyMedium,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Indicator & Next / Get Started Buttons
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
              child: Column(
                children: [
                  // Dots
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_pages.length, (i) {
                      final isSel = i == _currentPage;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: isSel ? 24 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: isSel ? AppColors.emerald : AppColors.borderLight,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 24),

                  // Button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: () {
                        if (_currentPage < _pages.length - 1) {
                          _pageController.nextPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        } else {
                          widget.onFinish();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.emerald,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Text(
                        _currentPage < _pages.length - 1 ? 'Next' : 'Get Started',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
