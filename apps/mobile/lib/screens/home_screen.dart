import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../services/audio_player_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import '../widgets/book_card.dart';
import '../widgets/continue_listening_card.dart';
import '../widgets/topic_chip.dart';
import '../widgets/common_components.dart';
import 'book_detail_screen.dart';
import 'player_screen.dart';

class HomeScreen extends StatefulWidget {
  final void Function(int tabIndex)? onSwitchTab;

  const HomeScreen({super.key, this.onSwitchTab});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Book>> _booksFuture;
  ListeningProgress? _recentProgress;
  Book? _progressBook;
  String _selectedTopic = 'All';

  final List<Map<String, String>> _topics = [
    {'label': 'All', 'urdu': 'سب'},
    {'label': 'Classics', 'urdu': 'شاہکار'},
    {'label': 'Urdu', 'urdu': 'اردو'},
    {'label': 'History', 'urdu': 'تاریخ'},
    {'label': 'Fiction', 'urdu': 'افسانہ'},
    {'label': 'Poetry', 'urdu': 'شاعری'},
    {'label': 'Short listens', 'urdu': 'مختصر'},
  ];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    final token = context.read<AuthProvider>().token;
    setState(() {
      _booksFuture = ApiService.getBooks(token: token);
    });

    // Check progress for resume
    if (token != null) {
      _booksFuture.then((books) async {
        if (books.isNotEmpty) {
          try {
            final overview = await ApiService.getPlaybackOverview(token, books.first.id);
            final progRaw = overview['progress'] as Map<String, dynamic>?;
            if (progRaw != null && mounted) {
              setState(() {
                _recentProgress = ListeningProgress.fromJson(progRaw);
                _progressBook = books.first;
              });
            } else if (mounted) {
              setState(() {
                _recentProgress = null;
                _progressBook = null;
              });
            }
          } catch (_) {
            // Non-blocking progress fetch
          }
        }
      });
    }
  }

  void _resumeBook(Book book, ListeningProgress progress) async {
    final token = context.read<AuthProvider>().token;
    if (token == null) return;

    try {
      final pbToken = await ApiService.getChapterPlaybackToken(
        token,
        book.id,
        progress.chapterId,
      );

      if (!mounted) return;
      final playerService = context.read<AudioPlayerService>();
      await playerService.loadAndPlay(
        token: pbToken,
        bookId: book.id,
        authToken: token,
        initialPositionMs: progress.positionMs,
      );

      final chapterItem = ChapterItem(
        id: pbToken.chapterId,
        chapterNum: pbToken.chapterNum,
        title: pbToken.title,
        titleUrdu: pbToken.titleUrdu,
        startMs: pbToken.startMs,
        durationMs: pbToken.durationMs,
        isPreviewFree: true,
        isApproved: true,
      );

      if (mounted) {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PlayerScreen(book: book, chapter: chapterItem),
          ),
        );
        if (mounted) _loadData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not resume: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final rawName = auth.userName ?? 'Friend';
    final userName = rawName.split(' ').first;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.emerald,
          backgroundColor: Theme.of(context).cardColor,
          onRefresh: () async => _loadData(),
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            children: [
              // Top Bar: Cozy greeting & Avatar
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Aao Suno',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                          letterSpacing: 0.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'آؤ سنو • بولتی کتاب',
                        style: TextStyle(
                          fontFamily: 'sans-serif',
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                        ),
                      ),
                    ],
                  ),

                  // Avatar / Notification affordance
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
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
                            userName.isNotEmpty ? userName[0].toUpperCase() : 'B',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Hero: "What shall we listen to?"
              Text(
                'What shall we\nlisten to today?',
                style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.6,
                  color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 16),

              // Large elegant search field (Pinterest inspiration: prominent search)
              BoltiSearchBar(
                readOnly: true,
                onTap: () {
                  if (widget.onSwitchTab != null) {
                    widget.onSwitchTab!(1); // Switch to Search tab
                  }
                },
                hintText: 'Search stories, classics, Urdu tales...',
              ),
              const SizedBox(height: 18),

              // Horizontal topic row
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _topics.map((t) {
                    final label = t['label']!;
                    final urdu = t['urdu'];
                    final isSel = _selectedTopic == label;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: TopicChip(
                        label: label,
                        urduLabel: urdu,
                        isSelected: isSel,
                        onTap: () {
                          setState(() {
                            _selectedTopic = label;
                          });
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 24),

              // Future builder for actual catalog data
              FutureBuilder<List<Book>>(
                future: _booksFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Column(
                      children: [
                        SkeletonBookCard(),
                        SizedBox(height: 16),
                        SkeletonBookCard(),
                      ],
                    );
                  }

                  if (snapshot.hasError) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.cloud_off_rounded, size: 40, color: AppColors.textMuted),
                            const SizedBox(height: 10),
                            Text('Could not load stories: ${snapshot.error}', textAlign: TextAlign.center, style: AppTypography.bodySmall),
                            const SizedBox(height: 12),
                            ElevatedButton(onPressed: _loadData, child: const Text('Try Again')),
                          ],
                        ),
                      ),
                    );
                  }

                  final books = snapshot.data ?? [];
                  if (books.isEmpty) {
                    return const EmptyStateView(
                      title: 'Library is quiet',
                      message: 'No stories found in the catalog right now.',
                    );
                  }

                  final featuredBook = books.first;

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Section 1: "Continue listening" (if progress exists)
                      if (_recentProgress != null && _progressBook != null) ...[
                        const SectionHeader(
                          title: 'Continue listening',
                          subtitle: 'Jump back into your story',
                        ),
                        ContinueListeningCard(
                          book: _progressBook!,
                          progress: _recentProgress!,
                          onResume: () => _resumeBook(_progressBook!, _recentProgress!),
                        ),
                        const SizedBox(height: 24),
                      ],

                      // Section 2: "Picked for you" / Bespoke Editorial Spotlight
                      // Designed so having ONE real book looks bespoke and intentional!
                      const SectionHeader(
                        title: 'Picked for you',
                        subtitle: 'Curated masterpiece in audio and text',
                      ),
                      BespokeSpotlightCard(
                        book: featuredBook,
                        onTap: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => BookDetailScreen(book: featuredBook),
                            ),
                          );
                          if (mounted) _loadData();
                        },
                        onPlay: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => BookDetailScreen(book: featuredBook),
                            ),
                          );
                          if (mounted) _loadData();
                        },
                      ),
                      const SizedBox(height: 28),

                      // Section 3: "Little treasures" (Short / Free preview content)
                      const SectionHeader(
                        title: 'Little treasures',
                        subtitle: 'Free preview sections ready to enjoy',
                      ),
                      BookCard(
                        book: featuredBook,
                        onTap: () async {
                          await Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => BookDetailScreen(book: featuredBook),
                            ),
                          );
                          if (mounted) _loadData();
                        },
                      ),
                      const SizedBox(height: 80), // Padding for floating mini player
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
