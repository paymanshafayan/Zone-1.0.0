/// Hearing Space Providers — State management for hearing spaces
///
/// Manages spaces, active presence, and WebSocket messages.
library features_hearing_providers_hearing_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/logger.dart';
import '../../../shared/models/zone_models.dart';
import '../../../shared/services/websocket_service.dart';

// ─── Hearing Space State ───

class HearingState {
  final List<HearingSpace> spaces;
  final String? currentSpaceId;
  final List<SpaceMessage> messages;
  final List<String> activeMembers;
  final bool isLoading;
  final String? errorMessage;

  const HearingState({
    this.spaces = const [],
    this.currentSpaceId,
    this.messages = const [],
    this.activeMembers = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  HearingState copyWith({
    List<HearingSpace>? spaces,
    String? currentSpaceId,
    List<SpaceMessage>? messages,
    List<String>? activeMembers,
    bool? isLoading,
    String? errorMessage,
  }) {
    return HearingState(
      spaces: spaces ?? this.spaces,
      currentSpaceId: currentSpaceId ?? this.currentSpaceId,
      messages: messages ?? this.messages,
      activeMembers: activeMembers ?? this.activeMembers,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class SpaceMessage {
  final String personId;
  final String text;
  final List<String> tags;
  final DateTime timestamp;

  const SpaceMessage({
    required this.personId,
    required this.text,
    required this.tags,
    required this.timestamp,
  });
}

// ─── Hearing Provider ───

final hearingProvider = StateNotifierProvider<HearingNotifier, HearingState>((ref) {
  return HearingNotifier(
    ref.read(apiClientProvider),
    ref.read(wsServiceProvider),
  );
});

class HearingNotifier extends StateNotifier<HearingState> {
  final ApiClient _api;
  final WebSocketService _ws;
  final ZoneLogger _logger = ZoneLogger('Hearing');

  HearingNotifier(this._api, this._ws) : super(const HearingState()) {
    _listenToWebSocket();
  }

  /// Listen to WebSocket messages
  void _listenToWebSocket() {
    _ws.messages.listen((message) {
      switch (message.type) {
        case WsMessageType.spaceCreated:
          // Refresh spaces list
          break;
        case WsMessageType.memberJoined:
          final personId = message.data['personId'] as String? ?? '';
          state = state.copyWith(
            activeMembers: [...state.activeMembers, personId],
          );
          break;
        case WsMessageType.memberLeft:
          final personId = message.data['personId'] as String? ?? '';
          state = state.copyWith(
            activeMembers: state.activeMembers.where((id) => id != personId).toList(),
          );
          break;
        case WsMessageType.messageReceived:
          final msg = SpaceMessage(
            personId: message.data['personId'] as String? ?? '',
            text: message.data['text'] as String? ?? '',
            tags: List<String>.from(message.data['tags'] ?? []),
            timestamp: DateTime.now(),
          );
          state = state.copyWith(
            messages: [...state.messages, msg],
          );
          break;
        default:
          break;
      }
    });
  }

  /// Load available spaces
  Future<void> loadSpaces({required String zoneId}) async {
    state = state.copyWith(isLoading: true);

    // Get spaces from API
    final response = await _api.getSpace(spaceId: 'list');

    state = state.copyWith(isLoading: false);

    // For now, use placeholder data
    // In production, parse from API response
  }

  /// Join a hearing space
  void joinSpace(String spaceId) {
    _ws.joinSpace(spaceId);
    state = state.copyWith(currentSpaceId: spaceId);
  }

  /// Leave current hearing space
  void leaveSpace() {
    if (state.currentSpaceId != null) {
      _ws.leaveSpace(state.currentSpaceId!);
      state = state.copyWith(
        currentSpaceId: null,
        messages: [],
        activeMembers: [],
      );
    }
  }

  /// Speak in current hearing space
  void speak(String text, {List<String>? tags}) {
    if (state.currentSpaceId != null) {
      _ws.speak(state.currentSpaceId!, text, tags: tags);
    }
  }
}
