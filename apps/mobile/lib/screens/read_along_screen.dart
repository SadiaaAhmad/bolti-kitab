import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/models.dart';
import '../models/read_along_models.dart';
import '../services/audio_player_service.dart';
import '../services/read_along_service.dart';
import '../theme/app_colors.dart';

class ReadAlongScreen extends StatefulWidget {
  final Book book;
  final ChapterItem chapter;

  const ReadAlongScreen({
    super.key,
    required this.book,
    required this.chapter,
  });

  @override
  State<ReadAlongScreen> createState() => _ReadAlongScreenState();
}

class _ReadAlongScreenState extends State<ReadAlongScreen> {
  final ReadAlongService _readAlongService = ReadAlongService();
  final ScrollController _scrollController = ScrollController();
  final Map<String, GlobalKey> _paraKeys = {};

  ReadAlongDocument? _document;
  bool _isLoading = true;
  String? _errorMessage;
  double _fontSize = 17.0;
  Timer? _scrollDebounceTimer;

  // Auto-sync state
  String? _lastAutoScrolledParaId;
  bool _isUserScrolling = false;
  Timer? _userScrollResumeTimer;
  DateTime _lastScrollTime = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _loadDocument();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollDebounceTimer?.cancel();
    _userScrollResumeTimer?.cancel();
    _saveCurrentScrollPosition();
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollDebounceTimer?.isActive ?? false) {
      _scrollDebounceTimer!.cancel();
    }
    _scrollDebounceTimer = Timer(const Duration(milliseconds: 500), () {
      _saveCurrentScrollPosition();
    });
  }

  Future<void> _saveCurrentScrollPosition() async {
    if (_document == null || !_scrollController.hasClients) return;
    final offset = _scrollController.offset;
    await _readAlongService.saveReadingScrollPosition(
      bookId: _document!.bookId,
      sectionId: _document!.section.sectionId,
      scrollOffset: offset,
    );
  }

  Future<void> _loadDocument() async {
    try {
      final doc = await _readAlongService.loadDocument(
        bookId: widget.book.id,
        chapterNum: widget.chapter.chapterNum,
      );

      final savedOffset = await _readAlongService.getReadingScrollPosition(
        bookId: doc.bookId,
        sectionId: doc.section.sectionId,
      );

      if (mounted) {
        for (final ch in doc.section.chapters) {
          for (final p in ch.paragraphs) {
            _paraKeys[p.paragraphId] = GlobalKey();
          }
        }

        setState(() {
          _document = doc;
          _isLoading = false;
        });

        // Restore scroll position after initial layout build if available
        if (savedOffset > 0) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_scrollController.hasClients) {
              _scrollController.animateTo(
                savedOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOut,
              );
            }
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Unable to load source text: $e';
        });
      }
    }
  }

  String? _findActiveParagraphId(int currentPosMs) {
    if (_document == null) return null;
    // 250ms speech anticipation lead offset ensures highlight hits crisply at the first syllable
    final effectivePosMs = currentPosMs + 250;
    String? candidate;
    for (final chapter in _document!.section.chapters) {
      for (final para in chapter.paragraphs) {
        if (para.startMs != null) {
          if (effectivePosMs >= para.startMs!) {
            if (para.endMs == null || effectivePosMs < para.endMs!) {
              candidate = para.paragraphId;
            }
          }
        }
      }
    }
    return candidate;
  }

  void _scrollToActiveParagraph(String activeParaId) {
    if (_isUserScrolling) return;

    final now = DateTime.now();
    if (now.difference(_lastScrollTime).inMilliseconds < 400) {
      return; // Debounce
    }
    _lastScrollTime = now;

    final key = _paraKeys[activeParaId];
    if (key?.currentContext != null) {
      Scrollable.ensureVisible(
        key!.currentContext!,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
        alignment: 0.30, // Upper third of screen for optimal reading
      );
    }
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = d.inHours;
    if (hours > 0) {
      return '$hours:$minutes:$seconds';
    }
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final playerService = context.watch<AudioPlayerService>();
    final isThisChapterActive = playerService.currentToken?.chapterId == widget.chapter.id;
    final isPlaying = isThisChapterActive && playerService.isPlaying;

    final startMs = isThisChapterActive
        ? (playerService.currentToken?.startMs ?? widget.chapter.startMs)
        : widget.chapter.startMs;
    final totalDurationMs = widget.chapter.durationMs > 0
        ? widget.chapter.durationMs
        : (playerService.duration.inMilliseconds > startMs
            ? playerService.duration.inMilliseconds - startMs
            : playerService.duration.inMilliseconds);

    final currentPositionMs = isThisChapterActive ? playerService.position.inMilliseconds : startMs;
    final chapterElapsedMs = (currentPositionMs - startMs).clamp(0, totalDurationMs);

    final progressRatio = totalDurationMs > 0
        ? (chapterElapsedMs / totalDurationMs).clamp(0.0, 1.0)
        : 0.0;

    // Detect currently active spoken paragraph using absolute audio file position
    final activeParaId = _findActiveParagraphId(currentPositionMs);

    // Auto-scroll when active paragraph transitions
    if (activeParaId != null && activeParaId != _lastAutoScrolledParaId && !_isUserScrolling) {
      _lastAutoScrolledParaId = activeParaId;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _scrollToActiveParagraph(activeParaId);
        }
      });
    }

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkScaffold : AppColors.bookPaper, // Theme-adaptive reading surface
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkSurface : AppColors.warmIvory,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 20,
            color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
          ),
          tooltip: 'Return to Player',
          onPressed: () {
            _saveCurrentScrollPosition();
            Navigator.pop(context);
          },
        ),
        title: Column(
          children: [
            Text(
              widget.book.title,
              style: TextStyle(
                fontFamily: 'serif',
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              widget.chapter.title,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: [
          // A- / A+ Font Size adjustment
          IconButton(
            icon: Text(
              'A-',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.darkTextSecondary : AppColors.textPrimary,
              ),
            ),
            tooltip: 'Decrease font size',
            onPressed: () {
              if (_fontSize > 13.0) {
                setState(() => _fontSize -= 1.5);
              }
            },
          ),
          IconButton(
            icon: Text(
              'A+',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: isDark ? AppColors.darkEmerald : AppColors.emerald,
              ),
            ),
            tooltip: 'Increase font size',
            onPressed: () {
              if (_fontSize < 26.0) {
                setState(() => _fontSize += 1.5);
              }
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Stack(
        children: [
          _buildBody(activeParaId, playerService),

          // Spotify-style "Sync to Audio" floating action pill if user scrolled away
          if (_isUserScrolling && activeParaId != null)
            Positioned(
              right: 16,
              bottom: 16,
              child: FloatingActionButton.extended(
                backgroundColor: isDark ? AppColors.darkEmerald : AppColors.emerald,
                foregroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
                elevation: 4,
                icon: const Icon(Icons.my_location_rounded, size: 18),
                label: const Text(
                  'Sync with Voice',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                onPressed: () {
                  setState(() {
                    _isUserScrolling = false;
                  });
                  _scrollToActiveParagraph(activeParaId);
                },
              ),
            ),
        ],
      ),
      // Compact Quiet Bottom Audio HUD
      bottomNavigationBar: _buildAudioHUD(
        context: context,
        playerService: playerService,
        isPlaying: isPlaying,
        position: Duration(milliseconds: chapterElapsedMs),
        duration: Duration(milliseconds: totalDurationMs),
        progressRatio: progressRatio,
      ),
    );
  }

  Widget _buildBody(String? activeParaId, AudioPlayerService playerService) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: isDark ? AppColors.darkEmerald : AppColors.emerald),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.menu_book_rounded, color: isDark ? AppColors.darkTextMuted : AppColors.textMuted, size: 48),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  setState(() {
                    _isLoading = true;
                    _errorMessage = null;
                  });
                  _loadDocument();
                },
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final doc = _document!;
    final section = doc.section;

    return Directionality(
      textDirection: doc.textDirection,
      child: NotificationListener<UserScrollNotification>(
        onNotification: (notification) {
          if (notification.metrics.axis == Axis.vertical) {
            if (!_isUserScrolling) {
              setState(() {
                _isUserScrolling = true;
              });
            }
            _userScrollResumeTimer?.cancel();
            _userScrollResumeTimer = Timer(const Duration(seconds: 5), () {
              if (mounted) {
                setState(() {
                  _isUserScrolling = false;
                });
              }
            });
          }
          return false;
        },
        child: Scrollbar(
          controller: _scrollController,
          thumbVisibility: false,
          child: SingleChildScrollView(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // "Digital Book" Frontispiece Header
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkCard : AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark ? AppColors.darkBorder : AppColors.borderLight,
                      width: 1.2,
                    ),
                    boxShadow: isDark
                        ? null
                        : const [
                            BoxShadow(
                              color: AppColors.shadowWarm,
                              blurRadius: 10,
                              offset: Offset(0, 3),
                            ),
                          ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.auto_stories_rounded,
                            color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                            size: 16,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'READ ALONG • SYNCHRONIZED DIGITAL BOOK',
                              style: TextStyle(
                                color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                              ),
                            ),
                            child: Text(
                              'Tap line to jump',
                              style: TextStyle(
                                fontSize: 10,
                                color: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        section.title,
                        style: TextStyle(
                          fontFamily: 'serif',
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                        ),
                      ),
                      if (section.titleUrdu != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          section.titleUrdu!,
                          style: TextStyle(
                            fontFamily: 'sans-serif',
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Text(
                        '${doc.author} • Translated by ${doc.translator ?? "Lionel Giles"}',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Chapters & Spoken Paragraphs with Spotify-style highlighting
                for (final chapter in section.chapters) ...[
                  // Literary Chapter Heading
                  Padding(
                    padding: const EdgeInsets.only(top: 24.0, bottom: 12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          chapter.title,
                          style: TextStyle(
                            fontFamily: 'serif',
                            fontSize: _fontSize + 3.0,
                            fontWeight: FontWeight.w700,
                            color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                            letterSpacing: -0.2,
                          ),
                        ),
                        if (chapter.titleUrdu != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            chapter.titleUrdu!,
                            style: TextStyle(
                              fontFamily: 'sans-serif',
                              fontSize: _fontSize - 1.0,
                              fontWeight: FontWeight.w600,
                              color: isDark ? AppColors.darkEmerald : AppColors.emeraldSoft,
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Divider(
                          color: isDark ? AppColors.darkBorder : AppColors.borderLight,
                          thickness: 1,
                          height: 16,
                        ),
                      ],
                    ),
                  ),

                  // Paragraphs
                  for (final para in chapter.paragraphs)
                    _buildParagraph(para, para.paragraphId == activeParaId, playerService, isDark),

                  const SizedBox(height: 12),
                ],

                // End of Section Marker
                const SizedBox(height: 24),
                Center(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(
                      '❦   End of Audio Section   ❦',
                      style: TextStyle(
                        fontFamily: 'serif',
                        fontSize: 13,
                        fontStyle: FontStyle.italic,
                        color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 70),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildParagraph(ReadAlongParagraph para, bool isActive, AudioPlayerService playerService, bool isDark) {
    return InkWell(
      key: _paraKeys[para.paragraphId],
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        if (para.startMs != null) {
          playerService.seek(Duration(milliseconds: para.startMs!));
          if (!playerService.isPlaying) {
            playerService.play();
          }
          setState(() {
            _isUserScrolling = false;
          });
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        margin: const EdgeInsets.symmetric(vertical: 4.0),
        padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 10.0),
        decoration: BoxDecoration(
          color: isActive
              ? (isDark ? AppColors.darkHighlightBg : AppColors.highlightBg)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isActive
                ? (isDark
                    ? AppColors.darkEmerald.withValues(alpha: 0.5)
                    : AppColors.emeraldSoft.withValues(alpha: 0.5))
                : Colors.transparent,
            width: 1.2,
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: isDark
                        ? AppColors.darkEmerald.withValues(alpha: 0.15)
                        : AppColors.emerald.withValues(alpha: 0.08),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Left active indicator pill
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 3.5,
              height: isActive ? 24 : 0,
              margin: const EdgeInsets.only(top: 2, right: 10),
              decoration: BoxDecoration(
                color: isActive
                    ? (isDark ? AppColors.darkEmerald : AppColors.emerald)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: Text(
                para.text,
                style: TextStyle(
                  fontFamily: 'serif',
                  fontSize: _fontSize,
                  height: 1.7,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive
                      ? (isDark ? AppColors.darkHighlightText : AppColors.highlightText)
                      : (isDark ? const Color(0xFFCBD5E1) : AppColors.textSecondary),
                  letterSpacing: 0.15,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Compact Quiet Bottom Audio HUD
  Widget _buildAudioHUD({
    required BuildContext context,
    required AudioPlayerService playerService,
    required bool isPlaying,
    required Duration position,
    required Duration duration,
    required double progressRatio,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.surfaceWhite,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.borderLight,
            width: 1,
          ),
        ),
        boxShadow: isDark
            ? null
            : const [
                BoxShadow(
                  color: AppColors.shadowWarm,
                  blurRadius: 10,
                  offset: Offset(0, -2),
                ),
              ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Linear progress indicator
            LinearProgressIndicator(
              value: progressRatio,
              backgroundColor: isDark ? AppColors.darkBorder : AppColors.borderLight,
              valueColor: AlwaysStoppedAnimation<Color>(
                isDark ? AppColors.darkEmerald : AppColors.emerald,
              ),
              minHeight: 2.5,
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Row(
                children: [
                  // Return to Player action & info
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        _saveCurrentScrollPosition();
                        Navigator.pop(context);
                      },
                      borderRadius: BorderRadius.circular(8),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4.0),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: isDark ? AppColors.darkGreenBg : AppColors.darkGreenBgLight,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isDark ? AppColors.darkGreenBorder : AppColors.darkGreenBorderLight,
                                ),
                              ),
                              child: Icon(
                                Icons.headphones_rounded,
                                color: isDark ? AppColors.darkGreenText : AppColors.darkGreenTextLight,
                                size: 18,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    widget.chapter.title,
                                    style: TextStyle(
                                      fontFamily: 'serif',
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: isDark ? AppColors.darkTextPrimary : AppColors.textPrimary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    '${_formatDuration(position)} / ${_formatDuration(duration)}',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: isDark ? AppColors.darkTextMuted : AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Play/Pause button
                  IconButton(
                    iconSize: 32,
                    color: isDark ? AppColors.darkEmerald : AppColors.emerald,
                    icon: Icon(isPlaying ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded),
                    onPressed: () {
                      if (isPlaying) {
                        playerService.pause();
                      } else {
                        playerService.play();
                      }
                    },
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
