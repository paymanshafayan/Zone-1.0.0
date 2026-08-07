/**
 * Zone API Server — Main entry point
 *
 * Fastify-based HTTP server that serves as the primary API
 * for the Zone mobile app and external integrations.
 *
 * Phase 5: Added professional post routes and response mode routes
 * Phase 8: Added learning routes, memory demand routes
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { Queue } from 'bullmq';
import {
  EventBus,
  PluginRegistry,
  Logger,
  SpaceType,
} from '@zone/core';
import { ZoneRedis } from '@zone/redis';
import { FullTagService as TagService } from '@zone/tags';
import { ZoneSDK } from '@zone/sdk';
import { VoiceManager, VoicePipeline, EdgeProcessor } from '@zone/voice';
import {
  AssistantManager,
  ResponseModeEngine,
  ToolExecutor,
  MemoryService,
  PostService,
  LearningService,
  MemoryDemandService,
  LicenseVerificationService,
  ProfessionalSubscriptionService,
  ZONE_PERSONA,
  type CreatePostParams,
  type PostFeedParams,
  type RecordMemoryParams,
  type MemorySearchParams,
  type LearnFromUserParams,
  type RegisterProfessionalParams,
  type ActivateSubscriptionParams,
} from '@zone/assistant';

// ─── Hearing Space Service (shared with WS server via Redis) ───

interface SpaceInfo {
  id: string;
  zoneId: string;
  type: string;
  name?: string;
  tags: string[];
  radius?: number;
  reverberationTtl: number;
  memberCount: number;
  createdAt: string;
  expiresAt?: string;
}

class SpaceManager {
  private redis: ZoneRedis;
  private logger: Logger;

  constructor(redis: ZoneRedis) {
    this.redis = redis;
    this.logger = new Logger({ context: { service: 'space-manager' } });
  }

  async getSpace(spaceId: string): Promise<SpaceInfo | null> {
    const data = await this.redis.get(`space:${spaceId}`);
    return data ? JSON.parse(data) : null;
  }

  async getSpaceMembers(spaceId: string): Promise<string[]> {
    const keys = await this.redis.getKeys(`member:${spaceId}:*`);
    const members: string[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const member = JSON.parse(data);
        if (member.isActive) members.push(member.personId);
      }
    }
    return members;
  }

  async listSpaces(zoneId?: string): Promise<SpaceInfo[]> {
    const keys = await this.redis.getKeys('space:*');
    const spaces: SpaceInfo[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (!data) continue;
      try {
        const space = JSON.parse(data) as SpaceInfo;
        if (!zoneId || space.zoneId === zoneId) {
          spaces.push(space);
        }
      } catch {
        // skip malformed entries
      }
    }
    return spaces;
  }
}

// ─── Wave Job Queue (shared with apps/worker) ───

interface WaveJob {
  requestId: string;
  zoneId: string;
  tags: string[];
  radius: number;
  waveLevel: 1 | 2 | 3;
  requesterId: string;
  description: string;
  responseCount: number;
  centerLatitude?: number;
  centerLongitude?: number;
  urgency: 'normal' | 'urgent' | 'emergency';
}

function redisConnectionEnv(): { host: string; port: number } {
  // Prefer explicit REDIS_HOST/REDIS_PORT; fall back to parsing REDIS_URL.
  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
  }
  try {
    const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

/**
 * Real waveService adapter for the ToolExecutor.
 *
 * Previously `waveService` was null, so open_wave produced a fake
 * `wave_*` ID: no hearing space ever appeared in Redis and the worker's
 * BullMQ `zone-waves` queue was never fed.
 *
 * This adapter:
 * 1. Creates a REAL dynamic hearing space in Redis using the exact
 *    `space:{id}` layout the WS server understands (so clients can join).
 * 2. Enqueues the tiered broadcast wave for the worker to process.
 */
class RedisWaveServiceAdapter {
  private redis: ZoneRedis;
  private waveQueue: Queue<WaveJob> | null;
  private logger: Logger;

  constructor(redis: ZoneRedis, waveQueue: Queue<WaveJob> | null) {
    this.redis = redis;
    this.waveQueue = waveQueue;
    this.logger = new Logger({ context: { service: 'wave-adapter' } });
  }

  async createDynamicSpace(input: {
    zoneId: string;
    tags: string[];
    radius?: number;
    /** Milliseconds (ToolExecutor's getReverberationTTL returns ms) */
    reverberationTtl?: number;
    requesterId: string;
    description?: string;
  }): Promise<SpaceInfo> {
    const id = `dyn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const ttlMs = input.reverberationTtl || 2 * 60 * 60 * 1000; // 2h default
    const ttlSeconds = Math.max(60, Math.floor(ttlMs / 1000));

    const space: SpaceInfo = {
      id,
      zoneId: input.zoneId,
      type: SpaceType.DYNAMIC,
      tags: input.tags,
      radius: input.radius ?? 2500,
      reverberationTtl: ttlMs,
      memberCount: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    };

    // Same layout as apps/ws HearingSpaceService.createDynamicSpace
    await this.redis.set(`space:${id}`, JSON.stringify(space), ttlSeconds);

    // Enqueue the tiered broadcast wave (worker picks it up)
    if (this.waveQueue) {
      try {
        const urgency: WaveJob['urgency'] =
          input.tags.includes('urgency/emergency')
            ? 'emergency'
            : input.tags.includes('urgency/urgent')
              ? 'urgent'
              : 'normal';

        await this.waveQueue.add('wave', {
          requestId: id,
          zoneId: input.zoneId,
          tags: input.tags,
          radius: space.radius ?? 2500,
          waveLevel: 1,
          requesterId: input.requesterId,
          description: input.description || input.tags.join(', '),
          responseCount: 0,
          urgency,
        });
      } catch (err) {
        this.logger.warn('wave:enqueue:failed', { error: err });
      }
    }

    this.logger.info('wave:space:created', {
      spaceId: id,
      zoneId: input.zoneId,
      ttlSeconds,
    });

    return space;
  }
}

// ─── Bootstrap ───

async function main() {
  const logger = new Logger({ context: { service: 'api' } });

  logger.info('zone:api:starting', { version: '1.0.0' });

  // ─── Initialize Inner Core ───

  const eventBus = new EventBus();
  eventBus.setLogger((msg, data) => logger.debug(msg, data));

  const pluginRegistry = new PluginRegistry(eventBus);
  pluginRegistry.setLogger((msg, data) => logger.info(msg, data));

  // ─── Initialize Services ───

  const redis = new ZoneRedis(process.env.REDIS_URL || 'redis://localhost:6379');
  const tagService = new TagService();
  const spaceManager = new SpaceManager(redis);

  // Wave queue shared with apps/worker (BullMQ 'zone-waves').
  // If Redis is unavailable this is created lazily-safe: BullMQ only
  // connects on first use, and enqueue failures are caught.
  const waveQueue = new Queue<WaveJob>('zone-waves', {
    connection: redisConnectionEnv(),
  });
  const waveAdapter = new RedisWaveServiceAdapter(redis, waveQueue);

  // ─── Initialize Phase 5 Services ───

  const memoryService = new MemoryService();
  const postService = new PostService();

  // ─── Initialize Phase 8 Services ───

  const learningService = new LearningService(memoryService);

  // ─── Initialize Phase 9 Services ───

  const licenseService = new LicenseVerificationService();
  const subscriptionService = new ProfessionalSubscriptionService(licenseService, postService);

  const toolExecutor = new ToolExecutor({
    memoryService,
    postService,
    waveService: waveAdapter, // Real spaces + wave queue
    learningService,
  });

  const responseModeEngine = new ResponseModeEngine(toolExecutor, memoryService, postService);

  // ─── Initialize Voice Pipeline (Phase 3) ───

  const voiceManager = new VoiceManager();
  // TODO: Set STT/TTS providers when domestic services are configured

  const tagVocabulary = tagService.getAllPaths();
  const voicePipeline = new VoicePipeline(voiceManager, {
    tagVocabulary,
    useBridging: true,
    useFastPath: true,
    useResponseModes: true,
    // Share the same service instances as the rest of the API so the
    // voice pipeline sees the SAME knowledge base (memories/posts).
    memoryService,
    postService,
    responseModeEngine,
  });

  // ─── Initialize Outer Core SDK ───

  const sdk = new ZoneSDK(
    {
      apiUrl: process.env.API_URL || 'http://localhost:3000',
      wsUrl: process.env.WS_URL || 'ws://localhost:3001/ws',
      pluginName: 'system',
    },
    eventBus,
    pluginRegistry
  );

  // ─── Create Fastify Server ───

  const app = Fastify({
    logger: false,
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB for images/videos
    },
  });

  // ═══════════════════════════════════════════
  // ─── Health Check ─────────────────────────
  // ═══════════════════════════════════════════

  const healthHandler = async () => {
    const redisHealthy = await redis.healthCheck();
    return {
      status: redisHealthy ? 'ok' : 'degraded',
      version: '1.0.0',
      services: {
        redis: redisHealthy ? 'ok' : 'down',
      },
    };
  };

  app.get('/health', healthHandler);
  // The mobile client calls /api/health
  app.get('/api/health', healthHandler);

  // ═══════════════════════════════════════════
  // ─── Tag Routes (Phase 4 — Enhanced) ──────
  // ═══════════════════════════════════════════

  app.get('/api/tags', async () => {
    return tagService.getVocabulary();
  });

  app.get('/api/tags/search', async (request) => {
    const { q } = request.query as { q: string };
    if (!q) return { matches: [] };
    const matches = await tagService.suggest(q);
    return { matches };
  });

  app.get('/api/tags/paths', async () => {
    return { paths: tagService.getAllPaths() };
  });

  app.get('/api/tags/branch', async (request, reply) => {
    const { branch } = request.query as { branch: string };
    if (!branch) {
      return reply.status(400).send({ error: 'branch is required' });
    }
    const tags = tagService.getTagsByBranch(branch);
    return { tags };
  });

  // Path-style variant (the mobile client uses /api/tags/branch/:branch)
  app.get('/api/tags/branch/:branch', async (request) => {
    const { branch } = request.params as { branch: string };
    const tags = tagService.getTagsByBranch(branch);
    return { tags };
  });

  app.get('/api/tags/stats', async () => {
    return tagService.getStats();
  });

  app.post('/api/tags/demand', async (request, reply) => {
    // Accept both `concept` (canonical) and `tagPath` (mobile client)
    const body = request.body as { concept?: string; tagPath?: string };
    const concept = body.concept || body.tagPath;
    if (!concept) {
      return reply.status(400).send({ error: 'concept is required' });
    }
    const result = await tagService.demand(concept);
    return result;
  });

  app.get('/api/tags/demands/pending', async () => {
    return { demands: tagService.getPendingDemands() };
  });

  app.get('/api/tags/demands/queued', async () => {
    return { demands: tagService.getQueuedDemands() };
  });

  app.post('/api/tags/demands/approve', async (request, reply) => {
    const body = request.body as {
      concept: string;
      path: string;
      label: string;
      labelEn: string;
    };
    if (!body.concept || !body.path || !body.label || !body.labelEn) {
      return reply.status(400).send({
        error: 'concept, path, label, and labelEn are required',
      });
    }
    const result = tagService.approveDemand(body.concept, body.path, body.label, body.labelEn);
    return { approved: result };
  });

  app.post('/api/tags/demands/reject', async (request, reply) => {
    const body = request.body as { concept: string };
    if (!body.concept) {
      return reply.status(400).send({ error: 'concept is required' });
    }
    const result = tagService.rejectDemand(body.concept);
    return { rejected: result };
  });

  app.post('/api/tags/alias', async (request, reply) => {
    const body = request.body as { alias: string; tagPath: string };
    if (!body.alias || !body.tagPath) {
      return reply.status(400).send({ error: 'alias and tagPath are required' });
    }
    const result = tagService.addAlias(body.alias, body.tagPath);
    return { added: result };
  });

  app.get('/api/tags/sync', async (request) => {
    const { version } = request.query as { version?: string };
    const lastVersion = version ? parseInt(version, 10) : 0;
    const payload = tagService.generateSyncPayload(lastVersion);
    return payload;
  });

  // ─── Plugin Routes ───

  app.get('/api/plugins', async () => {
    return pluginRegistry.list();
  });

  // ─── Event Bus Monitor ───

  app.get('/api/events', async () => {
    return { events: eventBus.listEvents() };
  });

  // ═══════════════════════════════════════════
  // ─── Hearing Space Routes (Phase 2) ───────
  // ═══════════════════════════════════════════

  app.get('/api/spaces/:spaceId', async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    let space: SpaceInfo | null;
    let members: string[];
    try {
      space = await spaceManager.getSpace(spaceId);
      members = space ? await spaceManager.getSpaceMembers(spaceId) : [];
    } catch {
      return reply.status(503).send({ error: 'Space store unavailable' });
    }

    if (!space) {
      return reply.status(404).send({ error: 'Space not found' });
    }

    return {
      id: space.id,
      type: space.type,
      zoneId: space.zoneId,
      name: space.name,
      tags: space.tags,
      radius: space.radius,
      reverberationTtl: space.reverberationTtl,
      memberCount: members.length,
      members,
      createdAt: space.createdAt,
      expiresAt: space.expiresAt,
    };
  });

  app.get('/api/spaces/:spaceId/members', async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    try {
      const members = await spaceManager.getSpaceMembers(spaceId);
      return { members };
    } catch {
      return reply.status(503).send({ error: 'Space store unavailable' });
    }
  });

  app.get('/api/spaces', async (request, reply) => {
    const { zoneId } = request.query as { zoneId?: string };
    if (!zoneId) {
      return reply.status(400).send({ error: 'zoneId is required' });
    }
    let spaces: SpaceInfo[];
    try {
      spaces = await spaceManager.listSpaces(zoneId);
    } catch {
      return reply.status(503).send({ error: 'Space store unavailable' });
    }
    return {
      spaces: spaces.map((s) => ({
        id: s.id,
        type: s.type,
        zoneId: s.zoneId,
        name: s.name,
        tags: s.tags,
        radius: s.radius,
        memberCount: s.memberCount,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      note: 'Real-time updates come through WebSocket',
    };
  });

  // ─── Presence Routes ───

  app.get('/api/presence/:personId', async (request) => {
    const { personId } = request.params as { personId: string };
    const presence = await redis.getPresence(personId);
    return presence || { personId, online: false };
  });

  app.get('/api/presence/zone/:zoneId', async (request) => {
    const { zoneId } = request.params as { zoneId: string };
    const presence = await redis.getZonePresence(zoneId);
    return {
      zoneId,
      online: presence.map((p) => ({
        personId: p.personId,
        spaces: p.spaces,
        lastSeen: p.lastSeen,
      })),
    };
  });

  // ═══════════════════════════════════════════
  // ─── Voice Pipeline Routes (Phase 3) ──────
  // ═══════════════════════════════════════════

  app.post('/api/voice/process', async (request, reply) => {
    // Accept both `requesterId` (canonical) and `personId` (mobile client)
    const body = request.body as {
      text: string;
      zoneId?: string;
      requesterId?: string;
      personId?: string;
    };
    if (!body.text) {
      return reply.status(400).send({ error: 'text is required' });
    }

    const requesterId = body.requesterId || body.personId;

    try {
      const result = await voicePipeline.processTextInput(body.text, body.zoneId, requesterId);
      const mode = result.modeResult?.mode ?? result.cloudResult?.mode;
      return {
        // Mobile-client contract: the reply text and uppercase mode
        response: result.responseText,
        mode: mode ? mode.toUpperCase() : 'UNKNOWN',
        // Full result (canonical contract)
        rawText: result.rawText,
        edgeResult: {
          tags: result.edgeResult.tags,
          intent: result.edgeResult.intent,
          numbers: result.edgeResult.numbers.map((n) => ({
            raw: n.raw,
            value: n.value,
            unit: n.unit,
            isConfirmed: n.isConfirmed,
          })),
          confidence: result.edgeResult.confidence,
        },
        cloudResult: result.cloudResult,
        modeResult: result.modeResult ? {
          mode: result.modeResult.mode,
          decision: {
            mode: result.modeResult.decision.mode,
            confidence: result.modeResult.decision.confidence,
            reasoning: result.modeResult.decision.reasoning,
            toolName: result.modeResult.decision.toolName,
          },
          professionalPostCount: result.modeResult.professionalPostCount,
        } : undefined,
        responseText: result.responseText,
        usedFastPath: result.usedFastPath,
        usedModeEngine: result.usedModeEngine,
        totalLatency: result.totalLatency,
        latencyBreakdown: result.latencyBreakdown,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post('/api/voice/extract-tags', async (request, reply) => {
    const body = request.body as { text: string };
    if (!body.text) {
      return reply.status(400).send({ error: 'text is required' });
    }

    const edgeProcessor = new EdgeProcessor(tagVocabulary);
    const tags = edgeProcessor.extractTags(body.text);
    const intent = edgeProcessor.detectIntent(body.text, tags);
    const numbers = edgeProcessor.extractNumbers(body.text);

    return { tags, intent, numbers };
  });

  app.post('/api/voice/readback', async (request, reply) => {
    // Accept both `value` (canonical) and `amount` (mobile client)
    const body = request.body as {
      value?: number;
      amount?: number;
      rawSpeech?: string;
      unit?: string;
      basis?: string;
    };
    const value = body.value ?? body.amount;
    if (value === undefined || value === null) {
      return reply.status(400).send({ error: 'value is required' });
    }

    const edgeProcessor = new EdgeProcessor(tagVocabulary);
    const readback = edgeProcessor.generateReadback({
      raw: body.rawSpeech || '',
      value,
      unit: body.unit || 'toman',
      basis: body.basis || 'per_unit',
      isConfirmed: false,
    });

    return { readback };
  });

  app.post('/api/voice/confirm-number', async (request, reply) => {
    // Accept both `value` (canonical) and `amount` (mobile client)
    const body = request.body as {
      value?: number;
      amount?: number;
      numberId?: string;
      unit?: string;
      basis?: string;
      confirmed: boolean;
    };
    const value = body.value ?? body.amount;
    if (value === undefined || value === null) {
      return reply.status(400).send({ error: 'value is required' });
    }

    if (!body.confirmed) {
      return reply.status(400).send({
        error: 'Number not confirmed. Read-back confirmation is mandatory.',
      });
    }

    return {
      confirmed: true,
      value,
      unit: body.unit || 'toman',
      basis: body.basis || 'per_unit',
      lockedAt: new Date().toISOString(),
    };
  });

  // ═══════════════════════════════════════════
  // ─── Response Mode Routes (Phase 5) ───────
  // ═══════════════════════════════════════════

  /**
   * Determine the response mode for a request
   * POST /api/response-mode/decide
   */
  app.post('/api/response-mode/decide', async (request, reply) => {
    // Mobile client sends { skill, zoneId, personId } — map it to the
    // canonical { tags, intent, zoneId, requesterId } shape.
    const body = request.body as {
      tags?: string[];
      skill?: string;
      intent?: 'know' | 'ask' | 'unknown';
      numbers?: any[];
      confidence?: number;
      zoneId: string;
      requesterId?: string;
      personId?: string;
    };

    const tags = body.tags || (body.skill ? [`services/${body.skill}`] : []);
    const requesterId = body.requesterId || body.personId;

    if (tags.length === 0 || !body.zoneId || !requesterId) {
      return reply.status(400).send({
        error: 'tags (or skill), zoneId, and requesterId (or personId) are required',
      });
    }

    try {
      const result = await responseModeEngine.decide(
        {
          tags,
          intent: body.intent || 'ask',
          numbers: body.numbers || [],
          confidence: body.confidence ?? 0.5,
        },
        body.zoneId,
        requesterId
      );

      return {
        mode: result.mode,
        decision: {
          mode: result.decision.mode,
          confidence: result.decision.confidence,
          reasoning: result.decision.reasoning,
          toolName: result.decision.toolName,
        },
        responseText: result.responseText,
        professionalPostCount: result.professionalPostCount,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  /**
   * Get tool definitions for the assistant
   * GET /api/response-mode/tools
   */
  app.get('/api/response-mode/tools', async () => {
    return { tools: toolExecutor.getToolDefinitions() };
  });

  // ═══════════════════════════════════════════
  // ─── Memory Routes (Phase 5) ──────────────
  // ═══════════════════════════════════════════

  /**
   * Search neighbourhood memories
   * GET /api/memories/search?skill=X&zoneId=Y
   */
  app.get('/api/memories/search', async (request, reply) => {
    const { skill, zoneId, minConfidence, maxResults } = request.query as {
      skill: string;
      zoneId: string;
      minConfidence?: string;
      maxResults?: string;
    };

    if (!skill || !zoneId) {
      return reply.status(400).send({ error: 'skill and zoneId are required' });
    }

    const results = await memoryService.search({
      skill,
      zoneId,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0.3,
      maxResults: maxResults ? parseInt(maxResults, 10) : 5,
    });

    return { memories: results };
  });

  /**
   * Record a new memory
   * POST /api/memories
   */
  app.post('/api/memories', async (request, reply) => {
    const body = request.body as Partial<RecordMemoryParams>;

    if (!body.zoneId || !body.personId || !body.skill) {
      return reply.status(400).send({
        error: 'zoneId, personId, and skill are required',
      });
    }

    // Sensible defaults: a memory without names/attribution uses the
    // person IDs (the mobile client may pass only IDs).
    const params: RecordMemoryParams = {
      zoneId: body.zoneId,
      personId: body.personId,
      personName: body.personName || body.personId,
      skill: body.skill,
      description: body.description || '',
      outcome: body.outcome || 'neutral',
      sourcePersonId: body.sourcePersonId || body.personId,
      sourcePersonName: body.sourcePersonName || body.sourcePersonId || body.personId,
    };

    const record = await memoryService.record(params);
    return { memory: record };
  });

  /**
   * Get memory statistics for a zone
   * GET /api/memories/stats?zoneId=X
   */
  app.get('/api/memories/stats', async (request) => {
    // zoneId is optional — the mobile client asks for global stats.
    const { zoneId } = request.query as { zoneId?: string };

    if (zoneId) {
      return memoryService.getStats(zoneId);
    }

    // Aggregate stats across all zones
    const zoneIds = memoryService.listZones();
    const allSkills = new Set<string>();
    let totalMemories = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const zid of zoneIds) {
      const stats = memoryService.getStats(zid);
      totalMemories += stats.totalMemories;
      for (const skill of stats.skills) allSkills.add(skill);
      if (stats.totalMemories > 0) {
        confidenceSum += stats.averageConfidence * stats.totalMemories;
        confidenceCount += stats.totalMemories;
      }
    }

    return {
      totalMemories,
      skills: Array.from(allSkills),
      averageConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
    };
  });

  /**
   * List all memories for a zone
   * GET /api/memories?zoneId=X
   */
  app.get('/api/memories', async (request, reply) => {
    const { zoneId } = request.query as { zoneId: string };
    if (!zoneId) {
      return reply.status(400).send({ error: 'zoneId is required' });
    }

    const memories = memoryService.listByZone(zoneId);
    return { memories };
  });

  // ═══════════════════════════════════════════
  // ─── Professional Post Routes (Phase 5) ───
  // ═══════════════════════════════════════════

  /**
   * Create a new professional post
   * POST /api/posts
   */
  app.post('/api/posts', async (request, reply) => {
    const body = request.body as CreatePostParams;

    if (!body.zoneId || !body.providerId || !body.description || !body.tags) {
      return reply.status(400).send({
        error: 'zoneId, providerId, description, and tags are required',
      });
    }

    if (!body.media || body.media.length === 0) {
      return reply.status(400).send({
        error: 'At least one media item (image or video) is required',
      });
    }

    try {
      // providerName is optional on the wire (the mobile client only
      // sends providerId) — PostService defaults it to providerId.
      const post = await postService.create(body);
      return { post };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Get the visual feed for a zone
   * GET /api/posts?zoneId=X&tags=Y&page=1&pageSize=20
   *
   * Also accepts the mobile-client pagination shape:
   * GET /api/posts?zoneId=X&tag=Y&limit=20&offset=40
   */
  app.get('/api/posts', async (request, reply) => {
    const { zoneId, tags, tag, page, pageSize, limit, offset, includeInactive } =
      request.query as {
        zoneId: string;
        tags?: string;
        tag?: string;
        page?: string;
        pageSize?: string;
        limit?: string;
        offset?: string;
        includeInactive?: string;
      };

    if (!zoneId) {
      return reply.status(400).send({ error: 'zoneId is required' });
    }

    // Pagination: page/pageSize (canonical) OR limit/offset (mobile)
    let resolvedPageSize = pageSize ? parseInt(pageSize, 10) : 20;
    let resolvedPage = page ? parseInt(page, 10) : 1;

    if (limit) {
      resolvedPageSize = parseInt(limit, 10);
      if (offset) {
        resolvedPage = Math.floor(parseInt(offset, 10) / resolvedPageSize) + 1;
      }
    }

    // Tags: comma-separated `tags` (canonical) OR single `tag` (mobile)
    const resolvedTags = tags
      ? tags.split(',')
      : tag
        ? [tag]
        : undefined;

    const feedParams: PostFeedParams = {
      zoneId,
      tags: resolvedTags,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      includeInactive: includeInactive === 'true',
    };

    const result = await postService.getFeed(feedParams);
    return result;
  });

  /**
   * Get a single post
   * GET /api/posts/:postId
   */
  app.get('/api/posts/:postId', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const post = await postService.get(postId);

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' });
    }

    return { post };
  });

  /**
   * Update a post
   * PUT /api/posts/:postId
   */
  app.put('/api/posts/:postId', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const body = request.body as {
      description?: string;
      tags?: string[];
      media?: any[];
      isSponsored?: boolean;
    };

    try {
      const post = await postService.update(postId, body);
      if (!post) return reply.status(404).send({ error: 'Post not found' });
      return { post };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Deactivate a post (soft delete)
   * DELETE /api/posts/:postId
   */
  app.delete('/api/posts/:postId', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const deleted = await postService.deactivate(postId);

    if (!deleted) return reply.status(404).send({ error: 'Post not found' });

    return { deactivated: true };
  });

  /**
   * Get professional post count for a zone+tags
   * GET /api/posts/count?zoneId=X&tags=Y
   */
  app.get('/api/posts/count', async (request, reply) => {
    const { zoneId, tags } = request.query as {
      zoneId: string;
      tags?: string;
    };

    if (!zoneId) {
      return reply.status(400).send({ error: 'zoneId is required' });
    }

    const count = await postService.getPostCount(
      zoneId,
      tags ? tags.split(',') : undefined
    );

    return { count };
  });

  /**
   * Get posts by a specific provider
   * GET /api/posts/provider/:providerId
   */
  app.get('/api/posts/provider/:providerId', async (request) => {
    const { providerId } = request.params as { providerId: string };
    const posts = await postService.getByProvider(providerId);
    return { posts };
  });

  /**
   * Like a post
   * POST /api/posts/:postId/like
   */
  app.post('/api/posts/:postId/like', async (request, reply) => {
    const { postId } = request.params as { postId: string };
    const liked = await postService.like(postId);

    if (!liked) return reply.status(404).send({ error: 'Post not found' });

    return { liked: true };
  });

  // ═══════════════════════════════════════════
  // ─── Learning Routes (Phase 8) ────────────
  // ═══════════════════════════════════════════

  /**
   * Learn from a user's report-back
   * POST /api/learning/learn
   *
   * The core learning endpoint. When a user reports back
   * after finding someone (from UNKNOWN mode), the system
   * records a memory and fulfills the demand.
   *
   * This is how Zone grows: "اگه خودت پیدا کردی، بهم بگو"
   */
  app.post('/api/learning/learn', async (request, reply) => {
    // Mobile client omits sourcePersonId/sourcePersonName — default to
    // the reporting person (a self-report is a valid learning signal).
    const body = request.body as Partial<LearnFromUserParams> & {
      demandId?: string;
    };

    if (!body.zoneId || !body.personId || !body.skill) {
      return reply.status(400).send({
        error: 'zoneId, personId, and skill are required',
      });
    }

    const params: LearnFromUserParams = {
      zoneId: body.zoneId,
      personId: body.personId,
      personName: body.personName || body.personId,
      skill: body.skill,
      description: body.description || '',
      outcome: body.outcome || 'positive',
      sourcePersonId: body.sourcePersonId || body.personId,
      sourcePersonName: body.sourcePersonName || body.sourcePersonId || body.personId,
      demandId: body.demandId,
    };

    try {
      const result = await learningService.learnFromUser(params);

      // Emit learning events
      eventBus.emit('memory.recorded', {
        memoryId: result.memory.id,
        personId: body.personId,
        skill: body.skill,
        zoneId: body.zoneId,
        outcome: body.outcome,
        confidence: result.confidence,
        fromLearningLoop: !!result.fulfilledDemand,
      });

      if (result.fulfilledDemand) {
        eventBus.emit('memory.demand.fulfilled', {
          demandId: result.fulfilledDemand.id,
          memoryId: result.memory.id,
          skill: body.skill,
          zoneId: body.zoneId,
          timeToLearn: result.timeToLearn || 0,
        });
      }

      return {
        success: true,
        memory: {
          id: result.memory.id,
          personName: result.memory.personName,
          skill: result.memory.skill,
          outcome: result.memory.outcome,
          confidence: result.confidence,
          credibility: result.credibility,
        },
        fulfilledDemand: !!result.fulfilledDemand,
        demandId: result.fulfilledDemand?.id,
        timeToLearn: result.timeToLearn,
        responseText: result.responseText,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Record a memory directly (simple recording, no learning loop)
   * POST /api/learning/record
   *
   * Used when a user shares a recommendation directly,
   * not from a demand fulfillment.
   */
  app.post('/api/learning/record', async (request, reply) => {
    // Same tolerant body handling as /api/learning/learn
    const body = request.body as Partial<LearnFromUserParams> & {
      demandId?: string;
    };

    if (!body.zoneId || !body.personId || !body.skill) {
      return reply.status(400).send({
        error: 'zoneId, personId, and skill are required',
      });
    }

    const params: LearnFromUserParams = {
      zoneId: body.zoneId,
      personId: body.personId,
      personName: body.personName || body.personId,
      skill: body.skill,
      description: body.description || '',
      outcome: body.outcome || 'positive',
      sourcePersonId: body.sourcePersonId || body.personId,
      sourcePersonName: body.sourcePersonName || body.sourcePersonId || body.personId,
      demandId: body.demandId,
    };

    try {
      const result = await learningService.learnFromUser(params);

      eventBus.emit('memory.recorded', {
        memoryId: result.memory.id,
        personId: body.personId,
        skill: body.skill,
        zoneId: body.zoneId,
        outcome: body.outcome,
        confidence: result.confidence,
        fromLearningLoop: !!result.fulfilledDemand,
      });

      return {
        success: true,
        memory: {
          id: result.memory.id,
          personName: result.memory.personName,
          skill: result.memory.skill,
          outcome: result.memory.outcome,
          confidence: result.confidence,
        },
        responseText: result.responseText,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Get open learning demands for a user
   * GET /api/learning/demands?requesterId=X
   *
   * Shows the user their pending learning requests.
   * "یه نقاش می‌خواستم" → still open
   */
  app.get('/api/learning/demands', async (request) => {
    // Accept both `requesterId` (canonical) and `personId` (mobile client)
    const { requesterId, personId, zoneId, skill, status } = request.query as {
      requesterId?: string;
      personId?: string;
      zoneId?: string;
      skill?: string;
      status?: string;
    };

    const demandService = learningService.getDemandService();

    const demands = demandService.search({
      requesterId: requesterId || personId,
      zoneId,
      skill,
      status: status as any,
    });

    return { demands };
  });

  /**
   * Get a specific demand
   * GET /api/learning/demands/:demandId
   */
  app.get('/api/learning/demands/:demandId', async (request, reply) => {
    const { demandId } = request.params as { demandId: string };
    const demandService = learningService.getDemandService();
    const demand = demandService.get(demandId);

    if (!demand) {
      return reply.status(404).send({ error: 'Demand not found' });
    }

    return { demand };
  });

  /**
   * Cancel a learning demand
   * POST /api/learning/demands/:demandId/cancel
   */
  app.post('/api/learning/demands/:demandId/cancel', async (request, reply) => {
    const { demandId } = request.params as { demandId: string };
    const demandService = learningService.getDemandService();
    const cancelled = demandService.cancel(demandId);

    if (!cancelled) {
      return reply.status(404).send({ error: 'Demand not found or not open' });
    }

    return { cancelled: true };
  });

  /**
   * Get learning statistics
   * GET /api/learning/stats?zoneId=X
   *
   * Shows how well Zone is learning in this neighbourhood.
   */
  app.get('/api/learning/stats', async (request) => {
    const { zoneId } = request.query as { zoneId?: string };
    return learningService.getStats(zoneId);
  });

  /**
   * Search memories with learning context
   * GET /api/learning/search?skill=X&zoneId=Y
   *
   * Returns memories AND open demands for a skill+zone.
   * If there are open demands, we know the neighbourhood is interested.
   */
  app.get('/api/learning/search', async (request, reply) => {
    const { skill, zoneId, minConfidence, maxResults } = request.query as {
      skill: string;
      zoneId: string;
      minConfidence?: string;
      maxResults?: string;
    };

    if (!skill || !zoneId) {
      return reply.status(400).send({ error: 'skill and zoneId are required' });
    }

    try {
      const result = await learningService.searchWithContext({
        skill,
        zoneId,
        minConfidence: minConfidence ? parseFloat(minConfidence) : 0.3,
        maxResults: maxResults ? parseInt(maxResults, 10) : 5,
      });

      return {
        memories: result.memories,
        openDemands: result.openDemands,
        demandCount: result.demandCount,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════
  // ─── Professional Routes (Phase 9) ────────
  // ═══════════════════════════════════════════

  /**
   * Register as a professional provider
   * POST /api/professional/register
   *
   * Flow:
   * 1. Submit license (image + unique number)
   * 2. License is verified by external site
   * 3. If verified, create pending subscription
   * 4. Return payment URL for external payment
   */
  app.post('/api/professional/register', async (request, reply) => {
    // Two shapes are accepted:
    //   canonical: { personId, personName, zoneId, license: {...}, planId }
    //   mobile:    { personId, profession, licenseNumber, licenseImageUrl }
    const body = request.body as Partial<RegisterProfessionalParams> & {
      profession?: string;
      licenseNumber?: string;
      licenseImageUrl?: string;
    };

    const isMobileShape = !body.license && body.licenseNumber;

    if (!body.personId) {
      return reply.status(400).send({ error: 'personId is required' });
    }
    if (!isMobileShape && (!body.zoneId || !body.license || !body.planId)) {
      return reply.status(400).send({
        error: 'personId, zoneId, license, and planId are required',
      });
    }

    // Normalize to the canonical shape
    const params: RegisterProfessionalParams = isMobileShape
      ? {
          personId: body.personId,
          personName: body.personName || body.personId,
          zoneId: body.zoneId || 'zone_default',
          planId: body.planId || 'monthly',
          license: {
            personId: body.personId,
            personName: body.personName || body.personId,
            licenseNumber: body.licenseNumber!,
            licenseImageUrl: body.licenseImageUrl || '',
            profession: body.profession || 'repair',
            zoneId: body.zoneId || 'zone_default',
          },
        }
      : {
          personId: body.personId,
          personName: body.personName || body.personId,
          zoneId: body.zoneId!,
          license: body.license!,
          planId: body.planId!,
        };

    try {
      const result = await subscriptionService.registerProfessional(params);

      // Emit events
      eventBus.emit('license.submitted', {
        licenseId: result.license.id,
        personId: params.personId,
        profession: result.license.profession,
        licenseNumber: result.license.licenseNumber,
      });

      eventBus.emit('professional.registered', {
        personId: params.personId,
        zoneId: params.zoneId,
        profession: result.license.profession,
        subscriptionId: result.subscription.id,
      });

      return {
        success: true,
        subscription: {
          id: result.subscription.id,
          status: result.subscription.status,
          planId: result.subscription.planId,
        },
        license: {
          id: result.license.id,
          status: result.license.status,
          licenseNumber: result.license.licenseNumber,
        },
        paymentUrl: result.paymentUrl,
        responseText: result.responseText,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Activate subscription after external payment
   * POST /api/professional/activate
   *
   * Called by the external payment gateway callback.
   * ⚠️ The app NEVER processes payment directly.
   */
  app.post('/api/professional/activate', async (request, reply) => {
    // Two shapes are accepted:
    //   canonical (gateway callback): { subscriptionId, paymentReference }
    //   mobile:                       { personId, planId, paymentReference }
    const body = request.body as Partial<ActivateSubscriptionParams> & {
      personId?: string;
      planId?: string;
    };

    let subscriptionId = body.subscriptionId;

    if (!subscriptionId && body.personId) {
      // Resolve the person's most recent pending subscription
      const pending = subscriptionService.search({
        personId: body.personId,
        status: 'pending',
      });
      const match = body.planId
        ? pending.find((s) => s.planId === body.planId) || pending[pending.length - 1]
        : pending[pending.length - 1];
      subscriptionId = match?.id;
    }

    if (!subscriptionId || !body.paymentReference) {
      return reply.status(400).send({
        error: 'subscriptionId (or personId) and paymentReference are required',
      });
    }

    try {
      const subscription = await subscriptionService.activateSubscription({
        subscriptionId,
        paymentReference: body.paymentReference,
      });

      if (!subscription) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }

      // Emit events
      eventBus.emit('subscription.activated', {
        subscriptionId: subscription.id,
        personId: subscription.personId,
        planId: subscription.planId,
        expiresAt: subscription.expiresAt!,
      });

      return {
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          startedAt: subscription.startedAt,
          expiresAt: subscription.expiresAt,
        },
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Verify a license (admin or external callback)
   * POST /api/professional/license/verify
   */
  app.post('/api/professional/license/verify', async (request, reply) => {
    // Mobile client omits verifiedBy (defaults to 'system')
    const body = request.body as {
      licenseId: string;
      approved: boolean;
      verifiedBy?: string;
      rejectionReason?: string;
      verificationReference?: string;
      expiresAt?: string;
    };

    if (!body.licenseId || body.approved === undefined) {
      return reply.status(400).send({
        error: 'licenseId and approved are required',
      });
    }

    try {
      const license = await licenseService.verifyLicense({
        licenseId: body.licenseId,
        approved: body.approved,
        verifiedBy: body.verifiedBy || 'system',
        rejectionReason: body.rejectionReason,
        verificationReference: body.verificationReference,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      if (!license) {
        return reply.status(404).send({
          error: 'License not found or not pending',
        });
      }

      // Emit events
      if (body.approved) {
        eventBus.emit('license.verified', {
          licenseId: license.id,
          personId: license.personId,
          verifiedBy: body.verifiedBy,
        });
      } else {
        eventBus.emit('license.rejected', {
          licenseId: license.id,
          personId: license.personId,
          rejectionReason: body.rejectionReason || '',
        });
      }

      return {
        success: true,
        license: {
          id: license.id,
          status: license.status,
          verifiedAt: license.verifiedAt,
          rejectionReason: license.rejectionReason,
        },
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Get professional status for a person
   * GET /api/professional/status/:personId
   */
  app.get('/api/professional/status/:personId', async (request) => {
    const { personId } = request.params as { personId: string };
    const status = subscriptionService.getProfessionalStatus(personId);
    return {
      ...status,
      // Mobile-client contract key
      professionalStatus: status.status,
    };
  });

  /**
   * Get subscription plans
   * GET /api/professional/plans
   */
  app.get('/api/professional/plans', async () => {
    return { plans: subscriptionService.getPlans() };
  });

  /**
   * Get subscription details
   * GET /api/professional/subscription/:subscriptionId
   */
  app.get('/api/professional/subscription/:subscriptionId', async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string };
    const subscription = subscriptionService.get(subscriptionId);

    if (!subscription) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    return { subscription };
  });

  /**
   * Renew a subscription
   * POST /api/professional/renew
   */
  app.post('/api/professional/renew', async (request, reply) => {
    // planId is optional — defaults to the subscription's current plan
    // (the mobile client renews with just subscriptionId + paymentReference).
    const body = request.body as {
      subscriptionId: string;
      planId?: string;
      paymentReference: string;
    };

    if (!body.subscriptionId || !body.paymentReference) {
      return reply.status(400).send({
        error: 'subscriptionId and paymentReference are required',
      });
    }

    const existing = subscriptionService.get(body.subscriptionId);
    if (!existing) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    try {
      const subscription = await subscriptionService.renewSubscription(
        body.subscriptionId,
        body.planId || existing.planId,
        body.paymentReference
      );

      if (!subscription) {
        return reply.status(404).send({ error: 'Subscription not found' });
      }

      eventBus.emit('subscription.activated', {
        subscriptionId: subscription.id,
        personId: subscription.personId,
        planId: subscription.planId,
        expiresAt: subscription.expiresAt!,
      });

      return {
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          expiresAt: subscription.expiresAt,
        },
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  /**
   * Cancel a subscription
   * POST /api/professional/cancel/:subscriptionId
   */
  app.post('/api/professional/cancel/:subscriptionId', async (request, reply) => {
    const { subscriptionId } = request.params as { subscriptionId: string };

    const cancelled = await subscriptionService.cancelSubscription(subscriptionId);

    if (!cancelled) {
      return reply.status(404).send({ error: 'Subscription not found' });
    }

    const subscription = subscriptionService.get(subscriptionId);

    eventBus.emit('subscription.cancelled', {
      subscriptionId,
      personId: subscription?.personId || '',
    });

    return { cancelled: true };
  });

  /**
   * Check subscription expirations
   * POST /api/professional/check-expirations
   *
   * Called periodically (e.g. cron job) to expire subscriptions
   * that have passed their expiry date.
   */
  app.post('/api/professional/check-expirations', async () => {
    const expiredIds = await subscriptionService.checkExpirations();

    for (const id of expiredIds) {
      const subscription = subscriptionService.get(id);
      if (subscription) {
        eventBus.emit('subscription.expired', {
          subscriptionId: id,
          personId: subscription.personId,
        });
      }
    }

    return { expiredCount: expiredIds.length, expiredIds };
  });

  /**
   * Get license statistics
   * GET /api/professional/license/stats
   */
  app.get('/api/professional/license/stats', async () => {
    return licenseService.getStats();
  });

  /**
   * Get subscription statistics
   * GET /api/professional/subscription/stats
   */
  app.get('/api/professional/subscription/stats', async () => {
    return subscriptionService.getStats();
  });

  /**
   * Search licenses
   * GET /api/professional/licenses?status=pending
   */
  app.get('/api/professional/licenses', async (request) => {
    const { personId, zoneId, status, profession } = request.query as {
      personId?: string;
      zoneId?: string;
      status?: string;
      profession?: string;
    };

    const licenses = licenseService.search({
      personId,
      zoneId,
      status: status as any,
      profession,
    });

    return { licenses };
  });

  /**
   * Search subscriptions
   * GET /api/professional/subscriptions?status=active
   */
  app.get('/api/professional/subscriptions', async (request) => {
    const { personId, zoneId, status, profession } = request.query as {
      personId?: string;
      zoneId?: string;
      status?: string;
      profession?: string;
    };

    const subscriptions = subscriptionService.search({
      personId,
      zoneId,
      status: status as any,
      profession,
    });

    return { subscriptions };
  });

  // ─── Start Server ───

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    logger.info('zone:api:listening', { port, host });
  } catch (err) {
    logger.error('zone:api:failed', { error: err });
    process.exit(1);
  }

  // ─── Graceful Shutdown ───

  const shutdown = async (signal: string) => {
    logger.info('zone:api:shutting_down', { signal });
    await app.close();
    await waveQueue.close();
    await redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
