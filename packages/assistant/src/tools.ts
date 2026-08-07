/**
 * Zone Assistant Tools — Three Response Modes + Learning
 *
 * The assistant has four tools for handling user requests:
 * - search_memories: KNOW — search neighbourhood knowledge
 * - open_wave: ASK — open a hearing space wave to ask around
 * - admit_unknown: UNKNOWN — honest admission of not knowing
 * - record_memory: LEARN — record a new memory (Phase 8)
 *
 * ⚠️ admit_unknown is a REAL tool, not a fallback.
 * When the model can explicitly choose "I don't know",
 * hallucination is dramatically reduced.
 *
 * ⚠️ record_memory is how Zone learns and grows.
 * Principle 4: Knowledge grows, it is not planted.
 */

import { Logger } from '@zone/core';
import type { EdgeProcessingResult, ExtractedNumber } from '@zone/core';
import type { MemoryService } from './memory-service';
import type { PostService } from './post-service';
import type { LearningService } from './learning-service';

// ─── Tool Definitions ───

export interface AssistantToolCall {
  name: string;
  arguments: Record<string, any>;
  id?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ─── search_memories Tool ───

export interface SearchMemoriesParams {
  /** Skill/service to search for (e.g. "house_painting") */
  skill: string;
  /** Zone ID to search within */
  zoneId: string;
  /** Geographic radius in meters (default: 2500) */
  radius?: number;
  /** Minimum confidence threshold (0-1, default: 0.3) */
  minConfidence?: number;
  /** Maximum number of results (default: 5) */
  maxResults?: number;
}

export interface MemorySearchResult {
  personId: string;
  personName: string;
  skill: string;
  description: string;
  outcome: 'positive' | 'negative' | 'neutral';
  sourceCount: number;
  confidence: number;
  credibility: number;
  lastMentioned: Date;
  isProfessional: boolean;
}

export interface SearchMemoriesResult {
  mode: 'know';
  memories: MemorySearchResult[];
  professionalPostCount: number;
  responseText: string;
}

// ─── open_wave Tool ───

export interface OpenWaveParams {
  /** Skill/service to ask about */
  skill: string;
  /** Zone ID */
  zoneId: string;
  /** Human-readable description of the request */
  description: string;
  /** Urgency level */
  urgency?: 'normal' | 'urgent' | 'emergency';
  /** Budget (if mentioned) */
  budget?: number;
  /** Budget unit */
  budgetUnit?: string;
  /** Tags from edge processing */
  tags: string[];
  /** Person making the request */
  requesterId: string;
}

export interface OpenWaveResult {
  mode: 'ask';
  spaceId: string;
  waveLevel: 1;
  radius: number;
  estimatedWait: string;
  professionalPostCount: number;
  responseText: string;
}

// ─── record_memory Tool (Phase 8) ───

export interface RecordMemoryToolParams {
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

export interface RecordMemoryToolResult {
  mode: 'record';
  memoryId: string;
  personName: string;
  skill: string;
  outcome: 'positive' | 'negative' | 'neutral';
  confidence: number;
  credibility: number;
  /** Whether a demand was fulfilled by this recording */
  fulfilledDemand: boolean;
  /** Time from demand creation to fulfillment (ms) */
  timeToLearn?: number;
  responseText: string;
}

// ─── admit_unknown Tool ───

export interface AdmitUnknownParams {
  /** Why we don't know */
  reason: string;
  /** What we were looking for */
  skill: string;
  /** Zone ID */
  zoneId: string;
  /** Tags we tried */
  tags: string[];
  /** Alternative suggestion (if any) */
  alternative?: string;
  /** Person who asked */
  requesterId: string;
}

export interface AdmitUnknownResult {
  mode: 'unknown';
  requestId: string;
  reason: string;
  alternative?: string;
  responseText: string;
  /** Whether we asked the user to tell us if they find someone */
  askedForFeedback: boolean;
  /** Demand ID created for the learning loop (Phase 8) */
  demandId?: string;
}

// ─── Tool Registry ───

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  default?: any;
}

export const ASSISTANT_TOOLS: Record<string, ToolDefinition> = {
  search_memories: {
    name: 'search_memories',
    description: 'Search neighbourhood memories for a specific skill or service. Use when you have knowledge about who can help. Returns friendly recommendations with confidence levels.',
    parameters: {
      skill: {
        type: 'string',
        description: 'Skill or service to search for (e.g. "house_painting", "plumbing")',
      },
      zoneId: {
        type: 'string',
        description: 'Zone/neighbourhood ID to search within',
      },
      radius: {
        type: 'number',
        description: 'Geographic radius in meters',
        default: 2500,
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence threshold (0-1)',
        default: 0.3,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results',
        default: 5,
      },
    },
    required: ['skill', 'zoneId'],
  },

  open_wave: {
    name: 'open_wave',
    description: 'Open a hearing space wave to ask around the neighbourhood. Use when you don\'t know someone directly but want to ask the community. Creates a dynamic space that reverberates.',
    parameters: {
      skill: {
        type: 'string',
        description: 'Skill or service being requested',
      },
      zoneId: {
        type: 'string',
        description: 'Zone/neighbourhood ID',
      },
      description: {
        type: 'string',
        description: 'Human-readable description of the request',
      },
      urgency: {
        type: 'string',
        description: 'Urgency level',
        enum: ['normal', 'urgent', 'emergency'],
        default: 'normal',
      },
      tags: {
        type: 'array',
        description: 'Tags from edge processing',
      },
      requesterId: {
        type: 'string',
        description: 'Person making the request',
      },
    },
    required: ['skill', 'zoneId', 'description', 'tags', 'requesterId'],
  },

  admit_unknown: {
    name: 'admit_unknown',
    description: 'Honest admission that you don\'t know anyone. This is a REAL tool, not a fallback. Use when you genuinely cannot help. Always ask the user to tell you if they find someone, so you can learn for next time. Creates a memory demand to track the learning loop.',
    parameters: {
      reason: {
        type: 'string',
        description: 'Why you don\'t know (e.g. "no memories found", "skill not in neighbourhood")',
      },
      skill: {
        type: 'string',
        description: 'What we were looking for',
      },
      zoneId: {
        type: 'string',
        description: 'Zone/neighbourhood ID',
      },
      tags: {
        type: 'array',
        description: 'Tags we tried',
      },
      alternative: {
        type: 'string',
        description: 'Alternative suggestion (if any, e.g. "try adjacent neighbourhood")',
      },
      requesterId: {
        type: 'string',
        description: 'Person who asked',
      },
    },
    required: ['reason', 'skill', 'zoneId', 'tags', 'requesterId'],
  },

  record_memory: {
    name: 'record_memory',
    description: 'Record a new memory about a person in the neighbourhood. Use when a user shares a recommendation, reports back after finding someone, or shares their experience. This is how Zone learns and grows. Every memory makes the next interaction better. If a demandId is provided, the corresponding learning demand will be fulfilled.',
    parameters: {
      zoneId: {
        type: 'string',
        description: 'Zone/neighbourhood ID',
      },
      personId: {
        type: 'string',
        description: 'Person the memory is about (unique ID)',
      },
      personName: {
        type: 'string',
        description: 'Person the memory is about (display name)',
      },
      skill: {
        type: 'string',
        description: 'Skill or service (e.g. "house_painting", "plumbing")',
      },
      description: {
        type: 'string',
        description: 'What was done or what happened',
      },
      outcome: {
        type: 'string',
        description: 'Outcome of the interaction',
        enum: ['positive', 'negative', 'neutral'],
      },
      sourcePersonId: {
        type: 'string',
        description: 'Person who reported this (source)',
      },
      sourcePersonName: {
        type: 'string',
        description: 'Person who reported this (display name)',
      },
      demandId: {
        type: 'string',
        description: 'Optional: demand ID if this is fulfilling a learning demand',
      },
    },
    required: ['zoneId', 'personId', 'personName', 'skill', 'description', 'outcome', 'sourcePersonId', 'sourcePersonName'],
  },
};

// ─── Tool Execution ───

export class ToolExecutor {
  private logger: Logger;
  private memoryService: MemoryService | null;
  private postService: PostService | null;
  private waveService: { createDynamicSpace(input: any): Promise<any> } | null;
  private learningService: LearningService | null; // Phase 8

  constructor(deps: {
    memoryService?: MemoryService | null;
    postService?: PostService | null;
    waveService?: { createDynamicSpace(input: any): Promise<any> } | null;
    learningService?: LearningService | null;
  } = {}) {
    this.logger = new Logger({ context: { service: 'tool-executor' } });
    this.memoryService = deps.memoryService ?? null;
    this.postService = deps.postService ?? null;
    this.waveService = deps.waveService ?? null;
    this.learningService = deps.learningService ?? null;
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall: AssistantToolCall): Promise<ToolResult> {
    this.logger.info('tool:execute', { tool: toolCall.name });

    switch (toolCall.name) {
      case 'search_memories':
        return this.executeSearchMemories(toolCall.arguments as SearchMemoriesParams);
      case 'open_wave':
        return this.executeOpenWave(toolCall.arguments as OpenWaveParams);
      case 'admit_unknown':
        return this.executeAdmitUnknown(toolCall.arguments as AdmitUnknownParams);
      case 'record_memory':
        return this.executeRecordMemory(toolCall.arguments as RecordMemoryToolParams);
      default:
        return { success: false, error: `Unknown tool: ${toolCall.name}` };
    }
  }

  /**
   * Get all tool definitions for the assistant
   */
  getToolDefinitions(): ToolDefinition[] {
    return Object.values(ASSISTANT_TOOLS);
  }

  // ─── search_memories ───

  private async executeSearchMemories(params: SearchMemoriesParams): Promise<ToolResult> {
    const { skill, zoneId, radius = 2500, minConfidence = 0.3, maxResults = 5 } = params;

    this.logger.info('tool:search_memories', { skill, zoneId, radius });

    let memories: MemorySearchResult[] = [];
    let professionalPostCount = 0;

    // Search memories from the memory service
    if (this.memoryService) {
      memories = await this.memoryService.search({
        skill,
        zoneId,
        radius,
        minConfidence,
        maxResults,
      });
    }

    // Check for professional posts
    if (this.postService) {
      professionalPostCount = await this.postService.getPostCount(zoneId, [`services/${skill}`]);
    }

    // Generate response text based on persona rules
    const responseText = this.generateKnowResponse(memories, professionalPostCount, skill);

    return {
      success: true,
      data: {
        mode: 'know',
        memories,
        professionalPostCount,
        responseText,
      } as SearchMemoriesResult,
    };
  }

  // ─── open_wave ───

  private async executeOpenWave(params: OpenWaveParams): Promise<ToolResult> {
    const {
      skill,
      zoneId,
      description,
      urgency = 'normal',
      tags,
      requesterId,
    } = params;

    this.logger.info('tool:open_wave', { skill, zoneId, urgency });

    let spaceId = '';
    let professionalPostCount = 0;

    // Create a dynamic hearing space
    if (this.waveService) {
      const space = await this.waveService.createDynamicSpace({
        zoneId,
        tags,
        reverberationTtl: this.getReverberationTTL(urgency),
        requesterId,
        description,
      });
      spaceId = space.id;
    } else {
      spaceId = `wave_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    // Check for professional posts
    if (this.postService) {
      professionalPostCount = await this.postService.getPostCount(zoneId, tags);
    }

    const estimatedWait = urgency === 'urgent' ? '۱۵ دقیقه' : urgency === 'emergency' ? 'فوری' : 'نیم ساعت';
    const responseText = this.generateAskResponse(urgency, professionalPostCount, estimatedWait);

    return {
      success: true,
      data: {
        mode: 'ask',
        spaceId,
        waveLevel: 1,
        radius: 2500,
        estimatedWait,
        professionalPostCount,
        responseText,
      } as OpenWaveResult,
    };
  }

  // ─── admit_unknown ───

  private async executeAdmitUnknown(params: AdmitUnknownParams): Promise<ToolResult> {
    const { reason, skill, zoneId, tags, alternative, requesterId } = params;

    this.logger.info('tool:admit_unknown', { skill, zoneId, reason });

    const requestId = `unknown_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Create a memory demand for the learning loop (Phase 8)
    let demandId: string | undefined;
    if (this.learningService) {
      try {
        const demand = this.learningService.createDemand({
          zoneId,
          skill,
          requesterId,
          tags,
          reason,
        });
        demandId = demand.id;
        this.logger.info('tool:admit_unknown:demand_created', { demandId: demand.id });
      } catch (err) {
        this.logger.warn('tool:admit_unknown:demand_failed', { error: err });
      }
    }

    const responseText = this.generateUnknownResponse(alternative);

    return {
      success: true,
      data: {
        mode: 'unknown',
        requestId,
        reason,
        alternative,
        responseText,
        askedForFeedback: true,
        demandId,
      } as AdmitUnknownResult,
    };
  }

  // ─── record_memory (Phase 8) ───

  private async executeRecordMemory(params: RecordMemoryToolParams): Promise<ToolResult> {
    const {
      zoneId, personId, personName, skill, description,
      outcome, sourcePersonId, sourcePersonName, demandId,
    } = params;

    this.logger.info('tool:record_memory', { skill, zoneId, personId, outcome, demandId });

    // Use LearningService if available (full learning loop)
    if (this.learningService) {
      try {
        const result = await this.learningService.learnFromUser({
          zoneId,
          personId,
          personName,
          skill,
          description,
          outcome,
          sourcePersonId,
          sourcePersonName,
          demandId,
        });

        return {
          success: true,
          data: {
            mode: 'record',
            memoryId: result.memory.id,
            personName,
            skill,
            outcome,
            confidence: result.confidence,
            credibility: result.credibility,
            fulfilledDemand: !!result.fulfilledDemand,
            timeToLearn: result.timeToLearn,
            responseText: result.responseText,
          } as RecordMemoryToolResult,
        };
      } catch (err: any) {
        this.logger.warn('tool:record_memory:learning_failed', { error: err.message });
        // Fall through to basic recording
      }
    }

    // Fallback: basic memory recording without learning loop
    if (this.memoryService) {
      try {
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

        return {
          success: true,
          data: {
            mode: 'record',
            memoryId: record.id,
            personName,
            skill,
            outcome,
            confidence: record.confidence,
            credibility: record.credibility,
            fulfilledDemand: false,
            responseText: `ممنون! یادداشت کردم که ${personName} برای ${this.getSkillLabel(skill)} معرفی شد.`,
          } as RecordMemoryToolResult,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'No memory service available' };
  }

  // ─── Response Generators (Persona-Aware) ───

  /**
   * KNOW mode response
   * Persona rules:
   * - One source? "یکی گفت." Multiple? "چند نفر."
   * - Always differentiate friendly vs professional
   * - Only announce professional posts, don't describe
   */
  private generateKnowResponse(
    memories: MemorySearchResult[],
    professionalPostCount: number,
    skill: string
  ): string {
    const positiveMemories = memories.filter((m) => m.outcome === 'positive');
    const skillLabel = this.getSkillLabel(skill);

    if (positiveMemories.length === 0) {
      // No positive memories — switch to ASK mode
      return `تو محله کسی رو برای ${skillLabel} نمی‌شناسم. میخوای بپرسم دوروبر؟`;
    }

    // Build the response
    const parts: string[] = [];

    if (positiveMemories.length === 1) {
      const m = positiveMemories[0];
      parts.push(`یکی ${m.personName} رو معرفی کرد.`);
    } else if (positiveMemories.length <= 3) {
      const names = positiveMemories.map((m) => m.personName).join(' و ');
      parts.push(`${positiveMemories.length} نفر ${names} رو معرفی کردن.`);
    } else {
      parts.push(`چند نفر تو محله معرفی کردن.`);
    }

    // Add confidence detail
    const highConfidence = positiveMemories.filter((m) => m.confidence >= 0.7);
    if (highConfidence.length > 0) {
      parts.push(`مطمئن‌ترین: ${highConfidence[0].personName}.`);
    }

    // Announce professional posts (don't describe!)
    if (professionalPostCount > 0) {
      parts.push(`${professionalPostCount} نفر هم پست حرفه‌ای دارن.`);
    }

    parts.push('کدوم رو بیشتر توضیح بدم؟');

    return parts.join(' ');
  }

  /**
   * ASK mode response
   */
  private generateAskResponse(
    urgency: string,
    professionalPostCount: number,
    estimatedWait: string
  ): string {
    const parts: string[] = [];

    if (urgency === 'emergency') {
      parts.push('فوریه؟ بذار سریع بپرسم.');
    } else if (urgency === 'urgent') {
      parts.push('بذار بپرسم دوروبر.');
    } else {
      parts.push('الان کسی رو نمی‌شناسم. بذار بپرسم دوروبر.');
    }

    parts.push(`تا ${estimatedWait} دیگه خبرت می‌کنم.`);

    // Announce professional posts
    if (professionalPostCount > 0) {
      parts.push(`${professionalPostCount} نفر هم پست حرفه‌ای دارن. میخوای ببینی؟`);
    }

    return parts.join(' ');
  }

  /**
   * UNKNOWN mode response
   * This is the most important response — it builds trust.
   * Always ask the user to tell you if they find someone.
   */
  private generateUnknownResponse(alternative?: string): string {
    const parts: string[] = [];

    parts.push('کسی رو پیدا نکردم.');

    if (alternative) {
      parts.push(alternative);
    }

    parts.push('اگه خودت پیدا کردی، بهم بگو تا دفعه بعد بدونم.');

    return parts.join(' ');
  }

  // ─── Helpers ───

  private getReverberationTTL(urgency: string): number {
    switch (urgency) {
      case 'emergency':
        return 15 * 60 * 1000; // 15 minutes
      case 'urgent':
        return 2 * 60 * 60 * 1000; // 2 hours
      default:
        return 2 * 60 * 60 * 1000; // 2 hours (service default)
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
}
