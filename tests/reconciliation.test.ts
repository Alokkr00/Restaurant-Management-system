import { describe, it, expect, beforeEach } from 'vitest';
import { DayEndReconciliationEngine } from '../src/fintech/reconciliation-engine.js';

describe('DayEndReconciliationEngine - Multi-Tender Settlement & Over/Short Variance', () => {
  let mockDb: any;
  let engine: DayEndReconciliationEngine;

  beforeEach(() => {
    mockDb = {
      prepare: (sql: string) => ({
        all: (storeId: string, businessDate: string) => {
          if (sql.includes('FROM orders')) {
            return [
              { order_id: 'ord-1', subtotal_cents: 2000, tax_cents: 100, total_cents: 2100, discount_cents: 0, status: 'PAID' },
              { order_id: 'ord-2', subtotal_cents: 3000, tax_cents: 150, total_cents: 3150, discount_cents: 0, status: 'PAID' },
              { order_id: 'ord-3', subtotal_cents: 1000, tax_cents: 50, total_cents: 1050, discount_cents: 0, status: 'VOIDED' },
            ];
          }
          if (sql.includes('FROM payments')) {
            return [
              { tender_type: 'CASH', amount_cents: 2500, change_cents: 400, status: 'SETTLED' }, // Net 2100 cash
              { tender_type: 'CARD_TERMINAL', amount_cents: 3150, change_cents: 0, status: 'SETTLED' }, // Net 3150 card
            ];
          }
          if (sql.includes('FROM invoices')) {
            return [
              { cgst_paise: 50, sgst_paise: 50, igst_paise: 0, service_charge_paise: 0, status: 'ISSUED' },
              { cgst_paise: 75, sgst_paise: 75, igst_paise: 0, service_charge_paise: 0, status: 'ISSUED' },
            ];
          }
          return [];
        },
        run: () => ({ changes: 1 }),
      }),
    };

    engine = new DayEndReconciliationEngine(mockDb);
  });

  it('computes expected drawer cash and flags cash shortage variance', () => {
    const summary = engine.generateDayEndZReport({
      storeId: 'store-104',
      businessDate: '2026-08-15',
      managerUserId: 'usr-mgr-01',
      managerName: 'Michael Smith (GM)',
      countedCashPaise: 4000, // Counted $40.00 cash (Expected $41.00 = $20.00 float + $21.00 net cash)
      cardBatchSettledPaise: 3150, // Card terminal settled exactly $31.50
      upiSettledPaise: 0,
      startingFloatPaise: 2000, // $20.00 float
      cashDropsPaise: 0,
      paidOutsPaise: 0,
    });

    expect(summary.grossSalesPaise).toBe(5250); // $21.00 + $31.50 = $52.50
    expect(summary.voidsAndCancellationsPaise).toBe(1050); // $10.50 voided order
    expect(summary.totalTaxPaise).toBe(250);

    const cashTender = summary.tenderSettlements.find(t => t.tenderType === 'CASH');
    expect(cashTender?.expectedPaise).toBe(4100); // $20.00 float + $21.00 cash sales = $41.00
    expect(cashTender?.settledPaise).toBe(4000); // $40.00 counted
    expect(cashTender?.variancePaise).toBe(-100); // $1.00 short!

    expect(summary.netOverShortVariancePaise).toBe(-100);
    expect(summary.isBalanced).toBe(false);
    expect(summary.status).toBe('VARIANCE_FLAGGED');
  });

  it('marks day as RECONCILED when counted cash and card settlements match exactly', () => {
    const summary = engine.generateDayEndZReport({
      storeId: 'store-104',
      businessDate: '2026-08-15',
      managerUserId: 'usr-mgr-01',
      managerName: 'Michael Smith (GM)',
      countedCashPaise: 4100, // Exactly $41.00
      cardBatchSettledPaise: 3150, // Exactly $31.50
      upiSettledPaise: 0,
      startingFloatPaise: 2000,
    });

    expect(summary.netOverShortVariancePaise).toBe(0);
    expect(summary.isBalanced).toBe(true);
    expect(summary.status).toBe('RECONCILED');
  });
});
