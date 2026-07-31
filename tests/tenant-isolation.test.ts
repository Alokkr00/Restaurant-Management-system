import { describe, it, expect } from 'vitest';
import { JWTAuthService, TenantContext } from '../src/security/tenant-context.js';
import { TenantDataIsolationGuard } from '../src/security/tenant-isolation.js';
import { TenantHierarchicalInheritanceEngine } from '../src/hq-cloud/tenant-inheritance-engine.js';
import { MenuItem } from '../src/shared/types.js';

describe('Multi-Tenant Architecture: JWT Claims, Franchisee Isolation & Inheritance Engine', () => {
  const authService = new JWTAuthService();
  const securityGuard = new TenantDataIsolationGuard();
  const inheritanceEngine = new TenantHierarchicalInheritanceEngine();

  it('JWTAuthService should issue and verify signed JWT tokens carrying multi-tenant claims', () => {
    const context: TenantContext = {
      platformId: 'plat-global-01',
      tenantId: 'tnt-franchise-corp',
      brandId: 'brand-pizza-co',
      franchiseeId: 'fran-chicago-101',
      user: {
        userId: 'usr-sarah-101',
        email: 'sarah@franchise101.com',
        role: 'FRANCHISEE_OWNER',
        allowedStoreIds: ['store-101', 'store-102'],
      },
    };

    const token = authService.issueToken(context);
    expect(token).toBeTypeOf('string');
    expect(token.split('.').length).toBe(3);

    const verified = authService.verifyToken(token);
    expect(verified.sub).toBe('usr-sarah-101');
    expect(verified.role).toBe('FRANCHISEE_OWNER');
    expect(verified.brandId).toBe('brand-pizza-co');
    expect(verified.storeIds).toContain('store-101');
  });

  it('Franchisee Data Isolation must return ZERO rows from Franchisee B (Strict Multi-Tenant Protection)', () => {
    const franchiseeAContext: TenantContext = {
      platformId: 'plat-global-01',
      tenantId: 'tnt-franchise-corp',
      brandId: 'brand-pizza-co',
      franchiseeId: 'fran-A',
      user: {
        userId: 'usr-fran-a',
        email: 'ownerA@franchiseA.com',
        role: 'FRANCHISEE_OWNER',
        allowedStoreIds: ['store-A1', 'store-A2'],
      },
    };

    const cloudPostgresSalesRecords = [
      { storeId: 'store-A1', sales: 12500, franchiseeId: 'fran-A' },
      { storeId: 'store-A2', sales: 9800, franchiseeId: 'fran-A' },
      { storeId: 'store-B1', sales: 45000, franchiseeId: 'fran-B' }, // Franchisee B's store!
      { storeId: 'store-B2', sales: 32000, franchiseeId: 'fran-B' }, // Franchisee B's store!
    ];

    const isolatedRecords = securityGuard.filterRecordsForTenant(franchiseeAContext.user, cloudPostgresSalesRecords);
    expect(isolatedRecords.length).toBe(2);
    expect(isolatedRecords.map((r) => r.storeId)).toEqual(['store-A1', 'store-A2']);

    // Franchisee B's rows must be exactly 0
    const franchiseeBRows = isolatedRecords.filter((r) => r.franchiseeId === 'fran-B');
    expect(franchiseeBRows.length).toBe(0);
  });

  it('Tenant Inheritance Engine must resolve Platform Default -> Brand -> Region -> Store hierarchy', () => {
    const masterPizza: MenuItem = {
      id: 'item-pizza-master',
      sku: 'PIZ-MST-LG',
      name: 'Master Large Pizza',
      category: 'Pizzas',
      basePrice: 20.0,
      currency: 'USD',
      hierarchyLevel: 'GLOBAL',
      targetId: 'global-hq',
      isBrandLocked: true,
      allergens: ['DAIRY', 'GLUTEN'],
      nutritionalInfo: { calories: 2000, proteinGrams: 80, carbsGrams: 200, fatGrams: 90 },
      version: 1,
      updatedAt: '2026-07-31T12:00:00Z',
    };

    inheritanceEngine.registerPlatformDefault(masterPizza);

    // Brand Level Override: Sets Brand Price to $18.99
    inheritanceEngine.registerOverride({
      id: 'ovr-brand-1',
      entityId: 'item-pizza-master',
      targetLevel: 'BRAND',
      targetId: 'brand-pizza-co',
      overrides: { basePrice: 18.99 },
      updatedByRole: 'HQ_ADMIN',
    });

    // Store Level Override Attempt by Franchisee: Tries to change price to $14.99 and un-lock brand record
    inheritanceEngine.registerOverride({
      id: 'ovr-store-1',
      entityId: 'item-pizza-master',
      targetLevel: 'STORE',
      targetId: 'store-104',
      overrides: { basePrice: 14.99, name: 'Hacked Cheap Pizza' },
      updatedByRole: 'FRANCHISEE_OWNER',
    });

    const resolved = inheritanceEngine.resolveItemConfiguration('item-pizza-master', {
      platformId: 'plat-global-01',
      brandId: 'brand-pizza-co',
      storeId: 'store-104',
    });

    // Price override ($14.99) applies because price is not locked, but locked name 'Master Large Pizza' is preserved
    expect(resolved.basePrice).toBe(14.99);
    expect(resolved.name).toBe('Master Large Pizza'); // Preserved HQ brand name!
  });
});
