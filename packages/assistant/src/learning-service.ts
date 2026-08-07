/**
 * Zone Learning Service — Orchestrates the Full Learning Loop
 *
 * The learning loop is the core growth mechanism of Zone:
 *
 *   User asks → UNKNOWN mode → "اگه خودت پیدا کردی، بهم بگو"
 *       → User comes back → "پیداش کردم" → record_memory tool
 *       → Memory recorded → next time KNOW mode
 *
 * This service orchestrates:
 * 1. Creating memory demands (when we admit we don't know)
 * 2. Fulfilling demands (when user reports back)
 * 3. Recording memories with enhanced confidence scoring
 * 4. Matching user reports to open demands
 *
 * Principle 4: Knowledge grows, it is not planted.
 * Principle 7: It is spoken, not stored (with one exception — memories ARE stored).
 */

import { Logger } from '@zone/core';
import {
  MemoryService,
  type MemoryRecord,
  type RecordMemoryParams,
  type MemorySearchParams,
  type MemorySearchResult,
} from './memory-service';
import {
  MemoryDemandService,
  type MemoryDemand,
  type CreateDemandParams,
  type FulfillDemandParams,
  type DemandSearchParams,
} from './memory-demand';

// ─── Types ───

export interface LearnFromUserParams {
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
  /** Outcome of the interaction */
  outcome: 'positive' | 'negative' | 'neutral';
  /** Person who reported this (source) */
  sourcePersonId: string;
  /** Person who reported this (display name) */
  sourcePersonName: string;
  /** Optional: demand ID if this is fulfilling a demand */
  demandId?: string;
}

export interface LearnResult {
  /** The recorded memory */
  memory: MemoryRecord;
  /** The fulfilled demand (if any) */
  fulfilledDemand?: MemoryDemand;
  /** Whether this was a new memory or an update */
  isNewMemory: boolean;
  /** Updated confidence score */
  confidence: number;
  /** Updated credibility score */
  credibility: number;
  /** Time from demand creation to fulfillment (ms) */
  timeToLearn?: number;
  /** Response text for the user */
  responseText: string;
}

export interface LearningStats {
  /** Total memories recorded */
  totalMemories: number;
  /** Total demands created */
  totalDemands: number;
  /** Open demands */
  openDemands: number;
  /** Fulfilled demands */
  fulfilledDemands: number;
  /** Average time from demand to fulfillment (ms) */
  averageTimeToLearn: number;
  /** Learning rate: fulfilled / total */
  learningRate: number;
  /** Skills with most open demands */
  topDemandedSkills: Array<{ skill: string; count: number }>;
  /** Skills with most memories */
  topKnownSkills: Array<{ skill: string; count: number }>;
}

// ─── Confidence Enhancement ───

/**
 * Enhanced confidence scoring factors:
 *
 * 1. Source diversity: different people saying the same thing → higher confidence
 * 2. Outcome consistency: all positive → higher confidence
 * 3. Recency: recent interactions are more valuable
 * 4. Professional status: professional providers get a small boost
 * 5. Verification: confirmed numbers/feedback → higher confidence
 */
export interface ConfidenceFactors {
  /** Number of distinct sources for this person+skill */
  sourceCount: number;
  /** Ratio of positive outcomes to total */
  positiveRatio: number;
  /** Days since the most recent mention */
  recencyDays: number;
  /** Whether the person is a professional provider */
  isProfessional: boolean;
  /** Whether the memory has verified numbers */
  hasVerifiedNumbers: boolean;
  /** Whether the memory came from a learning loop (demand fulfillment) */
  fromLearningLoop: boolean;
}

export const CONFIDENCE_WEIGHTS = {
  /** Base confidence for a new memory */
  BASE: 0.5,
  /** Confidence boost per additional source (max 0.3) */
  SOURCE_DIVERSITY: 0.1,
  /** Confidence boost for consistent positive outcomes */
  POSITIVE_CONSISTENCY: 0.15,
  /** Confidence boost for recency (within 7 days) */
  RECENCY_BOOST: 0.1,
  /** Confidence boost for professional status */
  PROFESSIONAL_BOOST: 0.05,
  /** Confidence boost for verified numbers */
  VERIFIED_NUMBERS: 0.1,
  /** Confidence boost for learning loop feedback */
  LEARNING_LOOP_BOOST: 0.1,
  /** Maximum confidence */
  MAX_CONFIDENCE: 1.0,
};

// ─── Learning Service ───

export class LearningService {
  private logger: Logger;
  private memoryService: MemoryService;
  private demandService: MemoryDemandService;

  constructor(
    memoryService?: MemoryService,
    demandService?: MemoryDemandService
  ) {
    this.logger = new Logger({ context: { service: 'learning' } });
    this.memoryService = memoryService || new MemoryService();
    this.demandService = demandService || new MemoryDemandService();
  }

  /**
   * Get the memory service
   */
  getMemoryService(): MemoryService {
    return this.memoryService;
  }

  /**
   * Get the demand service
   */
  getDemandService(): MemoryDemandService {
    return this.demandService;
  }

  // ─── Learning Loop Step 1: Create Demand ───

  /**
   * Create a memory demand when we admit we don't know.
   * This is called from the admit_unknown tool.
   *
   * The user is told: "اگه خودت پیدا کردی، بهم بگو تا دفعه بعد بدونم"
   * This demand tracks that request.
   */
  createDemand(params: CreateDemandParams): MemoryDemand {
    this.logger.info('learning:demand:create', {
      skill: params.skill,
      zoneId: params.zoneId,
      requesterId: params.requesterId,
    });

    return this.demandService.create(params);
  }

  // ─── Learning Loop Step 2: Learn from User ───

  /**
   * Learn from a user's report-back.
   * This is the core learning moment — when a user comes back
   * with information after we said "I don't know".
   *
   * Flow:
   * 1. If a demandId is provided, fulfill the demand
   * 2. Otherwise, try to find an open demand matching skill+zone
   * 3. Record the memory with enhanced confidence scoring
   * 4. Generate a learning-appropriate response
   */
  async learnFromUser(params: LearnFromUserParams): Promise<LearnResult> {
    const {
      zoneId, personId, personName, skill, description,
      outcome, sourcePersonId, sourcePersonName, demandId,
    } = params;

    this.logger.info('learning:from_user', {
      skill, zoneId, personId, outcome,
      demandId: demandId || 'none',
    });

    // ─── Step 1: Fulfill the demand ───

    let fulfilledDemand: MemoryDemand | undefined;

    if (demandId) {
      // Fulfill specific demand
      fulfilledDemand = this.demandService.fulfill({
        demandId,
        personId,
        personName,
        description,
        outcome,
        reportedBy: sourcePersonId,
      }) || undefined;
    } else {
      // Try to find a matching open demand
      const openDemands = this.demandService.findOpenDemands(skill, zoneId);

      // Find the demand from this requester
      const matchingDemand = openDemands.find(
        (d) => d.requesterId === sourcePersonId
      );

      if (matchingDemand) {
        fulfilledDemand = this.demandService.fulfill({
          demandId: matchingDemand.id,
          personId,
          personName,
          description,
          outcome,
          reportedBy: sourcePersonId,
        }) || undefined;
      }
    }

    // ─── Step 2: Calculate enhanced confidence ───

    const existingMemories = await this.memoryService.search({
      skill,
      zoneId,
      minConfidence: 0.1,
      maxResults: 20,
    });

    const factors = this.calculateConfidenceFactors(
      existingMemories,
      personId,
      outcome,
      !!fulfilledDemand
    );

    const enhancedConfidence = this.calculateEnhancedConfidence(factors);

    // ─── Step 3: Record the memory ───

    const record = await this.memoryService.record({
      zoneId,
      personId,
      personName,
      skill,
      description,
      outcome,
      sourcePersonId,
      sourcePersonName,
    });

    // Apply enhanced confidence
    record.confidence = enhancedConfidence;

    // ─── Step 4: Generate response ───

    const timeToLearn = fulfilledDemand
      ? Date.now() - fulfilledDemand.createdAt.getTime()
      : undefined;

    const responseText = this.generateLearningResponse(
      personName,
      skill,
      outcome,
      fulfilledDemand,
      timeToLearn
    );

    this.logger.info('learning:recorded', {
      memoryId: record.id,
      confidence: enhancedConfidence,
      fulfilledDemand: !!fulfilledDemand,
      timeToLearn,
    });

    return {
      memory: record,
      fulfilledDemand,
      isNewMemory: record.confidence === enhancedConfidence, // Fresh record
      confidence: enhancedConfidence,
      credibility: record.credibility,
      timeToLearn,
      responseText,
    };
  }

  // ─── Search with Learning Context ───

  /**
   * Search memories, including awareness of open demands.
   * If there are open demands for a skill+zone, we know the
   * neighbourhood is interested in that skill.
   */
  async searchWithContext(params: MemorySearchParams): Promise<{
    memories: MemorySearchResult[];
    openDemands: MemoryDemand[];
    demandCount: number;
  }> {
    const { skill, zoneId } = params;

    const memories = await this.memoryService.search(params);
    const openDemands = this.demandService.findOpenDemands(skill, zoneId);

    return {
      memories,
      openDemands,
      demandCount: openDemands.length,
    };
  }

  // ─── Learning Statistics ───

  getStats(zoneId?: string): LearningStats {
    const demandStats = this.demandService.getStats();
    const memoryStats = zoneId
      ? this.memoryService.getStats(zoneId)
      : { totalMemories: 0, skills: [], averageConfidence: 0 };

    // Get top demanded skills
    const openDemands = this.demandService.search({ status: 'open' });
    const skillDemandCount = new Map<string, number>();
    for (const d of openDemands) {
      skillDemandCount.set(d.skill, (skillDemandCount.get(d.skill) || 0) + 1);
    }
    const topDemandedSkills = Array.from(skillDemandCount.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get top known skills
    const topKnownSkills = (memoryStats.skills || []).map((skill) => ({
      skill,
      count: 1, // Simplified for dev
    })).slice(0, 5);

    const learningRate = demandStats.total > 0
      ? demandStats.fulfilled / demandStats.total
      : 0;

    return {
      totalMemories: memoryStats.totalMemories,
      totalDemands: demandStats.total,
      openDemands: demandStats.open,
      fulfilledDemands: demandStats.fulfilled,
      averageTimeToLearn: demandStats.averageTimeToLearn,
      learningRate,
      topDemandedSkills,
      topKnownSkills,
    };
  }

  // ─── Private: Confidence Enhancement ───

  private calculateConfidenceFactors(
    existingMemories: MemorySearchResult[],
    personId: string,
    outcome: 'positive' | 'negative' | 'neutral',
    fromLearningLoop: boolean
  ): ConfidenceFactors {
    // Count sources for this person
    const personMemories = existingMemories.filter(
      (m) => m.personId === personId
    );

    const sourceCount = personMemories.length;
    const positiveCount = personMemories.filter(
      (m) => m.outcome === 'positive'
    ).length;
    const positiveRatio = sourceCount > 0
      ? positiveCount / sourceCount
      : (outcome === 'positive' ? 1.0 : 0.0);

    const recencyDays = personMemories.length > 0
      ? (Date.now() - Math.max(...personMemories.map((m) => m.lastMentioned.getTime()))) / (1000 * 60 * 60 * 24)
      : 0;

    return {
      sourceCount,
      positiveRatio,
      recencyDays,
      isProfessional: false, // TODO: Check professional status
      hasVerifiedNumbers: false, // TODO: Check for confirmed numbers
      fromLearningLoop,
    };
  }

  private calculateEnhancedConfidence(factors: ConfidenceFactors): number {
    let confidence = CONFIDENCE_WEIGHTS.BASE;

    // Source diversity: more sources → higher confidence
    const sourceBoost = Math.min(
      factors.sourceCount * CONFIDENCE_WEIGHTS.SOURCE_DIVERSITY,
      0.3
    );
    confidence += sourceBoost;

    // Outcome consistency: all positive → higher confidence
    if (factors.positiveRatio >= 0.8) {
      confidence += CONFIDENCE_WEIGHTS.POSITIVE_CONSISTENCY;
    }

    // Recency: recent interactions are more valuable
    if (factors.recencyDays <= 7) {
      confidence += CONFIDENCE_WEIGHTS.RECENCY_BOOST;
    }

    // Professional status boost
    if (factors.isProfessional) {
      confidence += CONFIDENCE_WEIGHTS.PROFESSIONAL_BOOST;
    }

    // Verified numbers boost
    if (factors.hasVerifiedNumbers) {
      confidence += CONFIDENCE_WEIGHTS.VERIFIED_NUMBERS;
    }

    // Learning loop boost: feedback from a demand fulfillment
    if (factors.fromLearningLoop) {
      confidence += CONFIDENCE_WEIGHTS.LEARNING_LOOP_BOOST;
    }

    return Math.min(confidence, CONFIDENCE_WEIGHTS.MAX_CONFIDENCE);
  }

  // ─── Private: Response Generation ───

  private generateLearningResponse(
    personName: string,
    skill: string,
    outcome: 'positive' | 'negative' | 'neutral',
    fulfilledDemand?: MemoryDemand,
    timeToLearn?: number
  ): string {
    const skillLabel = this.getSkillLabel(skill);

    if (fulfilledDemand) {
      // This was a demand fulfillment — the user came back after we said "I don't know"
      if (outcome === 'positive') {
        const timeStr = this.formatTimeToLearn(timeToLearn);
        return `ممنون! یادداشت کردم که ${personName} برای ${skillLabel} خوبه. ${timeStr}یاد گرفتم. دفعه بعد از اول می‌شناسم.`;
      } else if (outcome === 'negative') {
        return `متأسفانه تجربه خوبی نبوده. یادداشت کردم. این اطلاعات هم برای محله مفیده.`;
      } else {
        return `ممنون که گفتی. یادداشت کردم. اگه بازم چیزی فهمیدی، بهم بگو.`;
      }
    }

    // Direct recommendation (not from a demand)
    if (outcome === 'positive') {
      return `ممنون! یادداشت کردم که ${personName} برای ${skillLabel} معرفی شد.`;
    } else if (outcome === 'negative') {
      return `یادداشت کردم. تجربه‌های بد هم مهمن.`;
    } else {
      return `ممنون که گفتی. یادداشت کردم.`;
    }
  }

  private getSkillLabel(skill: string): string {
    const labels: Record<string, string> = {
      house_painting: 'نقاشی ساختمان',
      plumbing: 'لوله‌کشی',
      electrical: 'برقکاری',
      cleaning: 'نظافت',
      repair: 'تعمیرات',
      moving: 'اسباب‌کشی',
      carpentry: 'نجاری',
      tiling: 'سرامیک‌کاری',
      air_conditioning: 'کولر',
      locksmith: 'قفل‌سازی',
      landscaping: 'باغبانی',
      appliance_repair: 'تعمیرات لوازم',
      sports: 'ورزش',
      walking: 'پیاده‌روی',
      gaming: 'بازی',
      food: 'غذا',
      party: 'مهمانی',
      trip: 'سفر',
      study: 'درس',
      volunteer: 'خیریه',
    };
    return labels[skill] || skill;
  }

  private formatTimeToLearn(ms?: number): string {
    if (!ms) return '';
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) return 'کمتر از یک ساعت ';
    if (hours < 24) return `حدود ${Math.round(hours)} ساعت `;
    const days = hours / 24;
    if (days < 7) return `حدود ${Math.round(days)} روز `;
    return 'چند روز ';
  }
}
