/// Voice Input Bar — Text input + voice recording button
///
/// Voice is primary (mic button), text is alternative (text field).
/// Matches architecture: "صدا رسانه اصلیه، متن جایگزینه"
library features_voice_widgets_voice_input_bar;

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class VoiceInputBar extends StatefulWidget {
  final bool isRecording;
  final ValueChanged<String> onTextChanged;
  final VoidCallback onRecordingStart;
  final VoidCallback onRecordingStop;

  const VoiceInputBar({
    super.key,
    required this.isRecording,
    required this.onTextChanged,
    required this.onRecordingStart,
    required this.onRecordingStop,
  });

  @override
  State<VoiceInputBar> createState() => _VoiceInputBarState();
}

class _VoiceInputBarState extends State<VoiceInputBar> with TickerProviderStateMixin {
  final TextEditingController _textController = TextEditingController();
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isRecording) {
      _pulseController.repeat(reverse: true);
    } else {
      _pulseController.stop();
      _pulseController.value = 1.0;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: widget.isRecording
            ? _buildRecordingUI()
            : _buildInputUI(),
      ),
    );
  }

  /// Recording state UI
  Widget _buildRecordingUI() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ─── Waveform visualization (placeholder) ───
        Container(
          height: 48,
          decoration: BoxDecoration(
            color: AppTheme.accentEmergency.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                20,
                (index) => AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, child) {
                    return Container(
                      width: 3,
                      height: 12 + (index % 5) * 4.0 * _pulseAnimation.value,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.accentEmergency,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ─── Stop button ───
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'در حال ضبط...',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.accentEmergency,
              ),
            ),
            const SizedBox(width: 16),
            FloatingActionButton.small(
              onPressed: widget.onRecordingStop,
              backgroundColor: AppTheme.accentEmergency,
              child: const Icon(Icons.stop, color: Colors.white),
            ),
          ],
        ),
      ],
    );
  }

  /// Normal input UI
  Widget _buildInputUI() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // ─── Mic Button (primary) ───
        ScaleTransition(
          scale: _pulseAnimation,
          child: FloatingActionButton(
            onPressed: widget.onRecordingStart,
            backgroundColor: AppTheme.primaryLight,
            elevation: 2,
            child: const Icon(Icons.mic, color: Colors.white, size: 28),
          ),
        ),
        const SizedBox(width: 12),

        // ─── Text Input (alternative) ───
        Expanded(
          child: TextField(
            controller: _textController,
            textDirection: TextDirection.rtl,
            decoration: InputDecoration(
              hintText: 'بنویس یا حرف بزن...',
              suffixIcon: IconButton(
                icon: const Icon(Icons.send),
                onPressed: () {
                  final text = _textController.text.trim();
                  if (text.isNotEmpty) {
                    widget.onTextChanged(text);
                    _textController.clear();
                  }
                },
              ),
            ),
            onSubmitted: (text) {
              if (text.trim().isNotEmpty) {
                widget.onTextChanged(text.trim());
                _textController.clear();
              }
            },
          ),
        ),
      ],
    );
  }
}

/// AnimatedBuilder helper
class AnimatedBuilder extends AnimatedWidget {
  final Widget Function(BuildContext context, Widget? child) builder;

  const AnimatedBuilder({
    super.key,
    required Animation<double> animation,
    required this.builder,
  }) : super(listenable: animation);

  @override
  Widget build(BuildContext context) {
    return builder(context, null);
  }
}
