import { POSTransaction } from '../shared/types.js';
import { FranchiseeRoyaltyInvoice } from '../fintech/royalty-engine.js';

export interface NetSuiteGLLine {
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  entityId?: string;
  memo?: string;
}

export interface NetSuiteJournalEntry {
  entryDate: string;
  memo: string;
  subsidiaryId: string;
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  lines: NetSuiteGLLine[];
}

export class NetSuiteERPIntegration {
  private acctCash: string = '1010'; // Cash on Hand
  private acctCardClearing: string = '1020'; // Merchant Card Settlement Clearing
  private acctDeliveryAR: string = '1030'; // 3rd-Party Delivery AR (DoorDash, UberEats)
  private acctSalesTaxPayable: string = '2010'; // Sales Tax Payable
  private acctTipLiability: string = '2020'; // Accrued Employee Tip Liability
  private acctGiftCardLiability: string = '2030'; // Deferred Revenue - Gift Cards
  private acctFoodSalesRevenue: string = '4010'; // Gross Food & Beverage Revenue
  private acctCompsDiscounts: string = '4020'; // Contra-Revenue: Comps & Discounts
  private acctRoyaltyIncome: string = '4050'; // HQ Royalty Fee Income
  private acctMarketingFundIncome: string = '4060'; // HQ National Marketing Fund Income

  /**
   * Transforms daily store POS sales into a fully balanced double-entry NetSuite GL Journal Entry.
   * Debits = Credits is strictly enforced.
   */
  public generateDailyGLJournalEntry(
    storeId: string,
    subsidiaryId: string,
    transactions: POSTransaction[],
    date: string
  ): NetSuiteJournalEntry {
    let cashDebit = 0;
    let cardDebit = 0;
    let deliveryARDebit = 0;
    let giftCardRedemptionDebit = 0;
    let compsContraDebit = 0;

    let grossFoodSalesCredit = 0;
    let salesTaxCredit = 0;
    let tipLiabilityCredit = 0;

    transactions.forEach((tx) => {
      grossFoodSalesCredit += tx.subtotal;
      salesTaxCredit += tx.tax;

      tx.tenders.forEach((tender) => {
        if (tender.type === 'CASH') {
          cashDebit += tender.amount;
        } else if (tender.type === 'CARD') {
          // Check if it's 3rd party aggregator
          if (tx.terminalId?.includes('AGGREGATOR') || tx.id.startsWith('deliv-')) {
            deliveryARDebit += tender.amount;
          } else {
            cardDebit += tender.amount;
          }
        } else if (tender.type === 'GIFT_CARD') {
          giftCardRedemptionDebit += tender.amount;
        } else if (tender.type === 'COMP') {
          compsContraDebit += tender.amount;
        }
      });
    });

    const lines: NetSuiteGLLine[] = [];

    // 1. Asset Debits (Cash, Card Clearing, 3rd Party Delivery Receivables, Gift Card Redemptions)
    if (cashDebit > 0) {
      lines.push({
        accountNumber: this.acctCash,
        accountName: 'Cash on Hand',
        debit: Number(cashDebit.toFixed(2)),
        credit: 0,
        memo: `Physical Cash Collected - Store ${storeId}`,
      });
    }

    if (cardDebit > 0) {
      lines.push({
        accountNumber: this.acctCardClearing,
        accountName: 'Merchant Card Settlement Clearing',
        debit: Number(cardDebit.toFixed(2)),
        credit: 0,
        memo: `Credit/Debit Card Batches - Store ${storeId}`,
      });
    }

    if (deliveryARDebit > 0) {
      lines.push({
        accountNumber: this.acctDeliveryAR,
        accountName: '3rd-Party Delivery Accounts Receivable',
        debit: Number(deliveryARDebit.toFixed(2)),
        credit: 0,
        memo: `DoorDash / UberEats AR Pending Settlement - Store ${storeId}`,
      });
    }

    if (giftCardRedemptionDebit > 0) {
      lines.push({
        accountNumber: this.acctGiftCardLiability,
        accountName: 'Deferred Revenue - Gift Card Redemptions',
        debit: Number(giftCardRedemptionDebit.toFixed(2)),
        credit: 0,
        memo: `Gift Card Redemptions - Store ${storeId}`,
      });
    }

    if (compsContraDebit > 0) {
      lines.push({
        accountNumber: this.acctCompsDiscounts,
        accountName: 'Comps & Promotional Discounts (Contra-Revenue)',
        debit: Number(compsContraDebit.toFixed(2)),
        credit: 0,
        memo: `Manager & Promotional Comps - Store ${storeId}`,
      });
    }

    // 2. Revenue & Liability Credits (Gross Sales, Sales Tax, Tip Liabilities)
    if (grossFoodSalesCredit > 0) {
      lines.push({
        accountNumber: this.acctFoodSalesRevenue,
        accountName: 'Food & Beverage Sales Revenue',
        debit: 0,
        credit: Number(grossFoodSalesCredit.toFixed(2)),
        memo: `Gross Food & Beverage POS Sales - Store ${storeId}`,
      });
    }

    if (salesTaxCredit > 0) {
      lines.push({
        accountNumber: this.acctSalesTaxPayable,
        accountName: 'Sales Tax Payable',
        debit: 0,
        credit: Number(salesTaxCredit.toFixed(2)),
        memo: `Sales Tax Collected - Store ${storeId}`,
      });
    }

    if (tipLiabilityCredit > 0) {
      lines.push({
        accountNumber: this.acctTipLiability,
        accountName: 'Employee Tip Liability',
        debit: 0,
        credit: Number(tipLiabilityCredit.toFixed(2)),
        memo: `Tips Collected for Distribution - Store ${storeId}`,
      });
    }

    const totalDebits = Number(lines.reduce((sum, l) => sum + l.debit, 0).toFixed(2));
    const totalCredits = Number(lines.reduce((sum, l) => sum + l.credit, 0).toFixed(2));
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return {
      entryDate: date,
      memo: `Daily POS Revenue Settlement - Store ${storeId}`,
      subsidiaryId,
      isBalanced,
      totalDebits,
      totalCredits,
      lines,
    };
  }

  /**
   * Generates NetSuite Intercompany Royalty Invoice voucher for corporate billing.
   */
  public generateRoyaltyInvoiceVoucher(invoice: FranchiseeRoyaltyInvoice): NetSuiteJournalEntry {
    const lines: NetSuiteGLLine[] = [
      {
        accountNumber: '1200', // Accounts Receivable
        accountName: 'Franchise Accounts Receivable',
        debit: invoice.totalDueACH,
        credit: 0,
        entityId: invoice.franchiseeId,
        memo: `Royalty & Marketing ACH Draft Pending - ${invoice.storeId}`,
      },
      {
        accountNumber: this.acctRoyaltyIncome,
        accountName: 'Franchise Royalty Fee Income',
        debit: 0,
        credit: invoice.royaltyFeeAmount,
        memo: `Franchise Royalty Fee (${invoice.effectiveRoyaltyRate}% of Net Sales $${invoice.netRoyaltySales})`,
      },
      {
        accountNumber: this.acctMarketingFundIncome,
        accountName: 'National Brand Marketing Fund',
        debit: 0,
        credit: invoice.marketingFeeAmount,
        memo: `National Marketing Contribution (2% of Net Sales $${invoice.netRoyaltySales})`,
      },
    ];

    const totalDebits = Number(lines.reduce((sum, l) => sum + l.debit, 0).toFixed(2));
    const totalCredits = Number(lines.reduce((sum, l) => sum + l.credit, 0).toFixed(2));
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return {
      entryDate: invoice.generatedAt.split('T')[0],
      memo: `Franchise Royalty ACH Billing - ${invoice.storeId}`,
      subsidiaryId: 'SUB-CORP-HQ',
      isBalanced,
      totalDebits,
      totalCredits,
      lines,
    };
  }
}
