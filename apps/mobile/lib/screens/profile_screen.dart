import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../services/theme_provider.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../widgets/bolti_logo.dart';
import '../widgets/common_components.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _selectedLanguage = 'English';
  double _defaultPlaybackSpeed = 1.0;
  int _skipDurationSecs = 10;

  void _showAppearanceDialog() {
    final themeProvider = context.read<ThemeProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : AppColors.surfaceWhite,
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
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
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
                    'Appearance & Theme',
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Choose your reading atmosphere.',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFBF9F5),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFEDE7DE)),
                      ),
                      child: const Icon(Icons.wb_sunny_rounded, color: Color(0xFF8A533E)),
                    ),
                    title: const Text('Warm Book-Paper (Light)', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Soft cream & literary ivory for daylight reading'),
                    trailing: themeProvider.themeMode == ThemeMode.light
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.emerald)
                        : null,
                    onTap: () {
                      themeProvider.setThemeMode(ThemeMode.light);
                      Navigator.pop(ctx);
                    },
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.darkScaffold,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.darkBorder),
                      ),
                      child: const Icon(Icons.nightlight_round_rounded, color: AppColors.darkEmerald),
                    ),
                    title: const Text('Night Reading (Dark Mode)', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Deep charcoal slate with gentle emerald glow'),
                    trailing: themeProvider.themeMode == ThemeMode.dark
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.emerald)
                        : null,
                    onTap: () {
                      themeProvider.setThemeMode(ThemeMode.dark);
                      Navigator.pop(ctx);
                    },
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.brightness_auto_rounded, color: AppColors.emerald),
                    ),
                    title: const Text('System Default', style: TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: const Text('Match your device appearance settings'),
                    trailing: themeProvider.themeMode == ThemeMode.system
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.emerald)
                        : null,
                    onTap: () {
                      themeProvider.setThemeMode(ThemeMode.system);
                      Navigator.pop(ctx);
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showLanguageDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : AppColors.surfaceWhite,
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
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
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
                    'Select App Language',
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 14),
                  ListTile(
                    title: const Text('English (US)'),
                    subtitle: const Text('Standard English interface'),
                    trailing: _selectedLanguage == 'English'
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.emerald)
                        : null,
                    onTap: () {
                      setState(() => _selectedLanguage = 'English');
                      Navigator.pop(ctx);
                    },
                  ),
                  ListTile(
                    title: const Text('اردو (Urdu)'),
                    subtitle: const Text('اردو انٹرفیس مع مکمل RTL سپورٹ'),
                    trailing: _selectedLanguage == 'اردو'
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.emerald)
                        : null,
                    onTap: () {
                      setState(() => _selectedLanguage = 'اردو');
                      Navigator.pop(ctx);
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _showPlaybackSettingsDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Container(
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkCard : AppColors.surfaceWhite,
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
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
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
                      const SizedBox(height: 22),
                      Text(
                        'Playback Preferences',
                        style: TextStyle(
                          fontFamily: 'serif',
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Configure default seek intervals and narration speed.',
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Default Skip Interval',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [10, 15, 30].map((sec) {
                          final isSel = _skipDurationSecs == sec;
                          return ChoiceChip(
                            label: Text('$sec seconds'),
                            selected: isSel,
                            selectedColor: AppColors.emerald,
                            backgroundColor: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                            labelStyle: TextStyle(
                              color: isSel ? Colors.white : (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary),
                              fontWeight: FontWeight.w600,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            onSelected: (_) {
                              setState(() => _skipDurationSecs = sec);
                              setSheetState(() {});
                            },
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 22),
                      Text(
                        'Default Speed',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [0.75, 1.0, 1.25, 1.5].map((spd) {
                          final isSel = (_defaultPlaybackSpeed - spd).abs() < 0.05;
                          return ChoiceChip(
                            label: Text('${spd}x'),
                            selected: isSel,
                            selectedColor: AppColors.emerald,
                            backgroundColor: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
                            labelStyle: TextStyle(
                              color: isSel ? Colors.white : (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary),
                              fontWeight: FontWeight.w600,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            onSelected: (_) {
                              setState(() => _defaultPlaybackSpeed = spd);
                              setSheetState(() {});
                            },
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showAboutDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppColors.darkCard : AppColors.surfaceWhite,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const BoltiLogo(size: LogoSize.medium),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Bolti Kitab v1.0.0\nA bespoke literary mobile audiobook & read-along experience.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.5,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Featuring authentic sentence synchronization, Backblaze B2 audio streaming, and bilingual Urdu typography.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.emerald)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final name = auth.userName ?? 'Reader';
    final email = auth.userEmail ?? 'listener@boltikitab.test';

    final cardBg = isDark ? AppColors.darkCard : AppColors.surfaceCard;
    final borderColor = isDark ? AppColors.darkBorder : AppColors.borderLight;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          children: [
            Text(
              'Profile',
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),

            // Profile Header Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: borderColor, width: 1.2),
                boxShadow: isDark
                    ? []
                    : const [
                        BoxShadow(
                          color: AppColors.shadowWarm,
                          blurRadius: 12,
                          offset: Offset(0, 4),
                        ),
                      ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                        width: 1.5,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : 'B',
                        style: TextStyle(
                          fontFamily: 'serif',
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          style: TextStyle(
                            fontFamily: 'serif',
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          email,
                          style: AppTypography.bodySmall.copyWith(
                            color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Settings Section
            const SectionHeader(title: 'Preferences'),
            Container(
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: borderColor),
              ),
              child: Column(
                children: [
                  _SettingsRow(
                    icon: Icons.palette_outlined,
                    title: 'Appearance / ڈارک موڈ',
                    subtitle: themeProvider.currentThemeName,
                    trailing: Switch.adaptive(
                      value: themeProvider.isDarkMode,
                      activeTrackColor: AppColors.emerald,
                      activeThumbColor: Colors.white,
                      onChanged: (val) {
                        themeProvider.setThemeMode(val ? ThemeMode.dark : ThemeMode.light);
                      },
                    ),
                    onTap: _showAppearanceDialog,
                  ),
                  Divider(height: 1, indent: 56, color: borderColor),
                  _SettingsRow(
                    icon: Icons.language_rounded,
                    title: 'Language / زبان',
                    subtitle: _selectedLanguage,
                    onTap: _showLanguageDialog,
                  ),
                  Divider(height: 1, indent: 56, color: borderColor),
                  _SettingsRow(
                    icon: Icons.tune_rounded,
                    title: 'Playback Settings',
                    subtitle: 'Speed (${_defaultPlaybackSpeed}x) • Skip (${_skipDurationSecs}s)',
                    onTap: _showPlaybackSettingsDialog,
                  ),
                  Divider(height: 1, indent: 56, color: borderColor),
                  _SettingsRow(
                    icon: Icons.notifications_none_rounded,
                    title: 'Notifications',
                    subtitle: 'New chapter releases & reminders',
                    onTap: () {},
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // About & Log Out
            const SectionHeader(title: 'About & Support'),
            Container(
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: borderColor),
              ),
              child: Column(
                children: [
                  _SettingsRow(
                    icon: Icons.auto_stories_outlined,
                    title: 'About Bolti Kitab',
                    subtitle: 'Version 1.0.0 (Pixel 8a verified)',
                    onTap: _showAboutDialog,
                  ),
                  Divider(height: 1, indent: 56, color: borderColor),
                  _SettingsRow(
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy Policy',
                    onTap: () {},
                  ),
                  Divider(height: 1, indent: 56, color: borderColor),
                  _SettingsRow(
                    icon: Icons.logout_rounded,
                    title: 'Log Out',
                    titleColor: const Color(0xFFEF4444),
                    onTap: () => auth.logout(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? titleColor;
  final Widget? trailing;
  final VoidCallback onTap;

  const _SettingsRow({
    required this.icon,
    required this.title,
    this.subtitle,
    this.titleColor,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListTile(
      leading: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 19, color: titleColor ?? AppColors.emeraldSoft),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: titleColor ?? (isDark ? AppColors.darkTextPrimary : AppColors.textPrimary),
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: TextStyle(
                fontSize: 12,
                color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
              ),
            )
          : null,
      trailing: trailing ??
          Icon(
            Icons.chevron_right_rounded,
            size: 20,
            color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
          ),
      onTap: onTap,
    );
  }
}
