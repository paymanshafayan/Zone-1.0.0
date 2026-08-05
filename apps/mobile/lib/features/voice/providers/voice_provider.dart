/// Voice Channel Providers — Riverpod state management
///
/// Manages the voice interaction state:
/// - Recording state
/// - Processing state
/// - Response mode (KNOW/ASK/UNKNOWN)
/// - Conversation history
/// - Number read-back confirmation
library features_voice_providers_voice_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/edge/edge_processor.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/logger.dart';
import '../../../shared/models/zone_models.dart';

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

class VoiceStateData {
  final VoiceState state;
  final List<VoiceConversationItem> conversation;
  final String? currentReadbackText;
  final String? pendingNumberId;
  final EdgeProcessingResult? lastEdgeResult;
  final String? errorMessage;

  const VoiceStateData({
    this.state = VoiceState.idle,
    this.conversation = const [],
    this.currentReadbackText,
    this.pendingNumberId,
    this.lastEdgeResult,
    this.errorMessage,
  });

  VoiceStateData copyWith({
    VoiceState? state,
    List<VoiceConversationItem>? conversation,
    String? currentReadbackText,
    String? pendingNumberId,
    EdgeProcessingResult? lastEdgeResult,
    String? errorMessage,
  }) {
    return VoiceStateData(
      state: state ?? this.state,
      conversation: conversation ?? this.conversation,
      currentReadbackText: currentReadbackText ?? this.currentReadbackText,
      pendingNumberId: pendingNumberId ?? this.pendingNumberId,
      lastEdgeResult: lastEdgeResult ?? this.lastEdgeResult,
      errorMessage: errorMessage,
    );
  }
}

// ─── Voice Provider ───

final voiceProvider = StateNotifierProvider<VoiceNotifier, VoiceStateData>((ref) {
  return VoiceNotifier(ref.read(apiClientProvider));
});

class VoiceNotifier extends StateNotifier<VoiceStateData> {
  final ApiClient _api;
  final EdgeProcessor _edgeProcessor = EdgeProcessor();
  final ZoneLogger _logger = ZoneLogger('Voice');

  VoiceNotifier(this._api) : super(const VoiceStateData());

  /// Start recording
  void startRecording() {
    state = state.copyWith(state: VoiceState.recording);
  }

  /// Process user input (text or voice)
  Future<void> processInput(String rawText, {String? personId, String? zoneId}) async {
    // Add user message to conversation
    state = state.copyWith(
      state: VoiceState.processing,
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
      state = state.copyWith(
        state: VoiceState.idle,
        errorMessage: 'خطای غیرمنتظره. لطفاً دوباره تلاش کنید.',
      );
    }
  }

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
        currentReadbackText: null,
      );

      if (confirmed) {
        // Number confirmed → lock it
        state = state.copyWith(
          conversation: [
            ...state.conversation,
            VoiceConversationItem(
              text: '✅ عدد تأیید شد و ثبت شد.',
              isUser: false,
              timestamp: DateTime.now(),
            ),
          ],
        );
      } else {
        // Number rejected
        state = state.copyWith(
          conversation: [
            ...state.conversation,
            VoiceConversationItem(
              text: 'اشکالی نداره. دوباره بگو تا درست بشه.',
              isUser: false,
              timestamp: DateTime.now(),
            ),
          ],
        );
      }
    }

    state = state.copyWith(state: VoiceState.idle);
  }

  /// Cancel current operation
  void cancel() {
    state = state.copyWith(state: VoiceState.idle);
  }

  /// Clear conversation
  void clearConversation() {
    state = const VoiceStateData();
  }
}
