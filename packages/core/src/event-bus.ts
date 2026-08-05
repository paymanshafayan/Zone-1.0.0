/**
 * Zone EventBus — Central nervous system of the micro-kernel
 *
 * All communication between inner core, outer core, and plugins
 * flows through this event bus. Nothing in the system may bypass it.
 */

export type EventHandler = (data: any) => void | Promise<void>;

export interface EventSubscription {
  event: string;
  handler: EventHandler;
  id: string;
}

export class EventBus {
  private subscriptions: Map<string, Map<string, EventHandler>> = new Map();
  private wildcardHandlers: Map<string, EventHandler> = new Map();
  private logger: ((msg: string, data?: any) => void) | null = null;

  /**
   * Set a logger for event tracing
   */
  setLogger(logger: (msg: string, data?: any) => void): void {
    this.logger = logger;
  }

  /**
   * Subscribe to an event
   * Returns a subscription ID for unsubscription
   */
  subscribe(event: string, handler: EventHandler): string {
    const id = this.generateId();

    if (event === '*') {
      // Wildcard — listen to all events
      this.wildcardHandlers.set(id, handler);
    } else {
      if (!this.subscriptions.has(event)) {
        this.subscriptions.set(event, new Map());
      }
      this.subscriptions.get(event)!.set(id, handler);
    }

    this.logger?.('eventbus:subscribe', { event, id });
    return id;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(subscriptionId: string): boolean {
    // Check wildcard handlers
    if (this.wildcardHandlers.has(subscriptionId)) {
      this.wildcardHandlers.delete(subscriptionId);
      this.logger?.('eventbus:unsubscribe', { id: subscriptionId });
      return true;
    }

    // Check specific event handlers
    for (const [event, handlers] of this.subscriptions) {
      if (handlers.has(subscriptionId)) {
        handlers.delete(subscriptionId);
        if (handlers.size === 0) {
          this.subscriptions.delete(event);
        }
        this.logger?.('eventbus:unsubscribe', { event, id: subscriptionId });
        return true;
      }
    }

    return false;
  }

  /**
   * Emit an event
   * All handlers are called asynchronously. Errors are caught and logged.
   */
  async emit(event: string, data: any): Promise<void> {
    this.logger?.('eventbus:emit', { event, dataKeys: Object.keys(data || {}) });

    const handlers: EventHandler[] = [];

    // Collect specific handlers
    const eventHandlers = this.subscriptions.get(event);
    if (eventHandlers) {
      handlers.push(...eventHandlers.values());
    }

    // Collect wildcard handlers
    handlers.push(...this.wildcardHandlers.values());

    // Execute all handlers in parallel
    const results = await Promise.allSettled(
      handlers.map((handler) => handler(data))
    );

    // Log errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger?.('eventbus:error', {
          event,
          handlerIndex: index,
          error: result.reason,
        });
      }
    });
  }

  /**
   * List all registered events
   */
  listEvents(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get handler count for an event
   */
  handlerCount(event: string): number {
    const specific = this.subscriptions.get(event)?.size || 0;
    return specific + this.wildcardHandlers.size;
  }

  /**
   * Remove all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.wildcardHandlers.clear();
    this.logger?.('eventbus:clear', {});
  }

  private generateId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
