/**
 * Zone Memory Service — Neighbourhood Knowledge
 *
 * Searches and manages the accumulated knowledge about people and
 * services in a neighbourhood. This is the "KNOW" part of the
 * three-mode system.
 *
 * Memory model:
 * - What was done, for whom, what was the outcome
 * - Who said it (source)
 * - When it was said
 * - Confidence (how many sources agree)
 * - Credibility (with temporal decay)
 */

import { Logger } from '@zone/core';
import type { MemorySearchResult } from './tools';
export type { MemorySearchResult } from './tools';

// ─── Types ───

export interface MemoryRecord {
  id: string;
  zoneId: string;
  personId: string;
  personName: string;
  skill: string;
  description: string;
  outcome: 'positive' | 'negative' | 'neutral';
  sourcePersonId: string;
  sourcePersonName: string;
  confidence: number;
  credibility: number;
  createdAt: Date;
}

export interface MemorySearchParams {
  /** Skill/service to search for */
  skill: string;
  /** Zone ID to search within */
  zoneId: string;
  /** Geographic radius in meters */
  radius?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Maximum number of results */
  maxResults?: number;
}

export interface RecordMemoryParams {
  /** Zone ID */
  zoneId: string;
  /** Person the memory is about */
  personId: string;
  /** Person the memory is about (display name) */
  personName: string;
  /** Skill/service */
  skill: string;
  /** What was done */
  description: string;
  /** Outcome */
  outcome: 'positive' | 'negative' | 'neutral';
  /** Person who said it */
  sourcePersonId: string;
  /** Person who said it (display name) */
  sourcePersonName: string;
}

// ─── Temporal Decay ───

/**
 * Credibility = base × e^(-λ × age)
 *
 * λ = 0.001 (half-life ≈ 693 days ≈ 2 years)
 * This means:
 * - 6 months: 0.84 × base
 * - 1 year: 0.69 × base
 * - 2 years: 0.50 × base
 * - 5 years: 0.14 × base
 */
const DECAY_LAMBDA = 0.001;

function calculateCredibility(baseConfidence: number, ageInDays: number): number {
  return baseConfidence * Math.exp(-DECAY_LAMBDA * ageInDays);
}

// ─── Memory Service ───

export class MemoryService {
  private logger: Logger;
  /** In-memory store for development (production: PostgreSQL) */
  private memories: Map<string, MemoryRecord> = new Map();
  /** Index: zoneId → skill → memoryIds */
  private index: Map<string, Map<string, string[]>> = new Map();

  constructor() {
    this.logger = new Logger({ context: { service: 'memory-service' } });
  }

  /**
   * Search for memories matching the given criteria
   */
  async search(params: MemorySearchParams): Promise<MemorySearchResult[]> {
    const { skill, zoneId, minConfidence = 0.3, maxResults = 5 } = params;

    this.logger.info('memory:search', { skill, zoneId, minConfidence });

    // Get memory IDs for this zone+skill
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex) return [];

    const memoryIds = zoneIndex.get(skill) || [];
    if (memoryIds.length === 0) return [];

    // Fetch and filter memories
    const results: MemorySearchResult[] = [];

    for (const id of memoryIds) {
      const record = this.memories.get(id);
      if (!record) continue;

      // Apply temporal decay
      const ageInDays = (Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const credibility = calculateCredibility(record.confidence, ageInDays);

      if (credibility + 1e-9 < minConfidence) continue;

      // Count sources for this person+skill
      const sourceCount = this.countSources(record.personId, skill, zoneId);

      results.push({
        personId: record.personId,
        personName: record.personName,
        skill: record.skill,
        description: record.description,
        outcome: record.outcome,
        sourceCount,
        confidence: record.confidence,
        credibility,
        lastMentioned: record.createdAt,
        isProfessional: false, // TODO: Check professional status
      });
    }

    // Sort by credibility (highest first)
    results.sort((a, b) => b.credibility - a.credibility);

    // Limit results
    return results.slice(0, maxResults);
  }

  /**
   * Record a new memory
   * This is called when:
   * - A user shares a recommendation (KNOW mode)
   * - A user reports back after finding someone (UNKNOWN → learning)
   */
  async record(params: RecordMemoryParams): Promise<MemoryRecord> {
    const { zoneId, personId, personName, skill, description, outcome, sourcePersonId, sourcePersonName } = params;

    this.logger.info('memory:record', { zoneId, personId, skill, outcome });

    // Check if a similar memory already exists
    const existing = this.findExisting(personId, skill, zoneId, sourcePersonId);

    if (existing) {
      // Update confidence — multiple sources increase confidence
      existing.confidence = Math.min(existing.confidence + 0.15, 1.0);
      existing.description = description; // Update with latest
      existing.createdAt = new Date(); // Update timestamp

      this.logger.info('memory:updated', {
        id: existing.id,
        confidence: existing.confidence,
      });

      return existing;
    }

    // Create new memory
    const record: MemoryRecord = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      zoneId,
      personId,
      personName,
      skill,
      description,
      outcome,
      sourcePersonId,
      sourcePersonName,
      confidence: 0.5, // Initial confidence
      credibility: 0.5,
      createdAt: new Date(),
    };

    // Store
    this.memories.set(record.id, record);

    // Update index
    if (!this.index.has(zoneId)) {
      this.index.set(zoneId, new Map());
    }
    const zoneIndex = this.index.get(zoneId)!;
    if (!zoneIndex.has(skill)) {
      zoneIndex.set(skill, []);
    }
    zoneIndex.get(skill)!.push(record.id);

    this.logger.info('memory:created', {
      id: record.id,
      zoneId,
      personId,
      skill,
    });

    return record;
  }

  /**
   * Get memory statistics for a zone
   */
  getStats(zoneId: string): {
    totalMemories: number;
    skills: string[];
    averageConfidence: number;
  } {
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex) {
      return { totalMemories: 0, skills: [], averageConfidence: 0 };
    }

    const skills = Array.from(zoneIndex.keys());
    let totalMemories = 0;
    let totalConfidence = 0;

    for (const [, memoryIds] of zoneIndex) {
      totalMemories += memoryIds.length;
      for (const id of memoryIds) {
        const record = this.memories.get(id);
        if (record) {
          totalConfidence += record.confidence;
        }
      }
    }

    return {
      totalMemories,
      skills,
      averageConfidence: totalMemories > 0 ? totalConfidence / totalMemories : 0,
    };
  }

  /**
   * Get a specific memory by ID
   */
  get(id: string): MemoryRecord | undefined {
    return this.memories.get(id);
  }

  /**
   * List all memories for a zone
   */
  listByZone(zoneId: string): MemoryRecord[] {
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex) return [];

    const records: MemoryRecord[] = [];
    for (const [, memoryIds] of zoneIndex) {
      for (const id of memoryIds) {
        const record = this.memories.get(id);
        if (record) records.push(record);
      }
    }

    return records;
  }

  /**
   * List all zone IDs that have memories
   */
  listZones(): string[] {
    return Array.from(this.index.keys());
  }

  // ─── Private Helpers ───

  private findExisting(
    personId: string,
    skill: string,
    zoneId: string,
    sourcePersonId: string
  ): MemoryRecord | undefined {
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex) return undefined;

    const memoryIds = zoneIndex.get(skill) || [];
    for (const id of memoryIds) {
      const record = this.memories.get(id);
      if (record && record.personId === personId && record.sourcePersonId === sourcePersonId) {
        return record;
      }
    }

    return undefined;
  }

  private countSources(personId: string, skill: string, zoneId: string): number {
    const zoneIndex = this.index.get(zoneId);
    if (!zoneIndex) return 0;

    const memoryIds = zoneIndex.get(skill) || [];
    let count = 0;
    for (const id of memoryIds) {
      const record = this.memories.get(id);
      if (record && record.personId === personId) {
        count++;
      }
    }

    return count;
  }
}
