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
import {
  EventBus,
  PluginRegistry,
  Logger,
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
    waveService: null, // Will be connected to WS server
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

  app.get('/health', async () => {
    const redisHealthy = await redis.healthCheck();
    return {
      status: redisHealthy ? 'ok' : 'degraded',
      version: '1.0.0',
      services: {
        redis: redisHealthy ? 'ok' : 'down',
      },
    };
  });

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

  app.get('/api/tags/branch', async (request) => {
    const { branch } = request.query as { branch: string };
    if (!branch) return { error: 'branch is required' };
    const tags = tagService.getTagsByBranch(branch);
    return { tags };
  });

  app.get('/api/tags/stats', async () => {
    return tagService.getStats();
  });

  app.post('/api/tags/demand', async (request) => {
    const body = request.body as { concept: string };
    if (!body.concept) return { error: 'concept is required' };
    const result = await tagService.demand(body.concept);
    return result;
  });

  app.get('/api/tags/demands/pending', async () => {
    return { demands: tagService.getPendingDemands() };
  });

  app.get('/api/tags/demands/queued', async () => {
    return { demands: tagService.getQueuedDemands() };
  });

  app.post('/api/tags/demands/approve', async (request) => {
    const body = request.body as {
      concept: string;
      path: string;
      label: string;
      labelEn: string;
    };
    if (!body.concept || !body.path || !body.label || !body.labelEn) {
      return { error: 'concept, path, label, and labelEn are required' };
    }
    const result = tagService.approveDemand(body.concept, body.path, body.label, body.labelEn);
    return { approved: result };
  });

  app.post('/api/tags/demands/reject', async (request) => {
    const body = request.body as { concept: string };
    if (!body.concept) return { error: 'concept is required' };
    const result = tagService.rejectDemand(body.concept);
    return { rejected: result };
  });

  app.post('/api/tags/alias', async (request) => {
    const body = request.body as { alias: string; tagPath: string };
    if (!body.alias || !body.tagPath) return { error: 'alias and tagPath are required' };
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

  app.get('/api/spaces/:spaceId', async (request) => {
    const { spaceId } = request.params as { spaceId: string };
    const space = await spaceManager.getSpace(spaceId);

    if (!space) {
      return { error: 'Space not found' };
    }

    const members = await spaceManager.getSpaceMembers(spaceId);

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

  app.get('/api/spaces/:spaceId/members', async (request) => {
    const { spaceId } = request.params as { spaceId: string };
    const members = await spaceManager.getSpaceMembers(spaceId);
    return { members };
  });

  app.get('/api/spaces', async (request) => {
    const { zoneId } = request.query as { zoneId: string };
    if (!zoneId) return { error: 'zoneId is required' };
    return { spaces: [], note: 'Use WebSocket for real-time space management' };
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

  app.post('/api/voice/process', async (request) => {
    const body = request.body as { text: string; zoneId?: string; requesterId?: string };
    if (!body.text) return { error: 'text is required' };

    try {
      const result = await voicePipeline.processTextInput(body.text, body.zoneId, body.requesterId);
      return {
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
      return { error: err.message };
    }
  });

  app.post('/api/voice/extract-tags', async (request) => {
    const body = request.body as { text: string };
    if (!body.text) return { error: 'text is required' };

    const edgeProcessor = new EdgeProcessor(tagVocabulary);
    const tags = edgeProcessor.extractTags(body.text);
    const intent = edgeProcessor.detectIntent(body.text, tags);
    const numbers = edgeProcessor.extractNumbers(body.text);

    return { tags, intent, numbers };
  });

  app.post('/api/voice/readback', async (request) => {
    const body = request.body as {
      value: number;
      unit: string;
      basis: string;
    };
    if (!body.value) return { error: 'value is required' };

    const edgeProcessor = new EdgeProcessor(tagVocabulary);
    const readback = edgeProcessor.generateReadback({
      raw: '',
      value: body.value,
      unit: body.unit || 'toman',
      basis: body.basis || 'per_unit',
      isConfirmed: false,
    });

    return { readback };
  });

  app.post('/api/voice/confirm-number', async (request) => {
    const body = request.body as {
      value: number;
      unit: string;
      basis: string;
      confirmed: boolean;
    };
    if (!body.value) return { error: 'value is required' };

    if (!body.confirmed) {
      return { error: 'Number not confirmed. Read-back confirmation is mandatory.' };
    }

    return {
      confirmed: true,
      value: body.value,
      unit: body.unit,
      basis: body.basis,
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
  app.post('/api/response-mode/decide', async (request) => {
    const body = request.body as {
      tags: string[];
      intent: 'know' | 'ask' | 'unknown';
      numbers?: any[];
      confidence: number;
      zoneId: string;
      requesterId: string;
    };

    if (!body.tags || !body.zoneId || !body.requesterId) {
      return { error: 'tags, zoneId, and requesterId are required' };
    }

    try {
      const result = await responseModeEngine.decide(
        {
          tags: body.tags,
          intent: body.intent,
          numbers: body.numbers || [],
          confidence: body.confidence,
        },
        body.zoneId,
        body.requesterId
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
      return { error: err.message };
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
  app.get('/api/memories/search', async (request) => {
    const { skill, zoneId, minConfidence, maxResults } = request.query as {
      skill: string;
      zoneId: string;
      minConfidence?: string;
      maxResults?: string;
    };

    if (!skill || !zoneId) return { error: 'skill and zoneId are required' };

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
  app.post('/api/memories', async (request) => {
    const body = request.body as RecordMemoryParams;

    if (!body.zoneId || !body.personId || !body.skill || !body.sourcePersonId) {
      return { error: 'zoneId, personId, skill, and sourcePersonId are required' };
    }

    const record = await memoryService.record(body);
    return { memory: record };
  });

  /**
   * Get memory statistics for a zone
   * GET /api/memories/stats?zoneId=X
   */
  app.get('/api/memories/stats', async (request) => {
    const { zoneId } = request.query as { zoneId: string };
    if (!zoneId) return { error: 'zoneId is required' };

    return memoryService.getStats(zoneId);
  });

  /**
   * List all memories for a zone
   * GET /api/memories?zoneId=X
   */
  app.get('/api/memories', async (request) => {
    const { zoneId } = request.query as { zoneId: string };
    if (!zoneId) return { error: 'zoneId is required' };

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
  app.post('/api/posts', async (request) => {
    const body = request.body as CreatePostParams;

    if (!body.zoneId || !body.providerId || !body.description || !body.tags) {
      return { error: 'zoneId, providerId, description, and tags are required' };
    }

    if (!body.media || body.media.length === 0) {
      return { error: 'At least one media item (image or video) is required' };
    }

    try {
      const post = await postService.create(body);
      return { post };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  /**
   * Get the visual feed for a zone
   * GET /api/posts?zoneId=X&tags=Y&page=1&pageSize=20
   */
  app.get('/api/posts', async (request) => {
    const { zoneId, tags, page, pageSize, includeInactive } = request.query as {
      zoneId: string;
      tags?: string;
      page?: string;
      pageSize?: string;
      includeInactive?: string;
    };

    if (!zoneId) return { error: 'zoneId is required' };

    const feedParams: PostFeedParams = {
      zoneId,
      tags: tags ? tags.split(',') : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      includeInactive: includeInactive === 'true',
    };

    const result = await postService.getFeed(feedParams);
    return result;
  });

  /**
   * Get a single post
   * GET /api/posts/:postId
   */
  app.get('/api/posts/:postId', async (request) => {
    const { postId } = request.params as { postId: string };
    const post = await postService.get(postId);

    if (!post) {
      return { error: 'Post not found' };
    }

    return { post };
  });

  /**
   * Update a post
   * PUT /api/posts/:postId
   */
  app.put('/api/posts/:postId', async (request) => {
    const { postId } = request.params as { postId: string };
    const body = request.body as {
      description?: string;
      tags?: string[];
      media?: any[];
      isSponsored?: boolean;
    };

    try {
      const post = await postService.update(postId, body);
      if (!post) return { error: 'Post not found' };
      return { post };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  /**
   * Deactivate a post (soft delete)
   * DELETE /api/posts/:postId
   */
  app.delete('/api/posts/:postId', async (request) => {
    const { postId } = request.params as { postId: string };
    const deleted = await postService.deactivate(postId);

    if (!deleted) return { error: 'Post not found' };

    return { deactivated: true };
  });

  /**
   * Get professional post count for a zone+tags
   * GET /api/posts/count?zoneId=X&tags=Y
   */
  app.get('/api/posts/count', async (request) => {
    const { zoneId, tags } = request.query as {
      zoneId: string;
      tags?: string;
    };

    if (!zoneId) return { error: 'zoneId is required' };

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
  app.post('/api/posts/:postId/like', async (request) => {
    const { postId } = request.params as { postId: string };
    const liked = await postService.like(postId);

    if (!liked) return { error: 'Post not found' };

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
  app.post('/api/learning/learn', async (request) => {
    const body = request.body as LearnFromUserParams;

    if (!body.zoneId || !body.personId || !body.skill || !body.sourcePersonId) {
      return { error: 'zoneId, personId, skill, and sourcePersonId are required' };
    }

    try {
      const result = await learningService.learnFromUser(body);

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
      return { error: err.message };
    }
  });

  /**
   * Record a memory directly (simple recording, no learning loop)
   * POST /api/learning/record
   *
   * Used when a user shares a recommendation directly,
   * not from a demand fulfillment.
   */
  app.post('/api/learning/record', async (request) => {
    const body = request.body as LearnFromUserParams;

    if (!body.zoneId || !body.personId || !body.skill || !body.sourcePersonId) {
      return { error: 'zoneId, personId, skill, and sourcePersonId are required' };
    }

    try {
      const result = await learningService.learnFromUser(body);

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
      return { error: err.message };
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
    const { requesterId, zoneId, skill, status } = request.query as {
      requesterId?: string;
      zoneId?: string;
      skill?: string;
      status?: string;
    };

    const demandService = learningService.getDemandService();

    const demands = demandService.search({
      requesterId,
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
  app.get('/api/learning/demands/:demandId', async (request) => {
    const { demandId } = request.params as { demandId: string };
    const demandService = learningService.getDemandService();
    const demand = demandService.get(demandId);

    if (!demand) {
      return { error: 'Demand not found' };
    }

    return { demand };
  });

  /**
   * Cancel a learning demand
   * POST /api/learning/demands/:demandId/cancel
   */
  app.post('/api/learning/demands/:demandId/cancel', async (request) => {
    const { demandId } = request.params as { demandId: string };
    const demandService = learningService.getDemandService();
    const cancelled = demandService.cancel(demandId);

    if (!cancelled) {
      return { error: 'Demand not found or not open' };
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
  app.get('/api/learning/search', async (request) => {
    const { skill, zoneId, minConfidence, maxResults } = request.query as {
      skill: string;
      zoneId: string;
      minConfidence?: string;
      maxResults?: string;
    };

    if (!skill || !zoneId) return { error: 'skill and zoneId are required' };

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
      return { error: err.message };
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
  app.post('/api/professional/register', async (request) => {
    const body = request.body as RegisterProfessionalParams;

    if (!body.personId || !body.zoneId || !body.license || !body.planId) {
      return { error: 'personId, zoneId, license, and planId are required' };
    }

    try {
      const result = await subscriptionService.registerProfessional(body);

      // Emit events
      eventBus.emit('license.submitted', {
        licenseId: result.license.id,
        personId: body.personId,
        profession: body.license.profession,
        licenseNumber: result.license.licenseNumber,
      });

      eventBus.emit('professional.registered', {
        personId: body.personId,
        zoneId: body.zoneId,
        profession: body.license.profession,
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
      return { error: err.message };
    }
  });

  /**
   * Activate subscription after external payment
   * POST /api/professional/activate
   *
   * Called by the external payment gateway callback.
   * ⚠️ The app NEVER processes payment directly.
   */
  app.post('/api/professional/activate', async (request) => {
    const body = request.body as ActivateSubscriptionParams;

    if (!body.subscriptionId || !body.paymentReference) {
      return { error: 'subscriptionId and paymentReference are required' };
    }

    try {
      const subscription = await subscriptionService.activateSubscription(body);

      if (!subscription) {
        return { error: 'Subscription not found' };
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
      return { error: err.message };
    }
  });

  /**
   * Verify a license (admin or external callback)
   * POST /api/professional/license/verify
   */
  app.post('/api/professional/license/verify', async (request) => {
    const body = request.body as {
      licenseId: string;
      approved: boolean;
      verifiedBy: string;
      rejectionReason?: string;
      verificationReference?: string;
      expiresAt?: string;
    };

    if (!body.licenseId || body.approved === undefined || !body.verifiedBy) {
      return { error: 'licenseId, approved, and verifiedBy are required' };
    }

    try {
      const license = await licenseService.verifyLicense({
        licenseId: body.licenseId,
        approved: body.approved,
        verifiedBy: body.verifiedBy,
        rejectionReason: body.rejectionReason,
        verificationReference: body.verificationReference,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      if (!license) {
        return { error: 'License not found or not pending' };
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
      return { error: err.message };
    }
  });

  /**
   * Get professional status for a person
   * GET /api/professional/status/:personId
   */
  app.get('/api/professional/status/:personId', async (request) => {
    const { personId } = request.params as { personId: string };
    const status = subscriptionService.getProfessionalStatus(personId);
    return status;
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
  app.get('/api/professional/subscription/:subscriptionId', async (request) => {
    const { subscriptionId } = request.params as { subscriptionId: string };
    const subscription = subscriptionService.get(subscriptionId);

    if (!subscription) {
      return { error: 'Subscription not found' };
    }

    return { subscription };
  });

  /**
   * Renew a subscription
   * POST /api/professional/renew
   */
  app.post('/api/professional/renew', async (request) => {
    const body = request.body as {
      subscriptionId: string;
      planId: string;
      paymentReference: string;
    };

    if (!body.subscriptionId || !body.planId || !body.paymentReference) {
      return { error: 'subscriptionId, planId, and paymentReference are required' };
    }

    try {
      const subscription = await subscriptionService.renewSubscription(
        body.subscriptionId,
        body.planId,
        body.paymentReference
      );

      if (!subscription) {
        return { error: 'Subscription not found' };
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
      return { error: err.message };
    }
  });

  /**
   * Cancel a subscription
   * POST /api/professional/cancel/:subscriptionId
   */
  app.post('/api/professional/cancel/:subscriptionId', async (request) => {
    const { subscriptionId } = request.params as { subscriptionId: string };

    const cancelled = await subscriptionService.cancelSubscription(subscriptionId);

    if (!cancelled) {
      return { error: 'Subscription not found' };
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
