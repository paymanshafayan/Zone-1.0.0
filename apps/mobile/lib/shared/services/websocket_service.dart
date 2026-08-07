/// WebSocket Service — Hearing Space real-time connection
///
/// Matches backend: apps/ws/src/index.ts
///
/// Client → Server: {type, payload}
///   identify | join | leave | speak | list_spaces | ping
///
/// Server → Client: {type, payload}
///   identified | joined | left | reverberation | speech |
///   presence | space_list | system | error | pong

import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/logger.dart';

// ─── WebSocket Provider ───

final wsServiceProvider = Provider<WebSocketService>((ref) {
  return WebSocketService();
});

// ─── WS Message Types (server → client) ───

enum WsMessageType {
  identified,
  joined,
  left,
  reverberation,
  speech,
  presence,
  spaceList,
  system,
  error,
  pong,
  unknown,
}

// ─── WS Message ───

class WsMessage {
  final WsMessageType type;
  final Map<String, dynamic> payload;

  const WsMessage({required this.type, required this.payload});

  factory WsMessage.fromJson(Map<String, dynamic> json) {
    WsMessageType type;
    switch (json['type']) {
      case 'identified':
        type = WsMessageType.identified;
        break;
      case 'joined':
        type = WsMessageType.joined;
        break;
      case 'left':
        type = WsMessageType.left;
        break;
      case 'reverberation':
        type = WsMessageType.reverberation;
        break;
      case 'speech':
        type = WsMessageType.speech;
        break;
      case 'presence':
        type = WsMessageType.presence;
        break;
      case 'space_list':
        type = WsMessageType.spaceList;
        break;
      case 'system':
        type = WsMessageType.system;
        break;
      case 'error':
        type = WsMessageType.error;
        break;
      case 'pong':
        type = WsMessageType.pong;
        break;
      default:
        type = WsMessageType.unknown;
    }
    final payload = json['payload'];
    return WsMessage(
      type: type,
      payload: payload is Map<String, dynamic> ? payload : <String, dynamic>{},
    );
  }
}

/// Lightweight space descriptor as returned by `space_list` and `joined`.
/// The WS payloads are partial (no zoneId/radius/createdAt), so parsing
/// is deliberately tolerant — every missing field gets a safe default.
class SpaceSummary {
  final String id;
  final String type; // 'dynamic' | 'persistent'
  final String? name;
  final List<String> tags;
  final int memberCount;

  const SpaceSummary({
    required this.id,
    required this.type,
    this.name,
    this.tags = const [],
    this.memberCount = 0,
  });

  factory SpaceSummary.fromJson(Map<String, dynamic> json) => SpaceSummary(
        id: json['id'] as String? ?? '',
        type: json['type'] as String? ?? 'persistent',
        name: json['name'] as String?,
        tags: List<String>.from(json['tags'] as List? ?? const []),
        memberCount: json['memberCount'] as int? ?? 0,
      );
}

// ─── WebSocket Service ───

class WebSocketService {
  WebSocketChannel? _channel;
  final ZoneLogger _logger = ZoneLogger('WebSocket');
  final _messageController = StreamController<WsMessage>.broadcast();
  Timer? _heartbeatTimer;
  Timer? _reconnectTimer;
  String? _personId;
  String? _zoneId;
  bool _isConnecting = false;
  Completer<void>? _identifiedCompleter;

  Stream<WsMessage> get messages => _messageController.stream;
  bool get isConnected => _channel != null;
  String? get personId => _personId;
  String? get zoneId => _zoneId;

  /// Connect to the WebSocket server (if not already connected).
  ///
  /// Resolves once the server has acknowledged the `identify` message
  /// (so callers can safely `join`/`speak` right away).
  Future<void> connect({
    required String personId,
    required String zoneId,
  }) async {
    if (_channel != null &&
        _personId == personId &&
        _zoneId == zoneId &&
        (_identifiedCompleter?.isCompleted ?? false)) {
      return; // Already connected and identified.
    }
    if (_isConnecting && _identifiedCompleter != null) {
      return _identifiedCompleter!.future;
    }

    _isConnecting = true;
    _personId = personId;
    _zoneId = zoneId;

    // Tear down any previous channel/completer BEFORE creating the new
    // identification completer, so the teardown can't clobber it.
    _teardownChannel();
    _identifiedCompleter = Completer<void>();

    try {
      final uri = Uri.parse('${AppConstants.wsBaseUrl}/ws');
      _channel = WebSocketChannel.connect(uri);

      _channel!.stream.listen(
        _handleIncoming,
        onDone: _handleClosed,
        onError: (Object error) {
          _logger.error('WebSocket error', error);
          _handleClosed();
        },
        cancelOnError: true,
      );

      // Identify ourselves — the IO channel buffers outbound messages
      // until the socket is actually open, so this is safe to send now.
      _send('identify', {
        'personId': personId,
        'zoneId': zoneId,
      });

      _startHeartbeat();
      _logger.info('Connecting to WebSocket server…');

      // Wait until the server confirms identification (bounded).
      await _identifiedCompleter!.future.timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          _logger.warning('Timed out waiting for WS identification');
        },
      );
    } catch (e) {
      _logger.error('Failed to connect to WebSocket', e);
      _handleClosed();
    } finally {
      _isConnecting = false;
    }
  }

  /// Disconnect from the WebSocket server.
  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _teardownChannel();
    _logger.info('Disconnected from WebSocket server');
  }

  /// Join an existing hearing space.
  void joinSpace(String spaceId) {
    _send('join', {'spaceId': spaceId});
  }

  /// Create (and join) a persistent user-created space.
  void createPersistentSpace({
    required String zoneId,
    required String name,
    List<String> tags = const [],
    String? description,
  }) {
    _send('join', {
      'createPersistent': {
        'zoneId': zoneId,
        'name': name,
        'tags': tags,
        if (description != null) 'description': description,
      },
    });
  }

  /// Leave the current hearing space.
  void leaveSpace(String spaceId) {
    _send('leave', {'spaceId': spaceId});
  }

  /// Speak in the current hearing space. The server routes the message
  /// to whatever space this connection has joined.
  void speak(String text, {List<String>? tags}) {
    _send('speak', {
      'text': text,
      'tags': tags ?? const <String>[],
    });
  }

  /// List available spaces in a zone.
  void listSpaces(String zoneId, {List<String>? tags}) {
    _send('list_spaces', {
      'zoneId': zoneId,
      'tags': tags ?? const <String>[],
    });
  }

  // ─── Private ───

  void _send(String type, Map<String, dynamic> payload) {
    try {
      final channel = _channel;
      if (channel == null) {
        _logger.warning('Tried to send "$type" while disconnected');
        return;
      }
      channel.sink.add(jsonEncode({'type': type, 'payload': payload}));
    } catch (e) {
      _logger.error('Failed to send WS message', e);
    }
  }

  void _handleIncoming(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      final message = WsMessage.fromJson(json);

      if (message.type == WsMessageType.identified) {
        _logger.info('Identified on WebSocket server');
        if (!(_identifiedCompleter?.isCompleted ?? true)) {
          _identifiedCompleter!.complete();
        }
      }

      if (message.type == WsMessageType.error) {
        _logger.warning('WS server error: ${message.payload['error']}');
      }

      _messageController.add(message);
    } catch (e) {
      _logger.error('Failed to parse WS message', e);
    }
  }

  void _handleClosed() {
    if (_channel == null) return; // Already cleaned up.
    _logger.warning('WebSocket connection closed');
    _teardownChannel();
    _scheduleReconnect();
  }

  void _teardownChannel() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    final channel = _channel;
    _channel = null;
    if (channel != null) {
      unawaited(channel.sink.close());
    }
    if (!(_identifiedCompleter?.isCompleted ?? true)) {
      _identifiedCompleter!.completeError(
        StateError('WebSocket closed before identification'),
      );
    }
    _identifiedCompleter = null;
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(AppConstants.presenceHeartbeat, (_) {
      _send('ping', {});
    });
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      final personId = _personId;
      final zoneId = _zoneId;
      if (personId != null && zoneId != null) {
        connect(personId: personId, zoneId: zoneId);
      }
    });
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
