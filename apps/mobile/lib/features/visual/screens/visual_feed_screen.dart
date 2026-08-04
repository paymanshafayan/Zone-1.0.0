/// Visual Feed Screen — Instagram-like professional post feed
///
/// This is the visual channel — separate from voice.
/// Professional posts: image + short video (≤15s) + text + system tags.
/// Assistant only ANNOUNCES existence, never describes.
library features_visual_screens_visual_feed_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../providers/visual_provider.dart';
import '../widgets/post_card.dart';

class VisualFeedScreen extends ConsumerWidget {
  const VisualFeedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feedState = ref.watch(visualFeedProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('فید حرفه‌ای'),
        centerTitle: true,
        actions: [
          // ─── Post count badge (for voice channel) ───
          if (feedState.postCount != null && feedState.postCount! > 0)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Chip(
                avatar: const Icon(Icons.workspace_premium, size: 16, color: AppTheme.professionalGold),
                label: Text('${feedState.postCount}'),
                backgroundColor: AppTheme.professionalGold.withValues(alpha: 0.1),
              ),
            ),
        ],
      ),
      body: feedState.posts.isEmpty
          ? _buildEmptyState(context)
          : RefreshIndicator(
              onRefresh: () => ref.read(visualFeedProvider.notifier)
                  .loadPosts(zoneId: 'default', refresh: true),
              child: ListView.builder(
                padding: const EdgeInsets.all(8),
                itemCount: feedState.posts.length + (feedState.hasMore ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index == feedState.posts.length) {
                    // Load more
                    ref.read(visualFeedProvider.notifier)
                        .loadPosts(zoneId: 'default');
                    return const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }
                  return PostCard(
                    post: feedState.posts[index],
                    onLike: () => ref.read(visualFeedProvider.notifier)
                        .likePost(feedState.posts[index].id),
                  );
                },
              ),
            ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.grid_view_outlined,
              size: 64,
              color: AppTheme.textSecondaryLight.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            Text(
              'هنوز پست حرفه‌ای نیست',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: AppTheme.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'وقتی ارائه‌دهندگان حرفه‌ای محله پست بذارن، اینجا نمایش داده میشه.',
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
}
