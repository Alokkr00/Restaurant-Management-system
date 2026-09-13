import { DatabaseAdapter } from '../../store-edge/db/database-adapter.js';
import { OrderCreatedEvent, OrderBumpedEvent } from '../events/order-events.js';

export interface KDSTicketItem {
  qty: number;
  name: string;
  modifiers: string[];
  allergens: string[];
}

export interface KDSTicketProjection {
  id: string;
  orderId: string;
  storeId: string;
  station: string;
  status: 'PENDING' | 'IN_PREP' | 'READY' | 'LATE' | 'BUMPED';
  source: string;
  diningType: string;
  tableNumber?: string;
  serverName?: string;
  items: KDSTicketItem[];
  elapsedMinutes: number;
  elapsedSeconds: number;
  createdAt: string;
  bumpedAt?: string;
}

export class KDSProjectionEngine {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  /**
   * Translates incoming OrderCreatedEvent into a pre-indexed KDS read projection record.
   */
  public async handleOrderCreated(event: OrderCreatedEvent): Promise<KDSTicketProjection> {
    const order = event.payload;
    const ticketId = `TKT-${order.orderId.slice(-6).toUpperCase()}`;

    // Categorize primary kitchen station based on items
    let primaryStation = 'HOTLINE_1';
    const isPizza = order.items.some((i) => i.name.toLowerCase().includes('pizza'));
    const isWings = order.items.some((i) => i.name.toLowerCase().includes('wing'));

    if (isPizza) {
      primaryStation = 'PIZZA_LINE';
    } else if (isWings) {
      primaryStation = 'WING_FRYER';
    }

    const formattedItems: KDSTicketItem[] = order.items.map((i) => ({
      qty: i.quantity,
      name: i.name,
      modifiers: (i.modifiers || []).map((m) => m.name),
      allergens: [],
    }));

    const now = new Date().toISOString();
    const source = order.terminalId.includes('pos') ? 'POS Register' : 'Online / Aggregator';
    const diningType = order.orderType === 'DINE_IN' ? 'DINE IN' : (order.orderType === 'TAKEAWAY' ? 'TO GO PICKUP' : 'DELIVERY');
    const tableNumber = order.tableId ? order.tableId.replace('tbl-', '#') : undefined;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kds_ticket_projections (
        ticket_id, order_id, store_id, station, status,
        source, dining_type, table_number, server_name,
        items_json, elapsed_minutes, elapsed_seconds,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `);

    stmt.run(
      ticketId,
      order.orderId,
      order.storeId,
      primaryStation,
      'IN_PREP',
      source,
      diningType,
      tableNumber || null,
      order.serverUserId || 'Server',
      JSON.stringify(formattedItems),
      now,
      now
    );

    return this.getTicketById(ticketId)!;
  }

  /**
   * Fast indexed query for KDS screens: fetches active tickets without scanning orders history.
   */
  public getActiveTickets(storeId: string = 'store-104', station?: string): KDSTicketProjection[] {
    let sql = "SELECT * FROM kds_ticket_projections WHERE store_id = ? AND status != 'BUMPED'";
    const params: any[] = [storeId];

    if (station && station !== 'ALL') {
      sql += ' AND station = ?';
      params.push(station);
    }
    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((r) => this.mapRow(r));
  }

  public getTicketById(ticketId: string): KDSTicketProjection | null {
    const r = this.db.prepare('SELECT * FROM kds_ticket_projections WHERE ticket_id = ?').get(ticketId) as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  /**
   * Advances ticket state: IN_PREP -> READY -> BUMPED
   */
  public bumpTicket(ticketId: string): KDSTicketProjection | null {
    const existing = this.getTicketById(ticketId);
    if (!existing) return null;

    let newStatus: KDSTicketProjection['status'] = 'READY';
    const now = new Date().toISOString();
    let bumpedAt: string | null = null;

    if (existing.status === 'IN_PREP') {
      newStatus = 'READY';
    } else if (existing.status === 'READY' || existing.status === 'LATE') {
      newStatus = 'BUMPED';
      bumpedAt = now;
    }

    const stmt = this.db.prepare(`
      UPDATE kds_ticket_projections
      SET status = ?, bumped_at = COALESCE(?, bumped_at), updated_at = ?
      WHERE ticket_id = ?
    `);

    stmt.run(newStatus, bumpedAt, now, ticketId);
    return this.getTicketById(ticketId);
  }

  private mapRow(r: any): KDSTicketProjection {
    return {
      id: r.ticket_id,
      orderId: r.order_id,
      storeId: r.store_id,
      station: r.station,
      status: r.status,
      source: r.source,
      diningType: r.dining_type,
      tableNumber: r.table_number || undefined,
      serverName: r.server_name || undefined,
      items: JSON.parse(r.items_json || '[]'),
      elapsedMinutes: r.elapsed_minutes,
      elapsedSeconds: r.elapsed_seconds,
      createdAt: r.created_at,
      bumpedAt: r.bumped_at || undefined,
    };
  }
}
