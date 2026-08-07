/// Visual Feed Providers — Professional post feed
///
/// Instagram-like feed for professional posts.
/// Assistant only ANNOUNCES count, never describes.
/// This is the visual channel — separate from voice.
library features_visual_providers_visual_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/utils/logger.dart';
import '../../../shared/models/zone_models.dart';

// ─── Visual Feed State ───

class VisualFeedState {
  final List<Post> posts;
  final bool isLoading;
  final bool hasMore;
  final int currentPage;
  final String? errorMessage;
  final int? postCount; // For voice announcements
  final Set<String> likedPostIds; // Optimistic like feedback

  const VisualFeedState({
    this.posts = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.currentPage = 0,
    this.errorMessage,
    this.postCount,
    this.likedPostIds = const {},
  });

  VisualFeedState copyWith({
    List<Post>? posts,
    bool? isLoading,
    bool? hasMore,
    int? currentPage,
    String? errorMessage,
    int? postCount,
    Set<String>? likedPostIds,
  }) {
    return VisualFeedState(
      posts: posts ?? this.posts,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      currentPage: currentPage ?? this.currentPage,
      errorMessage: errorMessage,
      postCount: postCount ?? this.postCount,
      likedPostIds: likedPostIds ?? this.likedPostIds,
    );
  }
}

// ─── Visual Feed Provider ───

final visualFeedProvider = StateNotifierProvider<VisualFeedNotifier, VisualFeedState>((ref) {
  return VisualFeedNotifier(ref.read(apiClientProvider));
});

class VisualFeedNotifier extends StateNotifier<VisualFeedState> {
  final ApiClient _api;
  final ZoneLogger _logger = ZoneLogger('VisualFeed');

  VisualFeedNotifier(this._api) : super(const VisualFeedState());

  /// Load posts for a zone
  Future<void> loadPosts({required String zoneId, String? tag, bool refresh = false}) async {
    if (state.isLoading) {
      return;
    }
    if (!refresh && !state.hasMore) {
      return;
    }

    final page = refresh ? 0 : state.currentPage;

    state = state.copyWith(isLoading: true);

    final response = await _api.getPosts(
      zoneId: zoneId,
      tag: tag,
      limit: 20,
      offset: page * 20,
    );

    if (response.isSuccess) {
      final data = response.data as Map<String, dynamic>;
      final postsList = (data['posts'] as List?)?.map((p) => Post.fromJson(p)).toList() ?? [];
      final hasMore = postsList.length >= 20;

      state = state.copyWith(
        posts: refresh ? postsList : [...state.posts, ...postsList],
        isLoading: false,
        hasMore: hasMore,
        currentPage: page + 1,
      );
    } else {
      state = state.copyWith(
        isLoading: false,
        errorMessage: response.errorMessage,
      );
    }
  }

  /// Get post count for voice channel announcement
  Future<int> getPostCount({required String zoneId}) async {
    final response = await _api.getPostCount(zoneId: zoneId);
    if (response.isSuccess) {
      final data = response.data as Map<String, dynamic>;
      final count = data['count'] as int? ?? 0;
      state = state.copyWith(postCount: count);
      return count;
    }
    return 0;
  }

  /// Like a post — optimistic update, rolled back if the call fails.
  Future<void> likePost(String postId) async {
    if (state.likedPostIds.contains(postId)) {
      return; // Already liked — backend counts each like once.
    }
    state = state.copyWith(
      likedPostIds: {...state.likedPostIds, postId},
    );
    final response = await _api.likePost(postId: postId);
    if (response.isError) {
      state = state.copyWith(
        likedPostIds: {...state.likedPostIds}..remove(postId),
      );
    }
  }
}
