/// Post Card — Instagram-like card for professional posts
///
/// Visual channel: image + short video (≤15s) + text + system tags
/// Like Instagram: scroll, image, short video, text, tags
library features_visual_widgets_post_card;

import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/zone_models.dart';

class PostCard extends StatelessWidget {
  final Post post;
  final bool isLiked;
  final VoidCallback? onLike;
  final VoidCallback? onTap;

  const PostCard({
    super.key,
    required this.post,
    this.isLiked = false,
    this.onLike,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Media ───
            if (post.media.isNotEmpty) _buildMedia(context),

            // ─── Content ───
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── Provider info ───
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: AppTheme.professionalGold.withValues(alpha: 0.2),
                        child: const Icon(
                          Icons.workspace_premium,
                          size: 18,
                          color: AppTheme.professionalBadge,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'ارائه‌دهنده حرفه‌ای',
                          style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: AppTheme.professionalBadge,
                          ),
                        ),
                      ),
                      if (post.isSponsored)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.professionalGold.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            'حرفه‌ای',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppTheme.professionalBadge,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // ─── Description ───
                  Text(
                    post.description,
                    style: Theme.of(context).textTheme.bodyMedium,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),

                  // ─── Tags (system-only) ───
                  if (post.tags.isNotEmpty)
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: post.tags.map((tag) {
                        return Chip(
                          label: Text(
                            tag.split('/').last,
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                          visualDensity: VisualDensity.compact,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          padding: EdgeInsets.zero,
                        );
                      }).toList(),
                    ),

                  // ─── Actions ───
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      IconButton(
                        icon: Icon(
                          isLiked ? Icons.favorite : Icons.favorite_border,
                          size: 20,
                          color: isLiked ? AppTheme.accentEmergency : null,
                        ),
                        onPressed: onLike,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                      ),
                      const Spacer(),
                      Text(
                        _timeAgo(post.publishedAt),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: AppTheme.textSecondaryLight,
                        ),
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

  Widget _buildMedia(BuildContext context) {
    // Show first media item
    final media = post.media.first;

    if (media.type == 'video') {
      return Stack(
        alignment: Alignment.center,
        children: [
          // Thumbnail
          Container(
            height: 240,
            width: double.infinity,
            color: Colors.black12,
            child: media.thumbnailUrl != null
                ? Image.network(media.thumbnailUrl!, fit: BoxFit.cover)
                : const Icon(Icons.play_circle_outline, size: 48),
          ),
          // Play button overlay
          const Icon(Icons.play_circle, size: 48, color: Colors.white70),
          // Duration badge
          if (media.duration != null)
            Positioned(
              bottom: 8,
              left: 8,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '${media.duration}s',
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                ),
              ),
            ),
        ],
      );
    }

    // Image
    return Container(
      height: 240,
      width: double.infinity,
      color: Colors.black12,
      child: Image.network(
        media.url,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Icon(Icons.image, size: 48, color: Colors.grey),
      ),
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
    return '${date.day}/${date.month}';
  }
}
