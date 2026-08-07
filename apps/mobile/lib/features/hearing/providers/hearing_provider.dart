/// Hearing Space Providers — State management for hearing spaces
///
/// Manages spaces, active presence, and WebSocket messages.
/// Talks to the WS backend (apps/ws) through [WebSocketService].
library features_hearing_providers_hearing_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/logger.dart';
import '../../../shared/services/navigation_service.dart';
import '../../../shared/services/websocket_service.dart';

// ─── Hearing Space State ───

class HearingState {
  final List<SpaceSummary> spaces;
  final String? currentSpaceId;
  final String? currentSpaceName;
  final List<SpaceMessage> messages;
  final List<String> activeMembers;
  final int memberCount;
  final bool isLoading;
  final String? errorMessage;

  const HearingState({
    this.spaces = const [],
    this.currentSpaceId,
    this.currentSpaceName,
    this.messages = const [],
    this.activeMembers = const [],
    this.memberCount = 0,
    this.isLoading = false,
    this.errorMessage,
  });

  HearingState copyWith({
    List<SpaceSummary>? spaces,
    String? currentSpaceId,
    String? currentSpaceName,
    List<SpaceMessage>? messages,
    List<String>? activeMembers,
    int? memberCount,
    bool? isLoading,
    String? errorMessage,
    bool clearSpace = false,
  }) {
    return HearingState(
      spaces: spaces ?? this.spaces,
      currentSpaceId: clearSpace ? null : (currentSpaceId ?? this.currentSpaceId),
      currentSpaceName:
          clearSpace ? null : (currentSpaceName ?? this.currentSpaceName),
      messages: messages ?? this.messages,
      activeMembers: activeMembers ?? this.activeMembers,
      memberCount: memberCount ?? this.memberCount,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }

  bool get isInSpace => currentSpaceId != null;
}

class SpaceMessage {
  final String personId;
  final String text;
  final List<String> tags;
  final DateTime timestamp;
  final bool isEcho; // Sent by the current user

  const SpaceMessage({
    required this.personId,
    required this.text,
    required this.tags,
    required this.timestamp,
    this.isEcho = false,
  });
}

// ─── Hearing Provider ───

final hearingProvider = StateNotifierProvider<HearingNotifier, HearingState>((ref) {
  return HearingNotifier(ref, ref.read(wsServiceProvider));
});

class HearingNotifier extends StateNotifier<HearingState> {
  final Ref _ref;
  final WebSocketService _ws;
  final ZoneLogger _logger = ZoneLogger('Hearing');

  HearingNotifier(this._ref, this._ws) : super(const HearingState()) {
    _listenToWebSocket();
  }

  String get _personId =>
      _ref.read(authProvider).personId ?? 'anonymous';
  String get _zoneId =>
      _ref.read(authProvider).zoneId ?? 'default_zone';

  /// Ensure the WS connection is up and identified.
  Future<void> _ensureConnected() async {
    if (!_ws.isConnected) {
      await _ws.connect(personId: _personId, zoneId: _zoneId);
    }
  }

  /// Listen to WebSocket messages
  void _listenToWebSocket() {
    _ws.messages.listen((message) {
      switch (message.type) {
        case WsMessageType.identified:
          // The WS reconnects transparently after network drops, but the
          // server forgets our membership — re-join the active space so
          // presence and speech keep flowing.
          final spaceId = state.currentSpaceId;
          if (spaceId != null) {
            _ws.joinSpace(spaceId);
          }
          break;

        case WsMessageType.spaceList:
          final rawSpaces = message.payload['spaces'] as List? ?? const [];
          state = state.copyWith(
            isLoading: false,
            spaces: rawSpaces
                .whereType<Map<String, dynamic>>()
                .map(SpaceSummary.fromJson)
                .toList(),
          );
          break;

        case WsMessageType.joined:
          final spacePayload = message.payload['space'];
          final space = spacePayload is Map<String, dynamic>
              ? SpaceSummary.fromJson(spacePayload)
              : null;
          final members = List<String>.from(
              message.payload['members'] as List? ?? const []);
          final reverberations = (message.payload['reverberations'] as List? ??
                  const [])
              .whereType<Map<String, dynamic>>()
              .map((r) => SpaceMessage(
                    personId: r['personId'] as String? ?? '',
                    text: r['text'] as String? ?? '',
                    tags: List<String>.from(r['tags'] as List? ?? const []),
                    timestamp: _parseTimestamp(r['createdAt']),
                  ))
              .toList();
          state = state.copyWith(
            currentSpaceId: space?.id,
            currentSpaceName: space?.name,
            activeMembers: members,
            memberCount: space?.memberCount ?? members.length,
            messages: reverberations,
            isLoading: false,
          );
          break;

        case WsMessageType.presence:
          final personId = message.payload['personId'] as String? ?? '';
          final action = message.payload['action'] as String? ?? '';
          if (action == 'joined') {
            if (!state.activeMembers.contains(personId)) {
              state = state.copyWith(
                activeMembers: [...state.activeMembers, personId],
                memberCount: state.memberCount + 1,
              );
            }
          } else {
            state = state.copyWith(
              activeMembers:
                  state.activeMembers.where((id) => id != personId).toList(),
              memberCount:
                  state.memberCount > 0 ? state.memberCount - 1 : 0,
            );
          }
          break;

        case WsMessageType.speech:
          final personId = message.payload['personId'] as String? ?? '';
          state = state.copyWith(
            messages: [
              ...state.messages,
              SpaceMessage(
                personId: personId,
                text: message.payload['text'] as String? ?? '',
                tags: List<String>.from(
                    message.payload['tags'] as List? ?? const []),
                timestamp: _parseTimestamp(message.payload['createdAt']),
                isEcho: personId == _personId,
              ),
            ],
          );
          break;

        case WsMessageType.left:
          state = state.copyWith(
            clearSpace: true,
            messages: const [],
            activeMembers: const [],
            memberCount: 0,
          );
          break;

        case WsMessageType.error:
          state = state.copyWith(
            isLoading: false,
            errorMessage: message.payload['error'] as String?,
          );
          break;

        default:
          break;
      }
    });
  }

  /// Load available spaces in the user's zone.
  Future<void> loadSpaces() async {
    state = state.copyWith(isLoading: true);
    try {
      await _ensureConnected();
      _ws.listSpaces(_zoneId);
    } catch (e) {
      _logger.error('Failed to load spaces', e);
      state = state.copyWith(isLoading: false);
    }
    // When the server answers (space_list) the listener flips isLoading off.
    // If nothing answers (server down), fall back after a grace period.
    await Future<void>.delayed(const Duration(seconds: 6));
    if (mounted && state.isLoading) {
      state = state.copyWith(isLoading: false);
    }
  }

  /// Join a hearing space.
  Future<void> joinSpace(String spaceId) async {
    try {
      await _ensureConnected();
      _ws.joinSpace(spaceId);
    } catch (e) {
      _logger.error('Failed to join space', e);
      state = state.copyWith(errorMessage: 'ورود به فضا ممکن نشد.');
    }
  }

  /// Create a new persistent space (and join it).
  Future<void> createSpace(String name, {List<String> tags = const []}) async {
    try {
      await _ensureConnected();
      _ws.createPersistentSpace(zoneId: _zoneId, name: name, tags: tags);
    } catch (e) {
      _logger.error('Failed to create space', e);
      state = state.copyWith(errorMessage: 'ساخت فضا ممکن نشد.');
    }
  }

  /// Leave the current hearing space.
  Future<void> leaveSpace() async {
    final spaceId = state.currentSpaceId;
    if (spaceId != null) {
      _ws.leaveSpace(spaceId);
      state = state.copyWith(
        clearSpace: true,
        messages: const [],
        activeMembers: const [],
        memberCount: 0,
      );
    }
  }

  /// Speak in the current hearing space.
  void speak(String text) {
    if (state.currentSpaceId != null) {
      _ws.speak(text);
    }
  }

  DateTime _parseTimestamp(dynamic value) {
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.now();
    }
    return DateTime.now();
  }
}
