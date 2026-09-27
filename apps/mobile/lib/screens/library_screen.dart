import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../services/audio_player_service.dart';
import '../services/bookmark_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/book_card.dart';
import '../widgets/continue_listening_card.dart';
import '../widgets/topic_chip.dart';
import '../widgets/common_components.dart';
import 'book_detail_screen.dart';
import 'player_screen.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  String _selectedTab = 'Continue';
  late Future<List<Book>> _booksFuture;
  ListeningProgress? _recentProgress;
  Book? _progressBook;

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
          } catch (_) {}
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bookmarkProvider = context.watch<BookmarkProvider>();

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          children: [
            // Title
            Text(
              'Your Library',
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'A personal sanctuary for your listening journey',
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 18),

            // Tabs: Continue, Saved, Purchased
            Row(
              children: [
                TopicChip(
                  label: 'Continue',
                  isSelected: _selectedTab == 'Continue',
                  onTap: () => setState(() => _selectedTab = 'Continue'),
                ),
                const SizedBox(width: 8),
                TopicChip(
                  label: 'Saved',
                  isSelected: _selectedTab == 'Saved',
                  onTap: () => setState(() => _selectedTab = 'Saved'),
                ),
                const SizedBox(width: 8),
                TopicChip(
                  label: 'Purchased',
                  isSelected: _selectedTab == 'Purchased',
                  onTap: () => setState(() => _selectedTab = 'Purchased'),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Tab Content
            FutureBuilder<List<Book>>(
              future: _booksFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const SkeletonBookCard();
                }

                final books = snapshot.data ?? [];

                if (_selectedTab == 'Continue') {
                  if (_recentProgress != null && _progressBook != null) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ContinueListeningCard(
                          book: _progressBook!,
                          progress: _recentProgress!,
                          onResume: () => _resumeBook(_progressBook!, _recentProgress!),
                        ),
                        const SizedBox(height: 20),
                        const SectionHeader(title: 'All In Progress'),
                        BookCard(
                          book: _progressBook!,
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => BookDetailScreen(book: _progressBook!),
                              ),
                            );
                            if (mounted) _loadData();
                          },
                        ),
                      ],
                    );
                  } else if (books.isNotEmpty) {
                    return Column(
                      children: [
                        BookCard(
                          book: books.first,
                          onTap: () async {
                            await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => BookDetailScreen(book: books.first),
                              ),
                            );
                            if (mounted) _loadData();
                          },
                        ),
                      ],
                    );
                  } else {
                    return const EmptyStateView(
                      icon: Icons.headphones_outlined,
                      title: 'Nothing playing right now',
                      message: 'Choose a story from Home to start listening.',
                    );
                  }
                } else if (_selectedTab == 'Saved') {
                  final savedBooks = books.where((b) => bookmarkProvider.isBookmarked(b.id)).toList();
                  if (savedBooks.isNotEmpty) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${savedBooks.length} ${savedBooks.length == 1 ? "Book" : "Books"} Saved',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                          ),
                        ),
                        const SizedBox(height: 12),
                        ...savedBooks.map((b) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: BookCard(
                            book: b,
                            onTap: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => BookDetailScreen(book: b),
                                ),
                              );
                              if (mounted) _loadData();
                            },
                          ),
                        )),
                      ],
                    );
                  }
                  return const EmptyStateView(
                    icon: Icons.bookmark_border_rounded,
                    title: 'No saved stories yet',
                    message: 'Bookmark books from the player or details to keep them here for later.',
                  );
                } else {
                  // Purchased
                  if (books.isNotEmpty) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Public Domain & Unlocked Editions',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                          ),
                        ),
                        const SizedBox(height: 10),
                        BookCard(
                          book: books.first,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => BookDetailScreen(book: books.first),
                              ),
                            );
                          },
                        ),
                      ],
                    );
                  }
                  return const EmptyStateView(
                    icon: Icons.shopping_bag_outlined,
                    title: 'No purchased audiobooks',
                    message: 'Your purchased editions will appear here.',
                  );
                }
              },
            ),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }
}
