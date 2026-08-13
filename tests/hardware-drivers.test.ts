import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { ESCPOSThermalPrinterDriver, PrinterStationConfig } from '../src/hardware/escpos-printer.js';

describe('Store Edge Node Hardware Drivers & SQLite WAL Persistence', () => {
  const printerDriver = new ESCPOSThermalPrinterDriver();

  it('ESCPOSThermalPrinterDriver must generate valid binary command buffer with paper cut (GS V 0)', () => {
    const buffer = printerDriver.generateReceiptBuffer({
      storeName: 'Store #104 Chicago West',
      ticketId: 'tx-test-999',
      timestamp: '2026-07-31 21:00:00',
      items: [{ name: 'Large Pepperoni Pizza', qty: 1, price: 18.99, modifiers: ['Extra Cheese', 'Well Done'] }],
      subtotal: 18.99,
      tax: 1.52,
      total: 20.51,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(50);

    // Verify ESC @ (0x1b, 0x40) printer initialization at byte 0 and 1
    expect(buffer[0]).toBe(0x1b);
    expect(buffer[1]).toBe(0x40);

    // Verify GS V 0 (0x1d, 0x56, 0x00) paper cut at the end of the buffer
    const lastThreeBytes = buffer.subarray(buffer.length - 3);
    expect(lastThreeBytes[0]).toBe(0x1d);
    expect(lastThreeBytes[1]).toBe(0x56);
    expect(lastThreeBytes[2]).toBe(0x00);
  });

  it('ESCPOSThermalPrinterDriver must correctly parse DLE EOT status bytes for Paper Out and Paper Low', () => {
    // 0x60 = Paper Out (Bits 5 & 6 high)
    const paperOutStatus = printerDriver.queryPaperSensorStatus(0x60);
    expect(paperOutStatus.isPaperOut).toBe(true);

    // 0x0C = Paper Low (Bits 2 & 3 high)
    const paperLowStatus = printerDriver.queryPaperSensorStatus(0x0c);
    expect(paperLowStatus.isPaperLow).toBe(true);
    expect(paperLowStatus.isPaperOut).toBe(false);

    // 0x00 = Paper OK
    const paperOkStatus = printerDriver.queryPaperSensorStatus(0x00);
    expect(paperOkStatus.isPaperLow).toBe(false);
    expect(paperOkStatus.isPaperOut).toBe(false);
  });

  it('ESCPOSThermalPrinterDriver must execute Station Fallback when primary station is offline', async () => {
    // Primary station points to non-routable test port
    const primary: PrinterStationConfig = {
      stationId: 'hotline-1',
      stationName: 'Hotline 1',
      ip: '127.0.0.1',
      port: 59991,
    };

    // Fallback station also unreachable in unit test environment
    const fallback: PrinterStationConfig = {
      stationId: 'expo-backup',
      stationName: 'Expo Backup',
      ip: '127.0.0.1',
      port: 59992,
    };

    const result = await printerDriver.printWithFallback(primary, fallback, {
      storeName: 'Store #104 Chicago West',
      ticketId: 'tx-fallback-01',
      timestamp: '2026-08-01 12:00:00',
      items: [{ name: 'Spicy Buffalo Wings', qty: 1, price: 14.99 }],
      subtotal: 14.99,
      tax: 1.2,
      total: 16.19,
    });

    // Confirms fallback was attempted and handled gracefully without crashing
    expect(result.success).toBe(false);
    expect(result.printedOnStation).toBe('NONE_STORED_IN_WAL_QUEUE');
    expect(result.message).toContain('queued in local SQLite WAL buffer');
  });

  it('better-sqlite3 WAL Mode must initialize persistent store-edge DB with zero corruption', () => {
    const testDbPath = path.resolve(process.cwd(), 'tests-edge-wal.db');
    const db = new Database(testDbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    const pragmaResult = db.pragma('journal_mode', { simple: true });
    expect(pragmaResult).toBe('wal');

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_orders (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL
      );
    `);

    db.prepare('INSERT OR REPLACE INTO test_orders (id, amount) VALUES (?, ?)').run('order-101', 42.50);
    const row = db.prepare('SELECT amount FROM test_orders WHERE id = ?').get('order-101') as any;

    expect(row.amount).toBe(42.50);

    db.close();
  });
});
