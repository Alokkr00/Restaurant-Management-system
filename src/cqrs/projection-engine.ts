import { DatabaseAdapter } from '../store-edge/db/database-adapter.js';
import { AsyncVectorEventQueue } from './event-queue/vector-queue.js';
import { CreateOrderCommand, OrderCommandValidator, CommandValidationResult } from './commands/order-commands.js';
import { OrderCreatedEvent, OrderBumpedEvent } from './events/order-events.js';
import { KDSProjectionEngine, KDSTicketProjection } from './projections/kds-projection.js';
import { CashierProjectionEngine, CashierOrderSummary } from './projections/cashier-projection.js';
import { InventoryBOMProjectionWorker, StockLevelRecord, DepletionRecord } from './projections/inventory-bom-projection.js';
import { InventoryRecipeEngine } from '../inventory/recipe-engine.js';
import { MenuMDMService } from '../mdm/menu-mdm.js';

export interface CommandAckResponse {
  success: boolean;
  orderId: string;
  eventId: string;
  vectorClock: Record<string, number>;
  status: 'ACCEPTED_IN_WAL';
  validation: CommandValidationResult;
  timestamp: string;
}

export class CQRSOrderEngine {
  private db: DatabaseAdapter;
  private queue: AsyncVectorEventQueue;
  private validator: OrderCommandValidator;
  public kdsProjection: KDSProjectionEngine;
  public cashierProjection: CashierProjectionEngine;
  public inventoryProjection: InventoryBOMProjectionWorker;

  constructor(
    db: DatabaseAdapter,
    recipeEngine: InventoryRecipeEngine,
    menuMDM?: MenuMDMService,
    nodeId: string = 'store-104'
  ) {
    this.db = db;
    this.queue = new AsyncVectorEventQueue(nodeId);
    this.validator = new OrderCommandValidator(menuMDM);
    this.kdsProjection = new KDSProjectionEngine(db);
    this.cashierProjection = new CashierProjectionEngine(db);
    this.inventoryProjection = new InventoryBOMProjectionWorker(db, recipeEngine);

    this.wireProjections();
  }

  private wireProjections(): void {
    // 1. KDS Projection Worker
    this.queue.subscribe<OrderCreatedEvent>('OrderCreated', async (event) => {
      await this.kdsProjection.handleOrderCreated(event);
    });

    // 2. Cashier Active Orders Projection Worker
    this.queue.subscribe<OrderCreatedEvent>('OrderCreated', async (event) => {
      await this.cashierProjection.handleOrderCreated(event);
    });

    // 3. Out-of-band Recipe BOM Yield Depletion Worker
    this.queue.subscribe<OrderCreatedEvent>('OrderCreated', async (event) => {
      await this.inventoryProjection.handleOrderCreated(event);
    });
  }

  /**
   * Command Path (Writes):
   * 1. Validates line items, quantities, prices, and allergen rules.
   * 2. Writes append-only to SQLite WAL (order_events_wal + orders).
   * 3. Emits OrderCreatedEvent to asynchronous vector queue.
   * 4. Returns fast ACK without waiting for out-of-band projections.
   */
  public async executeCreateOrder(command: CreateOrderCommand): Promise<CommandAckResponse> {
    const validation = this.validator.validate(command);
    if (!validation.isValid) {
      throw new Error(`Command validation failed: ${validation.errors.join('; ')}`);
    }

    const eventId = `evt-ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = command.timestamp || new Date().toISOString();
    const clock = this.queue.advanceClock();

    // ── Atomically write to append-only SQLite WAL ──
    const writeTransaction = this.db.transaction(() => {
      // 1. Append to order_events_wal
      const insertWalStmt = this.db.prepare(`
        INSERT INTO order_events_wal (
          event_id, order_id, event_type, aggregate_version,
          store_id, terminal_id, payload_json, vector_clock, created_at
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
      `);

      insertWalStmt.run(
        eventId,
        command.orderId,
        'OrderCreated',
        command.storeId,
        command.terminalId,
        JSON.stringify(command),
        JSON.stringify(clock),
        now
      );

      // 2. Write to orders write-model
      const insertOrderStmt = this.db.prepare(`
        INSERT OR REPLACE INTO orders (
          order_id, store_id, terminal_id, table_id, order_type,
          status, menu_version_id, subtotal_cents, tax_cents,
          discount_cents, total_cents, currency, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'SENT_TO_KITCHEN', 'menu-v1', ?, ?, 0, ?, 'USD', ?, ?)
      `);

      insertOrderStmt.run(
        command.orderId,
        command.storeId,
        command.terminalId,
        command.tableId || null,
        command.orderType,
        command.subtotalCents,
        command.taxCents,
        command.totalCents,
        now,
        now
      );

      // 3. Write line items
      const insertLineStmt = this.db.prepare(`
        INSERT OR REPLACE INTO order_lines (
          line_id, order_id, product_id, product_name,
          quantity, unit_price_cents, total_price_cents, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `);

      for (let i = 0; i < command.items.length; i++) {
        const item = command.items[i];
        const lineId = `line-${command.orderId}-${i + 1}`;
        insertLineStmt.run(
          lineId,
          command.orderId,
          item.menuItemId,
          item.name,
          item.quantity,
          item.unitPriceCents,
          item.unitPriceCents * item.quantity,
          item.notes || null
        );
      }
    });

    writeTransaction();

    // ── Emit order event to asynchronous vector queue ──
    const orderCreatedEvent: OrderCreatedEvent = {
      eventId,
      eventType: 'OrderCreated',
      aggregateId: command.orderId,
      aggregateVersion: 1,
      storeId: command.storeId,
      terminalId: command.terminalId,
      vectorClock: clock,
      timestamp: now,
      payload: { ...command, createdAt: now },
    };

    this.queue.enqueue(orderCreatedEvent);

    return {
      success: true,
      orderId: command.orderId,
      eventId,
      vectorClock: clock,
      status: 'ACCEPTED_IN_WAL',
      validation,
      timestamp: now,
    };
  }

  /**
   * Flushes all pending projections on the queue (for deterministic test runs)
   */
  public async flushProjections(): Promise<number> {
    return this.queue.flush();
  }

  // ── Query Path (Reads) ──
  public getKDSTickets(storeId?: string, station?: string): KDSTicketProjection[] {
    return this.kdsProjection.getActiveTickets(storeId, station);
  }

  public bumpKDSTicket(ticketId: string): KDSTicketProjection | null {
    return this.kdsProjection.bumpTicket(ticketId);
  }

  public getCashierActiveOrders(storeId?: string, terminalId?: string): CashierOrderSummary[] {
    return this.cashierProjection.getActiveOrders(storeId, terminalId);
  }

  public getInventoryStock(storeId?: string): StockLevelRecord[] {
    return this.inventoryProjection.getStockLevels(storeId);
  }

  public getDepletionHistory(orderId?: string): DepletionRecord[] {
    return this.inventoryProjection.getDepletionHistory(orderId);
  }

  public getQueueMetrics() {
    return this.queue.getMetrics();
  }
}
