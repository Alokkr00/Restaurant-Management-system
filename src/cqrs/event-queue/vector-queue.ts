import { OrderEvent, VectorClock } from '../events/order-events.js';

export type EventHandler<T extends OrderEvent = OrderEvent> = (event: T) => Promise<void> | void;

export class AsyncVectorEventQueue {
  private nodeId: string;
  private currentClock: VectorClock = {};
  private handlers: Map<string, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];
  private queue: OrderEvent[] = [];
  private isProcessing: boolean = false;
  private processedCount: number = 0;

  constructor(nodeId: string = 'store-104') {
    this.nodeId = nodeId;
    this.currentClock[this.nodeId] = 0;
  }

  /**
   * Advances the local node's logical clock and returns the updated vector clock.
   */
  public advanceClock(): VectorClock {
    this.currentClock[this.nodeId] = (this.currentClock[this.nodeId] || 0) + 1;
    return { ...this.currentClock };
  }

  /**
   * Merges an incoming vector clock with the current node clock.
   */
  public mergeClock(incoming: VectorClock): VectorClock {
    for (const [node, clockVal] of Object.entries(incoming)) {
      this.currentClock[node] = Math.max(this.currentClock[node] || 0, clockVal);
    }
    return { ...this.currentClock };
  }

  /**
   * Returns current vector clock snapshot
   */
  public getVectorClock(): VectorClock {
    return { ...this.currentClock };
  }

  /**
   * Subscribes a handler to a specific event type.
   */
  public subscribe<T extends OrderEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);
  }

  /**
   * Subscribes a handler to all events.
   */
  public subscribeAll(handler: EventHandler): void {
    this.globalHandlers.push(handler);
  }

  /**
   * Publishes an event to the asynchronous vector queue and triggers background processing.
   * Does NOT block the caller.
   */
  public enqueue(event: OrderEvent): void {
    this.mergeClock(event.vectorClock);
    this.queue.push(event);

    // Schedule out-of-band processing
    setImmediate(() => {
      this.processQueue();
    });
  }

  /**
   * Flushes queue synchronously (useful for test harnesses and controlled batch runs).
   */
  public async flush(): Promise<number> {
    let processedThisFlush = 0;
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      await this.dispatch(event);
      this.processedCount++;
      processedThisFlush++;
    }
    return processedThisFlush;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift()!;
        try {
          await this.dispatch(event);
          this.processedCount++;
        } catch (err) {
          console.error(`[AsyncVectorEventQueue] Error processing event ${event.eventId}:`, err);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async dispatch(event: OrderEvent): Promise<void> {
    const specific = this.handlers.get(event.eventType) || [];
    for (const handler of specific) {
      await handler(event);
    }
    for (const handler of this.globalHandlers) {
      await handler(event);
    }
  }

  public getMetrics(): { queueDepth: number; processedCount: number; currentClock: VectorClock } {
    return {
      queueDepth: this.queue.length,
      processedCount: this.processedCount,
      currentClock: { ...this.currentClock },
    };
  }
}
