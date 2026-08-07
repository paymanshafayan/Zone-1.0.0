/// Visual Feed Screen — Instagram-like professional post feed
///
/// This is the visual channel — separate from voice.
/// Professional posts: image + short video (≤15s) + text + system tags.
/// Assistant only ANNOUNCES existence, never describes.
library features_visual_screens_visual_feed_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/services/navigation_service.dart';
import '../../../shared/widgets/shared_widgets.dart';
import '../providers/visual_provider.dart';
import '../widgets/post_card.dart';

class VisualFeedScreen extends ConsumerStatefulWidget {
  const VisualFeedScreen({super.key});

  @override
  ConsumerState<VisualFeedScreen> createState() => _VisualFeedScreenState();
}

class _VisualFeedScreenState extends ConsumerState<VisualFeedScreen> {
  final ScrollController _scrollController = ScrollController();

  String get _zoneId => ref.read(authProvider).zoneId ?? 'default_zone';

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);

    // Initial load — never call provider mutations during build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(visualFeedProvider.notifier).loadPosts(
            zoneId: _zoneId,
            refresh: true,
          );
      ref.read(visualFeedProvider.notifier).getPostCount(zoneId: _zoneId);
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Infinite scroll — fetch the next page when nearing the bottom.
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels >= position.maxScrollExtent - 400) {
      ref.read(visualFeedProvider.notifier).loadPosts(zoneId: _zoneId);
    }
  }

  Future<void> _refresh() {
    return ref.read(visualFeedProvider.notifier).loadPosts(
          zoneId: _zoneId,
          refresh: true,
        );
  }

  @override
  Widget build(BuildContext context) {
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
                avatar: const Icon(Icons.workspace_premium,
                    size: 16, color: AppTheme.professionalBadge),
                label: Text('${feedState.postCount}'),
                backgroundColor:
                    AppTheme.professionalGold.withValues(alpha: 0.15),
              ),
            ),
        ],
      ),
      body: _buildBody(feedState),
    );
  }

  Widget _buildBody(VisualFeedState feedState) {
    // ─── First load in progress ───
    if (feedState.isLoading && feedState.posts.isEmpty) {
      return const ZoneLoading(message: 'داره فید حرفه‌ای لود میشه…');
    }

    // ─── Failed first load ───
    if (feedState.posts.isEmpty && feedState.errorMessage != null) {
      return ZoneError(
        message: feedState.errorMessage!,
        onRetry: _refresh,
      );
    }

    // ─── Successfully loaded but nothing to show ───
    if (feedState.posts.isEmpty) {
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.7,
              child: _buildEmptyState(context),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(8),
        itemCount: feedState.posts.length + (feedState.hasMore ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == feedState.posts.length) {
            // Trailing loader while the next page is fetched.
            return const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final post = feedState.posts[index];
          return PostCard(
            post: post,
            isLiked: feedState.likedPostIds.contains(post.id),
            onTap: () => context.push('/post/${post.id}', extra: post),
            onLike: () =>
                ref.read(visualFeedProvider.notifier).likePost(post.id),
          );
        },
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
