/**
 * Zone Plugin — Professional Posts
 *
 * Handles professional provider posts (visual channel).
 * Instagram-like feed with image + short video (≤15s) + text + tags.
 *
 * ⚠️ The assistant only ANNOUNCES professional posts.
 * It does not read or describe them in the voice channel.
 *
 * Phase 5: Full implementation with PostService integration
 */

import { definePlugin, type ZoneSDK } from '@zone/sdk';
import type { PostService, CreatePostParams, ProfessionalPost } from '@zone/assistant';

// ─── Professional Plugin ───

export default function createProfessionalPlugin(
  sdk: ZoneSDK,
  postService?: PostService
): ReturnType<typeof definePlugin> {
  return definePlugin(
    {
      name: 'zone-professional',
      displayName: 'پست حرفه‌ای',
      version: '1.0.0',
      description: 'Professional provider posts — visual feed (Instagram-like)',
      subscriptions: ['user.speak', 'professional.post', 'wave.open'],
      publications: ['professional.post'],
      models: ['posts', 'persons'],
      routes: [
        {
          path: '/professional',
          widget: 'ProfessionalFeed',
          label: 'حرفه‌ای',
          icon: 'briefcase',
          menuPosition: 2,
        },
        {
          path: '/professional/create',
          widget: 'CreatePost',
          label: 'ایجاد پست',
          icon: 'plus',
        },
        {
          path: '/professional/my-posts',
          widget: 'MyPosts',
          label: 'پست‌های من',
          icon: 'user',
        },
      ],
    },
    {
      onEvent: async (event: string, data: any) => {
        switch (event) {
          case 'user.speak': {
            // When a user asks for a service, check if professional posts exist
            const hasServiceTag = data.tags?.some((t: string) => t.startsWith('services/'));
            if (!hasServiceTag) return;

            if (postService) {
              const postCount = await postService.getPostCount(data.zoneId, data.tags);

              if (postCount > 0) {
                // Announce existence — do NOT describe the posts
                // The assistant will say: "X نفر پست حرفه‌ای دارن"
                // The user then chooses to see the visual feed
                await sdk.events.emit('professional.post', {
                  postId: '', // announcement, not a specific post
                  providerId: '',
                  zoneId: data.zoneId,
                  tags: data.tags,
                  postCount, // Extra field for announcement
                });
              }
            }
            break;
          }

          case 'professional.post': {
            // A new professional post was created
            // Notify users who are subscribed to matching tags
            if (data.tags && data.zoneId) {
              // Get users subscribed to these tags
              // TODO: Implement notification logic with UserSubscription
              // For now, log the event
              await sdk.ui.pushNotification(
                '', // broadcast to zone
                `پست حرفه‌ای جدید: ${data.tags?.join(', ') || ''}`
              );
            }
            break;
          }

          case 'wave.open': {
            // A wave was opened — check if professional posts exist for these tags
            if (postService && data.tags) {
              const postCount = await postService.getPostCount(data.zoneId, data.tags);
              if (postCount > 0) {
                // Notify the wave that professional posts exist
                await sdk.notify.send(
                  data.requesterId,
                  `${postCount} نفر پست حرفه‌ای دارن. میخوای ببینی؟`
                );
              }
            }
            break;
          }
        }
      },

      onDestroy: async () => {
        // Cleanup
      },
    }
  );
}

// ─── Post Creation Helper ───

/**
 * Create a professional post with validation
 * This is the server-side handler for post creation.
 */
export async function createProfessionalPost(
  postService: PostService,
  params: {
    zoneId: string;
    providerId: string;
    providerName: string;
    media: Array<{
      type: 'image' | 'video';
      url: string;
      thumbnailUrl?: string;
      duration?: number;
    }>;
    description: string;
    tags: string[];
  }
): Promise<ProfessionalPost> {
  // Validate: at least one media item
  if (!params.media || params.media.length === 0) {
    throw new Error('حداقل یک تصویر یا ویدیو لازمه');
  }

  // Validate: video duration ≤ 15 seconds
  for (const m of params.media) {
    if (m.type === 'video' && m.duration && m.duration > 15) {
      throw new Error('مدت ویدیو باید حداکثر ۱۵ ثانیه باشه');
    }
  }

  // Validate: description length
  if (params.description.length > 500) {
    throw new Error('توضیحات حداکثر ۵۰۰ کاراکتر');
  }

  // Validate: tags must be from closed vocabulary
  const validTags = params.tags.filter((t) => t.includes('/'));
  if (validTags.length === 0) {
    throw new Error('حداقل یک برچسب معتبر لازمه');
  }

  // Create the post
  const post = await postService.create({
    zoneId: params.zoneId,
    providerId: params.providerId,
    providerName: params.providerName,
    media: params.media,
    description: params.description,
    tags: validTags,
    isSponsored: false,
  });

  return post;
}

// ─── Professional Post Announcement ───

/**
 * Generate the voice channel announcement for professional posts
 * ⚠️ Only announces existence — NEVER describes the post content
 */
export function generatePostAnnouncement(postCount: number, skillLabel?: string): string {
  if (postCount === 0) return '';

  if (postCount === 1) {
    return skillLabel
      ? `یک نفر پست حرفه‌ای برای ${skillLabel} داره.`
      : 'یک نفر پست حرفه‌ای داره.';
  }

  return skillLabel
    ? `${postCount} نفر پست حرفه‌ای برای ${skillLabel} دارن.`
    : `${postCount} نفر پست حرفه‌ای دارن.`;
}
