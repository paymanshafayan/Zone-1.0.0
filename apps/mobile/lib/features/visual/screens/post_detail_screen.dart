/// Post Detail Screen — Full view of a professional post
///
/// Shows: full-size image/video, description, tags, provider info
/// Like Instagram detail view.
library features_visual_screens_post_detail_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/zone_models.dart';
import '../../../shared/widgets/shared_widgets.dart';

class PostDetailScreen extends ConsumerWidget {
  final Post post;

  const PostDetailScreen({super.key, required this.post});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('پست حرفه‌ای'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Media Gallery ───
            if (post.media.isNotEmpty) _buildMediaGallery(context),

            // ─── Content ───
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── Provider Info ───
                  _buildProviderInfo(context),
                  const SizedBox(height: 16),

                  // ─── Description ───
                  Text(
                    post.description,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),

                  // ─── Tags ───
                  if (post.tags.isNotEmpty) ...[
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: post.tags.map((tag) {
                        return ZoneStatusChip(
                          label: tag.split('/').last,
                          color: AppTheme.primaryLight,
                          icon: Icons.tag,
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ─── Meta Info ───
                  Row(
                    children: [
                      Text(
                        _timeAgo(post.publishedAt),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.textSecondaryLight,
                        ),
                      ),
                      const Spacer(),
                      if (post.isSponsored)
                        const ZoneStatusChip(
                          label: 'حرفه‌ای',
                          color: AppTheme.professionalBadge,
                          icon: Icons.workspace_premium,
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ─── Actions ───
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.favorite_border),
                        onPressed: () {
                          // In production: like post via API
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.share_outlined),
                        onPressed: () {
                          // In production: share post
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.phone_outlined),
                        onPressed: () {
                          // In production: contact provider
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMediaGallery(BuildContext context) {
    if (post.media.length == 1) {
      // Single media — full width
      return _buildMediaItem(context, post.media.first);
    }

    // Multiple media — horizontal scroll
    return SizedBox(
      height: 300,
      child: PageView.builder(
        itemCount: post.media.length,
        itemBuilder: (context, index) {
          return _buildMediaItem(context, post.media[index]);
        },
      ),
    );
  }

  Widget _buildMediaItem(BuildContext context, PostMedia media) {
    if (media.type == 'video') {
      return Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: double.infinity,
            height: 300,
            color: Colors.black12,
            child: media.thumbnailUrl != null
                ? Image.network(media.thumbnailUrl!, fit: BoxFit.cover)
                : const Icon(Icons.play_circle_outline, size: 48),
          ),
          const Icon(Icons.play_circle, size: 64, color: Colors.white70),
          // Duration badge
          if (media.duration != null)
            Positioned(
              bottom: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${media.duration}s',
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ),
        ],
      );
    }

    return Container(
      width: double.infinity,
      height: 300,
      color: Colors.black12,
      child: Image.network(
        media.url,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) =>
            const Icon(Icons.broken_image, size: 48, color: Colors.grey),
      ),
    );
  }

  Widget _buildProviderInfo(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 24,
          backgroundColor: AppTheme.professionalGold.withValues(alpha: 0.2),
          child: const Icon(
            Icons.workspace_premium,
            color: AppTheme.professionalBadge,
            size: 24,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ارائه‌دهنده حرفه‌ای',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppTheme.professionalBadge,
                ),
              ),
              Text(
                'تأیید شده ✓',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.accentKnow,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes} دقیقه پیش';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours} ساعت پیش';
    }
    if (diff.inDays < 7) {
      return '${diff.inDays} روز پیش';
    }
    if (diff.inDays < 30) {
      return '${(diff.inDays / 7).floor()} هفته پیش';
    }
    return '${(diff.inDays / 30).floor()} ماه پیش';
  }
}
