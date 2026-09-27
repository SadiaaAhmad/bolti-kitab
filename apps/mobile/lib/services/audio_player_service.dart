import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../models/models.dart';
import 'api_service.dart';

class AudioPlayerService extends ChangeNotifier {
  final AudioPlayer _player = AudioPlayer();

  PlaybackToken? _currentToken;
  String? _currentBookId;
  String? _authToken;
  bool _isPlaying = false;
  bool _isLoading = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  int _updateSeq = DateTime.now().millisecondsSinceEpoch ~/ 1000;

  Timer? _progressSyncTimer;

  AudioPlayer get player => _player;
  PlaybackToken? get currentToken => _currentToken;
  bool get isPlaying => _isPlaying;
  bool get isLoading => _isLoading;
  Duration get position => _position;
  Duration get duration => _duration;

  AudioPlayerService() {
    _player.playbackEventStream.listen(
      (event) {},
      onError: (Object e, StackTrace st) {
        debugPrint('[player-service] Playback stream error: $e');
      },
    );

    _player.playerStateStream.listen((state) {
      _isPlaying = state.playing;
      _isLoading = state.processingState == ProcessingState.loading ||
          state.processingState == ProcessingState.buffering;
      notifyListeners();

      if (!state.playing &&
          (state.processingState == ProcessingState.ready ||
              state.processingState == ProcessingState.completed)) {
        // Paused or finished -> sync progress immediately
        _syncProgress();
      }
    });

    _player.positionStream.listen((pos) {
      _position = pos;
      notifyListeners();
    });

    _player.durationStream.listen((dur) {
      if (dur != null && dur > Duration.zero) {
        _duration = dur;
        notifyListeners();
      }
    });
  }

  Future<void> loadAndPlay({
    required PlaybackToken token,
    required String bookId,
    required String authToken,
    int initialPositionMs = 0,
  }) async {
    _currentToken = token;
    _currentBookId = bookId;
    _authToken = authToken;
    _isLoading = true;
    if (token.durationMs > 0) {
      _duration = Duration(milliseconds: token.durationMs);
    }
    notifyListeners();

    try {
      debugPrint('[player-service] Initializing audio from URL: ${token.playbackUrl}');

      // Skip disclaimer: start directly from token.startMs unless resuming past it
      final startPosMs = initialPositionMs > token.startMs
          ? initialPositionMs
          : token.startMs;

      if (startPosMs > 0) {
        debugPrint('[player-service] Loading audio directly at content start: ${startPosMs}ms');
        await _player.setUrl(
          token.playbackUrl,
          initialPosition: Duration(milliseconds: startPosMs),
        );
      } else {
        await _player.setUrl(token.playbackUrl);
      }

      await _player.play();

      // Start periodic progress sync timer (every 12 seconds)
      _startPeriodicSync();
    } catch (e, st) {
      debugPrint('[player-service] Failed to load/play audio: $e\n$st');
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  void _startPeriodicSync() {
    _progressSyncTimer?.cancel();
    _progressSyncTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (_isPlaying) {
        _syncProgress();
      }
    });
  }

  Future<void> play() async {
    await _player.play();
  }

  Future<void> pause() async {
    await _player.pause();
    await _syncProgress();
  }

  Future<void> seek(Duration target) async {
    final minMs = _currentToken?.startMs ?? 0;
    final clamped = target.inMilliseconds < minMs
        ? Duration(milliseconds: minMs)
        : target;
    await _player.seek(clamped);
    await _syncProgress();
  }

  Future<void> seekRelative(int seconds) async {
    final minMs = _currentToken?.startMs ?? 0;
    final maxMs = minMs + (_currentToken?.durationMs ?? _duration.inMilliseconds);

    final newMs = _position.inMilliseconds + (seconds * 1000);
    final clampedMs = newMs < minMs
        ? minMs
        : (maxMs > minMs && newMs > maxMs ? maxMs : newMs);
    await _player.seek(Duration(milliseconds: clampedMs));
    await _syncProgress();
  }

  Future<void> _syncProgress([int? explicitPosMs]) async {
    if (_authToken == null || _currentBookId == null || _currentToken == null) return;
    try {
      final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      _updateSeq = math.max(_updateSeq + 1, nowSec);
      final posToSave = explicitPosMs ?? _position.inMilliseconds;
      final updated = await ApiService.saveProgress(
        token: _authToken!,
        bookId: _currentBookId!,
        chapterId: _currentToken!.chapterId,
        positionMs: posToSave,
        updateSeq: _updateSeq,
      );
      if (updated.updateSeq >= _updateSeq) {
        _updateSeq = updated.updateSeq + 1;
      }
      debugPrint('[player-service] Progress synced: ${updated.positionMs}ms (seq: ${updated.updateSeq})');
    } catch (e) {
      debugPrint('[player-service] Progress sync error: $e');
    }
  }

  Future<void> syncExplicitProgress(int positionMs) async {
    await _syncProgress(positionMs);
  }

  Future<void> resetProgressToStart() async {
    final minMs = _currentToken?.startMs ?? 0;
    await _player.seek(Duration(milliseconds: minMs));
    await _syncProgress(minMs);
  }

  @override
  void dispose() {
    _progressSyncTimer?.cancel();
    _player.dispose();
    super.dispose();
  }
}
