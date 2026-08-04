/// WebSocket Service — Hearing Space real-time connection
///
/// Matches backend: apps/ws/src/index.ts
/// Protocol: identify, join, leave, speak, list_spaces, ping

import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/logger.dart';
import '../../shared/models/zone_models.dart';

// ─── WebSocket Provider ───

final wsServiceProvider = Provider<WebSocketService>((ref) {
  return WebSocketService();
});

// ─── WS Message Types ───

enum WsMessageType {
  identify,
  join,
  leave,
  speak,
  listSpaces,
  ping,
  spaceCreated,
  spaceExpired,
  memberJoined,
  memberLeft,
  messageReceived,
  presenceUpdate,
  error,
  pong,
}

// ─── WS Message ───

class WsMessage {
  final WsMessageType type;
  final Map<String, dynamic> data;

  const WsMessage({required this.type, required this.data});

  factory WsMessage.fromJson(Map<String, dynamic> json) {
    WsMessageType type;
    switch (json['type']) {
      case 'identify': type = WsMessageType.identify; break;
      case 'join': type = WsMessageType.join; break;
      case 'leave': type = WsMessageType.leave; break;
      case 'speak': type = WsMessageType.speak; break;
      case 'list_spaces': type = WsMessageType.listSpaces; break;
      case 'ping': type = WsMessageType.ping; break;
      case 'space_created': type = WsMessageType.spaceCreated; break;
      case 'space_expired': type = WsMessageType.spaceExpired; break;
      case 'member_joined': type = WsMessageType.memberJoined; break;
      case 'member_left': type = WsMessageType.memberLeft; break;
      case 'message_received': type = WsMessageType.messageReceived; break;
      case 'presence_update': type = WsMessageType.presenceUpdate; break;
      case 'error': type = WsMessageType.error; break;
      case 'pong': type = WsMessageType.pong; break;
      default: type = WsMessageType.error;
    }
    return WsMessage(type: type, data: json['data'] ?? {});
  }

  String toJson() => jsonEncode({
    'type': type.name,
    'data': data,
  });
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

  Stream<WsMessage> get messages => _messageController.stream;
  bool get isConnected => _channel != null;

  /// Connect to the WebSocket server
  Future<void> connect({
    required String personId,
    required String zoneId,
  }) async {
    if (_isConnecting) return;
    _isConnecting = true;
    _personId = personId;
    _zoneId = zoneId;

    try {
      final uri = Uri.parse('${AppConstants.wsBaseUrl}/ws');
      _channel = WebSocketChannel.connect(uri);

      // Listen for messages
      _channel!.stream.listen(
        (data) {
          try {
            final json = jsonDecode(data as String) as Map<String, dynamic>;
            final message = WsMessage.fromJson(json);
            _messageController.add(message);
          } catch (e) {
            _logger.error('Failed to parse WS message', e);
          }
        },
        onDone: () {
          _logger.warning('WebSocket connection closed');
          _scheduleReconnect();
        },
        onError: (error) {
          _logger.error('WebSocket error', error);
          _scheduleReconnect();
        },
      );

      // Identify ourselves
      _send(WsMessage(type: WsMessageType.identify, data: {
        'personId': personId,
        'zoneId': zoneId,
      }));

      // Start heartbeat
      _startHeartbeat();

      _logger.info('Connected to WebSocket server');
    } catch (e) {
      _logger.error('Failed to connect to WebSocket', e);
      _scheduleReconnect();
    } finally {
      _isConnecting = false;
    }
  }

  /// Disconnect from the WebSocket server
  void disconnect() {
    _heartbeatTimer?.cancel();
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
    _logger.info('Disconnected from WebSocket server');
  }

  /// Join a hearing space
  void joinSpace(String spaceId) {
    _send(WsMessage(type: WsMessageType.join, data: {
      'spaceId': spaceId,
    }));
  }

  /// Leave a hearing space
  void leaveSpace(String spaceId) {
    _send(WsMessage(type: WsMessageType.leave, data: {
      'spaceId': spaceId,
    }));
  }

  /// Speak in a hearing space
  void speak(String spaceId, String text, {List<String>? tags}) {
    _send(WsMessage(type: WsMessageType.speak, data: {
      'spaceId': spaceId,
      'text': text,
      'tags': tags ?? [],
    }));
  }

  /// List available spaces
  void listSpaces() {
    _send(WsMessage(type: WsMessageType.listSpaces, data: {}));
  }

  // ─── Private ───

  void _send(WsMessage message) {
    try {
      _channel?.sink.add(message.toJson());
    } catch (e) {
      _logger.error('Failed to send WS message', e);
    }
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(AppConstants.presenceHeartbeat, (_) {
      _send(const WsMessage(type: WsMessageType.ping, data: {}));
    });
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      if (_personId != null && _zoneId != null) {
        connect(personId: _personId!, zoneId: _zoneId!);
      }
    });
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}
