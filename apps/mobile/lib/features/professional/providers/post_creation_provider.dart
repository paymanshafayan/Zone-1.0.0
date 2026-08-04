/// Post Creation Provider — State management for creating professional posts
///
/// Professional posts: image + short video (≤15s) + text + system tags
/// Tags are system-only (from edge processor), never user-tagged.
library features_professional_providers_post_creation_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/edge/edge_processor.dart';
import '../../../core/network/api_client.dart';
import '../../../core/utils/logger.dart';

// ─── Post Creation State ───

class PostCreationState {
  final String description;
  final List<String> mediaPaths; // Local file paths
  final List<String> tags; // System-only tags
  final bool isSubmitting;
  final bool isSuccess;
  final String? errorMessage;

  const PostCreationState({
    this.description = '',
    this.mediaPaths = const [],
    this.tags = const [],
    this.isSubmitting = false,
    this.isSuccess = false,
    this.errorMessage,
  });

  PostCreationState copyWith({
    String? description,
    List<String>? mediaPaths,
    List<String>? tags,
    bool? isSubmitting,
    bool? isSuccess,
    String? errorMessage,
  }) {
    return PostCreationState(
      description: description ?? this.description,
      mediaPaths: mediaPaths ?? this.mediaPaths,
      tags: tags ?? this.tags,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isSuccess: isSuccess ?? this.isSuccess,
      errorMessage: errorMessage,
    );
  }

  bool get isValid {
    return description.trim().isNotEmpty && mediaPaths.isNotEmpty;
  }
}

// ─── Post Creation Provider ───

final postCreationProvider =
    StateNotifierProvider<PostCreationNotifier, PostCreationState>((ref) {
  return PostCreationNotifier(ref.read(apiClientProvider));
});

class PostCreationNotifier extends StateNotifier<PostCreationState> {
  final ApiClient _api;
  final EdgeProcessor _edgeProcessor = EdgeProcessor();
  final ZoneLogger _logger = ZoneLogger('PostCreation');

  PostCreationNotifier(this._api) : super(const PostCreationState());

  /// Update description and auto-extract tags
  void updateDescription(String description) {
    // Auto-extract tags from description using edge processor
    final edgeResult = _edgeProcessor.process(description);
    state = state.copyWith(
      description: description,
      tags: edgeResult.tags,
    );
  }

  /// Add media file
  void addMedia(String path) {
    if (state.mediaPaths.length < 5) {
      state = state.copyWith(
        mediaPaths: [...state.mediaPaths, path],
      );
    }
  }

  /// Remove media file
  void removeMedia(int index) {
    final paths = [...state.mediaPaths];
    if (index >= 0 && index < paths.length) {
      paths.removeAt(index);
      state = state.copyWith(mediaPaths: paths);
    }
  }

  /// Submit the post
  Future<bool> submit({required String zoneId, required String providerId}) async {
    if (!state.isValid) {
      return false;
    }

    state = state.copyWith(isSubmitting: true);

    final response = await _api.createPost({
      'zoneId': zoneId,
      'providerId': providerId,
      'description': state.description,
      'tags': state.tags,
      'media': state.mediaPaths.map((path) {
        return {
          'type': path.endsWith('.mp4') || path.endsWith('.mov') ? 'video' : 'image',
          'url': path,
        };
      }).toList(),
    });

    if (response.isSuccess) {
      state = state.copyWith(isSubmitting: false, isSuccess: true);
      return true;
    }

    state = state.copyWith(
      isSubmitting: false,
      errorMessage: response.errorMessage,
    );
    return false;
  }

  /// Reset form
  void reset() {
    state = const PostCreationState();
  }
}
