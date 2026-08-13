import { describe, it, expect } from 'vitest';
import { PluggableTaxEngine } from '../src/tax/tax-engine.js';

describe('PluggableTaxEngine', () => {
  const taxEngine = new PluggableTaxEngine();

  it('calculates US sales tax with state and local breakdown', () => {
    const breakdown = taxEngine.calculate('US_SALES_TAX', 100.0);
    expect(breakdown.jurisdiction).toBe('US_SALES_TAX');
    expect(breakdown.totalTaxAmount).toBe(8.0); // 6% state + 2% local
    expect(breakdown.lines.length).toBe(2);
  });

  it('calculates European Union VAT', () => {
    const breakdown = taxEngine.calculate('EU_VAT', 100.0);
    expect(breakdown.jurisdiction).toBe('EU_VAT');
    expect(breakdown.totalTaxAmount).toBe(20.0); // 20% standard VAT
  });

  it('calculates India GST with CGST and SGST splits', () => {
    const breakdown = taxEngine.calculate('INDIA_GST', 100.0);
    expect(breakdown.jurisdiction).toBe('INDIA_GST');
    expect(breakdown.totalTaxAmount).toBe(5.0); // 2.5% CGST + 2.5% SGST
    expect(breakdown.lines.length).toBe(2);
  });
});
