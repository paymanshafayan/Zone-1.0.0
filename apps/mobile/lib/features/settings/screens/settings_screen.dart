/// Settings Screen — Notification preferences, tag subscriptions, profile
///
/// Hub for all settings, with links to profile, notifications, etc.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../../shared/services/navigation_service.dart';
import '../../../shared/services/notification_service.dart';
import '../providers/profile_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final notifState = ref.watch(notificationProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('تنظیمات'),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ─── Profile Card ───
          Card(
            child: InkWell(
              onTap: () => context.push('/profile'),
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppTheme.primaryLight.withValues(alpha: 0.2),
                      child: Text(
                        authState.displayName?.substring(0, 1) ?? 'ز',
                        style: const TextStyle(
                          fontSize: 24,
                          color: AppTheme.primaryLight,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            authState.displayName ?? 'کاربر',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            authState.zoneId != null ? 'محله: ${authState.zoneId}' : 'محله تعیین نشده',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.textSecondaryLight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_left),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // ─── Notifications ───
          Text(
            'اعلان‌ها',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.notifications_outlined),
                  title: const Text('اعلان‌ها'),
                  trailing: notifState.unreadCount > 0
                      ? Badge(
                          label: Text('${notifState.unreadCount}'),
                          child: const Icon(Icons.chevron_left),
                        )
                      : const Icon(Icons.chevron_left),
                  onTap: () => context.push('/notifications'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Notification Preferences ───
          Text(
            'ترجیحات نوتیفیکیشن',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.notifications_active_outlined),
                  title: const Text('حداکثر نوتیف روزانه'),
                  subtitle: Text('${AppConstants.maxDailyNotifications} عدد'),
                  dense: true,
                ),
                ListTile(
                  leading: const Icon(Icons.bedtime_outlined),
                  title: const Text('ساعت سکوت'),
                  subtitle: Text('${AppConstants.quietHourStart}:۰۰ تا ${AppConstants.quietHourEnd}:۰۰ (ایران)'),
                  dense: true,
                ),
                ListTile(
                  leading: const Icon(Icons.emergency_outlined),
                  title: const Text('کانال اضطراری'),
                  subtitle: Text('حداکثر ${AppConstants.maxEmergencyPerWeek} بار در هفته · همیشه فعال'),
                  dense: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Tag Subscriptions ───
          Text(
            'اشتراک برچسب',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                _buildTagSubscriptionTile(context, ref, 'خدمات', 'services/*', Icons.build),
                _buildTagSubscriptionTile(context, ref, 'فوری', 'urgency/*', Icons.bolt),
                _buildTagSubscriptionTile(context, ref, 'اجتماعی', 'social/*', Icons.people),
                _buildTagSubscriptionTile(context, ref, 'حمایتی', 'support/*', Icons.favorite),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Anti-Nuisance Info ───
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.accentAsk.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.accentAsk.withValues(alpha: 0.2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.shield, color: AppTheme.accentAsk, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'محافظت ضدآزاری',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AppTheme.accentAsk,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '• حداکثر ${AppConstants.maxDailyNotifications} نوتیف روزانه\n'
                  '• توقف بعد از ${AppConstants.minResponsesToStop} پاسخ\n'
                  '• کاهش وزن بعد از ${AppConstants.silenceDownWeightThreshold} بی‌توجهی\n'
                  '• ساعت سکوت: ${AppConstants.quietHourStart}:۰۰ تا ${AppConstants.quietHourEnd}:۰۰\n'
                  '• خروج از هر برچسب همیشه ممکنه',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── About ───
          Text(
            'درباره زون',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text('نسخه ${AppConstants.appVersion}'),
                  subtitle: const Text('زون — رفیق محله‌ات'),
                  dense: true,
                ),
                ListTile(
                  leading: const Icon(Icons.privacy_tip_outlined),
                  title: const Text('حریم خصوصی'),
                  subtitle: const Text('متن خام گفتار هرگز دیوایس رو ترک نمی‌کنه'),
                  dense: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Logout ───
          OutlinedButton(
            onPressed: () => ref.read(authProvider.notifier).logout(),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.accentEmergency,
              side: const BorderSide(color: AppTheme.accentEmergency),
            ),
            child: const Text('خروج'),
          ),
        ],
      ),
    );
  }

  Widget _buildTagSubscriptionTile(
    BuildContext context,
    WidgetRef ref,
    String label,
    String tagPattern,
    IconData icon,
  ) {
    final isSubscribed =
        ref.watch(profileProvider).subscribedTags.contains(tagPattern);

    return SwitchListTile(
      value: isSubscribed,
      onChanged: (value) => ref
          .read(profileProvider.notifier)
          .toggleTagSubscription(tagPattern),
      secondary: Icon(icon, color: AppTheme.primaryLight),
      title: Text(label),
      subtitle: Text(tagPattern, style: const TextStyle(fontFamily: 'monospace')),
      dense: true,
    );
  }
}
