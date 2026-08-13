import { describe, it, expect } from 'vitest';
import { NetSuiteERPIntegration } from '../src/integrations/netsuite.js';
import { ADPPayrollIntegration } from '../src/integrations/adp.js';
import { DigitalScaleDriver } from '../src/hardware/scale-driver.js';
import { POSTransaction } from '../src/shared/types.js';
import { Shift, BreakAttestation } from '../src/labor/compliance-guardrails.js';

describe('Phase 2 Sprint 2: Enterprise Integrations & Hardware Scale', () => {
  const netsuite = new NetSuiteERPIntegration();
  const adp = new ADPPayrollIntegration();
  const scale = new DigitalScaleDriver();

  it('NetSuite GL Journal Entry debits must exactly equal credits', () => {
    const transactions: POSTransaction[] = [
      {
        id: 'tx-1',
        storeId: 'store-01',
        terminalId: 'pos-1',
        timestamp: '2026-07-31T12:00:00Z',
        items: [{ menuItemId: 'item-101', quantity: 2, unitPrice: 18.99 }],
        subtotal: 37.98,
        tax: 3.04,
        total: 41.02,
        tenders: [{ type: 'CARD', amount: 41.02 }],
        offlineMode: false,
        synced: true,
      },
    ];

    const entry = netsuite.generateDailyGLJournalEntry('store-01', 'SUB-CHICAGO', transactions, '2026-07-31');
    const totalDebits = entry.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = entry.lines.reduce((sum, l) => sum + l.credit, 0);

    expect(entry.isBalanced).toBe(true);
    expect(totalDebits).toBeCloseTo(totalCredits, 2);
    expect(totalDebits).toBe(41.02);
  });

  it('ADP Payroll payload must correctly calculate overtime (> 40h) and include tips', () => {
    // 5 shifts of 9 hours each = 45 total hours (40 regular hours, 5 overtime hours)
    const shifts: Shift[] = [
      { id: 's1', employeeId: 'emp-101', employeeName: 'Sarah Jenkins', role: 'SERVER', startTime: '2026-07-27T08:00:00Z', endTime: '2026-07-27T17:00:00Z', hourlyRate: 20.0 },
      { id: 's2', employeeId: 'emp-101', employeeName: 'Sarah Jenkins', role: 'SERVER', startTime: '2026-07-28T08:00:00Z', endTime: '2026-07-28T17:00:00Z', hourlyRate: 20.0 },
      { id: 's3', employeeId: 'emp-101', employeeName: 'Sarah Jenkins', role: 'SERVER', startTime: '2026-07-29T08:00:00Z', endTime: '2026-07-29T17:00:00Z', hourlyRate: 20.0 },
      { id: 's4', employeeId: 'emp-101', employeeName: 'Sarah Jenkins', role: 'SERVER', startTime: '2026-07-30T08:00:00Z', endTime: '2026-07-30T17:00:00Z', hourlyRate: 20.0 },
      { id: 's5', employeeId: 'emp-101', employeeName: 'Sarah Jenkins', role: 'SERVER', startTime: '2026-07-31T08:00:00Z', endTime: '2026-07-31T17:00:00Z', hourlyRate: 20.0 },
    ];

    const tipDistributions = [
      { employeeId: 'emp-101', employeeName: 'Sarah Jenkins', role: 'SERVER' as any, hoursWorked: 45, isEligibleFLSA: true, allocatedTipAmount: 150.0 },
    ];

    const attestations: BreakAttestation[] = [
      { shiftId: 's5', employeeId: 'emp-101', clockOutTime: '2026-07-31T17:00:00Z', tookRequiredMealBreak: true, tookRequiredRestBreaks: true, signatureToken: 'sig-ok' },
    ];

    const payroll = adp.generateADPPayrollPayload(shifts, tipDistributions, attestations, '2026-07-31');
    expect(payroll.length).toBe(1);
    expect(payroll[0].regularHours).toBe(40);
    expect(payroll[0].overtimeHours15x).toBe(5);
    expect(payroll[0].allocatedTipsUSD).toBe(150.0);
    expect(payroll[0].grossPayUSD).toBe(40 * 20 + 5 * 30 + 150.0); // 800 + 150 + 150 = 1100
    expect(payroll[0].breakAttestationStatus).toBe('COMPLIANT');
  });

  it('Digital Scale Driver must correctly record weight readings and handle tare zeroing', () => {
    const reading = scale.readScaleWeight(500); // 500 grams
    expect(reading.weightGrams).toBe(500);
    expect(reading.weightOunces).toBe(17.64);
    expect(reading.isStable).toBe(true);

    const tared = scale.tareZero();
    expect(tared.weightGrams).toBe(0);
    expect(tared.weightOunces).toBe(0);
  });
});
