/**
 * Zone Response Modes — Three-Mode Decision Engine
 *
 * Determines which response mode to use for a user request:
 * - KNOW: We have neighbourhood knowledge about this
 * - ASK: We don't know, but we can ask around
 * - UNKNOWN: We genuinely cannot help
 *
 * This is the CLOUD decision — the most sensitive decision in the system.
 * The edge processor provides a preliminary intent, but the final
 * decision is made here with access to the full knowledge base.
 */

import { Logger } from '@zone/core';
import type { EdgeProcessingResult } from '@zone/core';
import { ToolExecutor, type SearchMemoriesResult, type OpenWaveResult, type AdmitUnknownResult } from './tools';
import type { MemoryService } from './memory-service';
import type { PostService } from './post-service';

// ─── Types ───

export type ResponseMode = 'know' | 'ask' | 'unknown';

export interface ModeDecision {
  mode: ResponseMode;
  confidence: number;
  reasoning: string;
  toolName: string;
  toolArguments: Record<string, any>;
}

export interface ResponseModeResult {
  mode: ResponseMode;
  decision: ModeDecision;
  toolResult: SearchMemoriesResult | OpenWaveResult | AdmitUnknownResult;
  responseText: string;
  professionalPostCount: number;
}

// ─── Decision Factors ───

interface DecisionFactors {
  /** Edge intent from on-device processing */
  edgeIntent: ResponseMode;
  /** Number of relevant memories found */
  memoryCount: number;
  /** Average confidence of memories */
  avgMemoryConfidence: number;
  /** Number of positive memories */
  positiveMemoryCount: number;
  /** Number of professional posts available */
  professionalPostCount: number;
  /** Whether the skill is in the closed vocabulary */
  skillInVocabulary: boolean;
  /** Urgency level */
  urgency: 'normal' | 'urgent' | 'emergency';
}

// ─── Decision Rules ───

/**
 * KNOW mode:
 *   - ≥1 positive memory with confidence ≥ 0.5
 *   - Edge intent is "know" (user is sharing info)
 *
 * ASK mode:
 *   - No positive memories OR low confidence
 *   - Skill is in vocabulary (we know what to ask about)
 *
 * UNKNOWN mode:
 *   - Skill not in vocabulary
 *   - No memories AND skill not in vocabulary
 *   - This is a REAL tool — it records the unknown for future learning
 */
const DECISION_RULES = {
  KNOW_MIN_CONFIDENCE: 0.5,
  KNOW_MIN_POSITIVE_MEMORIES: 1,
  KNOW_STRONG_MEMORIES: 2,
};

// ─── Known service skills (from closed vocabulary) ───

const KNOWN_SKILLS = [
  'house_painting', 'plumbing', 'electrical', 'cleaning', 'repair',
  'moving', 'carpentry', 'tiling', 'air_conditioning', 'locksmith',
  'landscaping', 'appliance_repair',
];

const KNOWN_SOCIAL = [
  'sports', 'walking', 'gaming', 'food', 'party', 'trip', 'study', 'volunteer',
];

const KNOWN_SUPPORT = ['advice', 'brainstorm', 'help'];

const ALL_KNOWN_SKILLS = [...KNOWN_SKILLS, ...KNOWN_SOCIAL, ...KNOWN_SUPPORT];

// ─── Response Mode Engine ───

export class ResponseModeEngine {
  private logger: Logger;
  private toolExecutor: ToolExecutor;
  private memoryService: MemoryService | null;
  private postService: PostService | null;

  constructor(toolExecutor: ToolExecutor, memoryService?: MemoryService, postService?: PostService) {
    this.logger = new Logger({ context: { service: 'response-mode-engine' } });
    this.toolExecutor = toolExecutor;
    this.memoryService = memoryService || null;
    this.postService = postService || null;
  }

  /**
   * Determine the response mode and execute the appropriate tool
   *
   * This is the core decision point of the Zone system.
   * The quality of this decision determines user trust.
   */
  async decide(
    edgeResult: EdgeProcessingResult,
    zoneId: string,
    requesterId: string
  ): Promise<ResponseModeResult> {
    const startTime = Date.now();

    this.logger.info('mode:decide', {
      intent: edgeResult.intent,
      tags: edgeResult.tags,
      confidence: edgeResult.confidence,
    });

    // Step 1: Gather decision factors from actual data
    const factors = await this.gatherFactors(edgeResult, zoneId);

    // Step 2: Make the decision
    const decision = this.makeDecision(factors, edgeResult, zoneId, requesterId);

    this.logger.info('mode:decision', {
      mode: decision.mode,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    });

    // Step 3: Execute the tool
    const toolResult = await this.toolExecutor.execute({
      name: decision.toolName,
      arguments: decision.toolArguments,
    });

    if (!toolResult.success) {
      this.logger.warn('mode:tool_failed', {
        tool: decision.toolName,
        error: toolResult.error,
      });

      const fallbackResult = await this.toolExecutor.execute({
        name: 'admit_unknown',
        arguments: {
          reason: 'خطای داخلی سیستم',
          skill: edgeResult.tags[0]?.split('/')[1] || 'unknown',
          zoneId,
          tags: edgeResult.tags,
          requesterId,
        },
      });

      return {
        mode: 'unknown',
        decision,
        toolResult: fallbackResult.data as AdmitUnknownResult,
        responseText: (fallbackResult.data as AdmitUnknownResult).responseText,
        professionalPostCount: 0,
      };
    }

    const duration = Date.now() - startTime;
    this.logger.info('mode:complete', { mode: decision.mode, duration });

    return {
      mode: decision.mode,
      decision,
      toolResult: toolResult.data as SearchMemoriesResult | OpenWaveResult | AdmitUnknownResult,
      responseText: (toolResult.data as any).responseText,
      professionalPostCount: (toolResult.data as any).professionalPostCount || 0,
    };
  }

  // ─── Factor Gathering ───

  private async gatherFactors(
    edgeResult: EdgeProcessingResult,
    zoneId: string
  ): Promise<DecisionFactors> {
    const skill = this.extractSkill(edgeResult.tags);
    const isService = edgeResult.tags.some((t) => t.startsWith('services/'));
    const isSocial = edgeResult.tags.some((t) => t.startsWith('social/'));
    const isSupport = edgeResult.tags.some((t) => t.startsWith('support/'));

    // Check if the skill is in the closed vocabulary
    // A tag like "services/rocket_science" is NOT in vocabulary
    // even though it starts with "services/"
    const skillInVocabulary = ALL_KNOWN_SKILLS.includes(skill) || (isSocial || isSupport);

    // Determine urgency
    const urgency = edgeResult.tags.includes('urgency/emergency') ? 'emergency'
      : edgeResult.tags.includes('urgency/urgent') ? 'urgent'
      : 'normal';

    let memoryCount = 0;
    let avgMemoryConfidence = 0;
    let positiveMemoryCount = 0;
    let professionalPostCount = 0;

    // Query actual memory service for this skill+zone
    if (this.memoryService && skill) {
      try {
        const memories = await this.memoryService.search({
          skill,
          zoneId,
          minConfidence: 0.1,
          maxResults: 10,
        });

        memoryCount = memories.length;
        positiveMemoryCount = memories.filter((m) => m.outcome === 'positive').length;

        if (memories.length > 0) {
          avgMemoryConfidence = memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length;
        }
      } catch (err) {
        this.logger.warn('mode:memory_search_failed', { error: err });
      }
    }

    // Query actual post service for professional posts
    if (this.postService) {
      try {
        professionalPostCount = await this.postService.getPostCount(zoneId, edgeResult.tags);
      } catch (err) {
        this.logger.warn('mode:post_count_failed', { error: err });
      }
    }

    return {
      edgeIntent: edgeResult.intent,
      memoryCount,
      avgMemoryConfidence,
      positiveMemoryCount,
      professionalPostCount,
      skillInVocabulary,
      urgency: urgency as 'normal' | 'urgent' | 'emergency',
    };
  }

  // ─── Decision Making ───

  private makeDecision(
    factors: DecisionFactors,
    edgeResult: EdgeProcessingResult,
    zoneId: string,
    requesterId: string
  ): ModeDecision {
    const skill = this.extractSkill(edgeResult.tags);

    // ─── Rule 1: KNOW mode ───
    // We have positive memories with decent confidence

    if (
      factors.positiveMemoryCount >= DECISION_RULES.KNOW_MIN_POSITIVE_MEMORIES &&
      factors.avgMemoryConfidence >= DECISION_RULES.KNOW_MIN_CONFIDENCE
    ) {
      return {
        mode: 'know',
        confidence: factors.avgMemoryConfidence,
        reasoning: `${factors.positiveMemoryCount} positive memories with avg confidence ${factors.avgMemoryConfidence.toFixed(2)}`,
        toolName: 'search_memories',
        toolArguments: {
          skill,
          zoneId,
          radius: 2500,
          // The fetch threshold is given a 0.1 margin below the decision
          // threshold: MemoryService compares CREDIBILITY (which decays
          // strictly below confidence over time) against this threshold,
          // so a memory sitting exactly at the decision boundary would
          // otherwise silently disappear between decide and fetch.
          minConfidence: DECISION_RULES.KNOW_MIN_CONFIDENCE - 0.1,
          maxResults: 5,
        },
      };
    }

    // ─── Rule 2: ASK mode ───
    // Skill is in vocabulary but we don't have enough memories

    if (factors.skillInVocabulary) {
      return {
        mode: 'ask',
        confidence: 0.7,
        reasoning: `Skill in vocabulary but no/few positive memories (${factors.positiveMemoryCount}). Asking around.`,
        toolName: 'open_wave',
        toolArguments: {
          skill,
          zoneId,
          description: edgeResult.tags.join(', '),
          urgency: factors.urgency,
          tags: edgeResult.tags,
          requesterId,
        },
      };
    }

    // ─── Rule 3: UNKNOWN mode ───
    // Skill not in vocabulary — we genuinely cannot help

    return {
      mode: 'unknown',
      confidence: 0.5,
      reasoning: `Skill not in vocabulary. Admitting unknown.`,
      toolName: 'admit_unknown',
      toolArguments: {
        reason: 'برچسب در واژگان نیست و حافظه‌ای وجود نداره',
        skill: skill || 'unknown',
        zoneId,
        tags: edgeResult.tags,
        requesterId,
        alternative: 'شاید تو محله‌های مجاور پیدا بشی',
      },
    };
  }

  // ─── Helpers ───

  private extractSkill(tags: string[]): string {
    const serviceTag = tags.find((t) => t.startsWith('services/'));
    if (serviceTag) return serviceTag.split('/')[1];

    const socialTag = tags.find((t) => t.startsWith('social/'));
    if (socialTag) return socialTag.split('/')[1];

    const supportTag = tags.find((t) => t.startsWith('support/'));
    if (supportTag) return supportTag.split('/')[1];

    return '';
  }
}
