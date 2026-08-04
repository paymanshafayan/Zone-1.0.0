/// Mode Indicator — Shows current response mode
///
/// Three states: می‌دونم (KNOW) / می‌پرسم (ASK) / نمی‌دونم (UNKNOWN)
/// Visual indicator at the top of the voice screen
library features_voice_widgets_mode_indicator;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../providers/voice_provider.dart';
import '../../../shared/models/zone_models.dart';

class ModeIndicator extends ConsumerWidget {
  const ModeIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final voiceState = ref.watch(voiceProvider);

    // Find the last Zone message with a mode
    ResponseMode? lastMode;
    for (final item in voiceState.conversation.reversed) {
      if (!item.isUser && item.mode != null) {
        lastMode = item.mode;
        break;
      }
    }

    if (lastMode == null) {
      return const SizedBox.shrink();
    }

    String label;
    Color color;
    IconData icon;

    switch (lastMode) {
      case ResponseMode.know:
        label = 'می‌دونم';
        color = AppTheme.accentKnow;
        icon = Icons.check_circle;
        break;
      case ResponseMode.ask:
        label = 'می‌پرسم';
        color = AppTheme.accentAsk;
        icon = Icons.help;
        break;
      case ResponseMode.unknown:
        label = 'نمی‌دونم';
        color = AppTheme.accentUnknown;
        icon = Icons.help_outline;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
