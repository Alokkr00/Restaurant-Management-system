import crypto from 'crypto';

export interface TenderSettlementInput {
  tenderType: 'CASH' | 'CARD_TERMINAL' | 'UPI' | 'EXTERNAL_AGGREGATOR';
  expectedAmountPaise: number; // Recorded by POS
  settledAmountPaise: number; // Reported by Terminal Batch / Bank UPI / Physical Count
  notes?: string;
}

export interface DayEndReconciliationSummary {
  reconciliationId: string;
  storeId: string;
  businessDate: string; // YYYY-MM-DD
  closedAt: string; // ISO UTC
  managerUserId: string;
  managerName: string;

  // Financial Sales Overview
  grossSalesPaise: number;
  netSalesPaise: number;
  discountsAndCompsPaise: number;
  voidsAndCancellationsPaise: number;
  refundsPaise: number;
  totalTaxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  serviceChargePaise: number;

  // Multi-Tender Settlement Details
  tenderSettlements: {
    tenderType: string;
    expectedPaise: number;
    settledPaise: number;
    variancePaise: number; // settled - expected (+ is over, - is short)
    notes?: string;
  }[];

  totalExpectedPaise: number;
  totalSettledPaise: number;
  netOverShortVariancePaise: number; // Net variance across all tenders
  isBalanced: boolean;
  status: 'RECONCILED' | 'VARIANCE_FLAGGED';
}

export class DayEndReconciliationEngine {
  constructor(private db: any) {}

  /**
   * Reconciles daily store trading session across multiple tenders
   */
  public generateDayEndZReport(params: {
    storeId: string;
    businessDate: string;
    managerUserId: string;
    managerName: string;
    countedCashPaise: number;
    cardBatchSettledPaise: number;
    upiSettledPaise: number;
    aggregatorSettledPaise?: number;
    startingFloatPaise?: number;
    cashDropsPaise?: number;
    paidOutsPaise?: number;
  }): DayEndReconciliationSummary {
    const reconciliationId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Query POS Invoices & Orders for this Business Date
    const orders = this.db
      .prepare(`
        SELECT order_id, subtotal_cents, tax_cents, total_cents, discount_cents, status
        FROM orders
        WHERE store_id = ? AND business_date = ? AND is_training = 0
      `)
      .all(params.storeId, params.businessDate) as any[];

    // 2. Query Payments for this Business Date
    const payments = this.db
      .prepare(`
        SELECT p.tender_type, p.amount_cents, p.change_cents, p.status
        FROM payments p
        JOIN orders o ON p.order_id = o.order_id
        WHERE o.store_id = ? AND o.business_date = ? AND o.is_training = 0 AND p.status = 'SETTLED'
      `)
      .all(params.storeId, params.businessDate) as any[];

    // 3. Query Invoices for GST Breakdown
    const invoices = this.db
      .prepare(`
        SELECT cgst_paise, sgst_paise, igst_paise, service_charge_paise, status
        FROM invoices
        WHERE store_id = ? AND business_date = ?
      `)
      .all(params.storeId, params.businessDate) as any[];

    // Compute Totals
    let grossSalesPaise = 0;
    let netSalesPaise = 0;
    let discountsAndCompsPaise = 0;
    let voidsAndCancellationsPaise = 0;
    let refundsPaise = 0;

    for (const ord of orders) {
      if (ord.status === 'VOIDED') {
        voidsAndCancellationsPaise += ord.total_cents;
      } else if (ord.status === 'REFUNDED') {
        refundsPaise += ord.total_cents;
      } else {
        grossSalesPaise += ord.total_cents;
        netSalesPaise += ord.subtotal_cents;
        discountsAndCompsPaise += ord.discount_cents || 0;
      }
    }

    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;
    let serviceChargePaise = 0;

    for (const inv of invoices) {
      if (inv.status === 'ISSUED') {
        cgstPaise += inv.cgst_paise || 0;
        sgstPaise += inv.sgst_paise || 0;
        igstPaise += inv.igst_paise || 0;
        serviceChargePaise += inv.service_charge_paise || 0;
      }
    }

    const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;

    // Compute Expected Tenders from POS records
    let expectedCashPaise = 0;
    let expectedCardPaise = 0;
    let expectedUpiPaise = 0;
    let expectedAggregatorPaise = 0;

    for (const pay of payments) {
      const netPaid = pay.amount_cents - (pay.change_cents || 0);
      if (pay.tender_type === 'CASH') {
        expectedCashPaise += netPaid;
      } else if (pay.tender_type === 'CARD_TERMINAL') {
        expectedCardPaise += netPaid;
      } else if (pay.tender_type === 'UPI') {
        expectedUpiPaise += netPaid;
      } else if (pay.tender_type === 'EXTERNAL_AGGREGATOR') {
        expectedAggregatorPaise += netPaid;
      }
    }

    // Cash in Drawer Formula: Starting Float + Cash Sales - Cash Drops - Paid Outs
    const startingFloat = params.startingFloatPaise || 0;
    const cashDrops = params.cashDropsPaise || 0;
    const paidOuts = params.paidOutsPaise || 0;
    const expectedDrawerCash = startingFloat + expectedCashPaise - cashDrops - paidOuts;

    const tenderSettlements = [
      {
        tenderType: 'CASH',
        expectedPaise: expectedDrawerCash,
        settledPaise: params.countedCashPaise,
        variancePaise: params.countedCashPaise - expectedDrawerCash,
        notes: `Float: ${startingFloat}, Drops: ${cashDrops}, PaidOuts: ${paidOuts}`,
      },
      {
        tenderType: 'CARD_TERMINAL',
        expectedPaise: expectedCardPaise,
        settledPaise: params.cardBatchSettledPaise,
        variancePaise: params.cardBatchSettledPaise - expectedCardPaise,
      },
      {
        tenderType: 'UPI',
        expectedPaise: expectedUpiPaise,
        settledPaise: params.upiSettledPaise,
        variancePaise: params.upiSettledPaise - expectedUpiPaise,
      },
    ];

    if (params.aggregatorSettledPaise !== undefined || expectedAggregatorPaise > 0) {
      tenderSettlements.push({
        tenderType: 'EXTERNAL_AGGREGATOR',
        expectedPaise: expectedAggregatorPaise,
        settledPaise: params.aggregatorSettledPaise || expectedAggregatorPaise,
        variancePaise: (params.aggregatorSettledPaise || expectedAggregatorPaise) - expectedAggregatorPaise,
      });
    }

    const totalExpectedPaise = tenderSettlements.reduce((sum, t) => sum + t.expectedPaise, 0);
    const totalSettledPaise = tenderSettlements.reduce((sum, t) => sum + t.settledPaise, 0);
    const netOverShortVariancePaise = totalSettledPaise - totalExpectedPaise;
    const isBalanced = Math.abs(netOverShortVariancePaise) === 0;

    const summary: DayEndReconciliationSummary = {
      reconciliationId,
      storeId: params.storeId,
      businessDate: params.businessDate,
      closedAt: now,
      managerUserId: params.managerUserId,
      managerName: params.managerName,
      grossSalesPaise,
      netSalesPaise,
      discountsAndCompsPaise,
      voidsAndCancellationsPaise,
      refundsPaise,
      totalTaxPaise,
      cgstPaise,
      sgstPaise,
      igstPaise,
      serviceChargePaise,
      tenderSettlements,
      totalExpectedPaise,
      totalSettledPaise,
      netOverShortVariancePaise,
      isBalanced,
      status: isBalanced ? 'RECONCILED' : 'VARIANCE_FLAGGED',
    };

    // Record in database
    this.db
      .prepare(`
        INSERT OR REPLACE INTO daily_reconciliations (
          reconciliation_id, store_id, business_date, manager_user_id,
          gross_sales_paise, net_sales_paise, total_tax_paise,
          expected_total_paise, settled_total_paise, variance_paise,
          status, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        reconciliationId,
        params.storeId,
        params.businessDate,
        params.managerUserId,
        grossSalesPaise,
        netSalesPaise,
        totalTaxPaise,
        totalExpectedPaise,
        totalSettledPaise,
        netOverShortVariancePaise,
        summary.status,
        JSON.stringify(summary),
        now
      );

    return summary;
  }
}
