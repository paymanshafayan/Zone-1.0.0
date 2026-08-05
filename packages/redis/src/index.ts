/**
 * Zone Redis — Cache, Reverberation, and Presence
 *
 * This module manages:
 * - Reverberation: time-limited messages in hearing spaces
 * - Presence: active user tracking
 * - Cache: general-purpose caching
 *
 * ⚠️ No persistence (RDB/AOF disabled). Server restart = data loss.
 * This is by design: reverberation is like real sound — it fades.
 */

import Redis from 'ioredis';

// ─── Reverberation ───

export enum ReverberationDuration {
  URGENT = 15 * 60,   // 15 minutes in seconds
  SERVICE = 2 * 60 * 60, // 2 hours in seconds
  SOCIAL = 6 * 60 * 60,  // 6 hours in seconds
}

export interface ReverberationEntry {
  id: string;
  spaceId: string;
  personId: string;
  text: string;
  tags: string[];
  createdAt: number;
}

// ─── Presence ───

export interface PresenceEntry {
  personId: string;
  zoneId: string;
  spaces: string[];
  lastSeen: number;
}

// ─── ZoneRedis Class ───

export class ZoneRedis {
  private client: Redis;
  private subscriber: Redis;

  constructor(url: string = 'redis://localhost:6379') {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.subscriber = new Redis(url, {
      maxRetriesPerRequest: 3,
    });
  }

  // ─── Reverberation Methods ───

  /**
   * Add a reverberation to a hearing space
   * The entry automatically expires after the TTL
   */
  async addReverberation(
    entry: ReverberationEntry,
    ttl: ReverberationDuration
  ): Promise<void> {
    const key = `reverb:${entry.spaceId}:${entry.id}`;
    const data = JSON.stringify(entry);

    await this.client.setex(key, ttl, data);

    // Also add to the space's reverberation index
    await this.client.sadd(`reverb:index:${entry.spaceId}`, entry.id);
    await this.client.expire(`reverb:index:${entry.spaceId}`, ttl);
  }

  /**
   * Get all active reverberations for a space
   */
  async getReverberations(spaceId: string): Promise<ReverberationEntry[]> {
    const indexKey = `reverb:index:${spaceId}`;
    const ids = await this.client.smembers(indexKey);

    const entries: ReverberationEntry[] = [];
    for (const id of ids) {
      const data = await this.client.get(`reverb:${spaceId}:${id}`);
      if (data) {
        entries.push(JSON.parse(data));
      } else {
        // Entry expired, remove from index
        await this.client.srem(indexKey, id);
      }
    }

    // Sort by creation time
    entries.sort((a, b) => a.createdAt - b.createdAt);
    return entries;
  }

  // ─── Presence Methods ───

  /**
   * Mark a user as present in a zone
   * Presence expires after 5 minutes of inactivity
   */
  async setPresence(personId: string, zoneId: string, spaces: string[] = []): Promise<void> {
    const key = `presence:${personId}`;
    const data: PresenceEntry = {
      personId,
      zoneId,
      spaces,
      lastSeen: Date.now(),
    };

    await this.client.setex(key, 300, JSON.stringify(data)); // 5 minutes TTL
  }

  /**
   * Get presence info for a user
   */
  async getPresence(personId: string): Promise<PresenceEntry | null> {
    const data = await this.client.get(`presence:${personId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get all present users in a zone
   */
  async getZonePresence(zoneId: string): Promise<PresenceEntry[]> {
    const pattern = 'presence:*';
    const keys = await this.client.keys(pattern);

    const entries: PresenceEntry[] = [];
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        const entry: PresenceEntry = JSON.parse(data);
        if (entry.zoneId === zoneId) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  /**
   * Get all present users in a hearing space
   */
  async getSpacePresence(spaceId: string): Promise<PresenceEntry[]> {
    const pattern = 'presence:*';
    const keys = await this.client.keys(pattern);

    const entries: PresenceEntry[] = [];
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        const entry: PresenceEntry = JSON.parse(data);
        if (entry.spaces.includes(spaceId)) {
          entries.push(entry);
        }
      }
    }

    return entries;
  }

  /**
   * Remove a user's presence
   */
  async removePresence(personId: string): Promise<void> {
    await this.client.del(`presence:${personId}`);
  }

  // ─── General Cache ───

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // ─── Key Pattern Matching ───

  /**
   * Get keys matching a pattern
   * ⚠️ Use sparingly in production — KEYS is O(N)
   */
  async getKeys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Remove a key from a Redis set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * Set expiry on a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.expire(key, ttlSeconds);
    return result === 1;
  }

  // ─── Pub/Sub ───

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        handler(msg);
      }
    });
    await this.subscriber.subscribe(channel);
  }

  // ─── Lifecycle ───

  async disconnect(): Promise<void> {
    await this.client.quit();
    await this.subscriber.quit();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
