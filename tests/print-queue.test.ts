import { describe, it, expect, beforeEach } from 'vitest';
import { DurablePrintQueueWorker, PrintJobRecord } from '../src/hardware/print-queue-worker.js';

describe('DurablePrintQueueWorker', () => {
  let mockDb: any;
  let worker: DurablePrintQueueWorker;
  let printJobsTable: PrintJobRecord[] = [];

  beforeEach(() => {
    printJobsTable = [];

    mockDb = {
      prepare: (sql: string) => ({
        all: (limit: number) => {
          return printJobsTable
            .filter(j => j.status === 'PENDING' || (j.status === 'FAILED' && j.attempts < 3))
            .slice(0, limit);
        },
        get: (jobId: string) => {
          return printJobsTable.find(j => j.job_id === jobId);
        },
        run: (...params: any[]) => {
          if (sql.includes("UPDATE print_jobs SET status = 'PRINTING'")) {
            const [updated_at, job_id] = params;
            const job = printJobsTable.find(j => j.job_id === job_id);
            if (job) {
              job.status = 'PRINTING';
              job.attempts += 1;
              job.updated_at = updated_at;
            }
          } else if (sql.includes("UPDATE print_jobs SET status = 'FAILED'")) {
            const [last_error, updated_at, job_id] = params;
            const job = printJobsTable.find(j => j.job_id === job_id);
            if (job) {
              job.status = 'FAILED';
              job.last_error = last_error;
              job.updated_at = updated_at;
            }
          } else if (sql.includes("UPDATE print_jobs SET status = 'COMPLETED'")) {
            const [updated_at, job_id] = params;
            const job = printJobsTable.find(j => j.job_id === job_id);
            if (job) {
              job.status = 'COMPLETED';
              job.last_error = null;
              job.updated_at = updated_at;
            }
          } else if (sql.includes('UPDATE print_jobs \n        SET printer_id = ?')) {
            const [printer_id, updated_at, job_id] = params;
            const job = printJobsTable.find(j => j.job_id === job_id);
            if (job) {
              job.printer_id = printer_id;
              job.status = 'PENDING';
              job.attempts = 0;
              job.last_error = null;
              job.updated_at = updated_at;
            }
          }
          return { changes: 1 };
        },
      }),
    };

    worker = new DurablePrintQueueWorker(mockDb, [
      { printerId: 'printer-hotline-primary', name: 'Hotline', host: '127.0.0.1', port: 9999, timeoutMs: 50 },
      { printerId: 'printer-expo-backup', name: 'Expo', host: '127.0.0.1', port: 9998, timeoutMs: 50 },
    ]);
  });

  it('records print jobs and handles offline failure gracefully without throwing', async () => {
    worker.customDispatcher = async () => {
      throw new Error('Printer connection refused: Paper out or offline');
    };

    const now = new Date().toISOString();
    printJobsTable.push({
      job_id: 'job-001',
      order_id: 'ord-001',
      printer_id: 'printer-hotline-primary',
      job_type: 'KOT',
      payload_raw: 'Sample Kitchen Ticket',
      status: 'PENDING',
      attempts: 0,
      last_error: null,
      created_at: now,
      updated_at: now,
    });

    const processed = await worker.processNextBatch(5);
    expect(processed).toBe(1);

    const job = mockDb.prepare('SELECT * FROM print_jobs WHERE job_id = ?').get('job-001');
    expect(job.status).toBe('FAILED');
    expect(job.attempts).toBe(1);
    expect(job.last_error).toContain('Paper out or offline');
  });

  it('allows manager to reroute a failed print job to an alternate backup printer', () => {
    const now = new Date().toISOString();
    printJobsTable.push({
      job_id: 'job-002',
      order_id: 'ord-002',
      printer_id: 'printer-hotline-primary',
      job_type: 'KOT',
      payload_raw: 'Sample Ticket',
      status: 'FAILED',
      attempts: 3,
      last_error: 'Paper Out',
      created_at: now,
      updated_at: now,
    });

    worker.rerouteJob('job-002', 'printer-expo-backup');

    const job = mockDb.prepare('SELECT * FROM print_jobs WHERE job_id = ?').get('job-002');
    expect(job.printer_id).toBe('printer-expo-backup');
    expect(job.status).toBe('PENDING');
    expect(job.attempts).toBe(0);
    expect(job.last_error).toBeNull();
  });
});
