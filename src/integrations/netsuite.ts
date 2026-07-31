import { POSTransaction, InventoryRecord } from '../shared/types.js';
import { FranchiseeRoyaltyInvoice } from '../fintech/royalty-engine.js';

export interface NetSuiteJournalEntry {
  entryDate: string;
  memo: string;
  subsidiaryId: string;
  lines: {
    accountNumber: string; // e.g. 1010 Cash, 4010 Sales, 2010 Tax Payable
    debit: number;
    credit: number;
    entityId?: string;
    memo?: string;
  }[];
}

export class NetSuiteERPIntegration {
  private cashAccount: string = '1010';
  private salesAccount: string = '4010';
  private taxAccount: string = '2010';
  private royaltyIncomeAccount: string = '4050';

  /**
   * Transforms daily POS transactions into a balanced NetSuite GL Journal Entry.
   */
  public generateDailyGLJournalEntry(
    storeId: string,
    subsidiaryId: string,
    transactions: POSTransaction[],
    date: string
  ): NetSuiteJournalEntry {
    const totalSales = transactions.reduce((sum, t) => sum + t.subtotal, 0);
    const totalTax = transactions.reduce((sum, t) => sum + t.tax, 0);
    const totalCashCardReceived = transactions.reduce((sum, t) => sum + t.total, 0);

    return {
      entryDate: date,
      memo: `Daily POS Revenue Settlement - Store ${storeId}`,
      subsidiaryId,
      lines: [
        {
          accountNumber: this.cashAccount,
          debit: Number(totalCashCardReceived.toFixed(2)),
          credit: 0,
          memo: 'Cash & Card Tenders Received',
        },
        {
          accountNumber: this.salesAccount,
          debit: 0,
          credit: Number(totalSales.toFixed(2)),
          memo: 'Gross POS Food & Beverage Sales',
        },
        {
          accountNumber: this.taxAccount,
          debit: 0,
          credit: Number(totalTax.toFixed(2)),
          memo: 'Sales Tax Payable',
        },
      ],
    };
  }

  /**
   * Generates NetSuite Intercompany Royalty Invoice voucher.
   */
  public generateRoyaltyInvoiceVoucher(invoice: FranchiseeRoyaltyInvoice): NetSuiteJournalEntry {
    return {
      entryDate: invoice.generatedAt.split('T')[0],
      memo: `Franchise Royalty ACH Billing - ${invoice.storeId}`,
      subsidiaryId: 'SUB-CORP-HQ',
      lines: [
        {
          accountNumber: '1200', // Accounts Receivable
          debit: invoice.totalDueACH,
          credit: 0,
          entityId: invoice.franchiseeId,
          memo: 'ACH Billing Pending',
        },
        {
          accountNumber: this.royaltyIncomeAccount, // Royalty Fee Revenue
          debit: 0,
          credit: invoice.royaltyFeeAmount,
          memo: `Royalty Fee (${invoice.storeId})`,
        },
        {
          accountNumber: '4060', // Marketing Fund Revenue
          debit: 0,
          credit: invoice.marketingFeeAmount,
          memo: `National Marketing Fund (${invoice.storeId})`,
        },
      ],
    };
  }
}
