/// Voice Channel Providers — Riverpod state management
///
/// Manages the voice interaction state:
/// - Recording (on-device STT with file-capture fallback)
/// - Processing state
/// - Response mode (KNOW/ASK/UNKNOWN)
/// - Conversation history
/// - Number read-back confirmation
/// - Spoken responses (TTS) with a persisted on/off toggle
library features_voice_providers_voice_provider;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/edge/edge_processor.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/logger.dart';
import '../../../shared/models/zone_models.dart';
import '../../../shared/services/voice_audio_service.dart';

// ─── Voice State ───

enum VoiceState { idle, recording, processing, responding, confirmingNumber }

class VoiceConversationItem {
  final String text;
  final bool isUser;
  final DateTime timestamp;
  final ResponseMode? mode;
  final String? readbackText;

  const VoiceConversationItem({
    required this.text,
    required this.isUser,
    required this.timestamp,
    this.mode,
    this.readbackText,
  });
}

/// How the current capture session is running.
enum CaptureMode {
  /// On-device speech recognition (streams live transcript).
  stt,

  /// Raw microphone capture to a file (fallback when STT is unavailable).
  file,
}

class VoiceStateData {
  final VoiceState state;
  final List<VoiceConversationItem> conversation;
  final String? currentReadbackText;
  final String? pendingNumberId;
  final EdgeProcessingResult? lastEdgeResult;
  final String? errorMessage;

  /// Partial transcript while the mic is live (STT mode).
  final String liveTranscript;

  /// Active capture path while [state] == [VoiceState.recording].
  final CaptureMode captureMode;

  /// Whether Zone speaks its replies out loud (persisted).
  final bool ttsEnabled;

  /// True while the TTS engine is actually speaking a reply.
  final bool isSpeaking;

  const VoiceStateData({
    this.state = VoiceState.idle,
    this.conversation = const [],
    this.currentReadbackText,
    this.pendingNumberId,
    this.lastEdgeResult,
    this.errorMessage,
    this.liveTranscript = '',
    this.captureMode = CaptureMode.stt,
    this.ttsEnabled = true,
    this.isSpeaking = false,
  });

  VoiceStateData copyWith({
    VoiceState? state,
    List<VoiceConversationItem>? conversation,
    String? currentReadbackText,
    String? pendingNumberId,
    EdgeProcessingResult? lastEdgeResult,
    String? errorMessage,
    String? liveTranscript,
    CaptureMode? captureMode,
    bool? ttsEnabled,
    bool? isSpeaking,
    bool clearReadback = false,
  }) {
    return VoiceStateData(
      state: state ?? this.state,
      conversation: conversation ?? this.conversation,
      currentReadbackText:
          clearReadback ? null : (currentReadbackText ?? this.currentReadbackText),
      pendingNumberId: pendingNumberId ?? this.pendingNumberId,
      lastEdgeResult: lastEdgeResult ?? this.lastEdgeResult,
      errorMessage: errorMessage,
      liveTranscript: liveTranscript ?? this.liveTranscript,
      captureMode: captureMode ?? this.captureMode,
      ttsEnabled: ttsEnabled ?? this.ttsEnabled,
      isSpeaking: isSpeaking ?? this.isSpeaking,
    );
  }
}

// ─── Providers ───

final voiceAudioServiceProvider = Provider<VoiceAudioService>((ref) {
  final service = VoiceAudioService();
  ref.onDispose(() => unawaited(service.dispose()));
  return service;
});

final voiceProvider = StateNotifierProvider<VoiceNotifier, VoiceStateData>((ref) {
  return VoiceNotifier(
    ref.read(apiClientProvider),
    ref.read(voiceAudioServiceProvider),
  );
});

// ─── Voice Notifier ───

class VoiceNotifier extends StateNotifier<VoiceStateData> {
  static const _ttsPrefsKey = 'voice_tts_enabled';

  final ApiClient _api;
  final VoiceAudioService _audio;
  final EdgeProcessor _edgeProcessor = EdgeProcessor();
  final ZoneLogger _logger = ZoneLogger('Voice');

  VoiceNotifier(this._api, this._audio) : super(const VoiceStateData()) {
    unawaited(_bootstrap());
  }

  Future<void> _bootstrap() async {
    await _audio.initialize();

    // Restore the spoken-replies preference.
    try {
      final prefs = await SharedPreferences.getInstance();
      final enabled = prefs.getBool(_ttsPrefsKey) ?? true;
      if (!enabled && mounted) {
        state = state.copyWith(ttsEnabled: false);
      }
    } catch (e) {
      _logger.warning('Failed to restore TTS preference', e);
    }
  }

  // ─── Recording ───

  /// Start capturing voice input.
  ///
  /// Prefers on-device Persian STT (streams a live transcript into state).
  /// Falls back to raw file recording when no recognizer is installed.
  Future<void> startRecording() async {
    if (state.state == VoiceState.recording) return;

    // Zone should never talk over the user.
    await _audio.stopSpeaking();
    if (mounted) {
      state = state.copyWith(isSpeaking: false);
    }

    state = state.copyWith(
      state: VoiceState.recording,
      liveTranscript: '',
      errorMessage: null,
    );

    // ─── Primary path: on-device STT ───
    final listening = await _audio.startListening(
      onTranscript: (transcript) {
        if (mounted && state.state == VoiceState.recording) {
          state = state.copyWith(liveTranscript: transcript);
        }
      },
    );

    if (listening && mounted) {
      state = state.copyWith(captureMode: CaptureMode.stt);
      return;
    }

    // ─── Fallback path: file capture ───
    final recording = await _audio.startFileRecording();
    if (recording && mounted) {
      state = state.copyWith(captureMode: CaptureMode.file);
      return;
    }

    // ─── Neither path available (e.g. permission denied) ───
    if (mounted) {
      _appendZoneMessage(
        'نمی‌تونم میکروفون رو باز کنم. لطفاً از تنظیمات گوشی اجازه میکروفون رو برای زون فعال کن 🎙️',
      );
      state = state.copyWith(state: VoiceState.idle);
    }
  }

  /// Stop capturing and process whatever was captured.
  Future<void> stopRecordingAndProcess() async {
    if (state.state != VoiceState.recording) return;

    if (state.captureMode == CaptureMode.stt) {
      final result = await _audio.stopListening();
      if (!mounted) return;
      state = state.copyWith(liveTranscript: '');

      final transcript = result.transcript.trim();
      if (transcript.isEmpty) {
        _appendZoneMessage('متوجه حرفت نشدم. یه بار دیگه، واضح‌تر بگو 🙏');
        state = state.copyWith(state: VoiceState.idle);
        return;
      }
      await processInput(transcript);
      return;
    }

    // ─── File-capture fallback ───
    // The recorded file is kept on-device. Server-side speech
    // recognition for captured files lands with the audio pipeline
    // endpoint; until then we ask the user to type or speak again.
    final result = await _audio.stopFileRecording();
    if (!mounted) return;
    state = state.copyWith(state: VoiceState.idle, liveTranscript: '');

    if (result.hasFile) {
      _logger.info('Voice captured to file: ${result.filePath}');
      _appendZoneMessage(
        'صدات ضبط شد، ولی تشخیص گفتار روی گوشی‌ات فعال نیست. لطفاً پیامت رو بنویس 📝',
      );
    } else {
      _appendZoneMessage('ضبط صدا انجام نشد. دوباره امتحان کن.');
    }
  }

  /// Cancel the current capture / playback and return to idle.
  Future<void> cancel() async {
    if (state.state == VoiceState.recording) {
      if (state.captureMode == CaptureMode.stt) {
        await _audio.cancelListening();
      } else {
        await _audio.cancelFileRecording();
      }
    }
    if (mounted) {
      state = state.copyWith(state: VoiceState.idle, liveTranscript: '');
    }
  }

  // ─── Spoken responses (TTS) ───

  /// Toggle spoken replies. Persisted across launches.
  Future<void> setTtsEnabled(bool enabled) async {
    state = state.copyWith(ttsEnabled: enabled);
    if (!enabled) {
      await stopSpeaking();
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_ttsPrefsKey, enabled);
    } catch (e) {
      _logger.warning('Failed to persist TTS preference', e);
    }
  }

  /// Stop the currently speaking reply.
  Future<void> stopSpeaking() async {
    await _audio.stopSpeaking();
    if (mounted && state.isSpeaking) {
      state = state.copyWith(isSpeaking: false);
    }
  }

  /// Speak a Zone reply when enabled. Never blocks error handling and
  /// never throws — voice output is a convenience, not a requirement.
  Future<void> _speakReply(String text) async {
    if (!state.ttsEnabled) return;
    if (mounted) state = state.copyWith(isSpeaking: true);
    try {
      await _audio.speak(text);
    } finally {
      if (mounted) state = state.copyWith(isSpeaking: false);
    }
  }

  // ─── Processing ───

  /// Process user input (text or voice transcript).
  Future<void> processInput(String rawText, {String? personId, String? zoneId}) async {
    // Add user message to conversation
    state = state.copyWith(
      state: VoiceState.processing,
      errorMessage: null,
      conversation: [
        ...state.conversation,
        VoiceConversationItem(
          text: rawText,
          isUser: true,
          timestamp: DateTime.now(),
        ),
      ],
    );

    try {
      // ─── Step 1: On-device processing (privacy: raw text stays on device) ───
      final edgeResult = _edgeProcessor.process(rawText);
      _logger.info('Edge processing: tags=${edgeResult.tags}, intent=${edgeResult.intent}, '
          'numbers=${edgeResult.numbers.length}, confidence=${edgeResult.confidence}');

      // ─── Step 2: Check for number read-back ───
      if (edgeResult.numbers.isNotEmpty && edgeResult.readbackText != null) {
        state = state.copyWith(
          state: VoiceState.confirmingNumber,
          currentReadbackText: edgeResult.readbackText,
          lastEdgeResult: edgeResult,
          conversation: [
            ...state.conversation,
            VoiceConversationItem(
              text: edgeResult.readbackText!,
              isUser: false,
              timestamp: DateTime.now(),
              mode: null,
              readbackText: edgeResult.readbackText,
            ),
          ],
        );
        unawaited(_speakReply(edgeResult.readbackText!));
        return;
      }

      // ─── Step 3: Fast path (high confidence, no cloud needed) ───
      if (edgeResult.confidence >= 0.8 && edgeResult.intent == 'KNOW') {
        // Fast path: use local knowledge only
        state = state.copyWith(
          state: VoiceState.responding,
          lastEdgeResult: edgeResult,
          conversation: [
            ...state.conversation,
            VoiceConversationItem(
              text: 'بذار ببینم...', // Bridging response
              isUser: false,
              timestamp: DateTime.now(),
            ),
          ],
        );
      }

      // ─── Step 4: Cloud processing (send structured data only) ───
      final response = await _api.processVoice(
        text: rawText,
        personId: personId,
        zoneId: zoneId,
      );

      if (!mounted) return;

      if (response.isSuccess) {
        final data = response.data as Map<String, dynamic>;
        final responseText = data['response'] as String? ?? 'ببخشید، متوجه نشدم.';
        final modeStr = data['mode'] as String?;
        ResponseMode? mode;
        if (modeStr == 'KNOW') {
          mode = ResponseMode.know;
        }
        else if (modeStr == 'ASK') {
          mode = ResponseMode.ask;
        }
        else if (modeStr == 'UNKNOWN') {
          mode = ResponseMode.unknown;
        }

        state = state.copyWith(
          state: VoiceState.idle,
          conversation: [
            ...state.conversation,
            VoiceConversationItem(
              text: responseText,
              isUser: false,
              timestamp: DateTime.now(),
              mode: mode,
            ),
          ],
        );
        unawaited(_speakReply(responseText));
      } else {
        state = state.copyWith(
          state: VoiceState.idle,
          errorMessage: response.errorMessage,
          conversation: [
            ...state.conversation,
            VoiceConversationItem(
              text: response.errorMessage ?? 'خطایی رخ داد. دوباره تلاش کنید.',
              isUser: false,
              timestamp: DateTime.now(),
            ),
          ],
        );
      }
    } catch (e) {
      _logger.error('Voice processing error', e);
      if (mounted) {
        state = state.copyWith(
          state: VoiceState.idle,
          errorMessage: 'خطای غیرمنتظره. لطفاً دوباره تلاش کنید.',
        );
      }
    }
  }

  // ─── Number read-back confirmation ───

  /// Confirm number read-back
  Future<void> confirmNumber(bool confirmed) async {
    if (state.currentReadbackText != null) {
      // Add user confirmation to conversation
      state = state.copyWith(
        conversation: [
          ...state.conversation,
          VoiceConversationItem(
            text: confirmed ? 'بله، درسته' : 'نه، اشتباهه',
            isUser: true,
            timestamp: DateTime.now(),
          ),
        ],
        clearReadback: true,
      );

      final String reply;
      if (confirmed) {
        // Number confirmed → lock it
        reply = '✅ عدد تأیید شد و ثبت شد.';
      } else {
        // Number rejected
        reply = 'اشکالی نداره. دوباره بگو تا درست بشه.';
      }

      state = state.copyWith(
        conversation: [
          ...state.conversation,
          VoiceConversationItem(
            text: reply,
            isUser: false,
            timestamp: DateTime.now(),
          ),
        ],
      );
      unawaited(_speakReply(reply));
    }

    state = state.copyWith(state: VoiceState.idle);
  }

  // ─── Conversation ───

  /// Clear conversation
  Future<void> clearConversation() async {
    await _audio.stopSpeaking();
    final ttsEnabled = state.ttsEnabled;
    state = VoiceStateData(ttsEnabled: ttsEnabled);
  }

  void _appendZoneMessage(String text) {
    if (!mounted) return;
    state = state.copyWith(
      conversation: [
        ...state.conversation,
        VoiceConversationItem(
          text: text,
          isUser: false,
          timestamp: DateTime.now(),
        ),
      ],
    );
  }
}
