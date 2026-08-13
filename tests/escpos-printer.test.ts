import { describe, it, expect } from 'vitest';
import { ESCPOSThermalPrinterDriver, PrinterStationConfig } from '../src/hardware/escpos-printer.js';

describe('ESCPOSThermalPrinterDriver', () => {
  const driver = new ESCPOSThermalPrinterDriver();

  it('generates binary ESC/POS buffer with init (ESC @) and cut (GS V 0)', () => {
    const buffer = driver.generateReceiptBuffer({
      storeName: 'Store #104 Chicago West',
      ticketId: 'tx-101',
      timestamp: '2026-08-01 12:00:00',
      items: [{ name: 'Large Pepperoni Pizza', qty: 1, price: 18.99, modifiers: ['Extra Cheese'] }],
      subtotal: 18.99,
      tax: 1.52,
      total: 20.51,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer[0]).toBe(0x1b);
    expect(buffer[1]).toBe(0x40);

    const cutCommand = buffer.subarray(buffer.length - 3);
    expect(cutCommand[0]).toBe(0x1d);
    expect(cutCommand[1]).toBe(0x56);
    expect(cutCommand[2]).toBe(0x00);
  });

  it('parses DLE EOT status bytes for Paper Out and Paper Low', () => {
    const paperOut = driver.queryPaperSensorStatus(0x60);
    expect(paperOut.isPaperOut).toBe(true);

    const paperLow = driver.queryPaperSensorStatus(0x0c);
    expect(paperLow.isPaperLow).toBe(true);
    expect(paperLow.isPaperOut).toBe(false);

    const paperOk = driver.queryPaperSensorStatus(0x00);
    expect(paperOk.isPaperOut).toBe(false);
  });

  it('attempts station fallback when primary hotline is offline', async () => {
    const primary: PrinterStationConfig = {
      stationId: 'hotline-1',
      stationName: 'Hotline 1',
      ip: '127.0.0.1',
      port: 59991,
    };

    const fallback: PrinterStationConfig = {
      stationId: 'expo-backup',
      stationName: 'Expo Backup',
      ip: '127.0.0.1',
      port: 59992,
    };

    const result = await driver.printWithFallback(primary, fallback, {
      storeName: 'Store #104 Chicago West',
      ticketId: 'tx-fail-1',
      timestamp: '2026-08-01 12:00:00',
      items: [{ name: 'Buffalo Wings', qty: 1, price: 14.99 }],
      subtotal: 14.99,
      tax: 1.2,
      total: 16.19,
    });

    expect(result.success).toBe(false);
    expect(result.printedOnStation).toBe('NONE_STORED_IN_WAL_QUEUE');
  });
});
