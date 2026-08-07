/**
 * Zone Post Service — Professional Posts (Visual Channel)
 *
 * Manages professional provider posts for the visual feed.
 * Instagram-like: image + short video (≤15s) + text + system tags.
 *
 * Key rules:
 * - Posts are created by professional providers only
 * - Tags are system-only (never user-tagged)
 * - Posts are visible while subscription is active
 * - When subscription expires, posts are hidden (not deleted)
 * - The assistant only ANNOUNCES posts, never describes them
 */

import { Logger } from '@zone/core';

// ─── Types ───

export interface PostMedia {
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  duration?: number; // seconds (for video, max 15)
}

export interface ProfessionalPost {
  id: string;
  zoneId: string;
  providerId: string;
  providerName: string;
  media: PostMedia[];
  description: string;
  tags: string[];
  isSponsored: boolean;
  isActive: boolean;
  publishedAt: Date;
  expiresAt?: Date;
  viewCount: number;
  likeCount: number;
}

export interface CreatePostParams {
  zoneId: string;
  providerId: string;
  /** Display name of the provider (defaults to providerId) */
  providerName?: string;
  media: PostMedia[];
  description: string;
  tags: string[];
  isSponsored?: boolean;
  expiresAt?: Date;
}

export interface PostFeedParams {
  zoneId: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}

export interface PostFeedResult {
  posts: ProfessionalPost[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Post Service ───

export class PostService {
  private logger: Logger;
  /** In-memory store for development (production: PostgreSQL) */
  private posts: Map<string, ProfessionalPost> = new Map();
  /** Index: zoneId → tag → postIds */
  private index: Map<string, Map<string, string[]>> = new Map();
  /** Index: providerId → postIds */
  private providerIndex: Map<string, string[]> = new Map();

  constructor() {
    this.logger = new Logger({ context: { service: 'post-service' } });
  }

  /**
   * Create a new professional post
   *
   * Only professional providers with active subscriptions can create posts.
   * Tags are system-only — they come from the edge processor's analysis.
   */
  async create(params: CreatePostParams): Promise<ProfessionalPost> {
    const {
      zoneId,
      providerId,
      providerName = providerId,
      media,
      description,
      tags,
      isSponsored = false,
      expiresAt,
    } = params;

    // Validate media
    for (const m of media) {
      if (m.type === 'video' && m.duration && m.duration > 15) {
        throw new Error('Video duration must be ≤ 15 seconds');
      }
    }

    // Validate tags — must be from closed vocabulary
    // (In production, this checks against TagService)
    const validTags = tags.filter((t) => t.includes('/'));

    const post: ProfessionalPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      zoneId,
      providerId,
      providerName,
      media,
      description,
      tags: validTags,
      isSponsored,
      isActive: true,
      publishedAt: new Date(),
      expiresAt,
      viewCount: 0,
      likeCount: 0,
    };

    // Store
    this.posts.set(post.id, post);

    // Update index
    this.addToIndex(post);

    // Update provider index
    if (!this.providerIndex.has(providerId)) {
      this.providerIndex.set(providerId, []);
    }
    this.providerIndex.get(providerId)!.push(post.id);

    this.logger.info('post:created', {
      id: post.id,
      zoneId,
      providerId,
      tags: validTags,
    });

    return post;
  }

  /**
   * Get the visual feed for a zone
   * Instagram-like scrollable feed of professional posts.
   */
  async getFeed(params: PostFeedParams): Promise<PostFeedResult> {
    const {
      zoneId,
      tags,
      page = 1,
      pageSize = 20,
      includeInactive = false,
    } = params;

    this.logger.info('post:feed', { zoneId, tags, page, pageSize });

    // Get all post IDs for this zone
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex) {
      if (tags && tags.length > 0) {
        return { posts: [], total: 0, page, pageSize, hasMore: false };
      }
      // No tags requested: unindexed (untagged) posts may still exist —
      // fall through to the direct store scan below.
    }

    // Collect matching post IDs
    let matchingIds: Set<string>;

    if (tags && tags.length > 0 && zoneIndex) {
      // Find posts that match ANY of the requested tags
      matchingIds = new Set();
      for (const tag of tags) {
        const ids = zoneIndex.get(tag) || [];
        for (const id of ids) {
          matchingIds.add(id);
        }
      }
    } else {
      // All posts in the zone — iterate the store directly so that
      // posts with no valid tags (never indexed) are not invisible.
      matchingIds = new Set();
      for (const post of this.posts.values()) {
        if (post.zoneId === zoneId) {
          matchingIds.add(post.id);
        }
      }
    }

    // Fetch posts
    let posts: ProfessionalPost[] = [];
    for (const id of matchingIds) {
      const post = this.posts.get(id);
      if (!post) continue;
      if (!includeInactive && !post.isActive) continue;
      posts.push(post);
    }

    // Sort by published date (newest first)
    posts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // Paginate
    const total = posts.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    posts = posts.slice(start, end);

    return {
      posts,
      total,
      page,
      pageSize,
      hasMore: end < total,
    };
  }

  /**
   * Get a single post by ID
   */
  async get(postId: string): Promise<ProfessionalPost | null> {
    const post = this.posts.get(postId);
    if (!post) return null;

    // Increment view count
    post.viewCount++;

    return post;
  }

  /**
   * Update a post
   */
  async update(
    postId: string,
    updates: Partial<Pick<ProfessionalPost, 'description' | 'tags' | 'media' | 'isSponsored'>>
  ): Promise<ProfessionalPost | null> {
    const post = this.posts.get(postId);
    if (!post) return null;

    // Update fields
    if (updates.description !== undefined) post.description = updates.description;
    if (updates.tags !== undefined) {
      // Remove from old index entries
      this.removeFromIndex(post);
      post.tags = updates.tags.filter((t) => t.includes('/'));
      // Add to new index entries
      this.addToIndex(post);
    }
    if (updates.media !== undefined) {
      // Validate video duration
      for (const m of updates.media) {
        if (m.type === 'video' && m.duration && m.duration > 15) {
          throw new Error('Video duration must be ≤ 15 seconds');
        }
      }
      post.media = updates.media;
    }
    if (updates.isSponsored !== undefined) post.isSponsored = updates.isSponsored;

    this.logger.info('post:updated', { id: postId });

    return post;
  }

  /**
   * Deactivate a post (soft delete)
   * Used when subscription expires.
   */
  async deactivate(postId: string): Promise<boolean> {
    const post = this.posts.get(postId);
    if (!post) return false;

    post.isActive = false;

    this.logger.info('post:deactivated', { id: postId, providerId: post.providerId });

    return true;
  }

  /**
   * Reactivate a post
   * Used when subscription is renewed.
   */
  async reactivate(postId: string): Promise<boolean> {
    const post = this.posts.get(postId);
    if (!post) return false;

    post.isActive = true;

    this.logger.info('post:reactivated', { id: postId });

    return true;
  }

  /**
   * Delete a post permanently
   */
  async delete(postId: string): Promise<boolean> {
    const post = this.posts.get(postId);
    if (!post) return false;

    // Remove from index
    this.removeFromIndex(post);

    // Remove from provider index
    const providerPosts = this.providerIndex.get(post.providerId);
    if (providerPosts) {
      const idx = providerPosts.indexOf(postId);
      if (idx >= 0) providerPosts.splice(idx, 1);
    }

    // Remove post
    this.posts.delete(postId);

    this.logger.info('post:deleted', { id: postId });

    return true;
  }

  /**
   * Get the count of active professional posts for a zone+tags
   * Used by the voice channel to ANNOUNCE professional posts.
   *
   * ⚠️ The assistant only announces the count.
   * It NEVER describes the posts.
   */
  async getPostCount(zoneId: string, tags?: string[]): Promise<number> {
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex && tags && tags.length > 0) return 0;

    let matchingIds: Set<string>;

    if (tags && tags.length > 0 && zoneIndex) {
      matchingIds = new Set();
      for (const tag of tags) {
        const ids = zoneIndex.get(tag) || [];
        for (const id of ids) {
          matchingIds.add(id);
        }
      }
    } else {
      // No tag filter: scan the store directly so untagged posts count too.
      matchingIds = new Set();
      for (const post of this.posts.values()) {
        if (post.zoneId === zoneId) {
          matchingIds.add(post.id);
        }
      }
    }

    // Count only active posts
    let count = 0;
    for (const id of matchingIds) {
      const post = this.posts.get(id);
      if (post && post.isActive) count++;
    }

    return count;
  }

  /**
   * Get posts by a specific provider
   */
  async getByProvider(providerId: string, includeInactive: boolean = false): Promise<ProfessionalPost[]> {
    const postIds = this.providerIndex.get(providerId) || [];
    const posts: ProfessionalPost[] = [];

    for (const id of postIds) {
      const post = this.posts.get(id);
      if (!post) continue;
      if (!includeInactive && !post.isActive) continue;
      posts.push(post);
    }

    return posts;
  }

  /**
   * Like a post
   */
  async like(postId: string): Promise<boolean> {
    const post = this.posts.get(postId);
    if (!post) return false;

    post.likeCount++;

    return true;
  }

  // ─── Index Management ───

  private addToIndex(post: ProfessionalPost): void {
    if (!this.index.has(post.zoneId)) {
      this.index.set(post.zoneId, new Map());
    }
    const zoneIndex = this.index.get(post.zoneId)!;

    for (const tag of post.tags) {
      if (!zoneIndex.has(tag)) {
        zoneIndex.set(tag, []);
      }
      zoneIndex.get(tag)!.push(post.id);
    }
  }

  private removeFromIndex(post: ProfessionalPost): void {
    const zoneIndex = this.index.get(post.zoneId);
    if (!zoneIndex) return;

    for (const tag of post.tags) {
      const ids = zoneIndex.get(tag);
      if (ids) {
        const idx = ids.indexOf(post.id);
        if (idx >= 0) ids.splice(idx, 1);
      }
    }
  }
}
