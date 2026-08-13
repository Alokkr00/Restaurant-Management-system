export interface CashDrawerSession {
  sessionId: string;
  storeId: string;
  terminalId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  startingBankUSD: number; // Opening float (e.g. $200.00)
  cashSalesTotalUSD: number;
  cashRefundsTotalUSD: number;
  cashDropsUSD: number; // Mid-shift safe drops
  payOutsUSD: number; // Petty cash expenses
  expectedCashInDrawerUSD: number;
  actualCashCountedUSD?: number; // Blind count by cashier
  overShortVarianceUSD?: number;
  status: 'OPEN' | 'CLOSED_RECONCILED' | 'VARIANCE_FLAGGED';
}

export interface CashDropEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  amountUSD: number;
  witnessManagerId: string;
  safeDropEnvelopeId: string;
}

export interface PayOutEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  amountUSD: number;
  reasonCode: 'WINDOW_WASHING' | 'EMERGENCY_PRODUCE' | 'STORE_SUPPLIES' | 'DELIVERY_PARKING' | 'OTHER';
  vendorName: string;
  approvedByManagerId: string;
  receiptImageToken?: string;
}

export interface EODZReport {
  reportId: string;
  sessionId: string;
  storeId: string;
  terminalId: string;
  generatedAt: string;
  startingBankUSD: number;
  grossCashCollectedUSD: number;
  cashRefundsUSD: number;
  totalCashDropsUSD: number;
  totalPayOutsUSD: number;
  netExpectedCashUSD: number;
  actualCountedCashUSD: number;
  overShortVarianceUSD: number;
  isVarianceAlertTriggered: boolean; // Flagged if variance >= ±$5.00
  managerSignatureToken: string;
}

export class CashManagementEngine {
  private activeSessions: Map<string, CashDrawerSession> = new Map();
  private drops: Map<string, CashDropEvent[]> = new Map();
  private payOuts: Map<string, PayOutEvent[]> = new Map();

  /**
   * Opens a new cash drawer shift session with an opening float bank.
   */
  public openDrawerSession(
    storeId: string,
    terminalId: string,
    cashierId: string,
    cashierName: string,
    startingBankUSD: number = 200.0
  ): CashDrawerSession {
    const sessionId = `drawer-${terminalId}-${Date.now()}`;
    const session: CashDrawerSession = {
      sessionId,
      storeId,
      terminalId,
      cashierId,
      cashierName,
      openedAt: new Date().toISOString(),
      startingBankUSD: Number(startingBankUSD.toFixed(2)),
      cashSalesTotalUSD: 0,
      cashRefundsTotalUSD: 0,
      cashDropsUSD: 0,
      payOutsUSD: 0,
      expectedCashInDrawerUSD: Number(startingBankUSD.toFixed(2)),
      status: 'OPEN',
    };

    this.activeSessions.set(sessionId, session);
    this.drops.set(sessionId, []);
    this.payOuts.set(sessionId, []);

    return session;
  }

  /**
   * Records cash sale or refund into active drawer session.
   */
  public recordCashTender(sessionId: string, amountUSD: number, isRefund: boolean = false): CashDrawerSession {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'OPEN') {
      throw new Error(`Active cash drawer session ${sessionId} not found or already closed`);
    }

    if (isRefund) {
      session.cashRefundsTotalUSD += amountUSD;
      session.expectedCashInDrawerUSD -= amountUSD;
    } else {
      session.cashSalesTotalUSD += amountUSD;
      session.expectedCashInDrawerUSD += amountUSD;
    }

    session.expectedCashInDrawerUSD = Number(session.expectedCashInDrawerUSD.toFixed(2));
    return session;
  }

  /**
   * Performs a mid-shift cash drop to safe to limit drawer exposure during rushes.
   */
  public recordCashDrop(
    sessionId: string,
    amountUSD: number,
    witnessManagerId: string,
    safeDropEnvelopeId: string
  ): CashDropEvent {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'OPEN') {
      throw new Error(`Drawer session ${sessionId} not found or closed`);
    }

    if (amountUSD > session.expectedCashInDrawerUSD) {
      throw new Error(`Cannot drop $${amountUSD}. Expected cash in drawer is only $${session.expectedCashInDrawerUSD}`);
    }

    const drop: CashDropEvent = {
      id: `drop-${Date.now()}`,
      sessionId,
      timestamp: new Date().toISOString(),
      amountUSD: Number(amountUSD.toFixed(2)),
      witnessManagerId,
      safeDropEnvelopeId,
    };

    session.cashDropsUSD += amountUSD;
    session.expectedCashInDrawerUSD -= amountUSD;
    session.expectedCashInDrawerUSD = Number(session.expectedCashInDrawerUSD.toFixed(2));

    this.drops.get(sessionId)?.push(drop);
    return drop;
  }

  /**
   * Records petty cash expense pay-out with manager approval code.
   */
  public recordPayOut(
    sessionId: string,
    amountUSD: number,
    reasonCode: PayOutEvent['reasonCode'],
    vendorName: string,
    approvedByManagerId: string
  ): PayOutEvent {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'OPEN') {
      throw new Error(`Drawer session ${sessionId} not found`);
    }

    const payout: PayOutEvent = {
      id: `payout-${Date.now()}`,
      sessionId,
      timestamp: new Date().toISOString(),
      amountUSD: Number(amountUSD.toFixed(2)),
      reasonCode,
      vendorName,
      approvedByManagerId,
    };

    session.payOutsUSD += amountUSD;
    session.expectedCashInDrawerUSD -= amountUSD;
    session.expectedCashInDrawerUSD = Number(session.expectedCashInDrawerUSD.toFixed(2));

    this.payOuts.get(sessionId)?.push(payout);
    return payout;
  }

  /**
   * Closes session and performs Blind EOD Z-Report Reconciliation.
   * Cashier enters physical cash counted without previewing expected cash to prevent theft skimming.
   */
  public reconcileAndCloseZReport(
    sessionId: string,
    actualCountedCashUSD: number,
    managerSignatureToken: string,
    varianceThresholdUSD: number = 5.0
  ): EODZReport {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Drawer session ${sessionId} not found`);
    }

    session.actualCashCountedUSD = Number(actualCountedCashUSD.toFixed(2));
    const variance = Number((session.actualCashCountedUSD - session.expectedCashInDrawerUSD).toFixed(2));
    session.overShortVarianceUSD = variance;
    session.closedAt = new Date().toISOString();

    const isVarianceAlert = Math.abs(variance) >= varianceThresholdUSD;
    session.status = isVarianceAlert ? 'VARIANCE_FLAGGED' : 'CLOSED_RECONCILED';

    return {
      reportId: `zreport-${session.terminalId}-${Date.now()}`,
      sessionId: session.sessionId,
      storeId: session.storeId,
      terminalId: session.terminalId,
      generatedAt: session.closedAt,
      startingBankUSD: session.startingBankUSD,
      grossCashCollectedUSD: Number(session.cashSalesTotalUSD.toFixed(2)),
      cashRefundsUSD: Number(session.cashRefundsTotalUSD.toFixed(2)),
      totalCashDropsUSD: Number(session.cashDropsUSD.toFixed(2)),
      totalPayOutsUSD: Number(session.payOutsUSD.toFixed(2)),
      netExpectedCashUSD: session.expectedCashInDrawerUSD,
      actualCountedCashUSD: session.actualCashCountedUSD,
      overShortVarianceUSD: variance,
      isVarianceAlertTriggered: isVarianceAlert,
      managerSignatureToken,
    };
  }
}
