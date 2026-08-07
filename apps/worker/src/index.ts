/**
 * Zone Worker — BullMQ Queue Processor
 *
 * Manages the tiered broadcast waves:
 * - Wave 1: 0-10 min, matching skill, 2.5km, max 8 people
 * - Wave 2: 10-30 min, adjacent skill, 5km, max 15 people
 * - Wave 3: 30-90 min, referral, all active users
 *
 * Anti-nuisance rules:
 * - Max 3 notifications/day
 * - Quiet hours: 22:00 – 08:00 (Iran time)
 * - Stop after ≥2 responses
 * - Down-weight after 3 silences
 * - Tag opt-out
 * - Emergency channel: max 1/week
 *
 * Phase 6: Full implementation with WaveService, AntiNuisanceService,
 * PersonRegistry, and proper tiered wave logic.
 */

import { Queue, Worker, type Job } from 'bullmq';
import { EventBus, Logger } from '@zone/core';
import { ZoneRedis } from '@zone/redis';
import {
  WaveService,
  AntiNuisanceService,
  PersonRegistry,
} from '@zone/assistant';

// ─── Types ───

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

// ─── Worker ───

async function main() {
  const logger = new Logger({ context: { service: 'worker' } });
  logger.info('zone:worker:starting', { version: '1.0.0' });

  const eventBus = new EventBus();
  eventBus.setLogger((msg, data) => logger.debug(msg, data));

  const redis = new ZoneRedis(process.env.REDIS_URL || 'redis://localhost:6379');

  // ─── Initialize Phase 6 Services ───

  const personRegistry = new PersonRegistry();
  const antiNuisance = new AntiNuisanceService();
  const waveService = new WaveService(personRegistry, antiNuisance);

  // Seed some sample persons for development only
  if (process.env.NODE_ENV !== 'production') {
    seedSamplePersons(personRegistry);
  }

  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };

  // ─── Create Queue ───

  const waveQueue = new Queue<WaveJob>('zone-waves', { connection });

  // ─── Wave Processor ───

  const waveWorker = new Worker<WaveJob>(
    'zone-waves',
    async (job: Job<WaveJob>) => {
      const {
        requestId,
        zoneId,
        tags,
        waveLevel,
        requesterId,
        responseCount,
        urgency,
        centerLatitude,
        centerLongitude,
      } = job.data;

      logger.info('zone:worker:wave', {
        requestId,
        waveLevel,
        responseCount,
        urgency,
      });

      // Check if we already have enough responses
      if (antiNuisance.hasEnoughResponses(requestId)) {
        logger.info('zone:worker:wave:stopped', { requestId, reason: 'sufficient_responses' });
        return { status: 'stopped', reason: 'sufficient_responses' };
      }

      // Check quiet hours (except emergency)
      if (antiNuisance.isInQuietHours() && urgency !== 'emergency') {
        logger.info('zone:worker:wave:delayed', { requestId, reason: 'quiet_hours' });
        const delay = antiNuisance.getQuietHoursDelay();
        await waveQueue.add('wave', job.data, { delay });
        return { status: 'delayed', reason: 'quiet_hours' };
      }

      // ─── Dispatch the appropriate wave ───

      // Ensure the request exists in the wave service
      let request = waveService.getRequest(requestId);
      if (!request) {
        request = waveService.createRequest({
          zoneId,
          requesterId,
          description: job.data.description,
          tags,
          urgency,
          radius: job.data.radius,
        });
        // Use the job's requestId
        request.id = requestId;
      }

      let result;

      switch (waveLevel) {
        case 1:
          result = waveService.dispatchWave1(requestId, centerLatitude, centerLongitude);
          break;
        case 2:
          result = waveService.dispatchWave2(requestId, centerLatitude, centerLongitude);
          break;
        case 3:
          result = waveService.dispatchWave3(requestId);
          break;
      }

      if (result.skipped) {
        logger.info('zone:worker:wave:skipped', {
          requestId,
          waveLevel,
          reason: result.skipReason,
        });

        // If quiet hours, schedule for after
        if (result.skipReason === 'quiet_hours') {
          const delay = antiNuisance.getQuietHoursDelay();
          await waveQueue.add('wave', job.data, { delay });
          return { status: 'delayed', reason: 'quiet_hours' };
        }

        return { status: 'skipped', reason: result.skipReason };
      }

      // Record silence for non-responders from previous wave
      if (waveLevel > 1) {
        waveService.recordWaveSilence(requestId, (waveLevel - 1) as 1 | 2);
      }

      // Emit wave event
      await eventBus.emit('wave.dispatched', {
        requestId,
        zoneId,
        waveLevel,
        personIds: result.personIds,
        count: result.count,
      });

      // Also emit the legacy wave.open event
      await eventBus.emit('wave.open', {
        requestId,
        zoneId,
        tags,
        radius: result.radius,
        waveLevel,
      });

      logger.info('zone:worker:wave:dispatched', {
        requestId,
        waveLevel,
        selected: result.count,
        skills: result.matchedSkills,
      });

      // ─── Schedule next wave or finish ───

      const updatedRequest = waveService.getRequest(requestId);
      if (updatedRequest && updatedRequest.status === 'fulfilled') {
        logger.info('zone:worker:request_fulfilled', { requestId });
        return { status: 'fulfilled', selected: result.count };
      }

      if (waveLevel < 3) {
        // Schedule next wave
        const nextDelay = waveService.getNextWaveDelay(waveLevel, urgency);
        await waveQueue.add(
          'wave',
          {
            ...job.data,
            waveLevel: (waveLevel + 1) as 1 | 2 | 3,
          },
          { delay: nextDelay }
        );

        logger.info('zone:worker:next_wave_scheduled', {
          requestId,
          nextWave: waveLevel + 1,
          delayMs: nextDelay,
        });
      } else {
        // Wave 3 completed → check if we should go to UNKNOWN mode
        if (result.count === 0) {
          await eventBus.emit('wave.unknown', {
            requestId,
            zoneId,
          });

          logger.info('zone:worker:unknown', { requestId });
        }
      }

      return { status: 'dispatched', selected: result.count, waveLevel };
    },
    { connection }
  );

  waveWorker.on('completed', (job) => {
    logger.debug('zone:worker:completed', { jobId: job.id, result: job.returnvalue });
  });

  waveWorker.on('failed', (job, err) => {
    logger.error('zone:worker:failed', { jobId: job?.id, error: err.message });
  });

  logger.info('zone:worker:listening');

  // ─── Graceful Shutdown ───

  const shutdown = async (signal: string) => {
    logger.info('zone:worker:shutting_down', { signal });
    await waveWorker.close();
    await waveQueue.close();
    await redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ─── Sample Data ───

function seedSamplePersons(registry: PersonRegistry): void {
  const persons = [
    { id: 'person_rezaei', displayName: 'آقای رضایی', zoneId: 'zone_narak', skills: ['house_painting', 'tiling'], latitude: 35.7750, longitude: 51.4150, responseRate: 0.9, isProfessional: true },
    { id: 'person_hosseini', displayName: 'استاد حسینی', zoneId: 'zone_narak', skills: ['plumbing', 'repair'], latitude: 35.7760, longitude: 51.4160, responseRate: 0.85, isProfessional: true },
    { id: 'person_ahmadi', displayName: 'خانم احمدی', zoneId: 'zone_narak', skills: ['cleaning'], latitude: 35.7740, longitude: 51.4140, responseRate: 0.7, isProfessional: false },
    { id: 'person_mohammadi', displayName: 'آقای محمدی', zoneId: 'zone_narak', skills: ['electrical', 'air_conditioning'], latitude: 35.7770, longitude: 51.4170, responseRate: 0.8, isProfessional: true },
    { id: 'person_karimi', displayName: 'آقای کریمی', zoneId: 'zone_narak', skills: ['carpentry', 'repair'], latitude: 35.7730, longitude: 51.4130, responseRate: 0.6, isProfessional: false },
    { id: 'person_moradi', displayName: 'آقای مرادی', zoneId: 'zone_narak', skills: ['moving', 'carpentry'], latitude: 35.7780, longitude: 51.4180, responseRate: 0.75, isProfessional: false },
    { id: 'person_jafari', displayName: 'آقای جعفری', zoneId: 'zone_narak', skills: ['locksmith', 'repair'], latitude: 35.7720, longitude: 51.4120, responseRate: 0.5, isProfessional: false },
    { id: 'person_alavi', displayName: 'خانم علوی', zoneId: 'zone_narak', skills: ['sports', 'walking'], latitude: 35.7790, longitude: 51.4190, responseRate: 0.9, isProfessional: false },
    { id: 'person_sadeghi', displayName: 'آقای صادقی', zoneId: 'zone_narak', skills: ['appliance_repair', 'electrical'], latitude: 35.7710, longitude: 51.4110, responseRate: 0.65, isProfessional: true },
    { id: 'person_noori', displayName: 'خانم نوری', zoneId: 'zone_narak', skills: ['food', 'party'], latitude: 35.7800, longitude: 51.4200, responseRate: 0.8, isProfessional: false },
  ];

  for (const person of persons) {
    registry.register(person);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
