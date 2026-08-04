/// Voice Bubble — Chat bubble for conversation
///
/// Different styles for user, Zone, and mode indicators.
library features_voice_widgets_voice_bubble;

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/zone_models.dart';

class VoiceBubble extends StatelessWidget {
  final String text;
  final bool isUser;
  final ResponseMode? mode;
  final bool isReadback;

  const VoiceBubble({
    super.key,
    required this.text,
    required this.isUser,
    this.mode,
    this.isReadback = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Align(
        alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: _getBackgroundColor(context),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: isUser ? Radius.zero : const Radius.circular(16),
              bottomRight: isUser ? const Radius.circular(16) : Radius.zero,
            ),
            border: isReadback
                ? Border.all(color: AppTheme.accentUnknown.withValues(alpha: 0.5))
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ─── Mode indicator ───
              if (mode != null && !isUser)
                _buildModeBadge(context),

              // ─── Text ───
              Text(
                text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: isUser ? Colors.white : null,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getBackgroundColor(BuildContext context) {
    if (isUser) {
      return AppTheme.primaryLight;
    }
    if (isReadback) {
      return AppTheme.accentUnknown.withValues(alpha: 0.1);
    }
    switch (mode) {
      case ResponseMode.know: return AppTheme.accentKnow.withValues(alpha: 0.1);
      case ResponseMode.ask: return AppTheme.accentAsk.withValues(alpha: 0.1);
      case ResponseMode.unknown: return AppTheme.accentUnknown.withValues(alpha: 0.1);
      default: return Theme.of(context).colorScheme.surface;
    }
  }

  Widget _buildModeBadge(BuildContext context) {
    String label;
    Color color;
    IconData icon;

    switch (mode) {
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
      default:
        return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
