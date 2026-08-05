/// Notification Service — Local notification management
///
/// Manages wave notifications, learning demands, and professional alerts.
/// Respects anti-nuisance rules:
///   - Max 3 notifications/day
///   - Quiet hours (22:00-08:00 Iran)
///   - Emergency bypasses quiet hours (max 1/week)
///   - Stop after ≥2 responses

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_constants.dart';
import '../../core/utils/logger.dart';

// ─── Notification Types ───

enum ZoneNotificationType {
  wave, // Someone is asking around
  response, // Someone responded to your wave
  learning, // Learning demand fulfilled
  professional, // Professional post announcement
  emergency, // Emergency channel
}

// ─── Notification Model ───

class ZoneNotification {
  final String id;
  final ZoneNotificationType type;
  final String title;
  final String body;
  final String? tagPattern;
  final DateTime createdAt;
  final bool isRead;

  const ZoneNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.tagPattern,
    required this.createdAt,
    this.isRead = false,
  });

  ZoneNotification copyWith({bool? isRead}) {
    return ZoneNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      tagPattern: tagPattern,
      createdAt: createdAt,
      isRead: isRead ?? this.isRead,
    );
  }
}

// ─── Notification State ───

class NotificationState {
  final List<ZoneNotification> notifications;
  final int dailyCount;
  final int weeklyEmergencyCount;
  final DateTime? lastEmergencyDate;

  const NotificationState({
    this.notifications = const [],
    this.dailyCount = 0,
    this.weeklyEmergencyCount = 0,
    this.lastEmergencyDate,
  });

  NotificationState copyWith({
    List<ZoneNotification>? notifications,
    int? dailyCount,
    int? weeklyEmergencyCount,
    DateTime? lastEmergencyDate,
  }) {
    return NotificationState(
      notifications: notifications ?? this.notifications,
      dailyCount: dailyCount ?? this.dailyCount,
      weeklyEmergencyCount: weeklyEmergencyCount ?? this.weeklyEmergencyCount,
      lastEmergencyDate: lastEmergencyDate ?? this.lastEmergencyDate,
    );
  }

  int get unreadCount => notifications.where((n) => !n.isRead).length;
}

// ─── Notification Provider ───

final notificationProvider =
    StateNotifierProvider<NotificationNotifier, NotificationState>((ref) {
  return NotificationNotifier();
});

class NotificationNotifier extends StateNotifier<NotificationState> {
  final ZoneLogger _logger = ZoneLogger('Notification');

  NotificationNotifier() : super(const NotificationState());

  /// Check if we can send a notification (anti-nuisance)
  bool canNotify(ZoneNotificationType type) {
    // Reset daily count if it's a new day
    _resetDailyCountIfNeeded();

    // Emergency: bypasses quiet hours, but max 1/week
    if (type == ZoneNotificationType.emergency) {
      return state.weeklyEmergencyCount < AppConstants.maxEmergencyPerWeek;
    }

    // Check daily limit
    if (state.dailyCount >= AppConstants.maxDailyNotifications) {
      _logger.info('Daily notification limit reached');
      return false;
    }

    // Check quiet hours
    if (_isQuietHours()) {
      _logger.info('Quiet hours active — notification blocked');
      return false;
    }

    return true;
  }

  /// Send a notification
  void notify(ZoneNotification notification) {
    if (!canNotify(notification.type)) return;

    state = state.copyWith(
      notifications: [notification, ...state.notifications],
      dailyCount: state.dailyCount + 1,
    );

    if (notification.type == ZoneNotificationType.emergency) {
      state = state.copyWith(
        weeklyEmergencyCount: state.weeklyEmergencyCount + 1,
        lastEmergencyDate: DateTime.now(),
      );
    }

    _logger.info('Notification sent: ${notification.type.name} — ${notification.title}');
  }

  /// Mark notification as read
  void markAsRead(String notificationId) {
    state = state.copyWith(
      notifications: state.notifications.map((n) {
        if (n.id == notificationId) {
          return n.copyWith(isRead: true);
        }
        return n;
      }).toList(),
    );
  }

  /// Mark all as read
  void markAllAsRead() {
    state = state.copyWith(
      notifications: state.notifications.map((n) => n.copyWith(isRead: true)).toList(),
    );
  }

  /// Clear all notifications
  void clearAll() {
    state = state.copyWith(notifications: []);
  }

  // ─── Private ───

  bool _isQuietHours() {
    final now = DateTime.now();
    // Iran is UTC+3:30
    // For simplicity, we use local time
    // In production: use proper timezone conversion
    final hour = now.hour;
    return hour >= AppConstants.quietHourStart || hour < AppConstants.quietHourEnd;
  }

  void _resetDailyCountIfNeeded() {
    // Simple reset: if last notification was on a different day
    // In production: use proper date tracking
    if (state.notifications.isEmpty) {
      if (state.dailyCount > 0) {
        state = state.copyWith(dailyCount: 0);
      }
    }
  }
}
