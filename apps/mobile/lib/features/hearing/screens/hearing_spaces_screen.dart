/// Hearing Spaces Screen — List and interact with hearing spaces
///
/// Two types of spaces:
/// - Dynamic (request waves with TTL) — created on-demand
/// - Persistent (user-created) — last until removed
///
/// Reverberation: 15min / 2h / 6h depending on urgency type
library features_hearing_screens_hearing_spaces_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/services/websocket_service.dart';
import '../providers/hearing_provider.dart';

class HearingSpacesScreen extends ConsumerStatefulWidget {
  const HearingSpacesScreen({super.key});

  @override
  ConsumerState<HearingSpacesScreen> createState() =>
      _HearingSpacesScreenState();
}

class _HearingSpacesScreenState extends ConsumerState<HearingSpacesScreen> {
  bool _didInitialLoad = false;

  @override
  void initState() {
    super.initState();
    // Load the zone's spaces once the first frame is up.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_didInitialLoad && mounted) {
        _didInitialLoad = true;
        ref.read(hearingProvider.notifier).loadSpaces();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final hearingState = ref.watch(hearingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('فضای شنوایی'),
        centerTitle: true,
        actions: [
          if (hearingState.currentSpaceId != null)
            IconButton(
              icon: const Icon(Icons.exit_to_app),
              onPressed: () => ref.read(hearingProvider.notifier).leaveSpace(),
              tooltip: 'خروج از فضا',
            )
          else
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: hearingState.isLoading
                  ? null
                  : () => ref.read(hearingProvider.notifier).loadSpaces(),
              tooltip: 'به‌روزرسانی',
            ),
        ],
      ),
      body: hearingState.currentSpaceId != null
          ? _buildActiveSpace(context, ref, hearingState)
          : _buildSpacesList(context, ref, hearingState),
      floatingActionButton: hearingState.currentSpaceId == null
          ? FloatingActionButton(
              onPressed: () => _showCreateSpaceDialog(context, ref),
              backgroundColor: AppTheme.primaryLight,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  /// Active space view
  Widget _buildActiveSpace(
      BuildContext context, WidgetRef ref, HearingState state) {
    return Column(
      children: [
        // ─── Space info bar ───
        Container(
          padding: const EdgeInsets.all(12),
          color: AppTheme.accentAsk.withValues(alpha: 0.1),
          child: Row(
            children: [
              const Icon(Icons.hearing, color: AppTheme.accentAsk),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  state.currentSpaceName ?? 'فضای شنوایی',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppTheme.accentAsk,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ),
              Text(
                '${state.memberCount} نفر حاضر',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppTheme.textSecondaryLight,
                    ),
              ),
            ],
          ),
        ),

        // ─── Messages ───
        Expanded(
          child: state.messages.isEmpty
              ? Center(
                  child: Text(
                    'هنوز کسی حرف نزده',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppTheme.textSecondaryLight,
                        ),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.messages.length,
                  itemBuilder: (context, index) {
                    final msg = state.messages[index];
                    return _buildMessage(context, msg);
                  },
                ),
        ),

        // ─── Input ───
        const _SpaceInputBar(),
      ],
    );
  }

  Widget _buildMessage(BuildContext context, SpaceMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        textDirection: msg.isEcho ? TextDirection.ltr : TextDirection.rtl,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: (msg.isEcho
                    ? AppTheme.accentKnow
                    : AppTheme.primaryLight)
                .withValues(alpha: 0.2),
            child: Icon(
              msg.isEcho ? Icons.person : Icons.hearing,
              size: 16,
              color: msg.isEcho ? AppTheme.accentKnow : AppTheme.primaryLight,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: msg.isEcho
                    ? AppTheme.accentKnow.withValues(alpha: 0.08)
                    : Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!msg.isEcho && msg.personId.isNotEmpty)
                    Text(
                      msg.personId,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppTheme.textSecondaryLight,
                          ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  Text(msg.text,
                      style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Spaces list view
  Widget _buildSpacesList(
      BuildContext context, WidgetRef ref, HearingState state) {
    if (state.isLoading && state.spaces.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: AppTheme.primaryLight),
      );
    }

    if (state.spaces.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.hearing_outlined,
                size: 64,
                color: AppTheme.textSecondaryLight.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 16),
              Text(
                'فضای شنوایی فعال نیست',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: AppTheme.textSecondaryLight,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'وقتی کسی درخواست کمک بکنه یا فضایی ساخته بشه، اینجا نمایش داده میشه.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.textSecondaryLight,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: () =>
                    ref.read(hearingProvider.notifier).loadSpaces(),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('به‌روزرسانی'),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(hearingProvider.notifier).loadSpaces(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: state.spaces.length,
        itemBuilder: (context, index) {
          final space = state.spaces[index];
          return _buildSpaceCard(context, ref, space);
        },
      ),
    );
  }

  Widget _buildSpaceCard(
      BuildContext context, WidgetRef ref, SpaceSummary space) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => ref.read(hearingProvider.notifier).joinSpace(space.id),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    space.type == 'dynamic' ? Icons.sensors : Icons.forum,
                    color: AppTheme.accentAsk,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      space.name ?? 'فضای شنوایی',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  Text(
                    '${space.memberCount} نفر',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppTheme.textSecondaryLight,
                        ),
                  ),
                ],
              ),
              if (space.tags.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(
                    spacing: 4,
                    children: space.tags
                        .map((tag) => Chip(
                              label: Text(tag.split('/').last),
                              visualDensity: VisualDensity.compact,
                            ))
                        .toList(),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCreateSpaceDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _CreateSpaceSheet(parentContext: context),
    );
  }
}

/// Input bar for the active space — stateful so the controller survives
/// rebuilds (a fresh controller per build used to swallow typed text).
class _SpaceInputBar extends ConsumerStatefulWidget {
  const _SpaceInputBar();

  @override
  ConsumerState<_SpaceInputBar> createState() => _SpaceInputBarState();
}

class _SpaceInputBarState extends ConsumerState<_SpaceInputBar> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isNotEmpty) {
      ref.read(hearingProvider.notifier).speak(text);
      _controller.clear();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                textDirection: TextDirection.rtl,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: const InputDecoration(
                  hintText: 'حرف بزن...',
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.send, color: AppTheme.primaryLight),
              onPressed: _send,
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom sheet for creating a new persistent hearing space.
class _CreateSpaceSheet extends ConsumerStatefulWidget {
  /// The Scaffold's context — used for the post-create SnackBar.
  final BuildContext parentContext;

  const _CreateSpaceSheet({required this.parentContext});

  @override
  ConsumerState<_CreateSpaceSheet> createState() => _CreateSpaceSheetState();
}

class _CreateSpaceSheetState extends ConsumerState<_CreateSpaceSheet> {
  final TextEditingController _nameController = TextEditingController();
  bool _isCreating = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || _isCreating) return;

    setState(() => _isCreating = true);
    await ref.read(hearingProvider.notifier).createSpace(name);
    if (!mounted) return;

    Navigator.of(context).pop(); // Close the sheet.
    ScaffoldMessenger.of(widget.parentContext).showSnackBar(
      SnackBar(
        content: Text('فضای «$name» ساخته شد 🎧'),
        backgroundColor: AppTheme.accentKnow,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ایجاد فضای شنوایی',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          Text(
            'فضای شنوایی جاییه که همسایه‌ها می‌تونن با هم حرف بزنن. '
            'صدای هر کسی که حاضر باشه، شنیده میشه.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: _nameController,
            textDirection: TextDirection.rtl,
            decoration: const InputDecoration(
              labelText: 'اسم فضا',
              hintText: 'مثلاً: گپ همسایه‌های قیطریه',
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _isCreating ? null : _create,
            child: _isCreating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('ایجاد فضا'),
          ),
        ],
      ),
    );
  }
}
