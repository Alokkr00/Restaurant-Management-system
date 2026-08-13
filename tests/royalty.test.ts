import { describe, it, expect } from 'vitest';
import { FranchiseRoyaltyEngine } from '../src/fintech/royalty-engine.js';
import { POSTransaction } from '../src/shared/types.js';

describe('FranchiseRoyaltyEngine', () => {
  const engine = new FranchiseRoyaltyEngine();

  it('calculates royalties on net sales after comps and excludes sales tax', () => {
    const transactions: POSTransaction[] = [
      {
        id: 'tx-101',
        storeId: 'store-104',
        terminalId: 'pos-1',
        timestamp: '2026-08-01T12:00:00Z',
        items: [{ menuItemId: 'item-101', quantity: 2, unitPrice: 20.0 }],
        subtotal: 40.0,
        tax: 3.2,
        total: 43.2,
        tenders: [{ type: 'CARD', amount: 43.2 }],
        offlineMode: false,
        synced: true,
      },
      {
        id: 'tx-102',
        storeId: 'store-104',
        terminalId: 'pos-1',
        timestamp: '2026-08-01T13:00:00Z',
        items: [{ menuItemId: 'item-102', quantity: 1, unitPrice: 20.0 }],
        subtotal: 20.0,
        tax: 1.6,
        total: 21.6,
        tenders: [{ type: 'COMP', amount: 20.0 }, { type: 'CASH', amount: 1.6 }],
        offlineMode: false,
        synced: true,
      },
    ];

    const invoice = engine.calculateRoyaltyForPeriod(
      'fran-01',
      'store-104',
      transactions,
      '2026-08-01',
      '2026-08-07'
    );

    expect(invoice.grossSales).toBe(60.0);
    expect(invoice.salesTaxExcluded).toBe(4.8);
    expect(invoice.compsAndDiscountsDeducted).toBe(20.0);
    expect(invoice.netRoyaltySales).toBe(40.0);
    expect(invoice.royaltyFeeAmount).toBe(2.0); // 5% of $40
    expect(invoice.marketingFeeAmount).toBe(0.8); // 2% of $40
    expect(invoice.totalDueACH).toBe(2.8);
  });
});
