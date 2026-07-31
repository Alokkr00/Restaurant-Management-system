import { POSTransaction } from '../shared/types.js';

export interface RoyaltyTier {
  salesThreshold: number;
  royaltyRatePercent: number;
}

export interface FranchiseeRoyaltyInvoice {
  invoiceId: string;
  franchiseeId: string;
  storeId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  netSales: number;
  royaltyFeeAmount: number;
  marketingFeeAmount: number;
  totalDueACH: number;
  generatedAt: string;
  status: 'PENDING_ACH' | 'PROCESSED' | 'FAILED';
}

export class FranchiseRoyaltyEngine {
  private marketingFundPercent: number = 2.0; // 2% Brand Marketing Contribution
  private royaltyTiers: RoyaltyTier[] = [
    { salesThreshold: 50000, royaltyRatePercent: 5.0 }, // 5% up to 50k
    { salesThreshold: Infinity, royaltyRatePercent: 4.5 }, // 4.5% above 50k
  ];

  /**
   * Calculates live royalties and generates ACH invoice from POS sales.
   */
  public calculateRoyaltyForPeriod(
    franchiseeId: string,
    storeId: string,
    transactions: POSTransaction[],
    periodStart: string,
    periodEnd: string
  ): FranchiseeRoyaltyInvoice {
    const grossSales = transactions.reduce((acc, t) => acc + t.subtotal, 0);
    // Net sales after employee meal comps or discounts
    const netSales = grossSales; 

    // Determine applicable tier rate
    let effectiveRoyaltyRate = 5.0;
    if (grossSales > 50000) {
      effectiveRoyaltyRate = 4.5;
    }

    const royaltyFeeAmount = Number(((netSales * effectiveRoyaltyRate) / 100).toFixed(2));
    const marketingFeeAmount = Number(((netSales * this.marketingFundPercent) / 100).toFixed(2));
    const totalDueACH = Number((royaltyFeeAmount + marketingFeeAmount).toFixed(2));

    return {
      invoiceId: `inv-ach-${storeId}-${Date.now()}`,
      franchiseeId,
      storeId,
      periodStart,
      periodEnd,
      grossSales: Number(grossSales.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      royaltyFeeAmount,
      marketingFeeAmount,
      totalDueACH,
      generatedAt: new Date().toISOString(),
      status: 'PENDING_ACH',
    };
  }
}
