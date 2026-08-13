import { describe, it, expect } from 'vitest';
import { NetSuiteERPIntegration } from '../src/integrations/netsuite.js';
import { POSTransaction } from '../src/shared/types.js';

describe('NetSuiteERPIntegration', () => {
  const netsuite = new NetSuiteERPIntegration();

  it('generates a balanced double-entry daily GL journal (Debits === Credits)', () => {
    const transactions: POSTransaction[] = [
      {
        id: 'tx-1',
        storeId: 'store-104',
        terminalId: 'pos-1',
        timestamp: '2026-08-01T12:00:00Z',
        items: [{ menuItemId: 'item-101', quantity: 2, unitPrice: 25.0 }],
        subtotal: 50.0,
        tax: 4.0,
        total: 54.0,
        tenders: [
          { type: 'CASH', amount: 20.0 },
          { type: 'CARD', amount: 34.0 },
        ],
        offlineMode: false,
        synced: true,
      },
      {
        id: 'deliv-dd-1',
        storeId: 'store-104',
        terminalId: 'AGGREGATOR-DOORDASH',
        timestamp: '2026-08-01T12:30:00Z',
        items: [{ menuItemId: 'item-102', quantity: 1, unitPrice: 30.0 }],
        subtotal: 30.0,
        tax: 2.4,
        total: 32.4,
        tenders: [{ type: 'CARD', amount: 32.4 }],
        offlineMode: false,
        synced: true,
      },
    ];

    const glEntry = netsuite.generateDailyGLJournalEntry('store-104', 'SUB-IL-CHI', transactions, '2026-08-01');

    expect(glEntry.isBalanced).toBe(true);
    expect(glEntry.totalDebits).toBe(glEntry.totalCredits);
    expect(glEntry.totalDebits).toBe(86.4);

    const cash = glEntry.lines.find((l) => l.accountNumber === '1010');
    const card = glEntry.lines.find((l) => l.accountNumber === '1020');
    const delivery = glEntry.lines.find((l) => l.accountNumber === '1030');
    const revenue = glEntry.lines.find((l) => l.accountNumber === '4010');
    const tax = glEntry.lines.find((l) => l.accountNumber === '2010');

    expect(cash?.debit).toBe(20.0);
    expect(card?.debit).toBe(34.0);
    expect(delivery?.debit).toBe(32.4);
    expect(revenue?.credit).toBe(80.0);
    expect(tax?.credit).toBe(6.4);
  });
});
