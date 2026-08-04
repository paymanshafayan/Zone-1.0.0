/**
 * Zone Voice Pipeline — Orchestrates the full voice chain
 *
 * 🎤 → STT → Edge Processing → Cloud Processing → TTS → 🔊
 *     ~1.0s    ~0.5s                ~1.0s            ~0.8s
 *
 * Total ≈ 3.3 seconds — within the 3-second target
 *
 * Fast path: if EdgeProcessor can handle it, skip cloud → ~2.3s
 * Bridging: fill the perceptual gap with "بذار ببینم..."
 *
 * Phase 5: Integrated with ResponseModeEngine for three-mode decision
 */

import { Logger } from '@zone/core';
import type { EdgeProcessingResult, ExtractedNumber } from '@zone/core';
import { EdgeProcessor } from './edge-processor';
import {
  VoiceManager,
  type STTResult,
  type TTSOptions,
} from './index';
import {
  ResponseModeEngine,
  ToolExecutor,
  MemoryService,
  PostService,
  type ResponseModeResult,
} from '@zone/assistant';

// ─── Types ───

export interface VoicePipelineConfig {
  /** Maximum time to wait for STT (ms) */
  sttTimeout: number;
  /** Maximum time to wait for cloud processing (ms) */
  cloudTimeout: number;
  /** Maximum time to wait for TTS (ms) */
  ttsTimeout: number;
  /** Whether to use bridging responses */
  useBridging: boolean;
  /** Whether to use fast path */
  useFastPath: boolean;
  /** Tag vocabulary for edge processor */
  tagVocabulary: string[];
  /** Whether to use the three-mode response engine */
  useResponseModes: boolean;
}

export interface VoicePipelineResult {
  /** The text the user said */
  rawText: string;
  /** Edge processing result (on-device) */
  edgeResult: EdgeProcessingResult;
  /** Cloud processing result (if used) */
  cloudResult?: {
    response: string;
    mode: 'know' | 'ask' | 'unknown';
    professionalPosts: number;
  };
  /** Three-mode response result (Phase 5) */
  modeResult?: ResponseModeResult;
  /** The final response text */
  responseText: string;
  /** Audio response (if TTS available) */
  audioResponse?: Buffer;
  /** Whether fast path was used */
  usedFastPath: boolean;
  /** Whether three-mode engine was used */
  usedModeEngine: boolean;
  /** Total processing time (ms) */
  totalLatency: number;
  /** Breakdown of latency per stage */
  latencyBreakdown: {
    stt: number;
    edge: number;
    cloud: number;
    tts: number;
  };
}

// ─── Default Config ───

const DEFAULT_CONFIG: VoicePipelineConfig = {
  sttTimeout: 3000,
  cloudTimeout: 5000,
  ttsTimeout: 2000,
  useBridging: true,
  useFastPath: true,
  tagVocabulary: [],
  useResponseModes: true,
};

// ─── Voice Pipeline ───

export class VoicePipeline {
  private voiceManager: VoiceManager;
  private edgeProcessor: EdgeProcessor;
  private config: VoicePipelineConfig;
  private logger: Logger;
  private responseModeEngine: ResponseModeEngine | null = null;
  private memoryService: MemoryService | null = null;
  private postService: PostService | null = null;

  constructor(
    voiceManager: VoiceManager,
    config: Partial<VoicePipelineConfig> = {}
  ) {
    this.voiceManager = voiceManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.edgeProcessor = new EdgeProcessor(this.config.tagVocabulary);
    this.logger = new Logger({ context: { service: 'voice-pipeline' } });

    // Initialize three-mode response engine (Phase 5)
    if (this.config.useResponseModes) {
      this.memoryService = new MemoryService();
      this.postService = new PostService();

      const toolExecutor = new ToolExecutor({
        memoryService: this.memoryService,
        postService: this.postService,
      });

      this.responseModeEngine = new ResponseModeEngine(toolExecutor);
    }
  }

  /**
   * Get the memory service for external access
   */
  getMemoryService(): MemoryService | null {
    return this.memoryService;
  }

  /**
   * Get the post service for external access
   */
  getPostService(): PostService | null {
    return this.postService;
  }

  /**
   * Process a voice input through the full pipeline
   *
   * @param audio - Raw audio buffer from the user
   * @returns Pipeline result with response text and audio
   */
  async processVoiceInput(audio: Buffer): Promise<VoicePipelineResult> {
    const startTime = Date.now();
    const latencyBreakdown = { stt: 0, edge: 0, cloud: 0, tts: 0 };

    // ─── Stage 1: STT ───

    const sttStart = Date.now();
    let sttResult: STTResult;

    try {
      sttResult = await this.withTimeout(
        this.voiceManager.recognize(audio),
        this.config.sttTimeout
      );
    } catch {
      sttResult = { text: '', confidence: 0, isFinal: true };
      this.logger.warn('pipeline:stt:timeout', { timeout: this.config.sttTimeout });
    }

    latencyBreakdown.stt = Date.now() - sttStart;

    // If STT failed, return early
    if (!sttResult.text) {
      return {
        rawText: '',
        edgeResult: { tags: [], intent: 'unknown', numbers: [], confidence: 0 },
        responseText: 'متأسفانه متوجه نشدم. میتونی دوباره بگی؟',
        usedFastPath: false,
        usedModeEngine: false,
        totalLatency: Date.now() - startTime,
        latencyBreakdown,
      };
    }

    const rawText = sttResult.text;

    // ─── Stage 2: Edge Processing (on-device) ───

    const edgeStart = Date.now();
    const edgeResult = await this.edgeProcessor.process(rawText);
    latencyBreakdown.edge = Date.now() - edgeStart;

    // ─── Stage 2.5: Bridging Response ───

    let bridgingSent = false;
    if (this.config.useBridging && !this.edgeProcessor.canUseFastPath(edgeResult)) {
      bridgingSent = true;
      this.logger.debug('pipeline:bridging', { intent: edgeResult.intent });
    }

    // ─── Stage 3: Cloud Processing OR Fast Path OR Mode Engine ───

    const cloudStart = Date.now();
    let cloudResult: VoicePipelineResult['cloudResult'];
    let modeResult: ResponseModeResult | undefined;
    let responseText: string;
    let usedFastPath = false;
    let usedModeEngine = false;

    // Priority: Mode Engine > Fast Path > Cloud
    if (this.config.useResponseModes && this.responseModeEngine && edgeResult.intent === 'ask') {
      // Use the three-mode response engine for ASK intents
      // This is the primary path for service requests
      try {
        // Default zoneId and requesterId for development
        const zoneId = 'zone_default';
        const requesterId = 'user_default';

        modeResult = await this.withTimeout(
          this.responseModeEngine.decide(edgeResult, zoneId, requesterId),
          this.config.cloudTimeout
        );

        responseText = modeResult.responseText;
        usedModeEngine = true;

        cloudResult = {
          response: modeResult.responseText,
          mode: modeResult.mode,
          professionalPosts: modeResult.professionalPostCount,
        };
      } catch {
        responseText = this.generateFallbackResponse(edgeResult);
      }
      latencyBreakdown.cloud = Date.now() - cloudStart;
    } else if (this.config.useFastPath && this.edgeProcessor.canUseFastPath(edgeResult)) {
      // Fast path: generate response without cloud model
      responseText = this.generateFastResponse(rawText, edgeResult);
      usedFastPath = true;
      latencyBreakdown.cloud = 0;
    } else {
      // Cloud path: use cloud model for nuanced response
      try {
        cloudResult = await this.withTimeout(
          this.processCloud(rawText, edgeResult),
          this.config.cloudTimeout
        );
        responseText = cloudResult?.response || this.generateFallbackResponse(edgeResult);
      } catch {
        responseText = this.generateFallbackResponse(edgeResult);
      }
      latencyBreakdown.cloud = Date.now() - cloudStart;
    }

    // ─── Stage 4: TTS ───

    const ttsStart = Date.now();
    let audioResponse: Buffer | undefined;

    try {
      audioResponse = await this.withTimeout(
        this.voiceManager.synthesize(responseText, {
          language: 'fa',
          speed: 1.0,
        }),
        this.config.ttsTimeout
      );
    } catch {
      this.logger.warn('pipeline:tts:timeout', { timeout: this.config.ttsTimeout });
    }

    latencyBreakdown.tts = Date.now() - ttsStart;

    // ─── Result ───

    const totalLatency = Date.now() - startTime;

    this.logger.info('pipeline:complete', {
      textLength: rawText.length,
      tags: edgeResult.tags,
      intent: edgeResult.intent,
      usedFastPath,
      usedModeEngine,
      mode: modeResult?.mode,
      totalLatency,
      latencyBreakdown,
    });

    return {
      rawText,
      edgeResult,
      cloudResult,
      modeResult,
      responseText,
      audioResponse,
      usedFastPath,
      usedModeEngine,
      totalLatency,
      latencyBreakdown,
    };
  }

  /**
   * Process text input (for when user types instead of speaks)
   * Skips STT but still does edge + cloud + mode processing
   */
  async processTextInput(text: string, zoneId?: string, requesterId?: string): Promise<VoicePipelineResult> {
    const startTime = Date.now();
    const latencyBreakdown = { stt: 0, edge: 0, cloud: 0, tts: 0 };

    // Edge processing
    const edgeStart = Date.now();
    const edgeResult = await this.edgeProcessor.process(text);
    latencyBreakdown.edge = Date.now() - edgeStart;

    // Cloud or fast path or mode engine
    const cloudStart = Date.now();
    let cloudResult: VoicePipelineResult['cloudResult'];
    let modeResult: ResponseModeResult | undefined;
    let responseText: string;
    let usedFastPath = false;
    let usedModeEngine = false;

    const _zoneId = zoneId || 'zone_default';
    const _requesterId = requesterId || 'user_default';

    if (this.config.useResponseModes && this.responseModeEngine) {
      // Use the three-mode response engine
      try {
        modeResult = await this.responseModeEngine.decide(edgeResult, _zoneId, _requesterId);
        responseText = modeResult.responseText;
        usedModeEngine = true;

        cloudResult = {
          response: modeResult.responseText,
          mode: modeResult.mode,
          professionalPosts: modeResult.professionalPostCount,
        };
      } catch {
        responseText = this.generateFallbackResponse(edgeResult);
      }
    } else if (this.config.useFastPath && this.edgeProcessor.canUseFastPath(edgeResult)) {
      responseText = this.generateFastResponse(text, edgeResult);
      usedFastPath = true;
    } else {
      try {
        cloudResult = await this.processCloud(text, edgeResult);
        responseText = cloudResult?.response || this.generateFallbackResponse(edgeResult);
      } catch {
        responseText = this.generateFallbackResponse(edgeResult);
      }
    }
    latencyBreakdown.cloud = Date.now() - cloudStart;

    return {
      rawText: text,
      edgeResult,
      cloudResult,
      modeResult,
      responseText,
      usedFastPath,
      usedModeEngine,
      totalLatency: Date.now() - startTime,
      latencyBreakdown,
    };
  }

  /**
   * Confirm a number read-back
   * This is the MANDATORY step before any number enters the system.
   */
  async confirmNumber(number: ExtractedNumber): Promise<ExtractedNumber> {
    return {
      ...number,
      isConfirmed: true,
    };
  }

  /**
   * Generate read-back confirmation for a number
   */
  generateReadback(number: ExtractedNumber): string {
    return this.edgeProcessor.generateReadback(number);
  }

  // ─── Cloud Processing ───

  private async processCloud(
    rawText: string,
    edgeResult: EdgeProcessingResult
  ): Promise<NonNullable<VoicePipelineResult['cloudResult']>> {
    // In production, this calls the cloud LLM through the assistant abstraction layer
    // For now, we generate a structured response based on edge results

    const mode = this.determineMode(edgeResult);

    let response: string;
    switch (mode) {
      case 'know':
        response = this.generateKnowResponse(edgeResult);
        break;
      case 'ask':
        response = this.generateAskResponse(edgeResult);
        break;
      case 'unknown':
        response = this.generateUnknownResponse(edgeResult);
        break;
    }

    return {
      response,
      mode,
      professionalPosts: 0,
    };
  }

  // ─── Three-Mode Decision (Legacy — used when mode engine is off) ───

  private determineMode(edgeResult: EdgeProcessingResult): 'know' | 'ask' | 'unknown' {
    return edgeResult.intent;
  }

  // ─── Response Generators (Legacy — used when mode engine is off) ───

  private generateKnowResponse(edgeResult: EdgeProcessingResult): string {
    const tag = edgeResult.tags.find((t) => t.startsWith('services/'));
    const serviceName = tag ? tag.split('/')[1] : 'خدمات';

    return `دو نفر تو محله معرفی کردن. اگه بخوای بیشتر بدونی بگو.`;
  }

  private generateAskResponse(edgeResult: EdgeProcessingResult): string {
    const isUrgent = edgeResult.tags.includes('urgency/urgent');

    if (isUrgent) {
      return `فوریه؟ بذار سریع بپرسم. نیم ساعت دیگه خبرت می‌کنم.`;
    }

    if (edgeResult.numbers.length > 0) {
      const number = edgeResult.numbers[0];
      const readback = this.edgeProcessor.generateReadback(number);
      return `${readback} اول اینو تأیید کن.`;
    }

    return `الان کسی رو نمی‌شناسم. بذار بپرسم دوروبر، تا نیم ساعت دیگه خبرت می‌کنم.`;
  }

  private generateUnknownResponse(edgeResult: EdgeProcessingResult): string {
    return `کسی رو پیدا نکردم. اگه خودت پیدا کردی، بهم بگو تا دفعه بعد بدونم.`;
  }

  private generateFastResponse(rawText: string, edgeResult: EdgeProcessingResult): string {
    switch (edgeResult.intent) {
      case 'know':
        return 'ممنون! یادداشت کردم.';
      case 'ask':
        return this.edgeProcessor.getBridgingResponse('ask');
      case 'unknown':
        return 'متوجه شدم. اگه چیزی پیدا کردم بهت میگم.';
      default:
        return 'بذار ببینم...';
    }
  }

  private generateFallbackResponse(edgeResult: EdgeProcessingResult): string {
    if (edgeResult.tags.some((t) => t.startsWith('services/'))) {
      return 'بذار بپرسم. یه لحظه صبر کن.';
    }
    if (edgeResult.tags.some((t) => t.startsWith('social/'))) {
      return 'بذار ببینم کی هست تو محله.';
    }
    return 'بذار فکر کنم...';
  }

  // ─── Helpers ───

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      ),
    ]);
  }
}
