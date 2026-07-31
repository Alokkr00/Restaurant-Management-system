export interface OfflineCardAuthRequest {
  storeId: string;
  terminalId: string;
  transactionAmount: number;
  encryptedCardToken: string;
  supervisorPinOverride?: string;
}

export interface OfflineAuthResult {
  approved: boolean;
  offlineToken: string;
  riskLimitBreached: boolean;
  requiresSupervisorOverride: boolean;
  reason?: string;
}

export class OfflinePaymentVaultEngine {
  private maxSingleTxOfflineLimit: number = 100.0; // Max $100 per offline card sale
  private maxStoreCumulativeRiskLimit: number = 2500.0; // Max $2,500 total exposure
  private currentStoreOfflineExposure: number = 0;
  private validSupervisorPins: Set<string> = new Set(['1234', '9999']);

  /**
   * Evaluates offline P2PE card checkout request against hard risk caps and manager overrides.
   */
  public processOfflineAuth(req: OfflineCardAuthRequest): OfflineAuthResult {
    const isSingleLimitBreached = req.transactionAmount > this.maxSingleTxOfflineLimit;
    const isCumulativeLimitBreached =
      this.currentStoreOfflineExposure + req.transactionAmount > this.maxStoreCumulativeRiskLimit;

    const requiresSupervisorOverride = isSingleLimitBreached || isCumulativeLimitBreached;

    if (requiresSupervisorOverride) {
      if (!req.supervisorPinOverride || !this.validSupervisorPins.has(req.supervisorPinOverride)) {
        return {
          approved: false,
          offlineToken: '',
          riskLimitBreached: true,
          requiresSupervisorOverride: true,
          reason: 'Offline risk limit exceeded ($100 max per tx / $2,500 total). Valid supervisor PIN override required.',
        };
      }
    }

    // Approved: Update store exposure & issue encrypted offline vault token
    this.currentStoreOfflineExposure += req.transactionAmount;
    const offlineToken = `tok_def_p2pe_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    return {
      approved: true,
      offlineToken,
      riskLimitBreached: requiresSupervisorOverride,
      requiresSupervisorOverride: false,
    };
  }

  public getStoreOfflineExposure(): number {
    return this.currentStoreOfflineExposure;
  }

  public resetStoreOfflineExposure(): void {
    this.currentStoreOfflineExposure = 0;
  }
}
