/**
 * Zone WebSocket Server — Hearing Space Real-time Layer
 *
 * Phase 2: Full implementation with HearingSpaceService
 *
 * Protocol:
 * - Client connects → sends 'identify' with personId
 * - Client joins a space → sends 'join' with spaceId
 * - Client speaks → sends 'speak' with text
 * - Client receives: 'reverberation', 'speech', 'presence', 'system'
 *
 * The server is the intermediary — user voice is never transmitted directly.
 * All messages are restated by the system.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type IncomingMessage } from 'http';
import { URL } from 'url';
import {
  EventBus,
  Logger,
  type SpaceMember,
} from '@zone/core';
import { ZoneRedis } from '@zone/redis';
import {
  HearingSpaceService,
  type SpaceMessage,
  type SpaceInfo,
} from './hearing-space-service';

// ─── Protocol Types ───

/**
 * Messages sent FROM the client TO the server
 */
interface ClientMessage {
  type: 'identify' | 'join' | 'leave' | 'speak' | 'list_spaces' | 'ping';
  payload: any;
}

/**
 * Messages sent FROM the server TO the client
 */
interface ServerMessage {
  type:
    | 'identified'
    | 'joined'
    | 'left'
    | 'reverberation'
    | 'speech'
    | 'presence'
    | 'space_list'
    | 'system'
    | 'error'
    | 'pong';
  payload: any;
}

/**
 * Connected user state
 */
interface ConnectedUser {
  connectionId: string;
  personId: string | null;
  zoneId: string | null;
  currentSpaceId: string | null;
  ws: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
}

// ─── Presence Heartbeat ───

const PRESENCE_INTERVAL = 60 * 1000; // 1 minute
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ─── Server ───

async function main() {
  const logger = new Logger({ context: { service: 'ws' } });
  logger.info('zone:ws:starting', { version: '1.0.0' });

  const eventBus = new EventBus();
  eventBus.setLogger((msg, data) => logger.debug(msg, data));

  const redis = new ZoneRedis(process.env.REDIS_URL || 'redis://localhost:6379');
  const spaceService = new HearingSpaceService(eventBus, redis);

  // Active connections
  const connections = new Map<string, ConnectedUser>();

  // ─── Create HTTP + WebSocket Server ───

  const server = createServer();
  const wss = new WebSocketServer({ server, path: '/ws' });

  // ─── Authentication / Identification ───

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const connectionId = generateId('conn');
    const user: ConnectedUser = {
      connectionId,
      personId: null,
      zoneId: null,
      currentSpaceId: null,
      ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    connections.set(connectionId, user);
    logger.info('ws:connected', { connectionId, ip: req.socket.remoteAddress });

    // Send welcome message
    send(ws, {
      type: 'system',
      payload: {
        message: 'connected',
        connectionId,
        nextAction: 'identify',
      },
    });

    // ─── Message Handler ───

    ws.on('message', async (raw: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(raw.toString());
        user.lastActivity = new Date();
        await handleClientMessage(connectionId, message);
      } catch (err) {
        sendError(ws, 'Invalid message format');
      }
    });

    // ─── Close Handler ───

    ws.on('close', async () => {
      logger.info('ws:disconnected', {
        connectionId,
        personId: user.personId,
      });

      // Leave current space
      if (user.currentSpaceId && user.personId) {
        await spaceService.leaveSpace(user.currentSpaceId, user.personId);

        // Notify others
        broadcastToSpace(user.currentSpaceId, {
          type: 'presence',
          payload: { personId: user.personId, action: 'left', reason: 'disconnect' },
        }, connectionId);
      }

      // Remove presence
      if (user.personId) {
        await redis.removePresence(user.personId);
      }

      connections.delete(connectionId);
    });

    // ─── Error Handler ───

    ws.on('error', (err) => {
      logger.error('ws:error', { connectionId, error: err.message });
    });
  });

  // ─── Client Message Router ───

  async function handleClientMessage(connectionId: string, message: ClientMessage): Promise<void> {
    const user = connections.get(connectionId);
    if (!user) return;

    switch (message.type) {
      case 'identify':
        await handleIdentify(connectionId, message.payload);
        break;
      case 'join':
        await handleJoin(connectionId, message.payload);
        break;
      case 'leave':
        await handleLeave(connectionId, message.payload);
        break;
      case 'speak':
        await handleSpeak(connectionId, message.payload);
        break;
      case 'list_spaces':
        await handleListSpaces(connectionId, message.payload);
        break;
      case 'ping':
        send(user.ws, { type: 'pong', payload: { timestamp: Date.now() } });
        break;
      default:
        sendError(user.ws, `Unknown message type: ${message.type}`);
    }
  }

  // ─── Identify ───

  async function handleIdentify(connectionId: string, payload: { personId: string; zoneId: string }): Promise<void> {
    const user = connections.get(connectionId);
    if (!user) return;

    user.personId = payload.personId;
    user.zoneId = payload.zoneId;

    // Update presence
    await redis.setPresence(payload.personId, payload.zoneId, []);

    send(user.ws, {
      type: 'identified',
      payload: {
        personId: payload.personId,
        zoneId: payload.zoneId,
      },
    });

    logger.info('ws:identified', {
      connectionId,
      personId: payload.personId,
      zoneId: payload.zoneId,
    });
  }

  // ─── Join Space ───

  async function handleJoin(
    connectionId: string,
    payload: {
      spaceId?: string; // existing space to join
      // OR create a new space:
      createDynamic?: {
        zoneId: string;
        tags: string[];
        radius: number;
      };
      createPersistent?: {
        zoneId: string;
        name: string;
        tags: string[];
        description?: string;
      };
    }
  ): Promise<void> {
    const user = connections.get(connectionId);
    if (!user || !user.personId) {
      if (user) sendError(user.ws, 'Not identified');
      return;
    }

    // Leave current space first
    if (user.currentSpaceId) {
      await spaceService.leaveSpace(user.currentSpaceId, user.personId);
      broadcastToSpace(user.currentSpaceId, {
        type: 'presence',
        payload: { personId: user.personId, action: 'left', reason: 'switched' },
      }, connectionId);
    }

    let spaceId: string;

    // Join existing space
    if (payload.spaceId) {
      spaceId = payload.spaceId;
    }
    // Create dynamic space
    else if (payload.createDynamic) {
      const space = await spaceService.createDynamicSpace({
        zoneId: payload.createDynamic.zoneId,
        tags: payload.createDynamic.tags,
        radius: payload.createDynamic.radius,
        requestedBy: user.personId,
      });
      spaceId = space.id;
    }
    // Create persistent space
    else if (payload.createPersistent) {
      const space = await spaceService.createPersistentSpace({
        zoneId: payload.createPersistent.zoneId,
        name: payload.createPersistent.name,
        tags: payload.createPersistent.tags,
        description: payload.createPersistent.description,
        createdBy: user.personId,
      });
      spaceId = space.id;
    } else {
      sendError(user.ws, 'Must specify spaceId, createDynamic, or createPersistent');
      return;
    }

    // Join the space
    const result = await spaceService.joinSpace(spaceId, user.personId);

    // Update user state
    user.currentSpaceId = spaceId;
    user.zoneId = result.space.zoneId;

    // Send join confirmation + reverberations
    send(user.ws, {
      type: 'joined',
      payload: {
        space: {
          id: result.space.id,
          type: result.space.type,
          name: result.space.name,
          tags: result.space.tags,
          memberCount: result.space.memberCount,
        },
        reverberations: result.reverberations,
        members: result.members.map((m) => m.personId),
      },
    });

    // Notify others in the space
    broadcastToSpace(spaceId, {
      type: 'presence',
      payload: { personId: user.personId, action: 'joined' },
    }, connectionId);

    logger.info('ws:joined', {
      connectionId,
      personId: user.personId,
      spaceId,
      memberCount: result.space.memberCount,
      reverberationCount: result.reverberations.length,
    });
  }

  // ─── Leave Space ───

  async function handleLeave(
    connectionId: string,
    payload?: { spaceId?: string }
  ): Promise<void> {
    const user = connections.get(connectionId);
    if (!user || !user.personId) return;

    const spaceId = payload?.spaceId || user.currentSpaceId;
    if (!spaceId) return;

    await spaceService.leaveSpace(spaceId, user.personId);

    // Update user state
    user.currentSpaceId = null;

    // Notify others
    broadcastToSpace(spaceId, {
      type: 'presence',
      payload: { personId: user.personId, action: 'left' },
    }, connectionId);

    // Confirm to user
    send(user.ws, {
      type: 'left',
      payload: { spaceId },
    });

    logger.info('ws:left', { connectionId, personId: user.personId, spaceId });
  }

  // ─── Speak ───

  async function handleSpeak(
    connectionId: string,
    payload: { text: string; tags?: string[] }
  ): Promise<void> {
    const user = connections.get(connectionId);
    if (!user || !user.personId || !user.currentSpaceId) {
      if (user) sendError(user.ws, 'Not in a space');
      return;
    }

    const tags = payload.tags || [];

    // Speak through the space service
    const message = await spaceService.speak(
      user.currentSpaceId,
      user.personId,
      payload.text,
      tags
    );

    // Broadcast to all present members
    broadcastToSpace(user.currentSpaceId, {
      type: 'speech',
      payload: {
        id: message.id,
        spaceId: message.spaceId,
        personId: message.personId,
        text: message.text,
        tags: message.tags,
        createdAt: message.createdAt,
      },
    });

    logger.info('ws:speak', {
      connectionId,
      personId: user.personId,
      spaceId: user.currentSpaceId,
      textLength: payload.text.length,
    });
  }

  // ─── List Spaces ───

  async function handleListSpaces(
    connectionId: string,
    payload: { zoneId: string; tags?: string[] }
  ): Promise<void> {
    const user = connections.get(connectionId);
    if (!user) return;

    const spaces = await spaceService.findSpaces(
      payload.zoneId,
      payload.tags || []
    );

    send(user.ws, {
      type: 'space_list',
      payload: {
        spaces: spaces.map((s) => ({
          id: s.id,
          type: s.type,
          name: s.name,
          tags: s.tags,
          memberCount: s.memberCount,
        })),
      },
    });
  }

  // ─── Broadcast Helpers ───

  function broadcastToSpace(
    spaceId: string,
    message: ServerMessage,
    excludeConnectionId?: string
  ): void {
    for (const [id, user] of connections) {
      if (
        user.currentSpaceId === spaceId &&
        id !== excludeConnectionId &&
        user.ws.readyState === WebSocket.OPEN
      ) {
        send(user.ws, message);
      }
    }
  }

  function send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function sendError(ws: WebSocket, error: string): void {
    send(ws, { type: 'error', payload: { error } });
  }

  // ─── Presence Heartbeat ───

  setInterval(async () => {
    for (const [id, user] of connections) {
      try {
        // Check idle timeout
        const idleTime = Date.now() - user.lastActivity.getTime();
        if (idleTime > IDLE_TIMEOUT) {
          logger.info('ws:idle_timeout', { connectionId: id, personId: user.personId });
          user.ws.close();
          continue;
        }

        // Refresh presence
        if (user.personId && user.zoneId) {
          const spaces = user.currentSpaceId ? [user.currentSpaceId] : [];
          await redis.setPresence(user.personId, user.zoneId, spaces);
        }
      } catch (err) {
        logger.warn('ws:presence_heartbeat:error', { connectionId: id, error: (err as Error).message });
      }
    }
  }, PRESENCE_INTERVAL);

  // ─── Start Server ───

  const port = parseInt(process.env.WS_PORT || '3001', 10);

  server.listen(port, () => {
    logger.info('zone:ws:listening', { port });
  });

  // ─── Graceful Shutdown ───

  const shutdown = async (signal: string) => {
    logger.info('zone:ws:shutting_down', { signal });

    // Close all connections gracefully
    for (const [id, user] of connections) {
      if (user.currentSpaceId && user.personId) {
        await spaceService.leaveSpace(user.currentSpaceId, user.personId);
      }
      user.ws.close();
    }

    wss.close();
    server.close();
    await redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
