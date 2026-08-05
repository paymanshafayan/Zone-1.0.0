/**
 * Zone Plugin Registry — Manages the lifecycle of all plugins
 *
 * Plugins register through the Outer Core SDK, but the registry
 * itself lives in the Inner Core. Plugins can never access the
 * registry directly — only through the SDK interface.
 */

import { EventBus } from './event-bus';

export interface PluginManifest {
  /** Unique plugin identifier */
  name: string;
  /** Human-readable name */
  displayName: string;
  /** Plugin version (semver) */
  version: string;
  /** Brief description */
  description: string;
  /** Events this plugin subscribes to */
  subscriptions: string[];
  /** Events this plugin produces */
  publications: string[];
  /** Data models this plugin requires access to */
  models: string[];
  /** UI routes this plugin registers */
  routes?: PluginRoute[];
  /** Plugin dependencies */
  dependencies?: string[];
}

export interface PluginRoute {
  path: string;
  widget: string;
  label: string;
  icon?: string;
  menuPosition?: number;
}

export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  registeredAt: Date;
  handler: PluginHandler;
}

export interface PluginHandler {
  onEvent(event: string, data: any): void | Promise<void>;
  onDestroy?(): void | Promise<void>;
}

export class PluginRegistry {
  private plugins: Map<string, PluginInstance> = new Map();
  private eventBus: EventBus;
  private subscriptionIds: Map<string, string[]> = new Map();
  private logger: ((msg: string, data?: any) => void) | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  setLogger(logger: (msg: string, data?: any) => void): void {
    this.logger = logger;
  }

  /**
   * Register a new plugin
   */
  register(manifest: PluginManifest, handler: PluginHandler): string {
    if (this.plugins.has(manifest.name)) {
      throw new Error(`Plugin "${manifest.name}" is already registered`);
    }

    // Check dependencies
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `Plugin "${manifest.name}" depends on "${dep}" which is not registered`
          );
        }
      }
    }

    const instance: PluginInstance = {
      manifest,
      enabled: true,
      registeredAt: new Date(),
      handler,
    };

    this.plugins.set(manifest.name, instance);

    // Subscribe to events
    const subs: string[] = [];
    for (const event of manifest.subscriptions) {
      const subId = this.eventBus.subscribe(event, (data) => {
        if (instance.enabled) {
          handler.onEvent(event, data);
        }
      });
      subs.push(subId);
    }
    this.subscriptionIds.set(manifest.name, subs);

    this.logger?.('plugin:registered', {
      name: manifest.name,
      version: manifest.version,
      subscriptions: manifest.subscriptions,
      publications: manifest.publications,
    });

    // Emit plugin registration event
    this.eventBus.emit('plugin.registered', {
      name: manifest.name,
      version: manifest.version,
    });

    return manifest.name;
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): boolean {
    const instance = this.plugins.get(name);
    if (!instance) return false;

    // Unsubscribe from events
    const subs = this.subscriptionIds.get(name) || [];
    for (const subId of subs) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptionIds.delete(name);

    // Call destroy handler
    instance.handler.onDestroy?.();

    this.plugins.delete(name);

    this.logger?.('plugin:unregistered', { name });

    this.eventBus.emit('plugin.unregistered', { name });
    return true;
  }

  /**
   * Enable a disabled plugin
   */
  enable(name: string): boolean {
    const instance = this.plugins.get(name);
    if (!instance) return false;
    if (instance.enabled) return false;

    instance.enabled = true;
    this.logger?.('plugin:enabled', { name });
    this.eventBus.emit('plugin.enabled', { name });
    return true;
  }

  /**
   * Disable a plugin (without removing it)
   */
  disable(name: string): boolean {
    const instance = this.plugins.get(name);
    if (!instance) return false;
    if (!instance.enabled) return false;

    instance.enabled = false;
    this.logger?.('plugin:disabled', { name });
    this.eventBus.emit('plugin.disabled', { name });
    return true;
  }

  /**
   * List all registered plugins
   */
  list(): Array<{
    name: string;
    version: string;
    enabled: boolean;
    registeredAt: Date;
  }> {
    return Array.from(this.plugins.entries()).map(([name, instance]) => ({
      name,
      version: instance.manifest.version,
      enabled: instance.enabled,
      registeredAt: instance.registeredAt,
    }));
  }

  /**
   * Get a plugin's manifest
   */
  getManifest(name: string): PluginManifest | null {
    return this.plugins.get(name)?.manifest || null;
  }

  /**
   * Check if a plugin is registered
   */
  isRegistered(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Check if a plugin is enabled
   */
  isEnabled(name: string): boolean {
    return this.plugins.get(name)?.enabled || false;
  }
}
