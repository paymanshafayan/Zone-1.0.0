/**
 * Zone Voice — STT/TTS Integration + Edge Processing
 *
 * Abstraction layer for speech-to-text and text-to-speech services.
 * Uses domestic Persian services for latency and access.
 *
 * Phase 3: Added EdgeProcessor and VoicePipeline
 */

export interface STTProvider {
  name: string;
  recognize(audio: Buffer, options?: STTOptions): Promise<STTResult>;
  stream(options?: STTOptions): STTStream;
}

export interface STTOptions {
  language?: string;
  sampleRate?: number;
  encoding?: string;
}

export interface STTResult {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface STTStream {
  onResult(handler: (result: STTResult) => void): void;
  write(audio: Buffer): void;
  end(): void;
}

export interface TTSProvider {
  name: string;
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
  stream(options?: TTSOptions): TTSStream;
}

export interface TTSOptions {
  language?: string;
  voice?: string;
  speed?: number;
}

export interface TTSStream {
  onAudio(handler: (audio: Buffer) => void): void;
  write(text: string): void;
  end(): void;
}

// ─── Voice Manager ───

export class VoiceManager {
  private sttProvider: STTProvider | null = null;
  private ttsProvider: TTSProvider | null = null;

  setSTTProvider(provider: STTProvider): void {
    this.sttProvider = provider;
  }

  setTTSProvider(provider: TTSProvider): void {
    this.ttsProvider = provider;
  }

  async recognize(audio: Buffer, options?: STTOptions): Promise<STTResult> {
    if (!this.sttProvider) throw new Error('STT provider not configured');
    return this.sttProvider.recognize(audio, options);
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    if (!this.ttsProvider) throw new Error('TTS provider not configured');
    return this.ttsProvider.synthesize(text, options);
  }
}

// ─── Edge Processing ───

export { EdgeProcessor } from './edge-processor';

// ─── Voice Pipeline ───

export { VoicePipeline } from './voice-pipeline';
export type { VoicePipelineConfig, VoicePipelineResult } from './voice-pipeline';
