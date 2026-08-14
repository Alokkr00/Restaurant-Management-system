import { describe, it, expect, beforeEach } from 'vitest';
import { OrderStateMachine } from '../src/pos/order-state-machine.js';

describe('OrderStateMachine & Server-Side Integer Pricing Engine', () => {
  let mockDb: any;
  let stateMachine: OrderStateMachine;

  // In-Memory Database Store
  let ordersTable: Map<string, any> = new Map();
  let orderLinesTable: any[] = [];
  let lineModifiersTable: any[] = [];
  let paymentsTable: any[] = [];
  let printJobsTable: any[] = [];
  let kitchenTicketsTable: any[] = [];
  let syncOutboxTable: any[] = [];
  let auditEventsTable: any[] = [];

  const storeSeed = { store_id: 'store-104', currency: 'USD', tax_rate_bps: 800 };
  const menuVersionSeed = { menu_version_id: 'menu-v1', version_number: 1, is_active: 1 };
  const productsSeed: Record<string, any> = {
    'item-101': { product_id: 'item-101', name: 'Large Pepperoni Pizza', price_cents: 1899, is_available: 1 },
    'item-104': { product_id: 'item-104', name: 'Spicy Buffalo Wings', price_cents: 1299, is_available: 1 },
    'item-105': { product_id: 'item-105', name: 'Artisanal Garlic Knots', price_cents: 699, is_available: 1 },
  };
  const modifiersSeed: Record<string, any> = {
    'mod-extra-cheese': { modifier_id: 'mod-extra-cheese', name: 'Extra Mozzarella', price_cents: 200 },
  };

  beforeEach(() => {
    ordersTable = new Map();
    orderLinesTable = [];
    lineModifiersTable = [];
    paymentsTable = [];
    printJobsTable = [];
    kitchenTicketsTable = [];
    syncOutboxTable = [];
    auditEventsTable = [];

    mockDb = {
      transaction: (fn: Function) => (...args: any[]) => fn(...args),
      prepare: (sql: string) => ({
        get: (...params: any[]) => {
          if (sql.includes('FROM stores')) {
            return params[0] === 'store-104' ? storeSeed : undefined;
          }
          if (sql.includes('FROM menu_versions')) {
            return menuVersionSeed;
          }
          if (sql.includes('FROM products WHERE product_id = ?')) {
            return productsSeed[params[0]];
          }
          if (sql.includes('FROM modifiers WHERE modifier_id = ?')) {
            return modifiersSeed[params[0]];
          }
          if (sql.includes('FROM orders WHERE idempotency_key = ?')) {
            for (const o of ordersTable.values()) {
              if (o.idempotency_key === params[0]) return { order_id: o.order_id };
            }
            return undefined;
          }
          if (sql.includes('FROM orders WHERE order_id = ?')) {
            const o = ordersTable.get(params[0]);
            return o ? { ...o } : undefined;
          }
          if (sql.includes('MAX(sequence_number)')) {
            return { maxSeq: syncOutboxTable.length };
          }
          if (sql.includes('FROM payments WHERE idempotency_key = ?')) {
            return paymentsTable.find(p => p.idempotency_key === params[0]);
          }
          return undefined;
        },
        all: (...params: any[]) => {
          if (sql.includes('FROM order_lines WHERE order_id = ?')) {
            return orderLinesTable.filter(l => l.order_id === params[0]);
          }
          if (sql.includes('FROM line_modifiers WHERE line_id = ?')) {
            return lineModifiersTable.filter(m => m.line_id === params[0]);
          }
          if (sql.includes('FROM print_jobs WHERE order_id = ?')) {
            return printJobsTable.filter(p => p.order_id === params[0]);
          }
          if (sql.includes('FROM sync_outbox WHERE store_id = ?')) {
            return syncOutboxTable.filter(s => s.store_id === params[0]);
          }
          return [];
        },
        run: (...params: any[]) => {
          if (sql.includes('INSERT INTO orders')) {
            const [order_id, store_id, terminal_id, table_id, order_type, menu_version_id, subtotal_cents, tax_cents, total_cents, currency, idempotency_key, created_at, updated_at] = params;
            ordersTable.set(order_id, {
              order_id, store_id, terminal_id, table_id, order_type, status: 'DRAFT',
              menu_version_id, subtotal_cents, tax_cents, discount_cents: 0, total_cents,
              currency, idempotency_key, created_at, updated_at,
            });
          } else if (sql.includes('INSERT INTO order_lines')) {
            const [line_id, order_id, product_id, product_name, quantity, unit_price_cents, total_price_cents, notes] = params;
            orderLinesTable.push({ line_id, order_id, product_id, product_name, quantity, unit_price_cents, total_price_cents, notes, status: 'PENDING' });
          } else if (sql.includes('INSERT INTO line_modifiers')) {
            const [line_mod_id, line_id, modifier_id, modifier_name, unit_price_cents] = params;
            lineModifiersTable.push({ line_mod_id, line_id, modifier_id, modifier_name, unit_price_cents });
          } else if (sql.includes("UPDATE orders SET status = 'PAID'")) {
            const [updated_at, order_id] = params;
            const existing = ordersTable.get(order_id);
            if (existing) {
              existing.status = 'PAID';
              existing.updated_at = updated_at;
            }
          } else if (sql.includes('UPDATE orders SET status = ?')) {
            const [newStatus, updated_at, order_id] = params;
            const existing = ordersTable.get(order_id);
            if (existing) {
              existing.status = newStatus;
              existing.updated_at = updated_at;
            }
          } else if (sql.includes('INSERT INTO payments')) {
            const [payment_id, order_id, store_id, tender_type, amount_cents, change_cents, terminal_ref, idempotency_key, created_at] = params;
            paymentsTable.push({ payment_id, order_id, store_id, tender_type, amount_cents, change_cents, status: 'SETTLED', terminal_ref, idempotency_key, created_at });
          } else if (sql.includes('INSERT INTO print_jobs')) {
            const [job_id, order_id, payload_raw, created_at, updated_at] = params;
            const job_type = sql.includes("'RECEIPT'") ? 'RECEIPT' : 'KOT';
            printJobsTable.push({ job_id, order_id, job_type, payload_raw, status: 'PENDING', created_at, updated_at });
          } else if (sql.includes('INSERT INTO sync_outbox')) {
            const [event_id, store_id, event_type, sequence_number, payload_json, created_at] = params;
            syncOutboxTable.push({ event_id, store_id, event_type, sequence_number, payload_json, created_at });
          } else if (sql.includes('INSERT INTO audit_events')) {
            const [event_id, store_id, user_id, entity_id, before_json, after_json, created_at] = params;
            auditEventsTable.push({ event_id, store_id, user_id, entity_id, before_json, after_json, created_at });
          }
          return { changes: 1 };
        },
      }),
    };

    stateMachine = new OrderStateMachine(mockDb);
  });

  it('prices orders on the server using integer minor units (cents) and calculates 8% tax correctly', () => {
    const order = stateMachine.createAndPriceOrder({
      storeId: 'store-104',
      terminalId: 'pos-01',
      orderType: 'DINE_IN',
      items: [
        { productId: 'item-101', quantity: 2, modifierIds: ['mod-extra-cheese'] }, // (1899 + 200) * 2 = 4198 cents ($41.98)
        { productId: 'item-104', quantity: 1 }, // 1299 * 1 = 1299 cents ($12.99)
      ],
    });

    expect(order.orderId).toBeDefined();
    expect(order.status).toBe('DRAFT');
    expect(order.subtotalCents).toBe(5497); // 4198 + 1299 = 5497 cents ($54.97)
    // 800 bps (8.00%) of 5497 = 439.76 -> 440 cents ($4.40)
    expect(order.taxCents).toBe(440);
    expect(order.totalCents).toBe(5937); // $59.37
    expect(order.currency).toBe('USD');
  });

  it('enforces idempotency key protection against duplicate orders', () => {
    const idempotencyKey = 'idem-order-key-991';

    const order1 = stateMachine.createAndPriceOrder({
      storeId: 'store-104',
      terminalId: 'pos-01',
      orderType: 'TAKEAWAY',
      items: [{ productId: 'item-101', quantity: 1 }],
      idempotencyKey,
    });

    const order2 = stateMachine.createAndPriceOrder({
      storeId: 'store-104',
      terminalId: 'pos-01',
      orderType: 'TAKEAWAY',
      items: [{ productId: 'item-101', quantity: 1 }],
      idempotencyKey,
    });

    expect(order1.orderId).toBe(order2.orderId);
    expect(order1.totalCents).toBe(order2.totalCents);
  });

  it('enforces strict state transition rules and rejects invalid transitions', () => {
    const order = stateMachine.createAndPriceOrder({
      storeId: 'store-104',
      terminalId: 'pos-01',
      orderType: 'DINE_IN',
      items: [{ productId: 'item-105', quantity: 2 }],
    });

    // Valid transition: DRAFT -> SENT_TO_KITCHEN
    stateMachine.transitionState(order.orderId, 'SENT_TO_KITCHEN', 'usr-csh-01');
    const updated = stateMachine.getOrderById(order.orderId);
    expect(updated?.status).toBe('SENT_TO_KITCHEN');

    // Invalid transition: SENT_TO_KITCHEN -> CLOSED (Must be paid first)
    expect(() => {
      stateMachine.transitionState(order.orderId, 'CLOSED', 'usr-csh-01');
    }).toThrow(/Invalid state transition/);
  });

  it('processes payment atomically, calculates change, and generates durable print jobs and outbox events', () => {
    const order = stateMachine.createAndPriceOrder({
      storeId: 'store-104',
      terminalId: 'pos-01',
      orderType: 'DINE_IN',
      items: [{ productId: 'item-105', quantity: 1 }], // 699 cents subtotal + 56 cents tax = 755 cents ($7.55)
    });

    const result = stateMachine.processPayment({
      orderId: order.orderId,
      tenderType: 'CASH',
      tenderAmountCents: 1000, // $10.00 cash tender
    });

    expect(result.status).toBe('SETTLED');
    expect(result.amountCents).toBe(1000);
    expect(result.changeCents).toBe(245); // $10.00 - $7.55 = $2.45

    // Verify order status is PAID
    const paidOrder = stateMachine.getOrderById(order.orderId);
    expect(paidOrder?.status).toBe('PAID');

    // Verify durable print jobs were inserted
    const printJobs = mockDb.prepare('SELECT * FROM print_jobs WHERE order_id = ?').all(order.orderId);
    expect(printJobs.length).toBe(2); // 1 Receipt + 1 KOT
    expect(printJobs.map((p: any) => p.job_type)).toContain('RECEIPT');
    expect(printJobs.map((p: any) => p.job_type)).toContain('KOT');

    // Verify sync outbox event was recorded
    const outboxEvents = mockDb.prepare('SELECT * FROM sync_outbox WHERE store_id = ?').all('store-104');
    expect(outboxEvents.length).toBeGreaterThan(0);
    expect(outboxEvents.some((e: any) => e.event_type === 'PAYMENT_SETTLED')).toBe(true);
  });
});
