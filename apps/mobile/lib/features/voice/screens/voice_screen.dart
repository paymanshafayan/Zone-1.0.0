/// Voice Screen — Main voice interaction screen
///
/// This is the heart of the app. The voice channel.
/// Conversation-driven, not data-driven.
/// Large, friendly, voice-first UI.
library features_voice_screens_voice_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/services/navigation_service.dart';
import '../providers/voice_provider.dart';
import '../widgets/voice_bubble.dart';
import '../widgets/voice_input_bar.dart';
import '../widgets/mode_indicator.dart';

class VoiceScreen extends ConsumerStatefulWidget {
  const VoiceScreen({super.key});

  @override
  ConsumerState<VoiceScreen> createState() => _VoiceScreenState();
}

class _VoiceScreenState extends ConsumerState<VoiceScreen> {
  final ScrollController _scrollController = ScrollController();
  int _lastConversationLength = 0;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  /// Route input through the voice pipeline with the caller's identity so
  /// the backend can attribute memories/demands to the right person.
  void _process(String text) {
    final auth = ref.read(authProvider);
    ref.read(voiceProvider.notifier).processInput(
          text,
          personId: auth.personId,
          zoneId: auth.zoneId,
        );
  }

  @override
  Widget build(BuildContext context) {
    final voiceState = ref.watch(voiceProvider);

    // Only auto-scroll when a new conversation item actually arrived —
    // scrolling on every rebuild yanks the list away from the user.
    if (voiceState.conversation.length != _lastConversationLength) {
      _lastConversationLength = voiceState.conversation.length;
      _scrollToBottom();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('زون'),
        centerTitle: true,
        actions: [
          // ─── Spoken replies toggle ───
          IconButton(
            icon: Icon(
              voiceState.ttsEnabled ? Icons.volume_up : Icons.volume_off,
            ),
            onPressed: () => ref
                .read(voiceProvider.notifier)
                .setTtsEnabled(!voiceState.ttsEnabled),
            tooltip: voiceState.ttsEnabled
                ? 'خواندن صوتی پاسخ‌ها: روشن'
                : 'خواندن صوتی پاسخ‌ها: خاموش',
          ),
          if (voiceState.conversation.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: () => ref.read(voiceProvider.notifier).clearConversation(),
              tooltip: 'پاک کردن گفتگو',
            ),
        ],
      ),
      body: Column(
        children: [
          // ─── Mode Indicator ───
          if (voiceState.conversation.isNotEmpty)
            const ModeIndicator(),

          // ─── Conversation Area ───
          Expanded(
            child: voiceState.conversation.isEmpty
                ? _buildEmptyState(context)
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: voiceState.conversation.length,
                    itemBuilder: (context, index) {
                      final item = voiceState.conversation[index];
                      return VoiceBubble(
                        text: item.text,
                        isUser: item.isUser,
                        mode: item.mode,
                        isReadback: item.readbackText != null,
                      );
                    },
                  ),
          ),

          // ─── Number Confirmation ───
          if (voiceState.state == VoiceState.confirmingNumber &&
              voiceState.currentReadbackText != null)
            _buildNumberConfirmation(context, voiceState.currentReadbackText!),

          // ─── Processing Indicator ───
          if (voiceState.state == VoiceState.processing)
            _buildProcessingIndicator(),

          // ─── Speaking Indicator ───
          if (voiceState.isSpeaking)
            _buildSpeakingIndicator(),

          // ─── Input Bar ───
          VoiceInputBar(
            isRecording: voiceState.state == VoiceState.recording,
            isSpeaking: voiceState.isSpeaking,
            liveTranscript: voiceState.liveTranscript,
            onTextChanged: _process,
            onRecordingStart: () {
              ref.read(voiceProvider.notifier).startRecording();
            },
            onRecordingStop: () {
              ref.read(voiceProvider.notifier).stopRecordingAndProcess();
            },
            onRecordingCancel: () {
              ref.read(voiceProvider.notifier).cancel();
            },
          ),
        ],
      ),
    );
  }

  /// Empty state — first time user sees this
  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // ─── Zone Logo/Icon ───
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppTheme.primaryLight.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.hearing,
                size: 56,
                color: AppTheme.primaryLight,
              ),
            ),
            const SizedBox(height: 24),

            // ─── Welcome Text ───
            Text(
              'سلام! من زونم.',
              style: Theme.of(context).textTheme.headlineMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              'رفیق محله‌اتم. هر چی لازم داری بگو.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: AppTheme.textSecondaryLight,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            // ─── Example prompts ───
            _buildExamplePrompt(context, 'نقاش می‌خوام'),
            const SizedBox(height: 8),
            _buildExamplePrompt(context, 'کی بلده لوله‌کشی کنه؟'),
            const SizedBox(height: 8),
            _buildExamplePrompt(context, 'یه رفیق برای پیاده‌روی'),
          ],
        ),
      ),
    );
  }

  Widget _buildExamplePrompt(BuildContext context, String text) {
    return InkWell(
      onTap: () => _process(text),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: AppTheme.primaryLight,
          ),
        ),
      ),
    );
  }

  /// Number confirmation UI
  Widget _buildNumberConfirmation(BuildContext context, String readbackText) {
    return Container(
      padding: const EdgeInsets.all(16),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.accentUnknown.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.accentUnknown.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.confirmation_number, color: AppTheme.accentUnknown),
          const SizedBox(height: 8),
          Text(
            'تأیید عدد',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton(
                onPressed: () => ref.read(voiceProvider.notifier).confirmNumber(true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accentKnow,
                  minimumSize: const Size(100, 44),
                ),
                child: const Text('بله ✓'),
              ),
              const SizedBox(width: 16),
              OutlinedButton(
                onPressed: () => ref.read(voiceProvider.notifier).confirmNumber(false),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(100, 44),
                  side: const BorderSide(color: AppTheme.accentEmergency),
                ),
                child: const Text('نه ✗', style: TextStyle(color: AppTheme.accentEmergency)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Processing indicator
  Widget _buildProcessingIndicator() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppTheme.primaryLight,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'بذار ببینم...',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppTheme.textSecondaryLight,
            ),
          ),
        ],
      ),
    );
  }

  /// Speaking indicator — shown while Zone reads a reply out loud
  Widget _buildSpeakingIndicator() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _SpeakingDots(color: AppTheme.primaryLight),
          const SizedBox(width: 12),
          Text(
            'زون داره می‌گه...',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppTheme.textSecondaryLight,
            ),
          ),
          const SizedBox(width: 8),
          InkWell(
            onTap: () => ref.read(voiceProvider.notifier).stopSpeaking(),
            borderRadius: BorderRadius.circular(16),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.stop_circle_outlined,
                  size: 20, color: AppTheme.accentEmergency),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tiny animated "speaking" dots used by the speaking indicator.
class _SpeakingDots extends StatefulWidget {
  final Color color;

  const _SpeakingDots({required this.color});

  @override
  State<_SpeakingDots> createState() => _SpeakingDotsState();
}

class _SpeakingDotsState extends State<_SpeakingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (index) {
            final phase = (_controller.value + index / 3) % 1.0;
            final scale = 0.6 + 0.6 * (phase < 0.5 ? phase * 2 : (1 - phase) * 2);
            return Container(
              width: 6,
              height: 6 * scale,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                color: widget.color,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        );
      },
    );
  }
}
