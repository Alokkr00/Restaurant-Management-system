import { describe, it, expect, beforeEach } from 'vitest';
import { PurchaseOrderEngine } from '../src/inventory/purchase-order-engine.js';

describe('Purchase Order & Inventory Receiving Engine', () => {
  let engine: PurchaseOrderEngine;

  beforeEach(() => {
    engine = new PurchaseOrderEngine();
  });

  it('creates a draft PO and progresses it through SENT status', () => {
    const po = engine.createPurchaseOrder(
      'sup-001',
      'store-104',
      [{ ingredientId: 'ing-cheese', orderedQty: 20, unitCostINR: 650 }],
      '2026-08-20',
      'Weekly cheese restock order'
    );

    expect(po.status).toBe('DRAFT');
    expect(po.supplierId).toBe('sup-001');
    expect(po.lineItems[0].ingredientName).toBe('Mozzarella Cheese (Shredded)');
    expect(po.totalCostINR).toBe(13000); // 20kg × ₹650

    const sent = engine.sendPurchaseOrder(po.poId);
    expect(sent.status).toBe('SENT');
  });

  it('receives a full PO delivery and increments stock balance', () => {
    const po = engine.createPurchaseOrder(
      'sup-001',
      'store-104',
      [{ ingredientId: 'ing-cheese', orderedQty: 10, unitCostINR: 650 }],
      '2026-08-18'
    );
    engine.sendPurchaseOrder(po.poId);

    const stockBefore = engine.getStockLevels().find((s) => s.ingredientId === 'ing-cheese')!;
    const balanceBefore = stockBefore.balance;

    const grn = engine.receivePurchaseOrder(po.poId, 'Warehouse Staff', [
      { ingredientId: 'ing-cheese', receivedQty: 10 },
    ]);

    expect(grn.hasShortDeliveries).toBe(false);
    expect(grn.lineItems[0].receivedQty).toBe(10);
    expect(grn.lineItems[0].varianceQty).toBe(0);

    const stockAfter = engine.getStockLevels().find((s) => s.ingredientId === 'ing-cheese')!;
    expect(stockAfter.balance).toBeCloseTo(balanceBefore + 10, 3);
  });

  it('detects short delivery and marks PO as PARTIAL_RECEIVED', () => {
    const po = engine.createPurchaseOrder(
      'sup-002',
      'store-104',
      [{ ingredientId: 'ing-flour', orderedQty: 50, unitCostINR: 45 }],
      '2026-08-19'
    );
    engine.sendPurchaseOrder(po.poId);

    const grn = engine.receivePurchaseOrder(po.poId, 'Receiver John', [
      { ingredientId: 'ing-flour', receivedQty: 38 }, // 12kg short
    ]);

    expect(grn.hasShortDeliveries).toBe(true);
    expect(grn.lineItems[0].isShortDelivery).toBe(true);
    expect(grn.lineItems[0].varianceQty).toBe(-12); // Under-delivered by 12kg

    // Confirm PO status is PARTIAL not RECEIVED
    const pos = engine.listPurchaseOrders('store-104');
    const updatedPO = pos.find((p) => p.poId === po.poId)!;
    expect(updatedPO.status).toBe('PARTIAL_RECEIVED');
  });

  it('runs stock-take and flags ingredients with ≥2% variance', () => {
    const variances = engine.runStockTake('store-104', [
      { ingredientId: 'ing-cheese', physicalCount: 13.0, unit: 'kg' }, // Theoretical is 15.8 → big variance
      { ingredientId: 'ing-pep',    physicalCount: 8.58, unit: 'kg' }, // Within ±2%
    ]);

    const cheeseVariance = variances.find((v) => v.ingredientId === 'ing-cheese')!;
    expect(cheeseVariance.requiresInvestigation).toBe(true);
    expect(cheeseVariance.variancePct).toBeLessThan(-10); // Large negative variance

    const pepVariance = variances.find((v) => v.ingredientId === 'ing-pep')!;
    expect(pepVariance.requiresInvestigation).toBe(false); // Small variance — within threshold
  });

  it('throws on duplicate PO receive attempt', () => {
    const po = engine.createPurchaseOrder(
      'sup-001', 'store-104',
      [{ ingredientId: 'ing-cheese', orderedQty: 5, unitCostINR: 650 }],
      '2026-08-21'
    );
    engine.sendPurchaseOrder(po.poId);
    engine.receivePurchaseOrder(po.poId, 'Staff A', [{ ingredientId: 'ing-cheese', receivedQty: 5 }]);

    // Second receive should throw — PO is already RECEIVED
    expect(() =>
      engine.receivePurchaseOrder(po.poId, 'Staff B', [{ ingredientId: 'ing-cheese', receivedQty: 5 }])
    ).toThrow('cannot receive again');
  });
});
