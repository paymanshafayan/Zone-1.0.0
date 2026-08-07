/// Voice Audio Service — Single facade for all audio operations
///
/// Wraps the proven, actively-maintained audio stack:
///   • just_audio + audio_session → playback & audio focus/interruptions
///   • record → microphone capture (file-based fallback path)
///   • speech_to_text → on-device Persian speech recognition (primary path)
///   • flutter_tts → spoken Persian responses
///
/// Design notes:
/// - Every native call is guarded: a missing platform capability (no
///   recognizer installed, permission denied, no Persian TTS voice)
///   never crashes the voice channel — the service degrades gracefully
///   and reports availability through [isSttAvailable] / [isTtsAvailable].
/// - Recording has TWO modes:
///     1. Live STT (preferred) — recognized text streams back via callbacks
///     2. File capture (fallback) — records an .m4a for a future
///        server-side STT endpoint
library shared_services_voice_audio_service;

import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:uuid/uuid.dart';

import '../../core/utils/logger.dart';

/// Result of a finished capture session.
class VoiceCaptureResult {
  /// Recognized text (live STT mode) — may be empty.
  final String transcript;

  /// Recorded file path (file-capture fallback mode) — null in STT mode.
  final String? filePath;

  const VoiceCaptureResult({this.transcript = '', this.filePath});

  bool get hasTranscript => transcript.trim().isNotEmpty;
  bool get hasFile => filePath != null;
}

class VoiceAudioService {
  /// On-device recognition locale — Persian (Iran).
  static const String defaultLocaleId = 'fa_IR';

  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _player = AudioPlayer();
  final SpeechToText _speech = SpeechToText();
  final FlutterTts _tts = FlutterTts();
  final ZoneLogger _logger = ZoneLogger('VoiceAudio');

  bool _initialized = false;

  bool _sttAvailable = false;
  bool _ttsAvailable = false;
  bool _ttsPersianAvailable = false;
  bool _isSpeaking = false;

  String? _recordingPath;
  String _lastTranscript = '';

  // ─── Availability getters ───

  /// True when on-device speech recognition can be used.
  bool get isSttAvailable => _sttAvailable;

  /// True when the platform TTS engine responded to initialization.
  bool get isTtsAvailable => _ttsAvailable;

  /// True when a Persian voice is installed on the device.
  bool get isPersianVoiceAvailable => _ttsPersianAvailable;

  bool get isSpeaking => _isSpeaking;

  // ─── Initialization ───

  /// Idempotent initialization: audio session, STT, and TTS.
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    await _configureAudioSession();
    await _initSpeech();
    await _initTts();
  }

  Future<void> _configureAudioSession() async {
    try {
      final session = await AudioSession.instance;
      await session.configure(AudioSessionConfiguration.speech());
      await session.setActive(true);
    } catch (e) {
      // Non-fatal: playback still works without explicit session config.
      _logger.warning('AudioSession configuration failed', e);
    }
  }

  Future<void> _initSpeech() async {
    try {
      _sttAvailable = await _speech.initialize(
        onError: (error) =>
            _logger.warning('STT error: ${error.errorMsg}'),
        onStatus: (status) => _logger.debug('STT status: $status'),
      );
      _logger.info('STT initialized: available=$_sttAvailable');
    } catch (e) {
      _sttAvailable = false;
      _logger.warning('STT initialization failed', e);
    }
  }

  Future<void> _initTts() async {
    try {
      await _tts.setLanguage(defaultLocaleId.replaceAll('_', '-'));
      await _tts.setSpeechRate(0.45);
      await _tts.setVolume(1.0);
      await _tts.setPitch(1.0);

      // speak() resolves when the utterance finishes (never hangs the UI).
      await _tts.awaitSpeakCompletion(true);

      _tts
        ..setStartHandler(() => _isSpeaking = true)
        ..setCompletionHandler(() => _isSpeaking = false)
        ..setCancelHandler(() => _isSpeaking = false)
        ..setErrorHandler((message) {
          _logger.warning('TTS error', message);
          _isSpeaking = false;
        });

      _ttsAvailable = true;

      // Check whether a Persian voice exists on this device.
      try {
        final dynamic available =
            await _tts.isLanguageAvailable(defaultLocaleId.replaceAll('_', '-'));
        _ttsPersianAvailable = available == true || available == 1;
        if (!_ttsPersianAvailable) {
          _logger.warning('Persian TTS voice is not installed on this device');
        }
      } catch (e) {
        _ttsPersianAvailable = false;
      }
    } catch (e) {
      _ttsAvailable = false;
      _logger.warning('TTS initialization failed', e);
    }
  }

  // ─── Live speech-to-text (primary capture path) ───

  /// Starts on-device recognition. Recognized text is delivered through
  /// [onTranscript] (partial and final results both stream there).
  ///
  /// Returns false when STT is unavailable so callers can fall back to
  /// file capture.
  Future<bool> startListening({
    required void Function(String transcript) onTranscript,
    String localeId = defaultLocaleId,
  }) async {
    if (!_sttAvailable) return false;

    // Never listen while Zone is speaking — stop any utterance first.
    await stopSpeaking();

    _lastTranscript = '';

    try {
      await _speech.listen(
        onResult: (result) {
          _lastTranscript = result.recognizedWords;
          onTranscript(result.recognizedWords);
        },
        localeId: localeId,
        listenFor: const Duration(seconds: 60),
        pauseFor: const Duration(seconds: 5),
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: true,
          listenMode: ListenMode.dictation,
        ),
      );
      return true;
    } catch (e) {
      _logger.warning('Failed to start listening', e);
      return false;
    }
  }

  /// Stops listening and returns whatever was recognized.
  Future<VoiceCaptureResult> stopListening() async {
    try {
      if (_speech.isListening) {
        await _speech.stop();
      }
    } catch (e) {
      _logger.warning('Failed to stop listening', e);
    }
    return VoiceCaptureResult(transcript: _lastTranscript);
  }

  /// Cancels listening and discards the transcript.
  Future<void> cancelListening() async {
    try {
      if (_speech.isListening) {
        await _speech.cancel();
      }
    } catch (e) {
      _logger.warning('Failed to cancel listening', e);
    }
    _lastTranscript = '';
  }

  // ─── File recording (fallback capture path) ───

  /// Starts recording to a temporary .m4a file.
  ///
  /// Asks for microphone permission via the plugin. Returns false when
  /// permission is denied or recording cannot start.
  Future<bool> startFileRecording() async {
    try {
      final permitted = await _recorder.hasPermission();
      if (!permitted) {
        _logger.warning('Microphone permission denied');
        return false;
      }

      final dir = await getTemporaryDirectory();
      final path =
          '${dir.path}/zone_voice_${const Uuid().v4()}.m4a';

      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 96000,
          sampleRate: 44100,
        ),
        path: path,
      );
      _recordingPath = path;
      return true;
    } catch (e) {
      _logger.warning('Failed to start file recording', e);
      _recordingPath = null;
      return false;
    }
  }

  /// Stops file recording and returns the captured file path.
  Future<VoiceCaptureResult> stopFileRecording() async {
    try {
      final path = await _recorder.stop();
      _recordingPath = null;
      if (path != null && path.isNotEmpty) {
        return VoiceCaptureResult(filePath: path);
      }
    } catch (e) {
      _logger.warning('Failed to stop file recording', e);
    }
    return const VoiceCaptureResult();
  }

  /// Cancels file recording and deletes the partial file.
  Future<void> cancelFileRecording() async {
    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
      final path = _recordingPath;
      if (path != null) {
        final file = File(path);
        if (await file.exists()) {
          await file.delete();
        }
      }
    } catch (e) {
      _logger.warning('Failed to cancel file recording', e);
    }
    _recordingPath = null;
  }

  // ─── Text-to-speech ───

  /// Speaks [text] and resolves when the utterance completes.
  ///
  /// [FlutterTts.awaitSpeakCompletion] is enabled at init, so [speak]'s
  /// own future resolves when the utterance finishes; a timeout guards
  /// against a stuck engine so the UI can never deadlock.
  ///
  /// No-ops silently when TTS is unavailable — the conversation UI is
  /// authoritative; voice is a convenience layer.
  Future<void> speak(String text) async {
    if (!_ttsAvailable || text.trim().isEmpty) return;

    _isSpeaking = true;
    try {
      await _tts
          .speak(text)
          .timeout(const Duration(seconds: 30), onTimeout: () => 0);
    } catch (e) {
      _logger.warning('TTS speak failed', e);
    } finally {
      _isSpeaking = false;
    }
  }

  Future<void> stopSpeaking() async {
    if (!_ttsAvailable) return;
    try {
      await _tts.stop();
    } catch (e) {
      _logger.warning('TTS stop failed', e);
    }
    _isSpeaking = false;
  }

  // ─── Playback (voice replies, hearing spaces, post audio) ───

  /// Plays audio from a remote URL through just_audio.
  Future<void> playUrl(String url) async {
    try {
      await _player.setUrl(url);
      await _player.play();
    } catch (e) {
      _logger.warning('Playback failed', e);
    }
  }

  /// Plays a local audio file (e.g. a just-captured voice note).
  Future<void> playFile(String path) async {
    try {
      await _player.setFilePath(path);
      await _player.play();
    } catch (e) {
      _logger.warning('File playback failed', e);
    }
  }

  Future<void> stopPlayback() async {
    try {
      await _player.stop();
    } catch (e) {
      _logger.warning('Playback stop failed', e);
    }
  }

  Stream<PlayerState> get playerStateStream => _player.playerStateStream;

  // ─── Lifecycle ───

  Future<void> dispose() async {
    try {
      await _speech.cancel();
    } catch (_) {}
    try {
      await _tts.stop();
    } catch (_) {}
    try {
      await _recorder.dispose();
    } catch (_) {}
    try {
      await _player.dispose();
    } catch (_) {}
  }
}
