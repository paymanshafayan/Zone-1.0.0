/**
 * Zone SDK — Outer Core (Open Source)
 *
 * This is the ONLY interface that plugins may use.
 * It wraps the Inner Core and exposes a safe, versioned API.
 *
 * ⚠️ Breaking changes to this API require a major version bump.
 * ⚠️ Plugins must never import from @zone/core directly.
 */

import {
  EventBus,
  PluginRegistry,
  Logger,
  type PluginManifest,
  type PluginHandler,
  type ZoneEvent,
  type EdgeProcessingResult,
  type ExtractedNumber,
  type Post,
  type Memory,
  type Person,
  type Tag,
  type HearingSpace,
  type Request,
  type Offer,
} from '@zone/core';

// ─── SDK Configuration ───

export interface SDKConfig {
  /** Base URL of the Zone API server */
  apiUrl: string;
  /** WebSocket URL for real-time connections */
  wsUrl: string;
  /** API key for plugin authentication */
  apiKey?: string;
  /** Plugin identifier */
  pluginName: string;
}

// ─── Event Interface ───

export interface EventsInterface {
  /**
   * Subscribe to an event
   * @param event Event name (must be in the plugin's manifest.subscriptions)
   * @param handler Event handler function
   */
  subscribe<E extends keyof ZoneEvent>(
    event: E,
    handler: (data: ZoneEvent[E]) => void | Promise<void>
  ): string;

  /**
   * Emit an event
   * @param event Event name (must be in the plugin's manifest.publications)
   * @param data Event data
   */
  emit<E extends keyof ZoneEvent>(
    event: E,
    data: ZoneEvent[E]
  ): Promise<void>;

  /**
   * List all available events
   */
  list(): string[];
}

// ─── Data Interface ───

export interface DataInterface {
  /**
   * Query data from a model
   */
  query(model: string, filters: Record<string, any>): Promise<any[]>;

  /**
   * Create a new record
   */
  create(model: string, data: Record<string, any>): Promise<any>;

  /**
   * Update an existing record
   */
  update(model: string, id: string, data: Record<string, any>): Promise<any>;

  /**
   * Delete a record
   */
  delete(model: string, id: string): Promise<boolean>;

  /**
   * List available models
   */
  models(): string[];
}

// ─── Tags Interface ───

export interface TagsInterface {
  /**
   * Suggest tags from the closed vocabulary based on a concept
   */
  suggest(concept: string): Promise<string[]>;

  /**
   * Subscribe a user to a tag pattern
   */
  subscribe(tagPattern: string, personId: string): Promise<void>;

  /**
   * List the closed vocabulary
   */
  vocabulary(): Promise<Tag[]>;
}

// ─── Hearing Space Interface ───

export interface HearingInterface {
  /**
   * Create a persistent hearing space
   */
  createSpace(config: {
    zoneId: string;
    name: string;
    tags: string[];
  }): Promise<HearingSpace>;

  /**
   * Open a broadcast wave (dynamic space)
   */
  openWave(config: {
    zoneId: string;
    tags: string[];
    radius: number;
    reverberationTtl: number;
  }): Promise<HearingSpace>;

  /**
   * Join a hearing space
   */
  join(spaceId: string, personId: string): Promise<void>;

  /**
   * Leave a hearing space
   */
  leave(spaceId: string, personId: string): Promise<void>;

  /**
   * Speak in a hearing space
   */
  speak(spaceId: string, content: {
    personId: string;
    text: string;
    tags: string[];
  }): Promise<void>;
}

// ─── UI Interface ───

export interface UIInterface {
  /**
   * Register a route in the mobile app
   */
  registerRoute(path: string, widget: string, label: string): void;

  /**
   * Add a menu item
   */
  addMenuItem(label: string, icon: string, path: string, position?: number): void;

  /**
   * Push an in-app notification
   */
  pushNotification(personId: string, content: string): Promise<void>;
}

// ─── Notification Interface ───

export interface NotifyInterface {
  /**
   * Send a notification to a user
   */
  send(personId: string, content: string): Promise<void>;

  /**
   * Schedule a notification
   */
  schedule(personId: string, content: string, at: Date): Promise<void>;
}

// ─── Plugin Interface ───

export interface PluginsInterface {
  /**
   * Register a new plugin
   */
  register(manifest: PluginManifest, handler: PluginHandler): string;

  /**
   * List all registered plugins
   */
  list(): Array<{
    name: string;
    version: string;
    enabled: boolean;
  }>;

  /**
   * Enable a plugin
   */
  enable(name: string): boolean;

  /**
   * Disable a plugin
   */
  disable(name: string): boolean;
}

// ─── Main SDK Class ───

export class ZoneSDK {
  private config: SDKConfig;
  private eventBus: EventBus;
  private pluginRegistry: PluginRegistry;
  private logger: Logger;

  public readonly events: EventsInterface;
  public readonly data: DataInterface;
  public readonly tags: TagsInterface;
  public readonly hearing: HearingInterface;
  public readonly ui: UIInterface;
  public readonly notify: NotifyInterface;
  public readonly plugins: PluginsInterface;

  constructor(config: SDKConfig, eventBus: EventBus, pluginRegistry: PluginRegistry) {
    this.config = config;
    this.eventBus = eventBus;
    this.pluginRegistry = pluginRegistry;
    this.logger = new Logger({ context: { plugin: config.pluginName } });

    // Initialize interfaces
    this.events = this.createEventsInterface();
    this.data = this.createDataInterface();
    this.tags = this.createTagsInterface();
    this.hearing = this.createHearingInterface();
    this.ui = this.createUIInterface();
    this.notify = this.createNotifyInterface();
    this.plugins = this.createPluginsInterface();
  }

  private createEventsInterface(): EventsInterface {
    return {
      subscribe: (event, handler) => {
        return this.eventBus.subscribe(event as string, handler as any);
      },
      emit: (event, data) => {
        return this.eventBus.emit(event as string, data);
      },
      list: () => {
        return this.eventBus.listEvents();
      },
    };
  }

  private createDataInterface(): DataInterface {
    // TODO: Implement with actual API calls
    return {
      query: async (model, filters) => {
        this.logger.info('sdk:data.query', { model, filters });
        return [];
      },
      create: async (model, data) => {
        this.logger.info('sdk:data.create', { model });
        return data;
      },
      update: async (model, id, data) => {
        this.logger.info('sdk:data.update', { model, id });
        return data;
      },
      delete: async (model, id) => {
        this.logger.info('sdk:data.delete', { model, id });
        return true;
      },
      models: () => {
        return ['zones', 'persons', 'memories', 'posts', 'tags', 'requests', 'offers'];
      },
    };
  }

  private createTagsInterface(): TagsInterface {
    // TODO: Implement with actual tag service
    return {
      suggest: async (concept) => {
        this.logger.info('sdk:tags.suggest', { concept });
        return [];
      },
      subscribe: async (tagPattern, personId) => {
        this.logger.info('sdk:tags.subscribe', { tagPattern, personId });
      },
      vocabulary: async () => {
        return [];
      },
    };
  }

  private createHearingInterface(): HearingInterface {
    // TODO: Implement with actual WebSocket
    return {
      createSpace: async (config) => {
        this.logger.info('sdk:hearing.createSpace', { zoneId: config.zoneId });
        return {} as HearingSpace;
      },
      openWave: async (config) => {
        this.logger.info('sdk:hearing.openWave', { zoneId: config.zoneId });
        return {} as HearingSpace;
      },
      join: async (spaceId, personId) => {
        this.logger.info('sdk:hearing.join', { spaceId, personId });
      },
      leave: async (spaceId, personId) => {
        this.logger.info('sdk:hearing.leave', { spaceId, personId });
      },
      speak: async (spaceId, content) => {
        this.logger.info('sdk:hearing.speak', { spaceId, personId: content.personId });
      },
    };
  }

  private createUIInterface(): UIInterface {
    return {
      registerRoute: (path, widget, label) => {
        this.logger.info('sdk:ui.registerRoute', { path, widget, label });
      },
      addMenuItem: (label, icon, path, position) => {
        this.logger.info('sdk:ui.addMenuItem', { label, icon, path, position });
      },
      pushNotification: async (personId, content) => {
        this.logger.info('sdk:ui.pushNotification', { personId });
      },
    };
  }

  private createNotifyInterface(): NotifyInterface {
    return {
      send: async (personId, content) => {
        this.logger.info('sdk:notify.send', { personId });
      },
      schedule: async (personId, content, at) => {
        this.logger.info('sdk:notify.schedule', { personId, at: at.toISOString() });
      },
    };
  }

  private createPluginsInterface(): PluginsInterface {
    return {
      register: (manifest, handler) => {
        return this.pluginRegistry.register(manifest, handler);
      },
      list: () => {
        return this.pluginRegistry.list().map((p) => ({
          name: p.name,
          version: p.version,
          enabled: p.enabled,
        }));
      },
      enable: (name) => {
        return this.pluginRegistry.enable(name);
      },
      disable: (name) => {
        return this.pluginRegistry.disable(name);
      },
    };
  }
}

// ─── Plugin Helper ───

/**
 * Define a Zone plugin
 * This is the main entry point for plugin developers.
 */
export function definePlugin(
  manifest: PluginManifest,
  handler: PluginHandler
): { manifest: PluginManifest; handler: PluginHandler } {
  return { manifest, handler };
}
