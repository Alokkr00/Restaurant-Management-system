import { DatabaseAdapter } from '../../store-edge/db/database-adapter.js';
import { OrderCreatedEvent, OrderCancelledEvent } from '../events/order-events.js';

export interface CashierOrderSummary {
  orderId: string;
  storeId: string;
  terminalId: string;
  tableId?: string;
  status: string;
  totalCents: number;
  itemsCount: number;
  itemsSummary: string;
  createdAt: string;
  updatedAt: string;
}

export class CashierProjectionEngine {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  public async handleOrderCreated(event: OrderCreatedEvent): Promise<CashierOrderSummary> {
    const order = event.payload;
    const now = new Date().toISOString();

    const itemsSummary = order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
    const totalItemQty = order.items.reduce((sum, i) => sum + i.quantity, 0);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pos_cashier_orders_projection (
        order_id, store_id, terminal_id, table_id, status,
        total_cents, items_count, items_summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.orderId,
      order.storeId,
      order.terminalId,
      order.tableId || null,
      order.totalCents,
      totalItemQty,
      itemsSummary,
      now,
      now
    );

    return this.getOrderById(order.orderId)!;
  }

  public async handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE pos_cashier_orders_projection
      SET status = 'CANCELLED', updated_at = ?
      WHERE order_id = ?
    `);
    stmt.run(new Date().toISOString(), event.payload.orderId);
  }

  public getActiveOrders(storeId: string = 'store-104', terminalId?: string): CashierOrderSummary[] {
    let sql = "SELECT * FROM pos_cashier_orders_projection WHERE store_id = ? AND status = 'ACTIVE'";
    const params: any[] = [storeId];

    if (terminalId) {
      sql += ' AND terminal_id = ?';
      params.push(terminalId);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((r) => ({
      orderId: r.order_id,
      storeId: r.store_id,
      terminalId: r.terminal_id,
      tableId: r.table_id || undefined,
      status: r.status,
      totalCents: r.total_cents,
      itemsCount: r.items_count,
      itemsSummary: r.items_summary,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public getOrderById(orderId: string): CashierOrderSummary | null {
    const r = this.db.prepare('SELECT * FROM pos_cashier_orders_projection WHERE order_id = ?').get(orderId) as any;
    if (!r) return null;

    return {
      orderId: r.order_id,
      storeId: r.store_id,
      terminalId: r.terminal_id,
      tableId: r.table_id || undefined,
      status: r.status,
      totalCents: r.total_cents,
      itemsCount: r.items_count,
      itemsSummary: r.items_summary,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
