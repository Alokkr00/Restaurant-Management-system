import { describe, it, expect } from 'vitest';
import { CashManagementEngine } from '../src/pos/cash-management.js';

describe('CashManagementEngine', () => {
  const engine = new CashManagementEngine();

  it('manages cash drawer lifecycle, drops, payouts, and blind Z-reports', () => {
    // Open drawer
    const session = engine.openDrawerSession('store-104', 'pos-1', 'emp-101', 'Alice', 200.0);
    expect(session.expectedCashInDrawerUSD).toBe(200.0);

    // Record cash sale
    engine.recordCashTender(session.sessionId, 350.0);
    expect(session.expectedCashInDrawerUSD).toBe(550.0);

    // Mid-shift safe drop
    engine.recordCashDrop(session.sessionId, 300.0, 'mgr-1', 'ENV-01');
    expect(session.expectedCashInDrawerUSD).toBe(250.0);

    // Petty cash payout
    engine.recordPayOut(session.sessionId, 20.0, 'WINDOW_WASHING', 'Clean Windows', 'mgr-1');
    expect(session.expectedCashInDrawerUSD).toBe(230.0);

    // Blind Z-Report with $2 short
    const zReport = engine.reconcileAndCloseZReport(session.sessionId, 228.0, 'sig-token');
    expect(zReport.netExpectedCashUSD).toBe(230.0);
    expect(zReport.actualCountedCashUSD).toBe(228.0);
    expect(zReport.overShortVarianceUSD).toBe(-2.0);
  });
});
