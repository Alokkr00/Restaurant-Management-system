import Database from 'better-sqlite3';
import net from 'net';

export interface PrintJobRecord {
  job_id: string;
  order_id: string;
  printer_id: string;
  job_type: 'KOT' | 'RECEIPT' | 'Z_REPORT';
  payload_raw: string;
  status: 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED';
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrinterTargetConfig {
  printerId: string;
  name: string;
  host: string;
  port: number;
  timeoutMs: number;
  fallbackPrinterId?: string;
}

export class DurablePrintQueueWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private printerRegistry: Map<string, PrinterTargetConfig> = new Map();
  public customDispatcher?: (host: string, port: number, timeoutMs: number, payload: string) => Promise<void>;

  constructor(
    private db: any,
    initialPrinters: PrinterTargetConfig[] = []
  ) {
    for (const p of initialPrinters) {
      this.printerRegistry.set(p.printerId, p);
    }
  }

  public registerPrinter(config: PrinterTargetConfig): void {
    this.printerRegistry.set(config.printerId, config);
  }

  public start(pollIntervalMs = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => {
      this.processNextBatch();
      this.pruneQueue();
    }, pollIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Bound memory/disk by pruning old print jobs
   */
  public pruneQueue(daysToKeep = 7): void {
    try {
      this.db.prepare(`DELETE FROM print_jobs WHERE status IN ('COMPLETED', 'FAILED') AND created_at < datetime('now', '-${daysToKeep} days')`).run();
    } catch (e) {}
  }

  /**
   * Polls and processes pending print jobs asynchronously
   */
  public async processNextBatch(limit = 10): Promise<number> {
    const pendingJobs = this.db
      .prepare(`
        SELECT * FROM print_jobs 
        WHERE status = 'PENDING' OR (status = 'FAILED' AND attempts < 3)
        ORDER BY created_at ASC 
        LIMIT ?
      `)
      .all(limit) as PrintJobRecord[];

    if (pendingJobs.length === 0) return 0;

    let processedCount = 0;
    for (const job of pendingJobs) {
      await this.executeJob(job);
      processedCount++;
    }

    return processedCount;
  }

  private async executeJob(job: PrintJobRecord): Promise<void> {
    const now = new Date().toISOString();
    const printer = this.printerRegistry.get(job.printer_id);

    // Mark as PRINTING
    this.db
      .prepare("UPDATE print_jobs SET status = 'PRINTING', attempts = attempts + 1, updated_at = ? WHERE job_id = ?")
      .run(now, job.job_id);

    if (!printer) {
      // Missing printer configuration - fail job
      this.db
        .prepare("UPDATE print_jobs SET status = 'FAILED', last_error = ?, updated_at = ? WHERE job_id = ?")
        .run(`Printer target '${job.printer_id}' is not configured in printer registry.`, now, job.job_id);
      return;
    }

    try {
      if (this.customDispatcher) {
        await this.customDispatcher(printer.host, printer.port, printer.timeoutMs, job.payload_raw);
      } else {
        await this.sendToRawSocket(printer.host, printer.port, printer.timeoutMs, job.payload_raw);
      }

      // Success
      this.db
        .prepare("UPDATE print_jobs SET status = 'COMPLETED', last_error = NULL, updated_at = ? WHERE job_id = ?")
        .run(now, job.job_id);
    } catch (err: any) {
      const errMsg = err?.message || 'Network socket timeout or connection refused';
      this.db
        .prepare("UPDATE print_jobs SET status = 'FAILED', last_error = ?, updated_at = ? WHERE job_id = ?")
        .run(errMsg, now, job.job_id);
    }
  }

  /**
   * 1-Tap Manager Action: Reroute failed print job to another printer
   */
  public rerouteJob(jobId: string, targetPrinterId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE print_jobs 
        SET printer_id = ?, status = 'PENDING', attempts = 0, last_error = NULL, updated_at = ? 
        WHERE job_id = ?
      `)
      .run(targetPrinterId, now, jobId);
  }

  /**
   * 1-Tap Manager Action: Reprint completed or failed job
   */
  public retryJob(jobId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE print_jobs 
        SET status = 'PENDING', attempts = 0, last_error = NULL, updated_at = ? 
        WHERE job_id = ?
      `)
      .run(now, jobId);
  }

  private sendToRawSocket(host: string, port: number, timeoutMs: number, payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let isSettled = false;

      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          socket.destroy();
          reject(new Error(`Printer socket connection timed out after ${timeoutMs}ms (${host}:${port})`));
        }
      }, timeoutMs);

      socket.connect(port, host, () => {
        // Mock / live ESC/POS binary initialization
        const escposInit = Buffer.from([0x1b, 0x40]); // ESC @
        const buffer = Buffer.concat([escposInit, Buffer.from(payload, 'utf8')]);
        socket.write(buffer, () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timer);
            socket.end();
            resolve();
          }
        });
      });

      socket.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          socket.destroy();
          reject(err);
        }
      });
    });
  }
}
