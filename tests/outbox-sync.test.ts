import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionalOutboxSyncEngine, OutboxEventRecord } from '../src/shared/outbox-sync-engine.js';

describe('TransactionalOutboxSyncEngine', () => {
  let mockDb: any;
  let outbox: TransactionalOutboxSyncEngine;
  let outboxTable: OutboxEventRecord[] = [];

  beforeEach(() => {
    outboxTable = [];

    mockDb = {
      transaction: (fn: Function) => (...args: any[]) => fn(...args),
      prepare: (sql: string) => ({
        get: () => {
          const pending = outboxTable.filter(e => e.delivered_at === null);
          return { count: pending.length };
        },
        all: (limit: number) => {
          return outboxTable
            .filter(e => e.delivered_at === null)
            .sort((a, b) => a.sequence_number - b.sequence_number)
            .slice(0, limit);
        },
        run: (...params: any[]) => {
          if (sql.includes('UPDATE sync_outbox SET delivered_at = ?')) {
            const [delivered_at, ack_token, event_id] = params;
            const event = outboxTable.find(e => e.event_id === event_id);
            if (event) {
              event.delivered_at = delivered_at;
              event.ack_token = ack_token;
            }
          }
          return { changes: 1 };
        },
      }),
    };

    outbox = new TransactionalOutboxSyncEngine(mockDb);
  });

  it('queues offline events and dispatches them in order with acknowledgment tokens when online', async () => {
    const now = new Date().toISOString();

    outboxTable.push(
      {
        event_id: 'evt-01',
        store_id: 'store-104',
        event_type: 'ORDER_CREATED',
        sequence_number: 1,
        payload_json: '{"orderId":"ord-1"}',
        created_at: now,
        delivered_at: null,
        ack_token: null,
      },
      {
        event_id: 'evt-02',
        store_id: 'store-104',
        event_type: 'PAYMENT_SETTLED',
        sequence_number: 2,
        payload_json: '{"orderId":"ord-1","amount":1000}',
        created_at: now,
        delivered_at: null,
        ack_token: null,
      }
    );

    outbox.setWanStatus(true);
    const result = await outbox.flushPendingBatch(10);

    expect(result.flushedCount).toBe(2);
    expect(result.remainingPending).toBe(0);
    expect(result.lastDeliveredSeq).toBe(2);

    expect(outboxTable.every(r => r.delivered_at !== null && r.ack_token !== null)).toBe(true);
  });

  it('does not flush events when offline / WAN dropped', async () => {
    const now = new Date().toISOString();
    outboxTable.push({
      event_id: 'evt-03',
      store_id: 'store-104',
      event_type: 'ORDER_CREATED',
      sequence_number: 3,
      payload_json: '{"orderId":"ord-3"}',
      created_at: now,
      delivered_at: null,
      ack_token: null,
    });

    outbox.setWanStatus(false);
    const result = await outbox.flushPendingBatch(10);

    expect(result.flushedCount).toBe(0);
    expect(result.remainingPending).toBe(1);
  });
});
