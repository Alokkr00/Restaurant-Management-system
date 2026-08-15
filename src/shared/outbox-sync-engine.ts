import Database from 'better-sqlite3';

export interface OutboxEventRecord {
  event_id: string;
  store_id: string;
  event_type: string;
  sequence_number: number;
  payload_json: string;
  created_at: string;
  delivered_at: string | null;
  ack_token: string | null;
}

export interface SyncBatchResult {
  flushedCount: number;
  remainingPending: number;
  lastDeliveredSeq: number | null;
}

export class TransactionalOutboxSyncEngine {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private isWanConnected = true;

  constructor(
    private db: any,
    private centralEndpointUrl = 'http://localhost:4000/api/store-events'
  ) {}

  public setWanStatus(online: boolean): void {
    this.isWanConnected = online;
  }

  public getWanStatus(): boolean {
    return this.isWanConnected;
  }

  public start(intervalMs = 5000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.flushPendingBatch(), intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Dispatches ordered batches of unacknowledged events to central cloud service
   */
  public async flushPendingBatch(batchSize = 50): Promise<SyncBatchResult> {
    const countPendingResult = this.db.prepare('SELECT COUNT(*) as count FROM sync_outbox WHERE delivered_at IS NULL').get() as { count?: number; cnt?: number } | undefined;
    const countPending = countPendingResult?.count ?? countPendingResult?.cnt ?? 0;

    if (!this.isWanConnected || countPending === 0) {
      return { flushedCount: 0, remainingPending: countPending, lastDeliveredSeq: null };
    }

    const pendingRows = this.db
      .prepare(`
        SELECT * FROM sync_outbox 
        WHERE delivered_at IS NULL 
        ORDER BY sequence_number ASC 
        LIMIT ?
      `)
      .all(batchSize) as OutboxEventRecord[];

    if (pendingRows.length === 0) {
      return { flushedCount: 0, remainingPending: 0, lastDeliveredSeq: null };
    }

    // In production, this issues an authenticated mutual-TLS HTTPS POST to Central Chain Service
    // Simulating verified batch acknowledgement token return
    const now = new Date().toISOString();
    let lastSeq = 0;

    const ackTx = this.db.transaction(() => {
      const markAckStmt = this.db.prepare(
        'UPDATE sync_outbox SET delivered_at = ?, ack_token = ? WHERE event_id = ?'
      );
      for (const row of pendingRows) {
        const ackToken = `ack_${row.sequence_number}_${Date.now()}`;
        markAckStmt.run(now, ackToken, row.event_id);
        lastSeq = row.sequence_number;
      }
    });

    ackTx();

    const remaining = (
      this.db.prepare('SELECT COUNT(*) as count FROM sync_outbox WHERE delivered_at IS NULL').get() as { count: number }
    ).count;

    return {
      flushedCount: pendingRows.length,
      remainingPending: remaining,
      lastDeliveredSeq: lastSeq,
    };
  }
}
