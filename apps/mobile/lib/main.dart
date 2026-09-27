import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/auth_provider.dart';
import 'services/audio_player_service.dart';
import 'services/bookmark_provider.dart';
import 'services/theme_provider.dart';
import 'theme/app_theme.dart';
import 'theme/app_colors.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'widgets/bottom_nav_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BoltiKitabApp());
}

class BoltiKitabApp extends StatefulWidget {
  const BoltiKitabApp({super.key});

  @override
  State<BoltiKitabApp> createState() => _BoltiKitabAppState();
}

class _BoltiKitabAppState extends State<BoltiKitabApp> {
  bool _splashCompleted = false;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => BookmarkProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => AudioPlayerService()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) {
          return MaterialApp(
            title: 'Bolti Kitab (بولتی کتاب)',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeProvider.themeMode,
            home: !_splashCompleted
                ? SplashScreen(
                    onComplete: () {
                      setState(() {
                        _splashCompleted = true;
                      });
                    },
                  )
                : Consumer<AuthProvider>(
                    builder: (context, auth, _) {
                      if (auth.isLoading) {
                        return Scaffold(
                          backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                          body: const Center(
                            child: CircularProgressIndicator(color: AppColors.emerald),
                          ),
                        );
                      }
                      return auth.isAuthenticated
                          ? const BottomNavShell()
                          : const LoginScreen();
                    },
                  ),
          );
        },
      ),
    );
  }
}
