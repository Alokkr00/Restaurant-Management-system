export interface TaxBreakdown {
  jurisdiction: 'US_SALES_TAX' | 'EU_VAT' | 'INDIA_GST' | 'FLAT_TAX';
  subtotal: number;
  totalTaxAmount: number;
  lines: {
    name: string;
    ratePercent: number;
    amount: number;
  }[];
}

export interface TaxStrategy {
  calculateTax(subtotal: number, params?: any): TaxBreakdown;
}

export class USSalesTaxStrategy implements TaxStrategy {
  constructor(private stateRate: number = 6.0, private localRate: number = 2.0) {}

  public calculateTax(subtotal: number): TaxBreakdown {
    const stateAmount = Number(((subtotal * this.stateRate) / 100).toFixed(2));
    const localAmount = Number(((subtotal * this.localRate) / 100).toFixed(2));
    const totalTaxAmount = Number((stateAmount + localAmount).toFixed(2));

    return {
      jurisdiction: 'US_SALES_TAX',
      subtotal,
      totalTaxAmount,
      lines: [
        { name: 'State Sales Tax', ratePercent: this.stateRate, amount: stateAmount },
        { name: 'Local Municipal Tax', ratePercent: this.localRate, amount: localAmount },
      ],
    };
  }
}

export class EUVatTaxStrategy implements TaxStrategy {
  constructor(private vatRate: number = 20.0) {}

  public calculateTax(subtotal: number): TaxBreakdown {
    const vatAmount = Number(((subtotal * this.vatRate) / 100).toFixed(2));
    return {
      jurisdiction: 'EU_VAT',
      subtotal,
      totalTaxAmount: vatAmount,
      lines: [{ name: 'Standard EU VAT', ratePercent: this.vatRate, amount: vatAmount }],
    };
  }
}

export class IndiaGstTaxStrategy implements TaxStrategy {
  constructor(private cgstRate: number = 2.5, private sgstRate: number = 2.5) {}

  public calculateTax(subtotal: number): TaxBreakdown {
    const cgstAmount = Number(((subtotal * this.cgstRate) / 100).toFixed(2));
    const sgstAmount = Number(((subtotal * this.sgstRate) / 100).toFixed(2));
    const totalTaxAmount = Number((cgstAmount + sgstAmount).toFixed(2));

    return {
      jurisdiction: 'INDIA_GST',
      subtotal,
      totalTaxAmount,
      lines: [
        { name: 'Central GST (CGST)', ratePercent: this.cgstRate, amount: cgstAmount },
        { name: 'State GST (SGST)', ratePercent: this.sgstRate, amount: sgstAmount },
      ],
    };
  }
}

export class PluggableTaxEngine {
  private strategies: Map<string, TaxStrategy> = new Map([
    ['US_SALES_TAX', new USSalesTaxStrategy()],
    ['EU_VAT', new EUVatTaxStrategy()],
    ['INDIA_GST', new IndiaGstTaxStrategy()],
  ]);

  public getStrategy(jurisdiction: string): TaxStrategy {
    return this.strategies.get(jurisdiction) || new USSalesTaxStrategy();
  }

  public calculate(jurisdiction: string, subtotal: number): TaxBreakdown {
    const strategy = this.getStrategy(jurisdiction);
    return strategy.calculateTax(subtotal);
  }
}
