import crypto from 'crypto';
import { GSTInvoiceEngine, StoreFiscalProfile, FiscalInvoice } from '../tax/gst-invoice-engine.js';

const uuidv4 = () => crypto.randomUUID();

export type OrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'SENT_TO_KITCHEN'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CLOSED'
  | 'VOIDED'
  | 'REFUNDED';

export type TenderType = 'CASH' | 'CARD_TERMINAL' | 'UPI' | 'EXTERNAL_AGGREGATOR';

export interface CreateOrderItemInput {
  productId: string;
  variantId?: string;
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
  isTraining?: boolean;
  customerStateCode?: string;
  applyServiceCharge?: boolean;
}

export interface CheckoutPaymentRequest {
  orderId: string;
  tenderType: TenderType;
  tenderAmountCents: number; // in minor units / cents / paise
  terminalRef?: string;
  idempotencyKey?: string;
}

export interface CalculatedOrderLine {
  lineId: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  sacCode: string;
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
  businessDate: string; // YYYY-MM-DD
  isTraining: boolean;
  menuVersionId: string;
  subtotalCents: number;
  serviceChargeCents: number;
  taxCents: number;
  cgstCents: number;
  sgstCents: number;
  igstCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  invoiceNumber?: string;
  upiQrPayload?: string;
  lines: CalculatedOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export class OrderStateMachine {
  private invoiceEngine = new GSTInvoiceEngine();

  constructor(private db: any) {}

  /**
   * Valid transition matrix enforcing strict lifecycle progression
   */
  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    DRAFT: ['SUBMITTED', 'SENT_TO_KITCHEN', 'PAYMENT_PENDING', 'VOIDED'],
    SUBMITTED: ['ACCEPTED', 'SENT_TO_KITCHEN', 'PREPARING', 'PAYMENT_PENDING', 'VOIDED'],
    SENT_TO_KITCHEN: ['ACCEPTED', 'PREPARING', 'READY', 'PAYMENT_PENDING', 'VOIDED'],
    ACCEPTED: ['PREPARING', 'READY', 'VOIDED'],
    PREPARING: ['READY', 'VOIDED'],
    READY: ['SERVED', 'PAYMENT_PENDING', 'PAID', 'VOIDED'],
    SERVED: ['PAYMENT_PENDING', 'PAID', 'CLOSED', 'VOIDED'],
    PAYMENT_PENDING: ['PAID', 'SENT_TO_KITCHEN', 'VOIDED'],
    PAID: ['SERVED', 'CLOSED', 'REFUNDED'],
    CLOSED: ['REFUNDED'],
    VOIDED: [],
    REFUNDED: [],
  };

  /**
   * Calculates outlet-local Business Trading Date taking into account morning rollover (e.g. 04:00 AM cut-off)
   */
  public static calculateBusinessDate(date: Date, rolloverTimeHHMM = '04:00'): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const currentHHMM = `${hours}:${minutes}`;

    const workingDate = new Date(date.getTime());
    if (currentHHMM < rolloverTimeHHMM) {
      // Prior to rollover time belongs to previous trading day
      workingDate.setDate(workingDate.getDate() - 1);
    }

    const y = workingDate.getFullYear();
    const m = String(workingDate.getMonth() + 1).padStart(2, '0');
    const d = String(workingDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Independent server-side order creation, catalog pricing, and tax calculation
   */
  public createAndPriceOrder(req: CreateOrderRequest): CalculatedOrder {
    // 1. Idempotency Check
    if (req.idempotencyKey) {
      const existing = this.getOrderByNaturalIdempotency(req.idempotencyKey);
      if (existing) return existing;
    }

    // 2. Fetch Store & Active Menu Version
    const store = this.db.prepare('SELECT * FROM stores WHERE store_id = ?').get(req.storeId) as any;
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

    // 3. Calculate Trading Business Date
    const now = new Date();
    const nowIso = now.toISOString();
    const businessDate = OrderStateMachine.calculateBusinessDate(
      now,
      store.trading_day_rollover_time || '04:00'
    );

    // 4. Price Every Line Item on the Server
    const orderId = uuidv4();
    let subtotalFoodCents = 0;
    const lines: CalculatedOrderLine[] = [];

    const getProductStmt = this.db.prepare(
      'SELECT product_id, name, price_cents, is_available, sac_code FROM products WHERE product_id = ? AND menu_version_id = ?'
    );
    const getModifierStmt = this.db.prepare(
      'SELECT modifier_id, name, price_cents FROM modifiers WHERE modifier_id = ? AND menu_version_id = ?'
    );

    for (const item of req.items) {
      if (item.quantity <= 0) {
        throw new Error(`Invalid quantity ${item.quantity} for product '${item.productId}'. Quantity must be positive.`);
      }

      const product = getProductStmt.get(item.productId, activeMenu.menu_version_id) as any;
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
          const mod = getModifierStmt.get(modId, activeMenu.menu_version_id) as any;
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
      subtotalFoodCents += lineTotalCents;

      lines.push({
        lineId: uuidv4(),
        productId: product.product_id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: product.price_cents,
        totalPriceCents: lineTotalCents,
        sacCode: product.sac_code || '996331',
        notes: item.notes,
        modifiers: lineModifiers,
      });
    }

    // 5. Server-Side GST / Tax & Service Charge Calculation
    const fiscalProfile: StoreFiscalProfile = {
      storeId: store.store_id,
      storeName: store.name,
      countryCode: store.country_code || 'IN',
      gstin: store.gstin,
      stateCode: store.state_code || '27',
      currency: store.currency || 'INR',
      isTaxInclusive: store.is_tax_inclusive === 1,
      standardGstBps: store.tax_rate_bps || 500, // 5.00% standard restaurant GST
      serviceChargeBps: store.service_charge_bps || 500,
      upiVpa: store.upi_vpa,
    };

    const taxResult = this.invoiceEngine.calculateTaxes(
      fiscalProfile,
      lines.map(l => ({
        productId: l.productId,
        name: l.productName,
        sacCode: l.sacCode,
        quantity: l.quantity,
        grossAmountPaise: l.totalPriceCents,
      })),
      req.customerStateCode,
      req.applyServiceCharge
    );

    const isTraining = req.isTraining ? 1 : 0;

    // 6. Atomic SQLite Write (Order + Order Lines + Outbox)
    const insertOrderTx = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO orders (
            order_id, store_id, terminal_id, table_id, order_type, status,
            business_date, is_training, menu_version_id, subtotal_cents,
            tax_cents, discount_cents, total_cents, currency, idempotency_key,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
        `)
        .run(
          orderId,
          req.storeId,
          req.terminalId,
          req.tableId || null,
          req.orderType,
          businessDate,
          isTraining,
          activeMenu.menu_version_id,
          taxResult.subtotalFoodPaise,
          taxResult.totalTaxPaise,
          taxResult.grandTotalPaise,
          store.currency || 'INR',
          req.idempotencyKey || null,
          nowIso,
          nowIso
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
        businessDate,
        isTraining: req.isTraining || false,
        totalCents: taxResult.grandTotalPaise,
        itemCount: lines.length,
        createdAt: nowIso,
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
      businessDate,
      isTraining: req.isTraining || false,
      menuVersionId: activeMenu.menu_version_id,
      subtotalCents: taxResult.subtotalFoodPaise,
      serviceChargeCents: taxResult.serviceChargePaise,
      taxCents: taxResult.totalTaxPaise,
      cgstCents: taxResult.cgstPaise,
      sgstCents: taxResult.sgstPaise,
      igstCents: taxResult.igstPaise,
      discountCents: 0,
      totalCents: taxResult.grandTotalPaise,
      currency: store.currency || 'INR',
      lines,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  /**
   * Transition order to a new lifecycle state
   */
  public transitionState(orderId: string, newStatus: OrderStatus, actorUserId?: string, reason?: string): void {
    const order = this.db.prepare('SELECT status, store_id, business_date, total_cents FROM orders WHERE order_id = ?').get(orderId) as any;
    if (!order) {
      throw new Error(`Order '${orderId}' not found.`);
    }

    const allowed = OrderStateMachine.VALID_TRANSITIONS[order.status as OrderStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(`Invalid state transition from '${order.status}' to '${newStatus}'. Allowed: [${allowed?.join(', ') || 'none'}]`);
    }

    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?').run(newStatus, now, orderId);

      if (newStatus === 'CLOSED') {
        this.db.prepare('UPDATE orders SET closed_at = ? WHERE order_id = ?').run(now, orderId);
      }

      // If Voiding or Refunding, create a Reversing Credit Note record
      if (newStatus === 'VOIDED' || newStatus === 'REFUNDED') {
        const invRow = this.db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId) as any;
        if (invRow) {
          const nextSeqRow = this.db.prepare('SELECT COALESCE(MAX(sequence_number), 0) AS maxSeq FROM credit_notes').get() as any;
          const nextSeq = (nextSeqRow?.maxSeq ?? nextSeqRow?.maxseq ?? 0) + 1;
          const fy = GSTInvoiceEngine.getFinancialYear(order.business_date);
          const cnNumber = GSTInvoiceEngine.formatCreditNoteNumber(order.store_id, fy, nextSeq);

          this.db
            .prepare(`
              INSERT INTO credit_notes (
                credit_note_id, credit_note_number, invoice_id, original_invoice_number,
                store_id, sequence_number, business_date, reason, amount_paise, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              uuidv4(),
              cnNumber,
              invRow.invoice_id,
              invRow.invoice_number,
              order.store_id,
              nextSeq,
              order.business_date,
              reason || 'Customer Cancellation / Order Void',
              order.total_cents,
              now
            );

          this.db.prepare("UPDATE invoices SET status = 'CANCELLED' WHERE invoice_id = ?").run(invRow.invoice_id);
        }
      }

      // Record Audit Event
      this.db
        .prepare(`
          INSERT INTO audit_events (event_id, store_id, user_id, device_id, action, entity_type, entity_id, before_json, after_json, created_at)
          VALUES (?, ?, ?, 'server', 'ORDER_STATUS_CHANGED', 'ORDER', ?, ?, ?, ?)
        `)
        .run(
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
   * Process payment tender atomically, issue statutory GST invoice, and generate durable print jobs
   */
  public processPayment(req: CheckoutPaymentRequest): {
    paymentId: string;
    orderId: string;
    amountCents: number;
    changeCents: number;
    status: string;
    invoiceNumber: string;
    upiQrPayload?: string;
    receiptPrintJobId: string;
    kotPrintJobId: string;
  } {
    // 1. Idempotency Check
    if (req.idempotencyKey) {
      const existing = this.db
        .prepare('SELECT payment_id, order_id, amount_cents, change_cents, status FROM payments WHERE idempotency_key = ?')
        .get(req.idempotencyKey) as any;
      if (existing) {
        const inv = this.db.prepare('SELECT invoice_number, upi_qr_payload FROM invoices WHERE order_id = ?').get(existing.order_id) as any;
        return {
          paymentId: existing.payment_id,
          orderId: existing.order_id,
          amountCents: existing.amount_cents,
          changeCents: existing.change_cents,
          status: existing.status,
          invoiceNumber: inv?.invoice_number || 'INV-SETTLED',
          upiQrPayload: inv?.upi_qr_payload,
          receiptPrintJobId: `reprint-${existing.payment_id}`,
          kotPrintJobId: `kot-${existing.payment_id}`,
        };
      }
    }

    const order = this.db
      .prepare('SELECT * FROM orders WHERE order_id = ?')
      .get(req.orderId) as any;

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
    const invoiceId = uuidv4();
    const now = new Date().toISOString();

    const store = this.db.prepare('SELECT * FROM stores WHERE store_id = ?').get(order.store_id) as any;

    // Resolve Next Sequential Invoice Number
    const nextSeqRow = this.db.prepare('SELECT COALESCE(MAX(sequence_number), 0) AS maxSeq FROM invoices').get() as any;
    const nextSeq = (nextSeqRow?.maxSeq ?? nextSeqRow?.maxseq ?? 0) + 1;
    const fy = GSTInvoiceEngine.getFinancialYear(order.business_date);
    const invoiceNumber = GSTInvoiceEngine.formatInvoiceNumber(order.store_id, fy, nextSeq);

    const upiQrPayload = store?.upi_vpa
      ? this.invoiceEngine.generateUpiQrPayload(store.upi_vpa, store.name, invoiceNumber, order.total_cents)
      : undefined;

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

      // 2. Issue Statutory GST Invoice Record
      this.db
        .prepare(`
          INSERT INTO invoices (
            invoice_id, invoice_number, store_id, order_id, sequence_number,
            business_date, financial_year, gstin, subtotal_paise, total_tax_paise,
            cgst_paise, sgst_paise, igst_paise, service_charge_paise, grand_total_paise,
            currency, upi_qr_payload, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'ISSUED', ?)
        `)
        .run(
          invoiceId,
          invoiceNumber,
          order.store_id,
          order.order_id,
          nextSeq,
          order.business_date,
          fy,
          store?.gstin || 'UNREGISTERED',
          order.subtotal_cents,
          order.tax_cents,
          Math.floor(order.tax_cents / 2),
          order.tax_cents - Math.floor(order.tax_cents / 2),
          0,
          order.total_cents,
          order.currency,
          upiQrPayload || null,
          now
        );

      // 3. Transition Order to PAID
      this.db.prepare("UPDATE orders SET status = 'PAID', updated_at = ? WHERE order_id = ?").run(now, order.order_id);

      // 4. Atomically Insert Durable Customer Receipt Print Job
      const receiptPayload = JSON.stringify({
        storeId: order.store_id,
        orderId: order.order_id,
        invoiceNumber,
        businessDate: order.business_date,
        totalCents: order.total_cents,
        tenderType: req.tenderType,
        tenderAmountCents: req.tenderAmountCents,
        changeCents,
        upiQrPayload,
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

      // 5. Atomically Insert Kitchen Order Ticket (KOT) Print Job
      this.db
        .prepare(`
          INSERT INTO print_jobs (
            job_id, order_id, printer_id, job_type, payload_raw,
            status, attempts, created_at, updated_at
          ) VALUES (?, ?, 'printer-hotline-primary', 'KOT', ?, 'PENDING', 0, ?, ?)
        `)
        .run(kotJobId, order.order_id, receiptPayload, now, now);

      // 6. Insert Kitchen Ticket record
      this.db
        .prepare(`
          INSERT INTO kitchen_tickets (ticket_id, order_id, station_id, status, fired_at)
          VALUES (?, ?, 'HOTLINE_1', 'PENDING', ?)
        `)
        .run(uuidv4(), order.order_id, now);

      // 7. Record Outbox Event
      this.recordOutboxEvent('PAYMENT_SETTLED', {
        paymentId,
        orderId: order.order_id,
        invoiceNumber,
        storeId: order.store_id,
        businessDate: order.business_date,
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
      invoiceNumber,
      upiQrPayload,
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
        sacCode: l.sac_code || '996331',
        notes: l.notes,
        modifiers: mods.map(m => ({
          lineModId: m.line_mod_id,
          modifierId: m.modifier_id,
          modifierName: m.modifier_name,
          unitPriceCents: m.unit_price_cents,
        })),
      });
    }

    const inv = this.db.prepare('SELECT invoice_number, upi_qr_payload FROM invoices WHERE order_id = ?').get(orderId) as any;

    return {
      orderId: order.order_id,
      storeId: order.store_id,
      terminalId: order.terminal_id,
      tableId: order.table_id,
      orderType: order.order_type,
      status: order.status,
      businessDate: order.business_date || OrderStateMachine.calculateBusinessDate(new Date(order.created_at)),
      isTraining: order.is_training === 1,
      menuVersionId: order.menu_version_id,
      subtotalCents: order.subtotal_cents,
      serviceChargeCents: 0,
      taxCents: order.tax_cents,
      cgstCents: Math.floor(order.tax_cents / 2),
      sgstCents: order.tax_cents - Math.floor(order.tax_cents / 2),
      igstCents: 0,
      discountCents: order.discount_cents,
      totalCents: order.total_cents,
      currency: order.currency,
      invoiceNumber: inv?.invoice_number,
      upiQrPayload: inv?.upi_qr_payload,
      lines: calculatedLines,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };
  }
}
