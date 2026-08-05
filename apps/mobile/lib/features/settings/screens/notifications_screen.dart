/// Notifications Screen — View and manage notifications
///
/// Shows wave notifications, learning demands, professional alerts
/// Respects anti-nuisance rules

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/services/notification_service.dart';
import '../../../shared/widgets/shared_widgets.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifState = ref.watch(notificationProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('اعلان‌ها'),
        centerTitle: true,
        actions: [
          if (notifState.unreadCount > 0)
            TextButton(
              onPressed: () => ref.read(notificationProvider.notifier).markAllAsRead(),
              child: const Text('خواندن همه'),
            ),
        ],
      ),
      body: notifState.notifications.isEmpty
          ? const ZoneEmptyState(
              icon: Icons.notifications_none,
              title: 'اعلانی نیست',
              subtitle: 'وقتی کسی درخواست کمک بکنه یا پاسخ بده، اینجا نمایش داده میشه.',
            )
          : ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: notifState.notifications.length,
              itemBuilder: (context, index) {
                final notif = notifState.notifications[index];
                return _NotificationCard(
                  notification: notif,
                  onTap: () => ref.read(notificationProvider.notifier).markAsRead(notif.id),
                );
              },
            ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final ZoneNotification notification;
  final VoidCallback onTap;

  const _NotificationCard({
    required this.notification,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      color: notification.isRead ? null : AppTheme.primaryLight.withValues(alpha: 0.05),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ─── Icon ───
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: _getColor().withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(_getIcon(), size: 20, color: _getColor()),
              ),
              const SizedBox(width: 12),

              // ─── Content ───
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: notification.isRead ? FontWeight.w400 : FontWeight.w600,
                            ),
                          ),
                        ),
                        if (!notification.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: _getColor(),
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      notification.body,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondaryLight,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _timeAgo(notification.createdAt),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppTheme.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getIcon() {
    switch (notification.type) {
      case ZoneNotificationType.wave:
        return Icons.waves;
      case ZoneNotificationType.response:
        return Icons.reply;
      case ZoneNotificationType.learning:
        return Icons.school;
      case ZoneNotificationType.professional:
        return Icons.workspace_premium;
      case ZoneNotificationType.emergency:
        return Icons.emergency;
    }
  }

  Color _getColor() {
    switch (notification.type) {
      case ZoneNotificationType.wave:
        return AppTheme.accentAsk;
      case ZoneNotificationType.response:
        return AppTheme.accentKnow;
      case ZoneNotificationType.learning:
        return AppTheme.accentUnknown;
      case ZoneNotificationType.professional:
        return AppTheme.professionalBadge;
      case ZoneNotificationType.emergency:
        return AppTheme.accentEmergency;
    }
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 60) return '${diff.inMinutes} دقیقه پیش';
    if (diff.inHours < 24) return '${diff.inHours} ساعت پیش';
    return '${diff.inDays} روز پیش';
  }
}
