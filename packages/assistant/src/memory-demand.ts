/**
 * Zone Memory Demand Service — Learning Loop
 *
 * When Zone says "اگه خودت پیدا کردی، بهم بگو تا دفعه بعد بدونم",
 * a memory demand is created. This tracks:
 * - What skill was requested
 * - Who asked
 * - When
 * - Whether it was fulfilled
 *
 * When a user comes back with info, the demand is fulfilled and
 * a memory is recorded. This is the core learning mechanism.
 *
 * Principle 4: Knowledge grows, it is not planted.
 * Day 1: Zone knows almost nothing. This is by design.
 */

import { Logger } from '@zone/core';

// ─── Types ───

export type DemandStatus = 'open' | 'fulfilled' | 'expired' | 'cancelled';

export interface MemoryDemand {
  id: string;
  /** Zone/neighbourhood ID */
  zoneId: string;
  /** Skill/service that was requested */
  skill: string;
  /** Person who asked */
  requesterId: string;
  /** Tags from the original edge processing */
  tags: string[];
  /** Reason for not knowing */
  reason: string;
  /** Current status */
  status: DemandStatus;
  /** When the demand was created */
  createdAt: Date;
  /** When the demand was fulfilled */
  fulfilledAt?: Date;
  /** ID of the memory that fulfilled this demand */
  fulfilledByMemoryId?: string;
  /** Person who reported back (if different from requester) */
  reportedBy?: string;
  /** Maximum time to keep this demand open (ms) */
  ttl: number;
}

export interface CreateDemandParams {
  zoneId: string;
  skill: string;
  requesterId: string;
  tags: string[];
  reason: string;
  /** Custom TTL in ms (default: 7 days) */
  ttl?: number;
}

export interface FulfillDemandParams {
  /** The demand ID to fulfill */
  demandId: string;
  /** Person the memory is about */
  personId: string;
  /** Person the memory is about (display name) */
  personName: string;
  /** What was done */
  description: string;
  /** Outcome of the interaction */
  outcome: 'positive' | 'negative' | 'neutral';
  /** Person who reported back (if different from requester) */
  reportedBy?: string;
}

export interface DemandSearchParams {
  /** Zone ID */
  zoneId?: string;
  /** Skill */
  skill?: string;
  /** Requester ID */
  requesterId?: string;
  /** Status filter */
  status?: DemandStatus;
}

// ─── Constants ───

/** Default demand TTL: 7 days */
const DEFAULT_DEMAND_TTL = 7 * 24 * 60 * 60 * 1000;

/** Maximum open demands per user */
const MAX_OPEN_DEMANDS_PER_USER = 10;

// ─── Memory Demand Service ───

export class MemoryDemandService {
  private logger: Logger;
  /** In-memory store for development (production: PostgreSQL) */
  private demands: Map<string, MemoryDemand> = new Map();
  /** Index: requesterId → demandIds */
  private requesterIndex: Map<string, string[]> = new Map();
  /** Index: zoneId+skill → demandIds */
  private skillIndex: Map<string, string[]> = new Map();

  constructor() {
    this.logger = new Logger({ context: { service: 'memory-demand' } });
  }

  /**
   * Create a new memory demand
   * Called when admit_unknown is invoked — the system asks
   * the user to report back if they find someone.
   */
  create(params: CreateDemandParams): MemoryDemand {
    const { zoneId, skill, requesterId, tags, reason, ttl } = params;

    // Check user's open demand limit
    const openDemands = this.getOpenDemandsForUser(requesterId);
    if (openDemands.length >= MAX_OPEN_DEMANDS_PER_USER) {
      this.logger.warn('demand:limit_reached', { requesterId, count: openDemands.length });
      // Expire the oldest demand to make room
      const oldest = openDemands.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      this.expire(oldest.id);
    }

    const demand: MemoryDemand = {
      id: `demand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      zoneId,
      skill,
      requesterId,
      tags,
      reason,
      status: 'open',
      createdAt: new Date(),
      ttl: ttl || DEFAULT_DEMAND_TTL,
    };

    this.demands.set(demand.id, demand);

    // Update indices
    this.addToRequesterIndex(requesterId, demand.id);
    this.addToSkillIndex(zoneId, skill, demand.id);

    this.logger.info('demand:created', {
      id: demand.id,
      skill,
      zoneId,
      requesterId,
    });

    return demand;
  }

  /**
   * Fulfill a demand — user reported back with info
   * This is the core learning moment.
   */
  fulfill(params: FulfillDemandParams): MemoryDemand | null {
    const { demandId, personId, personName, description, outcome, reportedBy } = params;

    const demand = this.demands.get(demandId);
    if (!demand) {
      this.logger.warn('demand:not_found', { demandId });
      return null;
    }

    if (demand.status !== 'open') {
      this.logger.warn('demand:not_open', { demandId, status: demand.status });
      return null;
    }

    // Check if demand has expired
    const age = Date.now() - demand.createdAt.getTime();
    if (age > demand.ttl) {
      demand.status = 'expired';
      this.logger.info('demand:expired_on_fulfill', { demandId });
      return null;
    }

    // Fulfill the demand
    demand.status = 'fulfilled';
    demand.fulfilledAt = new Date();
    demand.reportedBy = reportedBy || demand.requesterId;

    this.logger.info('demand:fulfilled', {
      id: demand.id,
      skill: demand.skill,
      personId,
      outcome,
      timeToLearn: Date.now() - demand.createdAt.getTime(),
    });

    return demand;
  }

  /**
   * Find open demands that match a skill+zone
   * Used when checking if a user's report-back matches a demand
   */
  findOpenDemands(skill: string, zoneId: string): MemoryDemand[] {
    const key = `${zoneId}:${skill}`;
    const demandIds = this.skillIndex.get(key) || [];

    const results: MemoryDemand[] = [];
    const now = Date.now();
    for (const id of demandIds) {
      const demand = this.demands.get(id);
      if (demand && demand.status === 'open') {
        // Check if expired — but don't mutate during a read operation.
        // Expired demands are cleaned up lazily by getStats() or explicitly.
        const age = now - demand.createdAt.getTime();
        if (age > demand.ttl) continue;
        results.push(demand);
      }
    }

    // Sort by most recent first
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results;
  }

  /**
   * Find open demands for a specific requester
   * Used to show the user their pending learning requests
   */
  findDemandsForUser(requesterId: string): MemoryDemand[] {
    const demandIds = this.requesterIndex.get(requesterId) || [];
    const results: MemoryDemand[] = [];

    for (const id of demandIds) {
      const demand = this.demands.get(id);
      if (demand) {
        // Check if expired
        if (demand.status === 'open') {
          const age = Date.now() - demand.createdAt.getTime();
          if (age > demand.ttl) {
            demand.status = 'expired';
            continue;
          }
        }
        results.push(demand);
      }
    }

    return results;
  }

  /**
   * Search demands with flexible filters
   */
  search(params: DemandSearchParams): MemoryDemand[] {
    let results = Array.from(this.demands.values());

    if (params.zoneId) {
      results = results.filter((d) => d.zoneId === params.zoneId);
    }
    if (params.skill) {
      results = results.filter((d) => d.skill === params.skill);
    }
    if (params.requesterId) {
      results = results.filter((d) => d.requesterId === params.requesterId);
    }
    if (params.status) {
      results = results.filter((d) => d.status === params.status);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a specific demand by ID
   */
  get(demandId: string): MemoryDemand | undefined {
    return this.demands.get(demandId);
  }

  /**
   * Cancel a demand
   */
  cancel(demandId: string): boolean {
    const demand = this.demands.get(demandId);
    if (!demand || demand.status !== 'open') return false;

    demand.status = 'cancelled';
    this.logger.info('demand:cancelled', { demandId });
    return true;
  }

  /**
   * Expire a demand
   */
  expire(demandId: string): boolean {
    const demand = this.demands.get(demandId);
    if (!demand) return false;

    demand.status = 'expired';
    this.logger.info('demand:expired', { demandId });
    return true;
  }

  /**
   * Get demand statistics
   */
  getStats(): {
    total: number;
    open: number;
    fulfilled: number;
    expired: number;
    cancelled: number;
    averageTimeToLearn: number;
  } {
    let open = 0;
    let fulfilled = 0;
    let expired = 0;
    let cancelled = 0;
    let totalLearnTime = 0;
    let learnCount = 0;

    for (const demand of this.demands.values()) {
      switch (demand.status) {
        case 'open':
          // Check if actually expired
          const age = Date.now() - demand.createdAt.getTime();
          if (age > demand.ttl) {
            demand.status = 'expired';
            expired++;
          } else {
            open++;
          }
          break;
        case 'fulfilled':
          fulfilled++;
          if (demand.fulfilledAt) {
            totalLearnTime += demand.fulfilledAt.getTime() - demand.createdAt.getTime();
            learnCount++;
          }
          break;
        case 'expired':
          expired++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    }

    return {
      total: this.demands.size,
      open,
      fulfilled,
      expired,
      cancelled,
      averageTimeToLearn: learnCount > 0 ? totalLearnTime / learnCount : 0,
    };
  }

  // ─── Private Helpers ───

  private getOpenDemandsForUser(requesterId: string): MemoryDemand[] {
    const demandIds = this.requesterIndex.get(requesterId) || [];
    const results: MemoryDemand[] = [];

    for (const id of demandIds) {
      const demand = this.demands.get(id);
      if (demand && demand.status === 'open') {
        results.push(demand);
      }
    }

    return results;
  }

  private addToRequesterIndex(requesterId: string, demandId: string): void {
    if (!this.requesterIndex.has(requesterId)) {
      this.requesterIndex.set(requesterId, []);
    }
    this.requesterIndex.get(requesterId)!.push(demandId);
  }

  private addToSkillIndex(zoneId: string, skill: string, demandId: string): void {
    const key = `${zoneId}:${skill}`;
    if (!this.skillIndex.has(key)) {
      this.skillIndex.set(key, []);
    }
    this.skillIndex.get(key)!.push(demandId);
  }
}
