/**
 * Zone Assistant — Abstraction Layer + Response Modes + Learning
 *
 * Provides a unified interface for all AI model providers.
 * No part of the codebase may depend on a specific provider's SDK.
 *
 * Dual-path strategy:
 * - On-device: tag extraction, intent detection, number extraction
 * - Cloud: conversational warmth, three-mode decision
 *
 * Phase 5: Added three response modes (KNOW/ASK/UNKNOWN),
 * tool definitions, memory service, and post service.
 * Phase 6: Added wave service, anti-nuisance, person registry.
 * Phase 7: Added number service.
 * Phase 8: Added learning service, memory demand, record_memory tool.
 * Phase 9: Added license verification, professional subscription.
 */

// ─── Assistant Provider Interface ───

export interface AssistantProvider {
  name: string;
  chat(messages: AssistantMessage[], options?: AssistantOptions): Promise<AssistantResponse>;
  stream(messages: AssistantMessage[], options?: AssistantOptions): AsyncIterable<AssistantChunk>;
}

export interface AssistantMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface AssistantOptions {
  tools?: AssistantTool[];
  temperature?: number;
  maxTokens?: number;
}

export interface AssistantTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface AssistantResponse {
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, any> }>;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AssistantChunk {
  content?: string;
  toolCall?: { name: string; arguments: string };
  done: boolean;
}

// ─── Zone Persona ───

export const ZONE_PERSONA = `تو یک محلی‌ای. رفیق صمیمی کاربر.

- کوتاه حرف بزن. مثل آدم.
- اگه نمی‌دونی، بگو. هرگز اختراع نکن.
- یک منبع؟ بگو «یکی گفت.» سه تا؟ بگو «چند نفر.»
- هرگز قیمت حدس نزن. فقط اعداد تأییدشده.
- هرگز بیشتر از دو سؤال پشت سر هم نپرس.
- تو دلال نیستی. هیچ‌کس رو تبلیغ نکن.
- وقتی پست حرفه‌ای وجود داره، فقط اعلام کن. توصیف نکن.
- همیشه بین پیشنهادات دوستانه و حرفه‌ای فرق بذار.
- اگه نمی‌شناسی، صادقانه بگو. «نمی‌دونم» پاسخ معتبره.
- وقتی نمی‌دونی، همیشه بپرس کاربر اگه پیدا کرد بهت بگه.
- وقتی کاربر بهت چیزی یاد داد، ممنون باشه و بگو یادداشت کردی.`;

// ─── Assistant Manager ───

export class AssistantManager {
  private providers: Map<string, AssistantProvider> = new Map();
  private defaultProvider: string = '';

  registerProvider(provider: AssistantProvider, isDefault: boolean = false): void {
    this.providers.set(provider.name, provider);
    if (isDefault || this.providers.size === 1) {
      this.defaultProvider = provider.name;
    }
  }

  async chat(
    messages: AssistantMessage[],
    options?: AssistantOptions,
    providerName?: string
  ): Promise<AssistantResponse> {
    const name = providerName || this.defaultProvider;
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider "${name}" not found`);
    return provider.chat(messages, options);
  }

  async *stream(
    messages: AssistantMessage[],
    options?: AssistantOptions,
    providerName?: string
  ): AsyncIterable<AssistantChunk> {
    const name = providerName || this.defaultProvider;
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider "${name}" not found`);
    yield* provider.stream(messages, options);
  }
}

// ─── Phase 5 Exports ───

// Three Response Modes
export { ResponseModeEngine, type ResponseMode, type ModeDecision, type ResponseModeResult } from './response-modes';

// Tools
export {
  ToolExecutor,
  ASSISTANT_TOOLS,
  type AssistantToolCall,
  type ToolResult,
  type ToolDefinition,
  type ToolParameter,
  type SearchMemoriesParams,
  type SearchMemoriesResult,
  type MemorySearchResult,
  type OpenWaveParams,
  type OpenWaveResult,
  type AdmitUnknownParams,
  type AdmitUnknownResult,
  type RecordMemoryToolParams,
  type RecordMemoryToolResult,
} from './tools';

// Memory Service
export {
  MemoryService,
  type MemoryRecord,
  type MemorySearchParams,
  type RecordMemoryParams,
} from './memory-service';

// Post Service
export {
  PostService,
  type PostMedia,
  type ProfessionalPost,
  type CreatePostParams,
  type PostFeedParams,
  type PostFeedResult,
} from './post-service';

// Wave Service (Phase 6)
export {
  WaveService,
  type WaveRequest,
  type WaveResult,
  type WaveConfig,
} from './wave-service';

// Anti-Nuisance Service (Phase 6)
export {
  AntiNuisanceService,
  type AntiNuisanceConfig,
  type NotificationRecord,
  MAX_DAILY_NOTIFICATIONS,
  QUIET_HOURS_START,
  QUIET_HOURS_END,
  MIN_RESPONSES_TO_STOP,
  SILENCE_THRESHOLD,
  MAX_WEEKLY_EMERGENCY,
} from './anti-nuisance';

// Person Registry (Phase 6)
export {
  PersonRegistry,
  type PersonRecord,
  type PersonSearchParams,
} from './person-registry';

// Number Service (Phase 7)
export {
  NumberService,
  NumberStatus,
  type LockedNumber,
  type NumberComparison,
  type ComparisonResult,
} from './number-service';

// Learning Service (Phase 8)
export {
  LearningService,
  type LearnFromUserParams,
  type LearnResult,
  type LearningStats,
  type ConfidenceFactors,
  CONFIDENCE_WEIGHTS,
} from './learning-service';

// Memory Demand Service (Phase 8)
export {
  MemoryDemandService,
  type MemoryDemand,
  type DemandStatus,
  type CreateDemandParams,
  type FulfillDemandParams,
  type DemandSearchParams,
} from './memory-demand';

// License Verification Service (Phase 9)
export {
  LicenseVerificationService,
  type ProfessionalLicense,
  type LicenseStatus,
  type SubmitLicenseParams,
  type VerifyLicenseParams,
  type LicenseSearchParams,
} from './license-service';

// Professional Subscription Service (Phase 9)
export {
  ProfessionalSubscriptionService,
  SUBSCRIPTION_PLANS,
  type ProfessionalSubscription,
  type SubscriptionStatus,
  type ProfessionalStatus,
  type SubscriptionPlan,
  type RegisterProfessionalParams,
  type ActivateSubscriptionParams,
  type SubscriptionSearchParams,
} from './subscription-service';
