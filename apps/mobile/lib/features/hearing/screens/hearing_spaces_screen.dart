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
import '../../../shared/models/zone_models.dart';
import '../providers/hearing_provider.dart';

class HearingSpacesScreen extends ConsumerWidget {
  const HearingSpacesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
  Widget _buildActiveSpace(BuildContext context, WidgetRef ref, HearingState state) {
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
                  '${state.activeMembers.length} نفر حاضر',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.accentAsk,
                  ),
                ),
              ),
              Text(
                'طنین: ۲ ساعت',
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
        _buildSpaceInput(context, ref),
      ],
    );
  }

  Widget _buildMessage(BuildContext context, SpaceMessage msg) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: AppTheme.primaryLight.withValues(alpha: 0.2),
            child: const Icon(Icons.person, size: 16, color: AppTheme.primaryLight),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(msg.text, style: Theme.of(context).textTheme.bodyMedium),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpaceInput(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();

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
                controller: controller,
                textDirection: TextDirection.rtl,
                decoration: const InputDecoration(
                  hintText: 'حرف بزن...',
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.send, color: AppTheme.primaryLight),
              onPressed: () {
                if (controller.text.trim().isNotEmpty) {
                  ref.read(hearingProvider.notifier).speak(controller.text.trim());
                  controller.clear();
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  /// Spaces list view
  Widget _buildSpacesList(BuildContext context, WidgetRef ref, HearingState state) {
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
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: state.spaces.length,
      itemBuilder: (context, index) {
        final space = state.spaces[index];
        return _buildSpaceCard(context, ref, space);
      },
    );
  }

  Widget _buildSpaceCard(BuildContext context, WidgetRef ref, HearingSpace space) {
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
                    children: space.tags.map((tag) => Chip(
                      label: Text(tag.split('/').last),
                      visualDensity: VisualDensity.compact,
                    )).toList(),
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
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
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
            // Placeholder for space creation form
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('بعداً پیاده‌سازی میشه'),
            ),
          ],
        ),
      ),
    );
  }
}
