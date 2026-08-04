/// Wave Status Screen — Shows the status of a dispatched wave
///
/// Three-tier wave:
///   Wave 1: matching skill + 2.5km + max 8
///   Wave 2: adjacent skill + 5km + max 15
///   Wave 3: referral + all active
///
/// After wave, if no response → UNKNOWN mode
library features_voice_screens_wave_status_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';

// ─── Wave Status Model ───

class WaveStatus {
  final String requestId;
  final String skill;
  final String zoneId;
  final int currentWave; // 1, 2, or 3
  final int totalResponses;
  final int totalNotified;
  final WaveState state;
  final DateTime startedAt;
  final DateTime? wave1SentAt;
  final DateTime? wave2SentAt;
  final DateTime? wave3SentAt;

  const WaveStatus({
    required this.requestId,
    required this.skill,
    required this.zoneId,
    this.currentWave = 0,
    this.totalResponses = 0,
    this.totalNotified = 0,
    this.state = WaveState.pending,
    required this.startedAt,
    this.wave1SentAt,
    this.wave2SentAt,
    this.wave3SentAt,
  });
}

enum WaveState { pending, wave1, wave2, wave3, responded, unknown }

// ─── Wave Status Screen ───

class WaveStatusScreen extends ConsumerWidget {
  final WaveStatus status;

  const WaveStatusScreen({super.key, required this.status});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('وضعیت موج'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Request Info ───
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'درخواست: ${status.skill}',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'شروع: ${_formatTime(status.startedAt)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondaryLight,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ─── Wave Progress ───
            Text(
              'مراحل موج',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            _buildWaveStep(
              context,
              wave: 1,
              title: 'موج ۱ — مهارت منطبق',
              subtitle: 'شعاع ${AppConstants.defaultRadiusKm} کیلومتر · حداکثر ${AppConstants.maxWave1Recipients} نفر',
              isSent: status.wave1SentAt != null,
              isActive: status.currentWave == 1,
              sentAt: status.wave1SentAt,
            ),
            _buildWaveConnector(context, status.currentWave > 1),
            _buildWaveStep(
              context,
              wave: 2,
              title: 'موج ۲ — مهارت مجاور',
              subtitle: 'شعاع ${AppConstants.expandedRadiusKm} کیلومتر · حداکثر ${AppConstants.maxWave2Recipients} نفر',
              isSent: status.wave2SentAt != null,
              isActive: status.currentWave == 2,
              sentAt: status.wave2SentAt,
            ),
            _buildWaveConnector(context, status.currentWave > 2),
            _buildWaveStep(
              context,
              wave: 3,
              title: 'موج ۳ — ارجاع',
              subtitle: 'همه کاربران فعال · حداکثر ۳۰ نفر',
              isSent: status.wave3SentAt != null,
              isActive: status.currentWave == 3,
              sentAt: status.wave3SentAt,
            ),
            const SizedBox(height: 24),

            // ─── Response Summary ───
            Card(
              color: status.totalResponses >= AppConstants.minResponsesToStop
                  ? AppTheme.accentKnow.withValues(alpha: 0.05)
                  : null,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(
                      status.totalResponses >= AppConstants.minResponsesToStop
                          ? Icons.check_circle
                          : Icons.hourglass_empty,
                      color: status.totalResponses >= AppConstants.minResponsesToStop
                          ? AppTheme.accentKnow
                          : AppTheme.accentUnknown,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${status.totalResponses} پاسخ از ${status.totalNotified} نفر',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          Text(
                            status.totalResponses >= AppConstants.minResponsesToStop
                                ? 'تعداد پاسخ کافیه ✋'
                                : 'منتظر پاسخ...',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: status.totalResponses >= AppConstants.minResponsesToStop
                                  ? AppTheme.accentKnow
                                  : AppTheme.accentUnknown,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ─── Anti-Nuisance Reminder ───
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.accentAsk.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shield, size: 16, color: AppTheme.accentAsk),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'حداکثر ${AppConstants.maxDailyNotifications} اعلان روزانه · '
                      'توقف بعد از ${AppConstants.minResponsesToStop} پاسخ · '
                      'ساعت سکوت ${AppConstants.quietHourStart}:۰۰ تا ${AppConstants.quietHourEnd}:۰۰',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondaryLight,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaveStep(
    BuildContext context, {
    required int wave,
    required String title,
    required String subtitle,
    required bool isSent,
    required bool isActive,
    DateTime? sentAt,
  }) {
    Color color;
    IconData icon;
    if (isSent && !isActive) {
      color = AppTheme.accentKnow;
      icon = Icons.check_circle;
    } else if (isActive) {
      color = AppTheme.accentAsk;
      icon = Icons.sync;
    } else {
      color = AppTheme.textSecondaryLight;
      icon = Icons.radio_button_unchecked;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ─── Icon ───
        Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: isActive
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: color,
                        ),
                      )
                    : Icon(icon, size: 18, color: color),
              ),
            ),
          ],
        ),
        const SizedBox(width: 12),

        // ─── Text ───
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive ? color : null,
                ),
              ),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
              ),
              if (sentAt != null)
                Text(
                  'ارسال: ${_formatTime(sentAt)}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppTheme.accentKnow,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildWaveConnector(BuildContext context, bool isActive) {
    return Padding(
      padding: const EdgeInsets.only(right: 15, top: 2, bottom: 2),
      child: Container(
        width: 2,
        height: 24,
        color: isActive ? AppTheme.accentAsk : AppTheme.textSecondaryLight.withValues(alpha: 0.3),
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
