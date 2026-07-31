import { describe, it, expect } from 'vitest';
import { PluggableTaxEngine } from '../src/tax/tax-engine.js';
import { OfflinePaymentVaultEngine } from '../src/fintech/offline-payment-vault.js';
import { TenantDataIsolationGuard, TenantUserContext } from '../src/security/tenant-isolation.js';

describe('Enterprise Hardening: Pluggable Tax, Offline Risk Caps & Multi-Tenant Security', () => {
  const taxEngine = new PluggableTaxEngine();
  const paymentVault = new OfflinePaymentVaultEngine();
  const securityGuard = new TenantDataIsolationGuard();

  it('Pluggable Tax Engine should calculate jurisdiction-agnostic taxes (US, EU VAT, India GST)', () => {
    // US Sales Tax (6% State + 2% Local)
    const usTax = taxEngine.calculate('US_SALES_TAX', 100.0);
    expect(usTax.totalTaxAmount).toBe(8.0);
    expect(usTax.lines.length).toBe(2);

    // EU VAT (20% Standard)
    const euTax = taxEngine.calculate('EU_VAT', 100.0);
    expect(euTax.totalTaxAmount).toBe(20.0);

    // India GST (2.5% CGST + 2.5% SGST)
    const indiaTax = taxEngine.calculate('INDIA_GST', 100.0);
    expect(indiaTax.totalTaxAmount).toBe(5.0);
    expect(indiaTax.lines[0].name).toBe('Central GST (CGST)');
  });

  it('Offline Payment Vault must block > $100 transactions without valid supervisor PIN override', () => {
    paymentVault.resetStoreOfflineExposure();

    // High value transaction ($150) without PIN -> Rejected
    const rejected = paymentVault.processOfflineAuth({
      storeId: 'store-01',
      terminalId: 'pos-1',
      transactionAmount: 150.0,
      encryptedCardToken: 'tok_p2pe_raw',
    });

    expect(rejected.approved).toBe(false);
    expect(rejected.requiresSupervisorOverride).toBe(true);

    // High value transaction ($150) WITH supervisor PIN 1234 -> Approved
    const approved = paymentVault.processOfflineAuth({
      storeId: 'store-01',
      terminalId: 'pos-1',
      transactionAmount: 150.0,
      encryptedCardToken: 'tok_p2pe_raw',
      supervisorPinOverride: '1234',
    });

    expect(approved.approved).toBe(true);
    expect(approved.offlineToken).toContain('tok_def_p2pe');
  });

  it('Tenant Security Guard must strictly isolate Franchisee data and prevent cross-tenant leakage', () => {
    const franchiseeContext: TenantUserContext = {
      userId: 'user-fran-chicago',
      userRole: 'FRANCHISEE_OPERATOR',
      franchiseeId: 'fran-101',
      allowedStoreIds: ['store-101', 'store-102'],
    };

    const multiStoreRecords = [
      { storeId: 'store-101', sales: 5000 },
      { storeId: 'store-102', sales: 4000 },
      { storeId: 'store-201', sales: 9000 }, // Franchisee B's store!
    ];

    // Filtered list should ONLY contain store-101 and store-102
    const filtered = securityGuard.filterRecordsForTenant(franchiseeContext, multiStoreRecords);
    expect(filtered.length).toBe(2);
    expect(filtered.map((r) => r.storeId)).not.toContain('store-201');

    // Attempting direct access to store-201 must throw Security Exception
    expect(() => {
      securityGuard.assertStoreAccess(franchiseeContext, 'store-201');
    }).toThrowError(/SECURITY VIOLATION/);
  });
});
