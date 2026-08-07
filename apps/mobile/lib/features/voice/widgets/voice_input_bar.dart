/// Voice Input Bar — Text input + voice capture button
///
/// Voice is primary (mic button), text is alternative (text field).
/// Matches architecture: «صدا رسانه اصلیه، متن جایگزینه»
///
/// While capturing, the bar shows the live on-device transcript
/// (STT mode) and offers two actions:
///   ✓ finish & send   (onRecordingStop)
///   ✕ discard         (onRecordingCancel)
library features_voice_widgets_voice_input_bar;

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class VoiceInputBar extends StatefulWidget {
  final bool isRecording;
  final bool isSpeaking;

  /// Live partial transcript from on-device STT — empty when unavailable.
  final String liveTranscript;
  final ValueChanged<String> onTextChanged;
  final VoidCallback onRecordingStart;
  final VoidCallback onRecordingStop;
  final VoidCallback onRecordingCancel;

  const VoiceInputBar({
    super.key,
    required this.isRecording,
    required this.onTextChanged,
    required this.onRecordingStart,
    required this.onRecordingStop,
    required this.onRecordingCancel,
    this.isSpeaking = false,
    this.liveTranscript = '',
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

  /// Recording state UI — waveform, live transcript, finish/cancel actions
  Widget _buildRecordingUI() {
    final hasTranscript = widget.liveTranscript.trim().isNotEmpty;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // ─── Waveform visualization ───
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

        // ─── Live transcript (on-device STT) ───
        if (hasTranscript)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              widget.liveTranscript,
              textDirection: TextDirection.rtl,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.textSecondaryLight,
              ),
            ),
          ),

        // ─── Actions: discard · status · finish ───
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Cancel capture
            FloatingActionButton.small(
              heroTag: 'voice_cancel',
              onPressed: widget.onRecordingCancel,
              backgroundColor: Colors.white,
              elevation: 1,
              child: const Icon(Icons.close, color: AppTheme.accentEmergency),
            ),
            const SizedBox(width: 20),
            Text(
              hasTranscript ? 'دارم می‌شنوم...' : 'در حال ضبط...',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppTheme.accentEmergency,
              ),
            ),
            const SizedBox(width: 20),
            // Finish capture & send
            FloatingActionButton.small(
              heroTag: 'voice_finish',
              onPressed: widget.onRecordingStop,
              backgroundColor: AppTheme.accentKnow,
              child: const Icon(Icons.check, color: Colors.white),
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
            heroTag: 'voice_mic',
            onPressed: widget.isSpeaking ? null : widget.onRecordingStart,
            backgroundColor: widget.isSpeaking
                ? AppTheme.textSecondaryLight
                : AppTheme.primaryLight,
            elevation: 2,
            tooltip: widget.isSpeaking
                ? 'زون داره حرف می‌زنه...'
                : 'حرف بزن',
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
                onPressed: _submitText,
              ),
            ),
            onSubmitted: (_) => _submitText(),
          ),
        ),
      ],
    );
  }

  void _submitText() {
    final text = _textController.text.trim();
    if (text.isNotEmpty) {
      widget.onTextChanged(text);
      _textController.clear();
    }
  }
}
