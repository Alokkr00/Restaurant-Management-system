import { describe, it, expect } from 'vitest';
import { GSTInvoiceEngine, StoreFiscalProfile, InvoiceItemLine } from '../src/tax/gst-invoice-engine.js';

describe('GSTInvoiceEngine - Indian Statutory Fiscal Invoicing & Tax Breakdown', () => {
  const engine = new GSTInvoiceEngine();

  const storeProfile: StoreFiscalProfile = {
    storeId: 'store-104',
    storeName: 'The Pizza Co. - Mumbai West',
    countryCode: 'IN',
    gstin: '27AAPFU0939F1ZV',
    stateCode: '27',
    stateName: 'Maharashtra',
    currency: 'INR',
    isTaxInclusive: false,
    standardGstBps: 500, // 5.00% standard restaurant GST (2.5% CGST + 2.5% SGST)
    serviceChargeBps: 500, // 5.00% optional service charge
    upiVpa: 'store104.pos@icici',
  };

  it('validates 15-character statutory GSTIN formatting', () => {
    expect(GSTInvoiceEngine.isValidGSTIN('27AAPFU0939F1ZV')).toBe(true);
    expect(GSTInvoiceEngine.isValidGSTIN('07AAAAA0000A1Z5')).toBe(true);
    expect(GSTInvoiceEngine.isValidGSTIN('INVALID_GSTIN')).toBe(false);
    expect(GSTInvoiceEngine.isValidGSTIN('12345')).toBe(false);
  });

  it('resolves correct Indian Financial Year (FY) across April 1 cutoff', () => {
    expect(GSTInvoiceEngine.getFinancialYear('2026-08-15')).toBe('2026-27');
    expect(GSTInvoiceEngine.getFinancialYear('2026-04-01')).toBe('2026-27');
    expect(GSTInvoiceEngine.getFinancialYear('2027-03-31')).toBe('2026-27');
    expect(GSTInvoiceEngine.getFinancialYear('2026-01-15')).toBe('2025-26');
  });

  it('calculates intra-state CGST + SGST (2.5% + 2.5%) correctly on exclusive pricing', () => {
    const items: InvoiceItemLine[] = [
      { productId: 'item-101', name: 'Large Pepperoni Pizza', sacCode: '996331', quantity: 2, grossAmountPaise: 40000 }, // ₹400.00
      { productId: 'item-104', name: 'Spicy Buffalo Wings', sacCode: '996331', quantity: 1, grossAmountPaise: 20000 }, // ₹200.00
    ];

    const result = engine.calculateTaxes(storeProfile, items, '27', false);

    expect(result.subtotalFoodPaise).toBe(60000); // ₹600.00
    expect(result.serviceChargePaise).toBe(0);
    expect(result.cgstBps).toBe(250); // 2.50%
    expect(result.sgstBps).toBe(250); // 2.50%
    expect(result.cgstPaise).toBe(1500); // ₹15.00
    expect(result.sgstPaise).toBe(1500); // ₹15.00
    expect(result.igstPaise).toBe(0);
    expect(result.totalTaxPaise).toBe(3000); // ₹30.00
    expect(result.grandTotalPaise).toBe(63000); // ₹630.00
  });

  it('calculates inter-state IGST (5%) when customer is from a different state', () => {
    const items: InvoiceItemLine[] = [
      { productId: 'item-101', name: 'Large Pepperoni Pizza', sacCode: '996331', quantity: 1, grossAmountPaise: 50000 }, // ₹500.00
    ];

    // Customer state is '07' (Delhi), Store is '27' (Maharashtra)
    const result = engine.calculateTaxes(storeProfile, items, '07', false);

    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(0);
    expect(result.igstBps).toBe(500); // 5.00%
    expect(result.igstPaise).toBe(2500); // ₹25.00
    expect(result.grandTotalPaise).toBe(52500); // ₹525.00
  });

  it('extracts base price correctly from tax-inclusive pricing', () => {
    const inclusiveProfile: StoreFiscalProfile = {
      ...storeProfile,
      isTaxInclusive: true,
      standardGstBps: 500, // 5% GST included in price
      serviceChargeBps: 0,
    };

    // ₹525.00 MRP inclusive of 5% GST -> Base should be ₹500.00, Tax ₹25.00
    const items: InvoiceItemLine[] = [
      { productId: 'item-101', name: 'Large Pepperoni Pizza', sacCode: '996331', quantity: 1, grossAmountPaise: 52500 },
    ];

    const result = engine.calculateTaxes(inclusiveProfile, items, '27', false);

    expect(result.subtotalFoodPaise).toBe(50000); // ₹500.00 base
    expect(result.cgstPaise).toBe(1250); // ₹12.50
    expect(result.sgstPaise).toBe(1250); // ₹12.50
    expect(result.totalTaxPaise).toBe(2500); // ₹25.00
    expect(result.grandTotalPaise).toBe(52500); // Total stays exactly ₹525.00
  });

  it('generates dynamic NPCI-compliant UPI QR code string with amount and invoice reference', () => {
    const upiQr = engine.generateUpiQrPayload(
      'store104.pos@icici',
      'The Pizza Co.',
      'INV-store-104/2026-27/000104',
      63000 // ₹630.00
    );

    expect(upiQr).toContain('upi://pay?pa=store104.pos@icici');
    expect(upiQr).toContain('am=630.00');
    expect(upiQr).toContain('tr=INV-store-104/2026-27/000104');
    expect(upiQr).toContain('cu=INR');
  });

  it('issues statutory invoice and creates reversing credit note on refund', () => {
    const items: InvoiceItemLine[] = [
      { productId: 'item-101', name: 'Pizza', sacCode: '996331', quantity: 1, grossAmountPaise: 10000 },
    ];

    const invoice = engine.issueInvoice({
      profile: storeProfile,
      orderId: 'ord-test-01',
      orderType: 'DINE_IN',
      businessDate: '2026-08-15',
      sequenceNumber: 104,
      items,
    });

    expect(invoice.invoiceNumber).toBe('INV-store-104/2026-27/000104');
    expect(invoice.status).toBe('ISSUED');
    expect(invoice.upiQrPayload).toBeDefined();

    // Issue Credit Note reversing invoice
    const creditNote = engine.issueCreditNote({
      originalInvoice: invoice,
      sequenceNumber: 12,
      reason: 'Customer cancelled prior to preparation',
    });

    expect(creditNote.creditNoteNumber).toBe('CN-store-104/2026-27/000012');
    expect(creditNote.status).toBe('REFUNDED');
  });
});
