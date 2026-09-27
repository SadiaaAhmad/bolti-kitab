import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class ApiService {
  static const List<String> candidateUrls = [
    'http://localhost:3000/api/v1',
    'http://10.1.162.154:3000/api/v1',
    'http://10.1.160.101:3000/api/v1',
    'http://10.0.2.2:3000/api/v1',
  ];

  static String baseUrl = 'http://localhost:3000/api/v1';

  static Map<String, String> _headers([String? token]) {
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final urlsToTry = [baseUrl, ...candidateUrls.where((u) => u != baseUrl)];
    dynamic lastError;

    for (final candidate in urlsToTry) {
      try {
        final res = await http
            .post(
              Uri.parse('$candidate/auth/login'),
              headers: _headers(),
              body: jsonEncode({'email': email, 'password': password}),
            )
            .timeout(const Duration(seconds: 4));

        if (res.statusCode == 200) {
          baseUrl = candidate; // Persist working URL
          return jsonDecode(res.body) as Map<String, dynamic>;
        } else {
          final body = jsonDecode(res.body);
          throw Exception(body['message'] ?? 'Login failed');
        }
      } catch (e) {
        lastError = e;
        final errStr = e.toString().toLowerCase();
        // If it's an explicit authentication error, don't try other URLs
        if (errStr.contains('invalid') || errStr.contains('credential') || errStr.contains('password') || errStr.contains('user not found')) {
          rethrow;
        }
        // If it's a network error or timeout, continue to next candidate URL
      }
    }
    throw lastError ?? Exception('Could not connect to server. Check your network or USB connection.');
  }

  static Future<List<Book>> getBooks({String? token}) async {
    final res = await http
        .get(
          Uri.parse('$baseUrl/books'),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 8));

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final list = data['books'] as List<dynamic>? ?? [];
      return list.map((b) => Book.fromJson(b as Map<String, dynamic>)).toList();
    } else {
      throw Exception('Failed to load audiobooks');
    }
  }

  static Future<Map<String, dynamic>> getPlaybackOverview(String token, String bookId) async {
    final res = await http
        .get(
          Uri.parse('$baseUrl/playback/books/$bookId'),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 8));

    if (res.statusCode == 200) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    } else {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? 'Failed to load playback overview');
    }
  }

  static Future<PlaybackToken> getChapterPlaybackToken(
    String token,
    String bookId,
    String chapterId,
  ) async {
    final res = await http
        .get(
          Uri.parse('$baseUrl/playback/books/$bookId/chapters/$chapterId'),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 8));

    if (res.statusCode == 200) {
      return PlaybackToken.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
    } else {
      final body = jsonDecode(res.body);
      throw Exception(body['message'] ?? 'Failed to authorize chapter playback');
    }
  }

  static Future<ListeningProgress> saveProgress({
    required String token,
    required String bookId,
    required String chapterId,
    required int positionMs,
    int updateSeq = 1,
  }) async {
    final res = await http
        .put(
          Uri.parse('$baseUrl/playback/books/$bookId/progress'),
          headers: _headers(token),
          body: jsonEncode({
            'chapter_id': chapterId,
            'position_ms': positionMs,
            'update_seq': updateSeq,
            'is_completed': false,
          }),
        )
        .timeout(const Duration(seconds: 8));

    if (res.statusCode == 200) {
      return ListeningProgress.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
    } else {
      throw Exception('Failed to synchronize listening progress');
    }
  }
}
