import { describe, it, expect } from 'vitest';
import { ConflictResolutionEngine } from '../src/shared/sync-engine.js';
import { MenuItem, POSTransaction } from '../src/shared/types.js';

describe('ConflictResolutionEngine', () => {
  const engine = new ConflictResolutionEngine();

  it('preserves HQ master item when item is brand locked', () => {
    const hqItem: MenuItem = {
      id: 'item-1',
      sku: 'PIZ-PEP',
      name: 'Pepperoni Pizza',
      category: 'Pizzas',
      basePrice: 18.99,
      currency: 'USD',
      hierarchyLevel: 'GLOBAL',
      targetId: 'global',
      isBrandLocked: true,
      allergens: [],
      nutritionalInfo: { calories: 2000, proteinGrams: 80, carbsGrams: 200, fatGrams: 90 },
      version: 2,
      updatedAt: '2026-08-01T10:00:00Z',
    };

    const storeItem: MenuItem = {
      ...hqItem,
      basePrice: 14.99,
      version: 3,
      updatedAt: '2026-08-01T11:00:00Z',
    };

    const resolved = engine.resolveMenuConflict(hqItem, storeItem);
    expect(resolved.isBrandLocked).toBe(true);
    expect(resolved.basePrice).toBe(18.99); // HQ price preserved
  });

  it('merges offline append-only POS transaction streams without duplication', () => {
    const cloudStream: POSTransaction[] = [
      {
        id: 'tx-1',
        storeId: 'store-104',
        terminalId: 'pos-1',
        timestamp: '2026-08-01T12:00:00Z',
        items: [],
        subtotal: 20,
        tax: 2,
        total: 22,
        tenders: [],
        offlineMode: false,
        synced: true,
      },
    ];

    const edgeIncoming: POSTransaction[] = [
      {
        id: 'tx-1', // duplicate already acknowledged
        storeId: 'store-104',
        terminalId: 'pos-1',
        timestamp: '2026-08-01T12:00:00Z',
        items: [],
        subtotal: 20,
        tax: 2,
        total: 22,
        tenders: [],
        offlineMode: false,
        synced: false,
      },
      {
        id: 'tx-2', // new offline transaction
        storeId: 'store-104',
        terminalId: 'pos-1',
        timestamp: '2026-08-01T12:05:00Z',
        items: [],
        subtotal: 30,
        tax: 3,
        total: 33,
        tenders: [],
        offlineMode: true,
        synced: false,
      },
    ];

    const result = engine.resolvePOSTransactionStream(cloudStream, edgeIncoming);
    expect(result.mergedStream.length).toBe(2);
    expect(result.newAdded).toBe(1);
    expect(result.mergedStream[1].id).toBe('tx-2');
  });
});
