import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../services/api_service.dart';
import '../services/auth_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/book_card.dart';
import '../widgets/topic_chip.dart';
import '../widgets/common_components.dart';
import 'book_detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<Book> _allBooks = [];
  List<Book> _filteredBooks = [];
  bool _isLoading = true;
  String _activeFilter = 'Books';

  final List<String> _recentSearches = [
    'The Art of War',
    'Sun Tzu',
    'Bob Neufeld',
    'Urdu classics',
  ];

  final List<Map<String, String>> _categories = [
    {'title': 'Philosophy', 'urdu': 'فلسفہ', 'color': 'green'},
    {'title': 'War & Strategy', 'urdu': 'حکمتِ عملی', 'color': 'green'},
    {'title': 'Classics', 'urdu': 'شاہکار', 'color': 'green'},
    {'title': 'Short Listens', 'urdu': 'مختصر', 'color': 'green'},
  ];

  @override
  void initState() {
    super.initState();
    _fetchCatalog();
  }

  void _fetchCatalog() async {
    final token = context.read<AuthProvider>().token;
    try {
      final books = await ApiService.getBooks(token: token);
      if (mounted) {
        setState(() {
          _allBooks = books;
          _filteredBooks = books;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _onSearchQueryChanged(String query) {
    final q = query.trim().toLowerCase();
    setState(() {
      if (q.isEmpty) {
        _filteredBooks = _allBooks;
      } else {
        _filteredBooks = _allBooks.where((b) {
          final matchesTitle = b.title.toLowerCase().contains(q) || b.titleUrdu.toLowerCase().contains(q);
          final matchesAuthor = b.author.toLowerCase().contains(q);
          final matchesNarrator = b.narratorName.toLowerCase().contains(q);
          return matchesTitle || matchesAuthor || matchesNarrator;
        }).toList();
      }
    });
  }

  Color _getCategoryBg(String color, bool isDark) {
    if (isDark) {
      return const Color(0xFF0F261C); // Subtle dark green surface
    }
    return AppColors.sageBg; // Soft green in light mode
  }

  Color _getCategoryText(String color, bool isDark) {
    if (isDark) {
      return const Color(0xFF79C6A3); // Crisp mint/sage text on dark green
    }
    return AppColors.sageText; // Dark green text in light mode
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final query = _searchController.text.trim();
    final isSearching = query.isNotEmpty;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          children: [
            // Title
            Text(
              'Search',
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 26,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),

            // Prominent Search Bar
            BoltiSearchBar(
              controller: _searchController,
              onChanged: _onSearchQueryChanged,
              onClear: () {
                _searchController.clear();
                _onSearchQueryChanged('');
              },
            ),
            const SizedBox(height: 18),

            // If not searching: Show Recent Searches & Discover Genres
            if (!isSearching) ...[
              // Recent searches
              const SectionHeader(title: 'Recent Searches'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _recentSearches.map((s) {
                  return InkWell(
                    onTap: () {
                      _searchController.text = s;
                      _onSearchQueryChanged(s);
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.darkCard : AppColors.surfaceWhite,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark ? AppColors.darkBorder : AppColors.borderLight,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.history_rounded,
                            size: 14,
                            color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            s,
                            style: TextStyle(
                              fontSize: 12,
                              color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),

              // Genres & Topics grid
              const SectionHeader(
                title: 'Explore Categories',
                subtitle: 'Find stories by genre and form',
              ),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 2.1,
                ),
                itemCount: _categories.length,
                itemBuilder: (context, idx) {
                  final cat = _categories[idx];
                  final bg = _getCategoryBg(cat['color']!, isDark);
                  final fg = _getCategoryText(cat['color']!, isDark);

                  return InkWell(
                    onTap: () {
                      _searchController.text = cat['title']!;
                      _onSearchQueryChanged(cat['title']!);
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: bg,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: fg.withValues(alpha: 0.15)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            cat['title']!,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: fg,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            cat['urdu']!,
                            style: TextStyle(
                              fontFamily: 'sans-serif',
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: fg.withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ] else ...[
              // Filter tabs
              Row(
                children: ['Books', 'Authors', 'Narrators'].map((tab) {
                  final isSel = _activeFilter == tab;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: TopicChip(
                      label: tab,
                      isSelected: isSel,
                      onTap: () {
                        setState(() {
                          _activeFilter = tab;
                        });
                      },
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 18),

              // Search results list prioritizing covers
              if (_isLoading)
                const SkeletonBookCard()
              else if (_filteredBooks.isEmpty)
                EmptyStateView(
                  icon: Icons.search_off_rounded,
                  title: 'No stories found',
                  message: 'No results for "$query". Try searching for "Sun Tzu" or "War".',
                )
              else
                ..._filteredBooks.map((book) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: BookCard(
                      book: book,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => BookDetailScreen(book: book),
                          ),
                        );
                      },
                    ),
                  );
                }),
            ],
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }
}
