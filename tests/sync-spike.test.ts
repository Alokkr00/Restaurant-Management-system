import { describe, it, expect } from 'vitest';
import { ConflictResolutionEngine } from '../src/shared/sync-engine.js';
import { MenuItem, POSTransaction, InventoryRecord } from '../src/shared/types.js';

describe('Architecture Spike: Domain-Specific Asymmetric Sync & Conflict Resolution', () => {
  const engine = new ConflictResolutionEngine();

  it('HQ Brand Lock should always take precedence over store-level edits (HQ LWW)', () => {
    const cloudItem: MenuItem = {
      id: 'item-101',
      sku: 'PIZ-PEP-LG',
      name: 'Large Pepperoni Pizza',
      category: 'Pizzas',
      basePrice: 18.99,
      currency: 'USD',
      hierarchyLevel: 'GLOBAL',
      targetId: 'global-hq',
      isBrandLocked: true,
      allergens: ['DAIRY', 'GLUTEN'],
      nutritionalInfo: { calories: 2200, proteinGrams: 90, carbsGrams: 210, fatGrams: 95 },
      version: 2,
      updatedAt: '2026-07-31T12:00:00Z',
    };

    const edgeAttemptedOverride: MenuItem = {
      ...cloudItem,
      basePrice: 14.99, // Store tried to discount locked item
      updatedAt: '2026-07-31T14:00:00Z', // Later timestamp
    };

    const resolved = engine.resolveMenuConflict(cloudItem, edgeAttemptedOverride);
    expect(resolved.basePrice).toBe(18.99); // Must retain HQ locked price
    expect(resolved.isBrandLocked).toBe(true);
  });

  it('Offline POS transactions must be merged seamlessly into Append-Only stream without data loss', () => {
    const cloudStream: POSTransaction[] = [
      {
        id: 'tx-001',
        storeId: 'store-01',
        terminalId: 'pos-1',
        timestamp: '2026-07-31T10:00:00Z',
        items: [{ menuItemId: 'item-101', quantity: 1, unitPrice: 18.99 }],
        subtotal: 18.99,
        tax: 1.52,
        total: 20.51,
        tenders: [{ type: 'CARD', amount: 20.51 }],
        offlineMode: false,
        synced: true,
      },
    ];

    const offlineQueue: POSTransaction[] = [
      {
        id: 'tx-002', // Processed while store internet was down
        storeId: 'store-01',
        terminalId: 'pos-1',
        timestamp: '2026-07-31T10:15:00Z',
        items: [{ menuItemId: 'item-101', quantity: 2, unitPrice: 18.99 }],
        subtotal: 37.98,
        tax: 3.04,
        total: 41.02,
        tenders: [{ type: 'CARD', amount: 41.02, deferredOfflineToken: 'tok_off_987213' }],
        offlineMode: true,
        synced: false,
      },
    ];

    const result = engine.resolvePOSTransactionStream(cloudStream, offlineQueue);
    expect(result.newAdded).toBe(1);
    expect(result.mergedStream.length).toBe(2);
    expect(result.mergedStream[1].id).toBe('tx-002');
    expect(result.mergedStream[1].synced).toBe(true);
  });

  it('Relative Delta inventory depletion must correctly adjust theoretical inventory', () => {
    const currentInv: InventoryRecord = {
      ingredientId: 'ing-cheese',
      storeId: 'store-01',
      ingredientName: 'Mozzarella Shredded',
      unit: 'GRAM',
      onHandQuantity: 5000,
      theoreticalQuantity: 5000,
      lastCalculatedAt: '2026-07-31T08:00:00Z',
    };

    // 2 pizzas sold requiring 400g cheese total
    const updated = engine.resolveInventoryDelta(currentInv, 400);
    expect(updated.theoreticalQuantity).toBe(4600);
  });

  it('Audit log hash chaining must generate tamper-evident SHA256 hashes', () => {
    const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const entryData = {
      id: 'audit-1',
      timestamp: '2026-07-31T15:00:00Z',
      actorId: 'user-hq-admin',
      actorRole: 'HQ_MENU_ENGINEER',
      action: 'UPDATE_PRICE',
      targetEntity: 'MenuItem',
      entityId: 'item-101',
      previousValue: 17.99,
      newValue: 18.99,
    };

    const hash1 = engine.createAuditHash(prevHash, entryData);
    expect(hash1).toBeTypeOf('string');
    expect(hash1.length).toBe(64); // Valid SHA256 length

    // Altering any parameter must produce a different hash
    const tamperedHash = engine.createAuditHash(prevHash, { ...entryData, newValue: 9.99 });
    expect(tamperedHash).not.toBe(hash1);
  });
});
