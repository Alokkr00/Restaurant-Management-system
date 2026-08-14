import Database from 'better-sqlite3';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

export type OrderStatus =
  | 'DRAFT'
  | 'SENT_TO_KITCHEN'
  | 'READY'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CLOSED'
  | 'VOIDED'
  | 'REFUNDED';

export type TenderType = 'CASH' | 'CARD_TERMINAL' | 'EXTERNAL_AGGREGATOR';

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  modifierIds?: string[];
  notes?: string;
}

export interface CreateOrderRequest {
  storeId: string;
  terminalId: string;
  tableId?: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  items: CreateOrderItemInput[];
  idempotencyKey?: string;
}

export interface CheckoutPaymentRequest {
  orderId: string;
  tenderType: TenderType;
  tenderAmountCents: number;
  terminalRef?: string;
  idempotencyKey?: string;
}

export interface CalculatedOrderLine {
  lineId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  notes?: string;
  modifiers: {
    lineModId: string;
    modifierId: string;
    modifierName: string;
    unitPriceCents: number;
  }[];
}

export interface CalculatedOrder {
  orderId: string;
  storeId: string;
  terminalId: string;
  tableId?: string;
  orderType: string;
  status: OrderStatus;
  menuVersionId: string;
  subtotalCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  lines: CalculatedOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export class OrderStateMachine {
  constructor(private db: any) {}

  /**
   * Valid transition matrix enforcing strict lifecycle progression
   */
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    DRAFT: ['SENT_TO_KITCHEN', 'PAYMENT_PENDING', 'VOIDED'],
    SENT_TO_KITCHEN: ['READY', 'PAYMENT_PENDING', 'VOIDED'],
    READY: ['PAYMENT_PENDING', 'PAID', 'VOIDED'],
    PAYMENT_PENDING: ['PAID', 'SENT_TO_KITCHEN', 'VOIDED'],
    PAID: ['CLOSED', 'REFUNDED'],
    CLOSED: ['REFUNDED'],
    VOIDED: [],
    REFUNDED: [],
  };

  /**
   * Independent server-side order creation and pricing
   */
  public createAndPriceOrder(req: CreateOrderRequest): CalculatedOrder {
    // 1. Idempotency Check
    if (req.idempotencyKey) {
      const existing = this.getOrderByNaturalIdempotency(req.idempotencyKey);
      if (existing) return existing;
    }

    // 2. Fetch Store & Active Menu Version
    const store = this.db.prepare('SELECT store_id, currency, tax_rate_bps FROM stores WHERE store_id = ?').get(req.storeId) as
      | { store_id: string; currency: string; tax_rate_bps: number }
      | undefined;
    if (!store) {
      throw new Error(`Store with ID '${req.storeId}' does not exist.`);
    }

    const activeMenu = this.db.prepare('SELECT menu_version_id FROM menu_versions WHERE is_active = 1 LIMIT 1').get() as
      | { menu_version_id: string }
      | undefined;
    if (!activeMenu) {
      throw new Error('No active menu version published for pricing.');
    }

    if (!req.items || req.items.length === 0) {
      throw new Error('Cannot create an empty order. At least one line item is required.');
    }

    // 3. Price Every Line Item on the Server
    const orderId = uuidv4();
    const now = new Date().toISOString();
    let subtotalCents = 0;
    const lines: CalculatedOrderLine[] = [];

    const getProductStmt = this.db.prepare(
      'SELECT product_id, name, price_cents, is_available FROM products WHERE product_id = ? AND menu_version_id = ?'
    );
    const getModifierStmt = this.db.prepare(
      'SELECT modifier_id, name, price_cents FROM modifiers WHERE modifier_id = ? AND menu_version_id = ?'
    );

    for (const item of req.items) {
      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity ${item.quantity} for product '${item.productId}'. Quantity must be positive.`);
      }

      const product = getProductStmt.get(item.productId, activeMenu.menu_version_id) as
        | { product_id: string; name: string; price_cents: number; is_available: number }
        | undefined;
      if (!product) {
        throw new Error(`Product '${item.productId}' not found in active menu version.`);
      }
      if (!product.is_available) {
        throw new Error(`Product '${product.name}' is currently 86'd (unavailable).`);
      }

      let lineUnitTotalCents = product.price_cents;
      const lineModifiers: CalculatedOrderLine['modifiers'] = [];

      if (item.modifierIds && item.modifierIds.length > 0) {
        for (const modId of item.modifierIds) {
          const mod = getModifierStmt.get(modId, activeMenu.menu_version_id) as
            | { modifier_id: string; name: string; price_cents: number }
            | undefined;
          if (mod) {
            lineUnitTotalCents += mod.price_cents;
            lineModifiers.push({
              lineModId: uuidv4(),
              modifierId: mod.modifier_id,
              modifierName: mod.name,
              unitPriceCents: mod.price_cents,
            });
          }
        }
      }

      const lineTotalCents = lineUnitTotalCents * item.quantity;
      subtotalCents += lineTotalCents;

      lines.push({
        lineId: uuidv4(),
        productId: product.product_id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: product.price_cents,
        totalPriceCents: lineTotalCents,
        notes: item.notes,
        modifiers: lineModifiers,
      });
    }

    // 4. Server-Side Half-Up Tax Calculation (Basis Points / Integer Division)
    // Formula: round((subtotal_cents * tax_rate_bps) / 10000)
    const taxCents = Math.round((subtotalCents * store.tax_rate_bps) / 10000);
    const totalCents = subtotalCents + taxCents;

    // 5. Atomic SQLite Write (Order + Lines + Outbox)
    const insertOrderTx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO orders (
            order_id, store_id, terminal_id, table_id, order_type, status,
            menu_version_id, subtotal_cents, tax_cents, discount_cents, total_cents,
            currency, idempotency_key, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `)
        .run(
          orderId,
          req.storeId,
          req.terminalId,
          req.tableId || null,
          req.orderType,
          activeMenu.menu_version_id,
          subtotalCents,
          taxCents,
          totalCents,
          store.currency,
          req.idempotencyKey || null,
          now,
          now
        );

      const insertLineStmt = this.db.prepare(`
        INSERT INTO order_lines (line_id, order_id, product_id, product_name, quantity, unit_price_cents, total_price_cents, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `);

      const insertModStmt = this.db.prepare(`
        INSERT INTO line_modifiers (line_mod_id, line_id, modifier_id, modifier_name, unit_price_cents)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const line of lines) {
        insertLineStmt.run(
          line.lineId,
          orderId,
          line.productId,
          line.productName,
          line.quantity,
          line.unitPriceCents,
          line.totalPriceCents,
          line.notes || null
        );

        for (const mod of line.modifiers) {
          insertModStmt.run(mod.lineModId, line.lineId, mod.modifierId, mod.modifierName, mod.unitPriceCents);
        }
      }

      // Record in Transactional Outbox
      this.recordOutboxEvent('ORDER_CREATED', {
        orderId,
        storeId: req.storeId,
        totalCents,
        itemCount: lines.length,
        createdAt: now,
      });
    });

    insertOrderTx();

    return {
      orderId,
      storeId: req.storeId,
      terminalId: req.terminalId,
      tableId: req.tableId,
      orderType: req.orderType,
      status: 'DRAFT',
      menuVersionId: activeMenu.menu_version_id,
      subtotalCents,
      taxCents,
      discountCents: 0,
      totalCents,
      currency: store.currency,
      lines,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Transition order to a new lifecycle state
   */
  public transitionState(orderId: string, newStatus: OrderStatus, actorUserId?: string, reason?: string): void {
    const order = this.db.prepare('SELECT status, store_id FROM orders WHERE order_id = ?').get(orderId) as
      | { status: OrderStatus; store_id: string }
      | undefined;
    if (!order) {
      throw new Error(`Order '${orderId}' not found.`);
    }

    const allowed = OrderStateMachine.VALID_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(`Invalid state transition from '${order.status}' to '${newStatus}'. Allowed: [${allowed?.join(', ') || 'none'}]`);
    }

    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?').run(newStatus, now, orderId);

      if (newStatus === 'CLOSED') {
        this.db.prepare('UPDATE orders SET closed_at = ? WHERE order_id = ?').run(now, orderId);
      }

      // Record Audit Event
      this.db.prepare(`
        INSERT INTO audit_events (event_id, store_id, user_id, device_id, action, entity_type, entity_id, before_json, after_json, created_at)
        VALUES (?, ?, ?, 'server', 'ORDER_STATUS_CHANGED', 'ORDER', ?, ?, ?, ?)
      `).run(
        uuidv4(),
        order.store_id,
        actorUserId || 'system',
        orderId,
        JSON.stringify({ status: order.status }),
        JSON.stringify({ status: newStatus, reason }),
        now
      );

      this.recordOutboxEvent('ORDER_STATUS_UPDATED', { orderId, oldStatus: order.status, newStatus, updatedAt: now });
    });

    tx();
  }

  /**
   * Process payment tender atomically and generate durable print jobs
   */
  public processPayment(req: CheckoutPaymentRequest): {
    paymentId: string;
    orderId: string;
    amountCents: number;
    changeCents: number;
    status: string;
    receiptPrintJobId: string;
    kotPrintJobId: string;
  } {
    // 1. Idempotency Check
    if (req.idempotencyKey) {
      const existing = this.db
        .prepare('SELECT payment_id, order_id, amount_cents, change_cents, status FROM payments WHERE idempotency_key = ?')
        .get(req.idempotencyKey) as any;
      if (existing) {
        return {
          paymentId: existing.payment_id,
          orderId: existing.order_id,
          amountCents: existing.amount_cents,
          changeCents: existing.change_cents,
          status: existing.status,
          receiptPrintJobId: `reprint-${existing.payment_id}`,
          kotPrintJobId: `kot-${existing.payment_id}`,
        };
      }
    }

    const order = this.db
      .prepare('SELECT order_id, store_id, total_cents, status, currency FROM orders WHERE order_id = ?')
      .get(req.orderId) as { order_id: string; store_id: string; total_cents: number; status: OrderStatus; currency: string } | undefined;

    if (!order) {
      throw new Error(`Order '${req.orderId}' not found.`);
    }

    if (order.status === 'PAID' || order.status === 'CLOSED') {
      throw new Error(`Order '${req.orderId}' is already settled (${order.status}).`);
    }

    if (req.tenderAmountCents < order.total_cents) {
      throw new Error(
        `Insufficient tender amount: Provided ${req.tenderAmountCents} cents, but order total is ${order.total_cents} cents.`
      );
    }

    const changeCents = req.tenderType === 'CASH' ? req.tenderAmountCents - order.total_cents : 0;
    const paymentId = uuidv4();
    const receiptJobId = uuidv4();
    const kotJobId = uuidv4();
    const now = new Date().toISOString();

    const checkoutTx = this.db.transaction(() => {
      // 1. Record Payment
      this.db
        .prepare(`
          INSERT INTO payments (
            payment_id, order_id, store_id, tender_type, amount_cents,
            change_cents, status, terminal_ref, idempotency_key, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'SETTLED', ?, ?, ?)
        `)
        .run(
          paymentId,
          order.order_id,
          order.store_id,
          req.tenderType,
          req.tenderAmountCents,
          changeCents,
          req.terminalRef || null,
          req.idempotencyKey || null,
          now
        );

      // 2. Transition Order to PAID / CLOSED
      this.db.prepare("UPDATE orders SET status = 'PAID', updated_at = ? WHERE order_id = ?").run(now, order.order_id);

      // 3. Atomically Insert Durable Customer Receipt Print Job
      const receiptPayload = JSON.stringify({
        storeId: order.store_id,
        orderId: order.order_id,
        totalCents: order.total_cents,
        tenderType: req.tenderType,
        tenderAmountCents: req.tenderAmountCents,
        changeCents,
        timestamp: now,
      });

      this.db
        .prepare(`
          INSERT INTO print_jobs (
            job_id, order_id, printer_id, job_type, payload_raw,
            status, attempts, created_at, updated_at
          ) VALUES (?, ?, 'printer-receipt-primary', 'RECEIPT', ?, 'PENDING', 0, ?, ?)
        `)
        .run(receiptJobId, order.order_id, receiptPayload, now, now);

      // 4. Atomically Insert Kitchen Order Ticket (KOT) Print Job
      this.db
        .prepare(`
          INSERT INTO print_jobs (
            job_id, order_id, printer_id, job_type, payload_raw,
            status, attempts, created_at, updated_at
          ) VALUES (?, ?, 'printer-hotline-primary', 'KOT', ?, 'PENDING', 0, ?, ?)
        `)
        .run(kotJobId, order.order_id, receiptPayload, now, now);

      // 5. Insert Kitchen Ticket record
      this.db
        .prepare(`
          INSERT INTO kitchen_tickets (ticket_id, order_id, station_id, status, fired_at)
          VALUES (?, ?, 'HOTLINE_1', 'PENDING', ?)
        `)
        .run(uuidv4(), order.order_id, now);

      // 6. Record Outbox Event
      this.recordOutboxEvent('PAYMENT_SETTLED', {
        paymentId,
        orderId: order.order_id,
        storeId: order.store_id,
        amountCents: req.tenderAmountCents,
        totalCents: order.total_cents,
        tenderType: req.tenderType,
        timestamp: now,
      });
    });

    checkoutTx();

    return {
      paymentId,
      orderId: order.order_id,
      amountCents: req.tenderAmountCents,
      changeCents,
      status: 'SETTLED',
      receiptPrintJobId: receiptJobId,
      kotPrintJobId: kotJobId,
    };
  }

  private recordOutboxEvent(eventType: string, payload: any): void {
    const row = this.db.prepare('SELECT COALESCE(MAX(sequence_number), 0) AS maxSeq FROM sync_outbox').get() as any;
    const nextSeq = (row?.maxSeq ?? row?.maxseq ?? Object.values(row || {})[0] ?? 0) + 1;
    this.db
      .prepare(`
        INSERT INTO sync_outbox (event_id, store_id, event_type, sequence_number, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(uuidv4(), payload.storeId || 'store-104', eventType, nextSeq, JSON.stringify(payload), new Date().toISOString());
  }

  private getOrderByNaturalIdempotency(key: string): CalculatedOrder | null {
    const row = this.db.prepare('SELECT order_id FROM orders WHERE idempotency_key = ?').get(key) as { order_id: string } | undefined;
    if (!row) return null;
    return this.getOrderById(row.order_id);
  }

  public getOrderById(orderId: string): CalculatedOrder | null {
    const order = this.db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId) as any;
    if (!order) return null;

    const lines = this.db.prepare('SELECT * FROM order_lines WHERE order_id = ?').all(orderId) as any[];
    const calculatedLines: CalculatedOrderLine[] = [];

    for (const l of lines) {
      const mods = this.db.prepare('SELECT * FROM line_modifiers WHERE line_id = ?').all(l.line_id) as any[];
      calculatedLines.push({
        lineId: l.line_id,
        productId: l.product_id,
        productName: l.product_name,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
        totalPriceCents: l.total_price_cents,
        notes: l.notes,
        modifiers: mods.map(m => ({
          lineModId: m.line_mod_id,
          modifierId: m.modifier_id,
          modifierName: m.modifier_name,
          unitPriceCents: m.unit_price_cents,
        })),
      });
    }

    return {
      orderId: order.order_id,
      storeId: order.store_id,
      terminalId: order.terminal_id,
      tableId: order.table_id,
      orderType: order.order_type,
      status: order.status,
      menuVersionId: order.menu_version_id,
      subtotalCents: order.subtotal_cents,
      taxCents: order.tax_cents,
      discountCents: order.discount_cents,
      totalCents: order.total_cents,
      currency: order.currency,
      lines: calculatedLines,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }
}
