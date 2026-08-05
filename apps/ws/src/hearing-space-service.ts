/**
 * Zone Hearing Space Service
 *
 * Manages the lifecycle of hearing spaces:
 * - Dynamic spaces (request waves): created on-demand, expire after TTL
 * - Persistent spaces (user-created): last until explicitly removed
 *
 * All spaces share the same model: "Who is listening here right now?"
 */

import { EventBus, Logger, SpaceType } from '@zone/core';
import type { HearingSpace, SpaceMember } from '@zone/core';
import {
  ZoneRedis,
  ReverberationDuration,
} from '@zone/redis';
import type { ReverberationEntry } from '@zone/redis';

// ─── Types ───

export interface CreateDynamicSpaceInput {
  zoneId: string;
  tags: string[];
  radius: number;
  reverberationTtl?: ReverberationDuration;
  requestedBy: string;
}

export interface CreatePersistentSpaceInput {
  zoneId: string;
  name: string;
  tags: string[];
  description?: string;
  createdBy: string;
}

export interface SpaceMessage {
  id: string;
  spaceId: string;
  personId: string;
  text: string;
  tags: string[];
  type: 'speech' | 'system';
  createdAt: number;
}

export interface SpaceInfo {
  id: string;
  zoneId: string;
  type: SpaceType;
  name?: string;
  tags: string[];
  radius?: number;
  reverberationTtl: number;
  memberCount: number;
  createdAt: Date;
  expiresAt?: Date;
}

// ─── Space Service ───

export class HearingSpaceService {
  private eventBus: EventBus;
  private redis: ZoneRedis;
  private logger: Logger;

  // In-memory space registry (for fast lookup)
  private spaces: Map<string, SpaceInfo> = new Map();

  constructor(eventBus: EventBus, redis: ZoneRedis) {
    this.eventBus = eventBus;
    this.redis = redis;
    this.logger = new Logger({ context: { service: 'hearing-space' } });
  }

  // ─── Dynamic Space (Request Wave) ───

  async createDynamicSpace(input: CreateDynamicSpaceInput): Promise<SpaceInfo> {
    const id = this.generateId('dyn');
    const ttl = input.reverberationTtl || ReverberationDuration.SERVICE;
    const ttlMs = ttl * 1000;

    const space: SpaceInfo = {
      id,
      zoneId: input.zoneId,
      type: SpaceType.DYNAMIC,
      tags: input.tags,
      radius: input.radius,
      reverberationTtl: ttlMs,
      memberCount: 0,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttlMs),
    };

    this.spaces.set(id, space);

    await this.redis.set(`space:${id}`, JSON.stringify(space), ttl);

    this.logger.info('space:created:dynamic', {
      spaceId: id,
      zoneId: input.zoneId,
      tags: input.tags,
      radius: input.radius,
      ttl,
    });

    await this.eventBus.emit('space.created', {
      spaceId: id,
      zoneId: input.zoneId,
      type: 'dynamic',
      tags: input.tags,
    });

    return space;
  }

  // ─── Persistent Space (User-Created) ───

  async createPersistentSpace(input: CreatePersistentSpaceInput): Promise<SpaceInfo> {
    const id = this.generateId('per');

    const space: SpaceInfo = {
      id,
      zoneId: input.zoneId,
      type: SpaceType.PERSISTENT,
      name: input.name,
      tags: input.tags,
      reverberationTtl: ReverberationDuration.SOCIAL * 1000,
      memberCount: 0,
      createdAt: new Date(),
    };

    this.spaces.set(id, space);

    await this.redis.set(`space:${id}`, JSON.stringify(space), 7 * 24 * 60 * 60);

    this.logger.info('space:created:persistent', {
      spaceId: id,
      zoneId: input.zoneId,
      name: input.name,
      tags: input.tags,
    });

    await this.eventBus.emit('space.created', {
      spaceId: id,
      zoneId: input.zoneId,
      type: 'persistent',
      name: input.name,
      tags: input.tags,
    });

    return space;
  }

  // ─── Join / Leave ───

  async joinSpace(spaceId: string, personId: string): Promise<{
    space: SpaceInfo;
    reverberations: SpaceMessage[];
    members: SpaceMember[];
  }> {
    const space = this.spaces.get(spaceId);
    if (!space) {
      throw new Error(`Space "${spaceId}" not found`);
    }

    const member: SpaceMember = {
      id: this.generateId('mem'),
      spaceId,
      personId,
      joinedAt: new Date(),
      isActive: true,
    };

    await this.redis.set(
      `member:${spaceId}:${personId}`,
      JSON.stringify(member),
      Math.floor(space.reverberationTtl / 1000)
    );

    space.memberCount++;

    const presence = await this.redis.getPresence(personId);
    const currentSpaces = presence?.spaces || [];
    if (!currentSpaces.includes(spaceId)) {
      currentSpaces.push(spaceId);
    }
    await this.redis.setPresence(personId, space.zoneId, currentSpaces);

    const reverbEntries = await this.redis.getReverberations(spaceId);
    const reverberations: SpaceMessage[] = reverbEntries.map((entry: ReverberationEntry) => ({
      id: entry.id,
      spaceId: entry.spaceId,
      personId: entry.personId,
      text: entry.text,
      tags: entry.tags,
      type: 'speech' as const,
      createdAt: entry.createdAt,
    }));

    const members = await this.getSpaceMembers(spaceId);

    this.logger.info('space:joined', {
      spaceId,
      personId,
      memberCount: space.memberCount,
      reverberationCount: reverberations.length,
    });

    await this.eventBus.emit('user.join', {
      personId,
      zoneId: space.zoneId,
      spaceId,
    });

    return { space, reverberations, members };
  }

  async leaveSpace(spaceId: string, personId: string): Promise<void> {
    const space = this.spaces.get(spaceId);
    if (!space) return;

    await this.redis.del(`member:${spaceId}:${personId}`);

    space.memberCount = Math.max(0, space.memberCount - 1);

    const presence = await this.redis.getPresence(personId);
    if (presence) {
      const updatedSpaces = presence.spaces.filter((s: string) => s !== spaceId);
      await this.redis.setPresence(personId, presence.zoneId, updatedSpaces);
    }

    this.logger.info('space:left', {
      spaceId,
      personId,
      memberCount: space.memberCount,
    });

    await this.eventBus.emit('user.leave', { personId, spaceId });

    if (space.type === SpaceType.DYNAMIC && space.memberCount === 0) {
      await this.removeSpace(spaceId);
    }
  }

  // ─── Speak ───

  async speak(
    spaceId: string,
    personId: string,
    text: string,
    tags: string[]
  ): Promise<SpaceMessage> {
    const space = this.spaces.get(spaceId);
    if (!space) {
      throw new Error(`Space "${spaceId}" not found`);
    }

    const message: SpaceMessage = {
      id: this.generateId('msg'),
      spaceId,
      personId,
      text,
      tags,
      type: 'speech',
      createdAt: Date.now(),
    };

    const ttl = this.determineTTL(tags);

    await this.redis.addReverberation(
      {
        id: message.id,
        spaceId,
        personId,
        text,
        tags,
        createdAt: message.createdAt,
      },
      ttl
    );

    this.logger.info('space:speak', {
      spaceId,
      personId,
      tags,
      ttl,
    });

    await this.eventBus.emit('user.speak', {
      personId,
      zoneId: space.zoneId,
      text,
      tags,
      intent: 'ask',
      numbers: [],
    });

    return message;
  }

  // ─── Query ───

  async getSpace(spaceId: string): Promise<SpaceInfo | null> {
    const cached = this.spaces.get(spaceId);
    if (cached) return cached;

    const data = await this.redis.get(`space:${spaceId}`);
    if (data) {
      const space = JSON.parse(data) as SpaceInfo;
      this.spaces.set(spaceId, space);
      return space;
    }

    return null;
  }

  async getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
    const keys = await this.redis.getKeys(`member:${spaceId}:*`);

    const members: SpaceMember[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        members.push(JSON.parse(data));
      }
    }

    return members.filter((m) => m.isActive);
  }

  async getSpacePresence(spaceId: string): Promise<string[]> {
    const members = await this.getSpaceMembers(spaceId);
    return members.map((m) => m.personId);
  }

  async findSpaces(zoneId: string, tags: string[]): Promise<SpaceInfo[]> {
    const results: SpaceInfo[] = [];

    for (const space of this.spaces.values()) {
      if (space.zoneId !== zoneId) continue;

      const hasMatch = tags.some((tag) => {
        const tagPrefix = tag.split('/')[0];
        return space.tags.some(
          (spaceTag) =>
            spaceTag === tag ||
            spaceTag.startsWith(tagPrefix + '/') ||
            spaceTag.startsWith(tag + '/')
        );
      });

      if (hasMatch) {
        results.push(space);
      }
    }

    return results;
  }

  async removeSpace(spaceId: string): Promise<void> {
    const space = this.spaces.get(spaceId);
    if (!space) return;

    const members = await this.getSpaceMembers(spaceId);
    for (const member of members) {
      await this.redis.del(`member:${spaceId}:${member.personId}`);
    }

    await this.redis.del(`space:${spaceId}`);
    this.spaces.delete(spaceId);

    this.logger.info('space:removed', { spaceId, type: space.type });

    await this.eventBus.emit('space.removed', {
      spaceId,
      zoneId: space.zoneId,
    });
  }

  // ─── Helpers ───

  private determineTTL(tags: string[]): ReverberationDuration {
    if (tags.includes('urgency/emergency')) return ReverberationDuration.URGENT;
    if (tags.some((t) => t.startsWith('services/'))) return ReverberationDuration.SERVICE;
    if (tags.some((t) => t.startsWith('social/'))) return ReverberationDuration.SOCIAL;
    return ReverberationDuration.SERVICE;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
