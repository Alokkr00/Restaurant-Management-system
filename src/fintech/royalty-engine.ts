import { POSTransaction } from '../shared/types.js';

export interface RoyaltyTier {
  salesThreshold: number;
  royaltyRatePercent: number;
}

export interface RoyaltyDeductionPolicy {
  allowEmployeeMealDeduction: boolean;
  allowPromotionalCompDeduction: boolean;
  allowManagerDiscretionaryCompDeduction: boolean;
  allowGiftCardBreakageDeduction: boolean;
}

export interface FranchiseeRoyaltyInvoice {
  invoiceId: string;
  franchiseeId: string;
  storeId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  salesTaxExcluded: number;
  compsAndDiscountsDeducted: number;
  netRoyaltySales: number;
  effectiveRoyaltyRate: number;
  royaltyFeeAmount: number;
  marketingFundPercent: number;
  marketingFeeAmount: number;
  totalDueACH: number;
  generatedAt: string;
  status: 'PENDING_ACH' | 'PROCESSED' | 'FAILED';
  deductionAuditTrail: {
    compType: string;
    amount: number;
  }[];
}

export class FranchiseRoyaltyEngine {
  private marketingFundPercent: number = 2.0; // 2% Brand Marketing Contribution
  private royaltyTiers: RoyaltyTier[] = [
    { salesThreshold: 50000, royaltyRatePercent: 5.0 }, // 5.0% up to $50k
    { salesThreshold: Infinity, royaltyRatePercent: 4.5 }, // 4.5% above $50k
  ];

  private defaultDeductionPolicy: RoyaltyDeductionPolicy = {
    allowEmployeeMealDeduction: true,
    allowPromotionalCompDeduction: true,
    allowManagerDiscretionaryCompDeduction: true,
    allowGiftCardBreakageDeduction: false,
  };

  /**
   * Calculates live royalties and generates ACH invoice from POS sales.
   * Net Royalty Sales = Gross Subtotal - Eligible Comps & Discounts.
   * Strictly excludes Sales Tax from the royalty fee base.
   */
  public calculateRoyaltyForPeriod(
    franchiseeId: string,
    storeId: string,
    transactions: POSTransaction[],
    periodStart: string,
    periodEnd: string,
    policy: RoyaltyDeductionPolicy = this.defaultDeductionPolicy
  ): FranchiseeRoyaltyInvoice {
    const grossSales = transactions.reduce((acc, t) => acc + t.subtotal, 0);
    const totalTax = transactions.reduce((acc, t) => acc + t.tax, 0);

    // Aggregate audited comps and discounts
    let compsAndDiscountsDeducted = 0;
    const deductionAuditTrail: { compType: string; amount: number }[] = [];

    transactions.forEach((tx) => {
      // Inspect tender comps or explicit discounts
      tx.tenders.forEach((tender) => {
        if (tender.type === 'COMP') {
          if (policy.allowManagerDiscretionaryCompDeduction || policy.allowPromotionalCompDeduction) {
            compsAndDiscountsDeducted += tender.amount;
            deductionAuditTrail.push({
              compType: 'MANAGER_OR_PROMO_COMP',
              amount: tender.amount,
            });
          }
        }
      });
    });

    // Net Royalty Sales cannot be negative
    const netRoyaltySales = Math.max(0, Number((grossSales - compsAndDiscountsDeducted).toFixed(2)));

    // Tiered rate calculation based on Net Royalty Sales
    let effectiveRoyaltyRate = 5.0;
    if (netRoyaltySales > 50000) {
      effectiveRoyaltyRate = 4.5;
    }

    const royaltyFeeAmount = Number(((netRoyaltySales * effectiveRoyaltyRate) / 100).toFixed(2));
    const marketingFeeAmount = Number(((netRoyaltySales * this.marketingFundPercent) / 100).toFixed(2));
    const totalDueACH = Number((royaltyFeeAmount + marketingFeeAmount).toFixed(2));

    return {
      invoiceId: `inv-ach-${storeId}-${Date.now()}`,
      franchiseeId,
      storeId,
      periodStart,
      periodEnd,
      grossSales: Number(grossSales.toFixed(2)),
      salesTaxExcluded: Number(totalTax.toFixed(2)),
      compsAndDiscountsDeducted: Number(compsAndDiscountsDeducted.toFixed(2)),
      netRoyaltySales,
      effectiveRoyaltyRate,
      royaltyFeeAmount,
      marketingFundPercent: this.marketingFundPercent,
      marketingFeeAmount,
      totalDueACH,
      generatedAt: new Date().toISOString(),
      status: 'PENDING_ACH',
      deductionAuditTrail,
    };
  }
}
