/**
 * Zone Person Registry — In-Memory Person Store
 *
 * For development and testing. In production, this queries
 * PostgreSQL with PostGIS for geographic proximity.
 *
 * Tracks:
 * - Self-declared skills
 * - Approximate location (for radius filtering)
 * - Silence count (3 silences → down-weighted)
 * - Tag opt-out preferences
 * - Response rate
 */

import { Logger } from '@zone/core';

// ─── Types ───

export interface PersonRecord {
  id: string;
  displayName: string;
  zoneId: string;
  skills: string[];
  /** Approximate latitude */
  latitude: number;
  /** Approximate longitude */
  longitude: number;
  /** Response rate (0-1) */
  responseRate: number;
  /** Number of consecutive silences (no response to waves) */
  silenceCount: number;
  /** Tags the user has opted out of */
  optedOutTags: string[];
  /** Whether the user is currently active (app open) */
  isActive: boolean;
  /** Is professional provider */
  isProfessional: boolean;
  /** Last activity timestamp */
  lastActiveAt: Date;
}

export interface PersonSearchParams {
  /** Zone ID to search within */
  zoneId: string;
  /** Skills to match (OR logic) */
  skills?: string[];
  /** Center point for radius search */
  centerLatitude?: number;
  /** Center point for radius search */
  centerLongitude?: number;
  /** Radius in meters */
  radius?: number;
  /** Exclude person IDs */
  excludeIds?: string[];
  /** Maximum results */
  maxResults?: number;
  /** Include only active users */
  activeOnly?: boolean;
  /** Include down-weighted users (3+ silences) */
  includeDownWeighted?: boolean;
}

// ─── Adjacent Skills Map ───

/**
 * Maps a skill to its adjacent skills for Wave 2.
 * These are skills that are related but not identical.
 */
const ADJACENT_SKILLS: Record<string, string[]> = {
  house_painting: ['tiling', 'carpentry', 'repair'],
  plumbing: ['repair', 'appliance_repair'],
  electrical: ['repair', 'air_conditioning', 'appliance_repair'],
  cleaning: ['appliance_repair'],
  repair: ['electrical', 'plumbing', 'carpentry', 'locksmith'],
  moving: ['carpentry'],
  carpentry: ['house_painting', 'repair', 'tiling'],
  tiling: ['house_painting', 'carpentry'],
  air_conditioning: ['electrical', 'repair'],
  locksmith: ['repair', 'carpentry'],
  landscaping: ['carpentry'],
  appliance_repair: ['electrical', 'plumbing', 'repair'],
  // Social
  sports: ['walking', 'gaming'],
  walking: ['sports', 'trip'],
  gaming: ['sports', 'study'],
  food: ['party', 'trip'],
  party: ['food', 'trip'],
  trip: ['walking', 'food', 'party'],
  study: ['gaming', 'volunteer'],
  volunteer: ['study', 'support'],
  // Support
  advice: ['brainstorm', 'help'],
  brainstorm: ['advice', 'help'],
  help: ['advice', 'brainstorm', 'volunteer'],
};

// ─── Person Registry ───

export class PersonRegistry {
  private logger: Logger;
  private persons: Map<string, PersonRecord> = new Map();
  /** Index: zoneId → personIds */
  private zoneIndex: Map<string, string[]> = new Map();
  /** Index: skill → personIds */
  private skillIndex: Map<string, string[]> = new Map();

  constructor() {
    this.logger = new Logger({ context: { service: 'person-registry' } });
  }

  /**
   * Register or update a person
   */
  register(person: Omit<PersonRecord, 'silenceCount' | 'optedOutTags' | 'isActive' | 'lastActiveAt'>): PersonRecord {
    const existing = this.persons.get(person.id);

    const record: PersonRecord = {
      ...person,
      silenceCount: existing?.silenceCount || 0,
      optedOutTags: existing?.optedOutTags || [],
      isActive: existing?.isActive ?? true,
      lastActiveAt: new Date(),
    };

    this.persons.set(person.id, record);

    // Update zone index
    if (!this.zoneIndex.has(person.zoneId)) {
      this.zoneIndex.set(person.zoneId, []);
    }
    const zoneList = this.zoneIndex.get(person.zoneId)!;
    if (!zoneList.includes(person.id)) {
      zoneList.push(person.id);
    }

    // Update skill index
    for (const skill of person.skills) {
      if (!this.skillIndex.has(skill)) {
        this.skillIndex.set(skill, []);
      }
      const skillList = this.skillIndex.get(skill)!;
      if (!skillList.includes(person.id)) {
        skillList.push(person.id);
      }
    }

    this.logger.debug('person:registered', { personId: person.id, zoneId: person.zoneId });

    return record;
  }

  /**
   * Search for persons matching the given criteria
   */
  search(params: PersonSearchParams): PersonRecord[] {
    const {
      zoneId,
      skills,
      centerLatitude,
      centerLongitude,
      radius,
      excludeIds = [],
      maxResults = 50,
      activeOnly = true,
      includeDownWeighted = false,
    } = params;

    // Start with zone-filtered persons
    const zonePersonIds = this.zoneIndex.get(zoneId) || [];
    let candidates: PersonRecord[] = [];

    for (const id of zonePersonIds) {
      const person = this.persons.get(id);
      if (!person) continue;

      // Exclude specific IDs
      if (excludeIds.includes(person.id)) continue;

      // Filter by active status
      if (activeOnly && !person.isActive) continue;

      // Filter by down-weighted
      if (!includeDownWeighted && person.silenceCount >= 3) continue;

      candidates.push(person);
    }

    // Filter by skills if provided
    if (skills && skills.length > 0) {
      candidates = candidates.filter((person) =>
        person.skills.some((skill) => skills.includes(skill))
      );
    }

    // Filter by geographic radius if provided
    if (centerLatitude !== undefined && centerLongitude !== undefined && radius) {
      candidates = candidates.filter((person) => {
        const distance = this.haversineDistance(
          centerLatitude,
          centerLongitude,
          person.latitude,
          person.longitude
        );
        return distance <= radius;
      });

      // Sort by proximity (closest first)
      candidates.sort((a, b) => {
        const distA = this.haversineDistance(centerLatitude, centerLongitude, a.latitude, a.longitude);
        const distB = this.haversineDistance(centerLatitude, centerLongitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }

    // Sort by response rate (higher first) and then by recent activity
    if (!centerLatitude) {
      candidates.sort((a, b) => {
        // Active users first
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;

        // Higher response rate first
        if (a.responseRate !== b.responseRate) return b.responseRate - a.responseRate;

        // Less silence first
        if (a.silenceCount !== b.silenceCount) return a.silenceCount - b.silenceCount;

        // More recent activity first
        return b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
      });
    }

    // Limit results
    return candidates.slice(0, maxResults);
  }

  /**
   * Get a person by ID
   */
  get(personId: string): PersonRecord | undefined {
    return this.persons.get(personId);
  }

  /**
   * Increment silence count for a person
   */
  incrementSilence(personId: string): void {
    const person = this.persons.get(personId);
    if (person) {
      person.silenceCount++;
      this.logger.debug('person:silence_incremented', {
        personId,
        silenceCount: person.silenceCount,
      });
    }
  }

  /**
   * Reset silence count (when person responds)
   */
  resetSilence(personId: string): void {
    const person = this.persons.get(personId);
    if (person) {
      person.silenceCount = 0;
    }
  }

  /**
   * Add a tag to the user's opt-out list
   */
  optOut(personId: string, tag: string): boolean {
    const person = this.persons.get(personId);
    if (!person) return false;

    if (!person.optedOutTags.includes(tag)) {
      person.optedOutTags.push(tag);
      this.logger.info('person:opted_out', { personId, tag });
    }

    return true;
  }

  /**
   * Remove a tag from the user's opt-out list
   */
  optIn(personId: string, tag: string): boolean {
    const person = this.persons.get(personId);
    if (!person) return false;

    const idx = person.optedOutTags.indexOf(tag);
    if (idx >= 0) {
      person.optedOutTags.splice(idx, 1);
      this.logger.info('person:opted_in', { personId, tag });
    }

    return true;
  }

  /**
   * Check if a person has opted out of a tag
   */
  hasOptedOut(personId: string, tag: string): boolean {
    const person = this.persons.get(personId);
    if (!person) return false;
    return person.optedOutTags.includes(tag) || person.optedOutTags.includes('*');
  }

  /**
   * Set active status
   */
  setActive(personId: string, isActive: boolean): void {
    const person = this.persons.get(personId);
    if (person) {
      person.isActive = isActive;
      person.lastActiveAt = new Date();
    }
  }

  /**
   * Get all persons in a zone
   */
  getByZone(zoneId: string): PersonRecord[] {
    const ids = this.zoneIndex.get(zoneId) || [];
    return ids.map((id) => this.persons.get(id)!).filter(Boolean);
  }

  /**
   * Get adjacent skills for a given skill
   */
  getAdjacentSkills(skill: string): string[] {
    return ADJACENT_SKILLS[skill] || [];
  }

  /**
   * Get all registered person IDs
   */
  getAllIds(): string[] {
    return Array.from(this.persons.keys());
  }

  /**
   * Get stats about the registry
   */
  getStats(): { totalPersons: number; zones: number; skills: number } {
    return {
      totalPersons: this.persons.size,
      zones: this.zoneIndex.size,
      skills: this.skillIndex.size,
    };
  }

  // ─── Haversine Distance ───

  /**
   * Calculate the distance between two points on Earth
   * using the Haversine formula. Returns meters.
   */
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
