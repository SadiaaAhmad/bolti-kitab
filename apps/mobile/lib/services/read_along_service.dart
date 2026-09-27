import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/read_along_models.dart';

/// Bolti Kitab — Read Along Service
///
/// Handles retrieval of authoritative read-along documents and manages
/// local client-side reading position persistence (scroll offset and last read paragraph).
class ReadAlongService {
  static const String _scrollPrefix = 'read_along_scroll_';
  static const String _paraPrefix = 'read_along_last_para_';

  /// Fetch the ReadAlongDocument for a given book and chapter/section.
  /// Currently resolves to the development vertical slice asset for The Art of War Part 1.
  Future<ReadAlongDocument> loadDocument({
    required String bookId,
    required int chapterNum,
  }) async {
    // Map to content assets for the active catalog content (Part 1 and Part 2)
    final assetPath = chapterNum == 2
        ? 'assets/content/the_art_of_war_part_2.json'
        : 'assets/content/the_art_of_war_part_1.json';

    final jsonString = await rootBundle.loadString(assetPath);
    final Map<String, dynamic> data = json.decode(jsonString) as Map<String, dynamic>;
    return ReadAlongDocument.fromJson(data);
  }

  /// Store user's scroll offset locally in SharedPreferences.
  Future<void> saveReadingScrollPosition({
    required String bookId,
    required String sectionId,
    required double scrollOffset,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('$_scrollPrefix${bookId}_$sectionId', scrollOffset);
  }

  /// Retrieve user's stored scroll offset from SharedPreferences.
  Future<double> getReadingScrollPosition({
    required String bookId,
    required String sectionId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getDouble('$_scrollPrefix${bookId}_$sectionId') ?? 0.0;
  }

  /// Store last-viewed paragraph ID.
  Future<void> saveLastReadParagraph({
    required String bookId,
    required String sectionId,
    required String paragraphId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_paraPrefix${bookId}_$sectionId', paragraphId);
  }

  /// Retrieve last-viewed paragraph ID.
  Future<String?> getLastReadParagraph({
    required String bookId,
    required String sectionId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('$_paraPrefix${bookId}_$sectionId');
  }
}
