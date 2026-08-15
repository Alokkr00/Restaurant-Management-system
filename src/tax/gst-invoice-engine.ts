import crypto from 'crypto';

export type JurisdictionCode = 'IN_GST' | 'US_SALES' | 'EU_VAT';

export interface StoreFiscalProfile {
  storeId: string;
  storeName: string;
  countryCode: 'IN' | 'US' | 'EU';
  gstin?: string; // e.g. 27AAPFU0939F1ZV for India
  stateCode?: string; // e.g. '27' (Maharashtra), '07' (Delhi), 'IL' (Illinois)
  stateName?: string;
  currency: 'INR' | 'USD' | 'EUR';
  isTaxInclusive: boolean;
  standardGstBps: number; // e.g. 500 = 5.00% (Restaurant non-AC/AC standard) or 1800 (18.00%)
  serviceChargeBps: number; // e.g. 500 = 5.00% optional service charge
  upiVpa?: string; // e.g. 'restaurant.pos@icici'
}

export interface InvoiceItemLine {
  productId: string;
  name: string;
  sacCode: string; // e.g. '996331' for restaurant food, '996332' for takeaway
  quantity: number;
  grossAmountPaise: number; // In minor units (paise/cents)
  isTaxExempt?: boolean;
}

export interface TaxCalculationResult {
  subtotalFoodPaise: number;
  serviceChargePaise: number;
  taxableAmountPaise: number;
  cgstBps: number;
  cgstPaise: number;
  sgstBps: number;
  sgstPaise: number;
  igstBps: number;
  igstPaise: number;
  totalTaxPaise: number;
  roundingPaise: number; // Cash rounding adjustment
  grandTotalPaise: number;
  breakdownSummary: {
    label: string;
    ratePercent: number;
    amountPaise: number;
  }[];
}

export interface FiscalInvoice {
  invoiceId: string;
  invoiceNumber: string; // e.g. INV/2026-27/000104
  creditNoteNumber?: string; // e.g. CN/2026-27/000012
  financialYear: string; // e.g. 2026-27
  storeId: string;
  businessDate: string; // YYYY-MM-DD
  issuedAt: string; // ISO UTC
  orderId: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  gstin: string;
  isInterState: boolean;
  currency: string;
  items: InvoiceItemLine[];
  taxSummary: TaxCalculationResult;
  upiQrPayload?: string;
  status: 'ISSUED' | 'CANCELLED' | 'REFUNDED';
}

export class GSTInvoiceEngine {
  /**
   * Validates statutory 15-character GSTIN format
   */
  public static isValidGSTIN(gstin: string): boolean {
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return regex.test(gstin.trim().toUpperCase());
  }

  /**
   * Resolves Indian Financial Year based on business date (April 1 to March 31)
   */
  public static getFinancialYear(businessDate: string): string {
    const date = new Date(businessDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    if (month >= 4) {
      const nextYearShort = String((year + 1) % 100).padStart(2, '0');
      return `${year}-${nextYearShort}`;
    } else {
      const currentYearShort = String(year % 100).padStart(2, '0');
      return `${year - 1}-${currentYearShort}`;
    }
  }

  /**
   * Generates sequential statutory invoice number
   */
  public static formatInvoiceNumber(storePrefix: string, fy: string, sequenceNumber: number): string {
    const padded = String(sequenceNumber).padStart(6, '0');
    return `INV-${storePrefix}/${fy}/${padded}`;
  }

  /**
   * Generates sequential statutory credit note number
   */
  public static formatCreditNoteNumber(storePrefix: string, fy: string, sequenceNumber: number): string {
    const padded = String(sequenceNumber).padStart(6, '0');
    return `CN-${storePrefix}/${fy}/${padded}`;
  }

  /**
   * Calculates GST / Tax Breakdown with support for intra-state (CGST+SGST) vs inter-state (IGST),
   * inclusive vs exclusive pricing, and optional service charge.
   */
  public calculateTaxes(
    profile: StoreFiscalProfile,
    items: InvoiceItemLine[],
    customerStateCode?: string,
    applyServiceCharge = false
  ): TaxCalculationResult {
    let rawItemTotalPaise = 0;
    for (const it of items) {
      rawItemTotalPaise += it.grossAmountPaise;
    }

    let subtotalFoodPaise = 0;
    const isInterState = customerStateCode && profile.stateCode ? customerStateCode !== profile.stateCode : false;

    // Handle Inclusive vs Exclusive Pricing
    if (profile.isTaxInclusive) {
      // Extract base price before tax
      const totalRateBps = profile.standardGstBps + (applyServiceCharge ? profile.serviceChargeBps : 0);
      subtotalFoodPaise = Math.round((rawItemTotalPaise * 10000) / (10000 + totalRateBps));
    } else {
      subtotalFoodPaise = rawItemTotalPaise;
    }

    // Service Charge (calculated on food subtotal)
    const serviceChargePaise = applyServiceCharge
      ? Math.round((subtotalFoodPaise * profile.serviceChargeBps) / 10000)
      : 0;

    const taxableAmountPaise = subtotalFoodPaise + serviceChargePaise;

    let cgstBps = 0;
    let cgstPaise = 0;
    let sgstBps = 0;
    let sgstPaise = 0;
    let igstBps = 0;
    let igstPaise = 0;

    const breakdown: TaxCalculationResult['breakdownSummary'] = [];

    if (profile.countryCode === 'IN') {
      if (isInterState) {
        igstBps = profile.standardGstBps;
        igstPaise = Math.round((taxableAmountPaise * igstBps) / 10000);
        breakdown.push({
          label: 'Integrated GST (IGST)',
          ratePercent: igstBps / 100,
          amountPaise: igstPaise,
        });
      } else {
        // Equal split between CGST and SGST
        cgstBps = Math.floor(profile.standardGstBps / 2);
        sgstBps = profile.standardGstBps - cgstBps;
        cgstPaise = Math.round((taxableAmountPaise * cgstBps) / 10000);
        sgstPaise = Math.round((taxableAmountPaise * sgstBps) / 10000);

        breakdown.push({
          label: 'Central GST (CGST)',
          ratePercent: cgstBps / 100,
          amountPaise: cgstPaise,
        });
        breakdown.push({
          label: 'State GST (SGST)',
          ratePercent: sgstBps / 100,
          amountPaise: sgstPaise,
        });
      }
    } else {
      // US or EU fallback
      const flatTaxPaise = Math.round((taxableAmountPaise * profile.standardGstBps) / 10000);
      breakdown.push({
        label: profile.countryCode === 'US' ? 'Sales Tax' : 'VAT',
        ratePercent: profile.standardGstBps / 100,
        amountPaise: flatTaxPaise,
      });
      cgstPaise = flatTaxPaise;
    }

    const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;
    const exactTotal = taxableAmountPaise + totalTaxPaise;

    // Cash / Minor unit half-up rounding
    const grandTotalPaise = Math.round(exactTotal);
    const roundingPaise = grandTotalPaise - exactTotal;

    return {
      subtotalFoodPaise,
      serviceChargePaise,
      taxableAmountPaise,
      cgstBps,
      cgstPaise,
      sgstBps,
      sgstPaise,
      igstBps,
      igstPaise,
      totalTaxPaise,
      roundingPaise,
      grandTotalPaise,
      breakdownSummary: breakdown,
    };
  }

  /**
   * Generates dynamic NPCI-compliant UPI QR URI string
   */
  public generateUpiQrPayload(vpa: string, merchantName: string, invoiceNumber: string, amountPaise: number): string {
    const amountRupees = (amountPaise / 100).toFixed(2);
    const encodedName = encodeURIComponent(merchantName);
    const note = encodeURIComponent(`Bill ${invoiceNumber}`);
    return `upi://pay?pa=${vpa}&pn=${encodedName}&am=${amountRupees}&tr=${invoiceNumber}&tn=${note}&cu=INR`;
  }

  /**
   * Constructs a complete statutory fiscal invoice
   */
  public issueInvoice(params: {
    profile: StoreFiscalProfile;
    orderId: string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    businessDate: string;
    sequenceNumber: number;
    items: InvoiceItemLine[];
    customerStateCode?: string;
    applyServiceCharge?: boolean;
  }): FiscalInvoice {
    const fy = GSTInvoiceEngine.getFinancialYear(params.businessDate);
    const invoiceNumber = GSTInvoiceEngine.formatInvoiceNumber(params.profile.storeId, fy, params.sequenceNumber);
    const isInterState = params.customerStateCode && params.profile.stateCode ? params.customerStateCode !== params.profile.stateCode : false;

    const taxSummary = this.calculateTaxes(
      params.profile,
      params.items,
      params.customerStateCode,
      params.applyServiceCharge
    );

    const upiQrPayload = params.profile.upiVpa
      ? this.generateUpiQrPayload(params.profile.upiVpa, params.profile.storeName, invoiceNumber, taxSummary.grandTotalPaise)
      : undefined;

    return {
      invoiceId: crypto.randomUUID(),
      invoiceNumber,
      financialYear: fy,
      storeId: params.profile.storeId,
      businessDate: params.businessDate,
      issuedAt: new Date().toISOString(),
      orderId: params.orderId,
      orderType: params.orderType,
      gstin: params.profile.gstin || 'UNREGISTERED',
      isInterState,
      currency: params.profile.currency,
      items: params.items,
      taxSummary,
      upiQrPayload,
      status: 'ISSUED',
    };
  }

  /**
   * Creates a formal statutory Credit Note reversing an issued invoice
   */
  public issueCreditNote(params: {
    originalInvoice: FiscalInvoice;
    sequenceNumber: number;
    reason: string;
    refundAmountPaise?: number;
  }): FiscalInvoice {
    const fy = GSTInvoiceEngine.getFinancialYear(params.originalInvoice.businessDate);
    const creditNoteNumber = GSTInvoiceEngine.formatCreditNoteNumber(params.originalInvoice.storeId, fy, params.sequenceNumber);

    return {
      ...params.originalInvoice,
      invoiceId: crypto.randomUUID(),
      creditNoteNumber,
      issuedAt: new Date().toISOString(),
      status: 'REFUNDED',
      taxSummary: {
        ...params.originalInvoice.taxSummary,
        grandTotalPaise: params.refundAmountPaise ?? params.originalInvoice.taxSummary.grandTotalPaise,
      },
    };
  }
}
