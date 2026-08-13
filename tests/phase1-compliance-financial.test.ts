import { describe, it, expect } from 'vitest';
import { FranchiseRoyaltyEngine } from '../src/fintech/royalty-engine.js';
import { TipPoolingEngine, StaffShiftHours } from '../src/fintech/tip-pooling-engine.js';
import { ADPPayrollIntegration } from '../src/integrations/adp.js';
import { NetSuiteERPIntegration } from '../src/integrations/netsuite.js';
import { POSTransaction } from '../src/shared/types.js';
import { Shift } from '../src/labor/compliance-guardrails.js';

describe('Sprint 1: Core Financial, Legal & Compliance Hardening', () => {
  const royaltyEngine = new FranchiseRoyaltyEngine();
  const tipEngine = new TipPoolingEngine();
  const adpIntegration = new ADPPayrollIntegration();
  const netsuiteIntegration = new NetSuiteERPIntegration();

  describe('1. Franchise Royalty Engine (Net Sales & Comps Deductions)', () => {
    it('must strictly deduct comps/discounts and exclude sales tax from royalty fee base', () => {
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
          tenders: [{ type: 'COMP', amount: 20.0 }, { type: 'CASH', amount: 1.6 }], // $20 meal comped
          offlineMode: false,
          synced: true,
        },
      ];

      const invoice = royaltyEngine.calculateRoyaltyForPeriod(
        'fran-01',
        'store-104',
        transactions,
        '2026-08-01',
        '2026-08-07'
      );

      // Gross Subtotal = $40 + $20 = $60
      expect(invoice.grossSales).toBe(60.0);
      // Sales Tax Excluded = $3.20 + $1.60 = $4.80
      expect(invoice.salesTaxExcluded).toBe(4.8);
      // Comps Deducted = $20.00
      expect(invoice.compsAndDiscountsDeducted).toBe(20.0);
      // Net Royalty Sales = $60.00 - $20.00 = $40.00
      expect(invoice.netRoyaltySales).toBe(40.0);

      // Royalty Fee (5% of $40.00) = $2.00
      expect(invoice.royaltyFeeAmount).toBe(2.0);
      // Marketing Fund (2% of $40.00) = $0.80
      expect(invoice.marketingFeeAmount).toBe(0.8);
      // Total ACH Due = $2.80
      expect(invoice.totalDueACH).toBe(2.8);
    });
  });

  describe('2. FLSA Tip Pooling Compliance (Managerial Bans & Tip Credit Rules)', () => {
    it('must strictly exclude managers and shift leads with supervisory authority from tip pool', () => {
      const staff: StaffShiftHours[] = [
        { employeeId: 'emp-server1', employeeName: 'Alice Server', role: 'SERVER', hoursWorked: 10, isManagerial: false },
        { employeeId: 'emp-busser1', employeeName: 'Bob Busser', role: 'BUSSER', hoursWorked: 10, isManagerial: false },
        { employeeId: 'emp-lead1', employeeName: 'Charlie Shift Lead', role: 'SHIFT_LEAD', hoursWorked: 10, isManagerial: true },
      ];

      const result = tipEngine.calculateTipDistribution('store-104', '2026-08-01', 170.0, staff, false);

      const managerDistribution = result.distributions.find((d) => d.employeeId === 'emp-lead1');
      expect(managerDistribution?.isEligibleFLSA).toBe(false);
      expect(managerDistribution?.allocatedTipAmount).toBe(0);
      expect(managerDistribution?.exclusionReason).toContain('FLSA §3(m)(2)(B) Violation');

      // Server weight = 1.0 (10 hrs * 1.0 = 10), Busser weight = 0.7 (10 hrs * 0.7 = 7). Total weighted = 17.
      // Server share = 10/17 * 170 = $100.00
      // Busser share = 7/17 * 170 = $70.00
      const serverDist = result.distributions.find((d) => d.employeeId === 'emp-server1');
      const busserDist = result.distributions.find((d) => d.employeeId === 'emp-busser1');

      expect(serverDist?.allocatedTipAmount).toBe(100.0);
      expect(busserDist?.allocatedTipAmount).toBe(70.0);
    });

    it('must block BOH kitchen staff from tip pool when employer takes FOH tip credit', () => {
      const staff: StaffShiftHours[] = [
        { employeeId: 'emp-server1', employeeName: 'Alice Server', role: 'SERVER', hoursWorked: 8, isManagerial: false },
        { employeeId: 'emp-cook1', employeeName: 'Dan Line Cook', role: 'LINE_COOK', hoursWorked: 8, isManagerial: false },
      ];

      // takesTipCredit = true
      const result = tipEngine.calculateTipDistribution('store-104', '2026-08-01', 100.0, staff, true);

      const cookDist = result.distributions.find((d) => d.employeeId === 'emp-cook1');
      expect(cookDist?.isEligibleFLSA).toBe(false);
      expect(cookDist?.allocatedTipAmount).toBe(0);
      expect(cookDist?.exclusionReason).toContain('Tip Credit Rule');

      const serverDist = result.distributions.find((d) => d.employeeId === 'emp-server1');
      expect(serverDist?.allocatedTipAmount).toBe(100.0);
    });
  });

  describe('3. ADP State-Aware Overtime & Blended Regular Rates', () => {
    it('must calculate California Daily OT (>8h at 1.5x, >12h at 2.0x)', () => {
      // 1 single shift of 14 hours at $20/hr:
      // Regular: 8h @ $20 = $160
      // Daily OT: 4h @ $30 ($20*1.5) = $120
      // Daily Double Time: 2h @ $40 ($20*2.0) = $80
      // Total Gross Pay = $360
      const shifts: Shift[] = [
        {
          id: 'sh-1',
          employeeId: 'emp-ca-1',
          employeeName: 'Elena Rostova',
          role: 'LINE_COOK',
          startTime: '2026-08-01T06:00:00Z',
          endTime: '2026-08-01T20:00:00Z', // 14 hours
          hourlyRate: 20.0,
        },
      ];

      const records = adpIntegration.generateADPPayrollPayload(shifts, [], [], '2026-08-01', 'CALIFORNIA');

      expect(records.length).toBe(1);
      expect(records[0].regularHours).toBe(8.0);
      expect(records[0].overtimeHours15x).toBe(4.0);
      expect(records[0].doubleTimeHours20x).toBe(2.0);
      expect(records[0].grossPayUSD).toBe(360.0);
    });

    it('must calculate blended regular rate for dual-role / split-rate employee shifts', () => {
      // 5 hours as Cashier @ $15/hr = $75
      // 5 hours as Cook @ $25/hr = $125
      // Total hours = 10h (CA rule: 8h reg, 2h OT @ 1.5x)
      // Total base earnings = $200
      // Blended regular rate = $200 / 10 = $20.00/hr
      // OT premium = 2h * ($20.00 * 0.5) = $20.00
      // Total Gross Pay = $200 (base) + $20 (OT premium) = $220.00
      const shifts: Shift[] = [
        {
          id: 'sh-split-1',
          employeeId: 'emp-split-1',
          employeeName: 'Carlos Gomez',
          role: 'CASHIER',
          startTime: '2026-08-01T08:00:00Z',
          endTime: '2026-08-01T13:00:00Z', // 5h @ $15
          hourlyRate: 15.0,
        },
        {
          id: 'sh-split-2',
          employeeId: 'emp-split-1',
          employeeName: 'Carlos Gomez',
          role: 'LINE_COOK',
          startTime: '2026-08-01T13:00:00Z',
          endTime: '2026-08-01T18:00:00Z', // 5h @ $25
          hourlyRate: 25.0,
        },
      ];

      const records = adpIntegration.generateADPPayrollPayload(shifts, [], [], '2026-08-01', 'CALIFORNIA');

      expect(records[0].blendedRegularRateUSD).toBe(20.0);
      expect(records[0].regularHours).toBe(8.0);
      expect(records[0].overtimeHours15x).toBe(2.0);
      expect(records[0].grossPayUSD).toBe(220.0);
    });
  });

  describe('4. NetSuite Double-Entry GL Journal Balancing', () => {
    it('must create a balanced journal entry spanning cash, card clearing, delivery AR, tax, and comps', () => {
      const transactions: POSTransaction[] = [
        // Dine-in Cash & Card Sale
        {
          id: 'tx-dine-1',
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
        // DoorDash 3rd Party Delivery Order
        {
          id: 'deliv-dd-9988',
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

      const glEntry = netsuiteIntegration.generateDailyGLJournalEntry('store-104', 'SUB-IL-CHI', transactions, '2026-08-01');

      expect(glEntry.isBalanced).toBe(true);
      expect(glEntry.totalDebits).toBe(glEntry.totalCredits);
      expect(glEntry.totalDebits).toBe(86.4); // ($54.00 + $32.40)

      // Verify Account Lines
      const cashLine = glEntry.lines.find((l) => l.accountNumber === '1010');
      const cardLine = glEntry.lines.find((l) => l.accountNumber === '1020');
      const deliveryARLine = glEntry.lines.find((l) => l.accountNumber === '1030');
      const revenueLine = glEntry.lines.find((l) => l.accountNumber === '4010');
      const taxLine = glEntry.lines.find((l) => l.accountNumber === '2010');

      expect(cashLine?.debit).toBe(20.0);
      expect(cardLine?.debit).toBe(34.0);
      expect(deliveryARLine?.debit).toBe(32.4);
      expect(revenueLine?.credit).toBe(80.0); // ($50 + $30)
      expect(taxLine?.credit).toBe(6.4); // ($4.00 + $2.40)
    });
  });
});
