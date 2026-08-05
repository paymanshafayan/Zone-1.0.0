/**
 * Zone Core — Inner Core Package
 *
 * This package contains the Inner Core of the Zone micro-kernel:
 * - EventBus: Central nervous system
 * - PluginRegistry: Plugin lifecycle management
 * - Logger: Structured logging
 * - Types: Shared type definitions
 *
 * ⚠️ Plugins must NEVER import from this package directly.
 * They must use the Outer Core SDK (@zone/sdk) instead.
 */

export { EventBus } from './event-bus';
export { PluginRegistry } from './plugin-registry';
export type {
  PluginManifest,
  PluginRoute,
  PluginInstance,
  PluginHandler,
} from './plugin-registry';
export { Logger } from './logger';
export type { LogLevel, LogEntry } from './logger';
export * from './types';
