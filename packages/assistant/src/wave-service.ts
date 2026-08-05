/**
 * Zone Wave Service — Tiered Broadcast Waves
 *
 * The heart of the ASK mode. When the assistant doesn't know someone
 * directly, it opens a wave to ask around the neighbourhood.
 *
 * Three tiers:
 * - Wave 1 (0-10 min): matching skill + 2.5km radius + max 8 people
 * - Wave 2 (10-30 min): adjacent skill + 5km radius + max 15 people
 * - Wave 3 (30-90 min): referral ("who do you know?") + all active users
 *
 * ⚠️ Anti-nuisance rules are the most critical part of this system.
 * If a user mutes notifications, they never come back.
 */

import { Logger } from '@zone/core';
import { AntiNuisanceService } from './anti-nuisance';
import { PersonRegistry, type PersonRecord } from './person-registry';

// ─── Types ───

export interface WaveRequest {
  id: string;
  zoneId: string;
  requesterId: string;
  description: string;
  tags: string[];
  urgency: 'normal' | 'urgent' | 'emergency';
  radius: number;
  createdAt: Date;
  expiresAt: Date;
  currentWave: 0 | 1 | 2 | 3;
  status: 'open' | 'wave1' | 'wave2' | 'wave3' | 'fulfilled' | 'unknown' | 'cancelled';
  responseCount: number;
  /** Notified person IDs across all waves */
  notifiedPersons: string[];
  /** Wave dispatch results */
  waveResults: WaveResult[];
}

export interface WaveResult {
  waveLevel: 1 | 2 | 3;
  dispatchedAt: Date;
  /** Person IDs notified in this wave */
  personIds: string[];
  /** Number of people notified */
  count: number;
  /** Skills matched */
  matchedSkills: string[];
  /** Radius used */
  radius: number;
  /** Max people limit */
  maxPeople: number;
  /** Whether this wave was skipped (quiet hours, etc.) */
  skipped: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

export interface WaveConfig {
  /** Wave 1 radius in meters */
  wave1Radius: number;
  /** Wave 1 max people */
  wave1MaxPeople: number;
  /** Wave 1 delay from request (ms) */
  wave1Delay: number;

  /** Wave 2 radius in meters */
  wave2Radius: number;
  /** Wave 2 max people */
  wave2MaxPeople: number;
  /** Wave 2 delay from Wave 1 (ms) */
  wave2Delay: number;

  /** Wave 3 max people */
  wave3MaxPeople: number;
  /** Wave 3 delay from Wave 2 (ms) */
  wave3Delay: number;

  /** Request expiry time (ms) */
  requestExpiry: number;

  /** Minimum responses to stop */
  minResponsesToStop: number;
}

// ─── Default Config ───

const DEFAULT_WAVE_CONFIG: WaveConfig = {
  wave1Radius: 2500,       // 2.5 km
  wave1MaxPeople: 8,
  wave1Delay: 0,            // Immediate

  wave2Radius: 5000,       // 5 km
  wave2MaxPeople: 15,
  wave2Delay: 10 * 60 * 1000, // 10 minutes

  wave3MaxPeople: 30,
  wave3Delay: 20 * 60 * 1000, // 20 minutes

  requestExpiry: 90 * 60 * 1000, // 90 minutes

  minResponsesToStop: 2,
};

// ─── Wave Service ───

export class WaveService {
  private logger: Logger;
  private config: WaveConfig;
  private personRegistry: PersonRegistry;
  private antiNuisance: AntiNuisanceService;

  /** Active requests */
  private requests: Map<string, WaveRequest> = new Map();

  /** Index: zoneId → requestIds */
  private zoneIndex: Map<string, string[]> = new Map();

  constructor(
    personRegistry: PersonRegistry,
    antiNuisance: AntiNuisanceService,
    config?: Partial<WaveConfig>
  ) {
    this.logger = new Logger({ context: { service: 'wave-service' } });
    this.config = { ...DEFAULT_WAVE_CONFIG, ...config };
    this.personRegistry = personRegistry;
    this.antiNuisance = antiNuisance;
  }

  /**
   * Create a new wave request
   * This starts the tiered wave process.
   */
  createRequest(params: {
    zoneId: string;
    requesterId: string;
    description: string;
    tags: string[];
    urgency?: 'normal' | 'urgent' | 'emergency';
    radius?: number;
  }): WaveRequest {
    const { zoneId, requesterId, description, tags, urgency = 'normal', radius } = params;

    const now = new Date();
    const urgencyMultiplier = urgency === 'emergency' ? 0.5 : urgency === 'urgent' ? 0.75 : 1;

    const request: WaveRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      zoneId,
      requesterId,
      description,
      tags,
      urgency,
      radius: radius || this.config.wave1Radius,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.requestExpiry * urgencyMultiplier),
      currentWave: 0,
      status: 'open',
      responseCount: 0,
      notifiedPersons: [],
      waveResults: [],
    };

    this.requests.set(request.id, request);

    // Update zone index
    if (!this.zoneIndex.has(zoneId)) {
      this.zoneIndex.set(zoneId, []);
    }
    this.zoneIndex.get(zoneId)!.push(request.id);

    this.logger.info('wave:request_created', {
      requestId: request.id,
      zoneId,
      tags,
      urgency,
    });

    return request;
  }

  /**
   * Dispatch Wave 1
   * Matching skill + 2.5km radius + max 8 people
   */
  dispatchWave1(requestId: string, centerLatitude?: number, centerLongitude?: number): WaveResult {
    const request = this.requests.get(requestId);
    if (!request) {
      return this.emptyResult(1, 'request_not_found');
    }

    // Check if already fulfilled
    if (this.antiNuisance.hasEnoughResponses(requestId)) {
      request.status = 'fulfilled';
      return this.emptyResult(1, 'already_fulfilled');
    }

    // Check quiet hours
    if (this.antiNuisance.isInQuietHours() && request.urgency !== 'emergency') {
      this.logger.info('wave:quiet_hours', { requestId, wave: 1 });
      return this.emptyResult(1, 'quiet_hours');
    }

    request.currentWave = 1;
    request.status = 'wave1';

    // Extract skills from tags
    const skills = this.extractSkills(request.tags);

    // Search for matching persons
    const candidates = this.personRegistry.search({
      zoneId: request.zoneId,
      skills,
      centerLatitude,
      centerLongitude,
      radius: this.config.wave1Radius,
      excludeIds: [request.requesterId, ...request.notifiedPersons],
      maxResults: this.config.wave1MaxPeople * 2, // Get more, then filter by anti-nuisance
      activeOnly: true,
      includeDownWeighted: false,
    });

    // Filter by anti-nuisance and opt-out
    const eligible = this.filterEligible(candidates, request.tags);

    // Limit to max people
    const selected = eligible.slice(0, this.config.wave1MaxPeople);

    // Record notifications
    for (const person of selected) {
      this.antiNuisance.recordNotification(person.id, requestId, 1);
      request.notifiedPersons.push(person.id);
    }

    const result: WaveResult = {
      waveLevel: 1,
      dispatchedAt: new Date(),
      personIds: selected.map((p) => p.id),
      count: selected.length,
      matchedSkills: skills,
      radius: this.config.wave1Radius,
      maxPeople: this.config.wave1MaxPeople,
      skipped: false,
    };

    request.waveResults.push(result);

    this.logger.info('wave:dispatched', {
      requestId,
      waveLevel: 1,
      candidates: candidates.length,
      eligible: eligible.length,
      selected: selected.length,
      skills,
    });

    return result;
  }

  /**
   * Dispatch Wave 2
   * Adjacent skills + 5km radius + max 15 people
   */
  dispatchWave2(requestId: string, centerLatitude?: number, centerLongitude?: number): WaveResult {
    const request = this.requests.get(requestId);
    if (!request) {
      return this.emptyResult(2, 'request_not_found');
    }

    // Check if already fulfilled
    if (this.antiNuisance.hasEnoughResponses(requestId)) {
      request.status = 'fulfilled';
      return this.emptyResult(2, 'already_fulfilled');
    }

    // Check quiet hours
    if (this.antiNuisance.isInQuietHours() && request.urgency !== 'emergency') {
      return this.emptyResult(2, 'quiet_hours');
    }

    request.currentWave = 2;
    request.status = 'wave2';

    // Get adjacent skills
    const primarySkills = this.extractSkills(request.tags);
    const adjacentSkills: string[] = [];
    for (const skill of primarySkills) {
      const adj = this.personRegistry.getAdjacentSkills(skill);
      adjacentSkills.push(...adj);
    }

    // Combine primary + adjacent skills
    const allSkills = [...new Set([...primarySkills, ...adjacentSkills])];

    // Search with expanded criteria
    const candidates = this.personRegistry.search({
      zoneId: request.zoneId,
      skills: allSkills,
      centerLatitude,
      centerLongitude,
      radius: this.config.wave2Radius,
      excludeIds: [request.requesterId, ...request.notifiedPersons],
      maxResults: this.config.wave2MaxPeople * 2,
      activeOnly: true,
      includeDownWeighted: true, // Wave 2 includes down-weighted
    });

    // Filter by anti-nuisance and opt-out
    const eligible = this.filterEligible(candidates, request.tags);

    // Limit to max people
    const selected = eligible.slice(0, this.config.wave2MaxPeople);

    // Record notifications
    for (const person of selected) {
      this.antiNuisance.recordNotification(person.id, requestId, 2);
      request.notifiedPersons.push(person.id);
    }

    const result: WaveResult = {
      waveLevel: 2,
      dispatchedAt: new Date(),
      personIds: selected.map((p) => p.id),
      count: selected.length,
      matchedSkills: allSkills,
      radius: this.config.wave2Radius,
      maxPeople: this.config.wave2MaxPeople,
      skipped: false,
    };

    request.waveResults.push(result);

    this.logger.info('wave:dispatched', {
      requestId,
      waveLevel: 2,
      candidates: candidates.length,
      eligible: eligible.length,
      selected: selected.length,
      skills: allSkills,
    });

    return result;
  }

  /**
   * Dispatch Wave 3
   * Referral ("who do you know?") + all active users
   */
  dispatchWave3(requestId: string): WaveResult {
    const request = this.requests.get(requestId);
    if (!request) {
      return this.emptyResult(3, 'request_not_found');
    }

    // Check if already fulfilled
    if (this.antiNuisance.hasEnoughResponses(requestId)) {
      request.status = 'fulfilled';
      return this.emptyResult(3, 'already_fulfilled');
    }

    // Check quiet hours
    if (this.antiNuisance.isInQuietHours() && request.urgency !== 'emergency') {
      return this.emptyResult(3, 'quiet_hours');
    }

    request.currentWave = 3;
    request.status = 'wave3';

    // Wave 3: all active users in the zone
    const candidates = this.personRegistry.search({
      zoneId: request.zoneId,
      excludeIds: [request.requesterId, ...request.notifiedPersons],
      maxResults: this.config.wave3MaxPeople * 2,
      activeOnly: true,
      includeDownWeighted: true,
    });

    // Filter by anti-nuisance and opt-out
    const eligible = this.filterEligible(candidates, request.tags);

    // Limit to max people
    const selected = eligible.slice(0, this.config.wave3MaxPeople);

    // Record notifications
    for (const person of selected) {
      this.antiNuisance.recordNotification(person.id, requestId, 3);
      request.notifiedPersons.push(person.id);
    }

    const result: WaveResult = {
      waveLevel: 3,
      dispatchedAt: new Date(),
      personIds: selected.map((p) => p.id),
      count: selected.length,
      matchedSkills: ['referral'],
      radius: 0, // No radius limit for Wave 3
      maxPeople: this.config.wave3MaxPeople,
      skipped: false,
    };

    request.waveResults.push(result);

    this.logger.info('wave:dispatched', {
      requestId,
      waveLevel: 3,
      candidates: candidates.length,
      eligible: eligible.length,
      selected: selected.length,
    });

    // If Wave 3 also yields no responses, mark as UNKNOWN
    if (selected.length === 0) {
      request.status = 'unknown';
    }

    return result;
  }

  /**
   * Record a response to a wave
   * Returns true if the wave should stop (≥2 responses)
   */
  recordResponse(requestId: string, providerId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request) return false;

    request.responseCount++;
    const shouldStop = this.antiNuisance.recordResponse(requestId);

    // Reset silence count for the responder
    this.personRegistry.resetSilence(providerId);
    this.antiNuisance.resetSilence(providerId);

    if (shouldStop) {
      request.status = 'fulfilled';
      this.logger.info('wave:fulfilled', {
        requestId,
        responseCount: request.responseCount,
      });
    }

    return shouldStop;
  }

  /**
   * Record silence for all notified persons who didn't respond
   * Called when a wave times out without enough responses
   */
  recordWaveSilence(requestId: string, waveLevel: number): void {
    const request = this.requests.get(requestId);
    if (!request) return;

    const waveResult = request.waveResults.find((w) => w.waveLevel === waveLevel);
    if (!waveResult) return;

    for (const personId of waveResult.personIds) {
      this.personRegistry.incrementSilence(personId);
      this.antiNuisance.recordSilence(personId);
    }

    this.logger.debug('wave:silence_recorded', {
      requestId,
      waveLevel,
      personCount: waveResult.personIds.length,
    });
  }

  /**
   * Get a request by ID
   */
  getRequest(requestId: string): WaveRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Get all active requests for a zone
   */
  getActiveRequests(zoneId: string): WaveRequest[] {
    const ids = this.zoneIndex.get(zoneId) || [];
    return ids
      .map((id) => this.requests.get(id)!)
      .filter((r) => r && r.status !== 'fulfilled' && r.status !== 'unknown' && r.status !== 'cancelled');
  }

  /**
   * Cancel a request
   */
  cancelRequest(requestId: string): boolean {
    const request = this.requests.get(requestId);
    if (!request) return false;

    request.status = 'cancelled';
    this.logger.info('wave:cancelled', { requestId });
    return true;
  }

  /**
   * Get the next wave delay for a request
   */
  getNextWaveDelay(currentWave: number, urgency: string): number {
    if (urgency === 'emergency') {
      // Emergency: faster waves
      return currentWave === 1 ? 2 * 60 * 1000 : 5 * 60 * 1000; // 2min / 5min
    }
    if (urgency === 'urgent') {
      return currentWave === 1 ? 5 * 60 * 1000 : 10 * 60 * 1000; // 5min / 10min
    }
    return currentWave === 1 ? this.config.wave2Delay : this.config.wave3Delay;
  }

  // ─── Emergency Channel ───

  /**
   * Dispatch an emergency wave
   * This is a special channel (#urgent/help) with strict limits:
   * - Max 1/week per user
   * - Always delivered (bypasses quiet hours)
   * - All active users in the zone
   */
  dispatchEmergency(requestId: string, zoneId: string, requesterId: string): WaveResult {
    // Check weekly emergency limit
    if (!this.antiNuisance.canNotify(requesterId, 'emergency')) {
      return this.emptyResult(1, 'weekly_emergency_limit');
    }

    // Get all active users in the zone
    const candidates = this.personRegistry.search({
      zoneId,
      excludeIds: [requesterId],
      maxResults: 30,
      activeOnly: true,
      includeDownWeighted: true,
    });

    // Filter by anti-nuisance
    const eligible = candidates.filter((p) =>
      this.antiNuisance.canNotify(p.id, 'emergency')
    );

    // Record emergency notifications
    for (const person of eligible) {
      this.antiNuisance.recordNotification(person.id, requestId, 1, 'emergency');
    }

    this.logger.info('wave:emergency', {
      requestId,
      zoneId,
      selected: eligible.length,
    });

    return {
      waveLevel: 1,
      dispatchedAt: new Date(),
      personIds: eligible.map((p) => p.id),
      count: eligible.length,
      matchedSkills: ['emergency'],
      radius: 0,
      maxPeople: 30,
      skipped: false,
    };
  }

  // ─── Private Helpers ───

  private filterEligible(candidates: PersonRecord[], tags: string[]): PersonRecord[] {
    return candidates.filter((person) => {
      // Check anti-nuisance
      if (!this.antiNuisance.canNotify(person.id)) {
        return false;
      }

      // Check tag opt-out
      for (const tag of tags) {
        if (this.personRegistry.hasOptedOut(person.id, tag)) {
          return false;
        }
      }

      return true;
    });
  }

  private extractSkills(tags: string[]): string[] {
    return tags
      .filter((t) => t.startsWith('services/') || t.startsWith('social/') || t.startsWith('support/'))
      .map((t) => t.split('/')[1])
      .filter(Boolean);
  }

  private emptyResult(waveLevel: 1 | 2 | 3, reason: string): WaveResult {
    return {
      waveLevel,
      dispatchedAt: new Date(),
      personIds: [],
      count: 0,
      matchedSkills: [],
      radius: 0,
      maxPeople: 0,
      skipped: true,
      skipReason: reason,
    };
  }
}
