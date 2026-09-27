import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Bolti Kitab Bookmark Provider
/// Manages user's saved/bookmarked audiobooks and persists them to SharedPreferences.
class BookmarkProvider extends ChangeNotifier {
  static const String _prefKey = 'saved_bookmarked_book_ids';

  final Set<String> _bookmarkedBookIds = {};
  bool _isLoaded = false;

  BookmarkProvider() {
    _loadBookmarks();
  }

  Set<String> get bookmarkedBookIds => Set.unmodifiable(_bookmarkedBookIds);
  bool get isLoaded => _isLoaded;

  bool isBookmarked(String bookId) {
    return _bookmarkedBookIds.contains(bookId);
  }

  Future<void> _loadBookmarks() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final list = prefs.getStringList(_prefKey) ?? [];
      _bookmarkedBookIds.addAll(list);
      _isLoaded = true;
      notifyListeners();
    } catch (_) {
      _isLoaded = true;
    }
  }

  Future<bool> toggleBookmark(String bookId) async {
    final bool nowBookmarked;
    if (_bookmarkedBookIds.contains(bookId)) {
      _bookmarkedBookIds.remove(bookId);
      nowBookmarked = false;
    } else {
      _bookmarkedBookIds.add(bookId);
      nowBookmarked = true;
    }
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_prefKey, _bookmarkedBookIds.toList());
    } catch (_) {}

    return nowBookmarked;
  }

  Future<void> addBookmark(String bookId) async {
    if (_bookmarkedBookIds.add(bookId)) {
      notifyListeners();
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList(_prefKey, _bookmarkedBookIds.toList());
      } catch (_) {}
    }
  }

  Future<void> removeBookmark(String bookId) async {
    if (_bookmarkedBookIds.remove(bookId)) {
      notifyListeners();
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setStringList(_prefKey, _bookmarkedBookIds.toList());
      } catch (_) {}
    }
  }
}
