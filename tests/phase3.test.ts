import { describe, it, expect } from 'vitest';
import { PredictiveMLPrepEngine } from '../src/inventory/predictive-ml-prep.js';
import { MultiBrandGhostKitchenRouter } from '../src/hq-cloud/multi-brand-router.js';
import { POSTransaction } from '../src/shared/types.js';

describe('Phase 3: Advanced ML Prep & Multi-Brand Ghost Kitchen Engine', () => {
  const mlEngine = new PredictiveMLPrepEngine();
  const brandRouter = new MultiBrandGhostKitchenRouter();

  it('Predictive ML Prep Engine should calculate accurate prep quantity with safety buffer', () => {
    const recommendation = mlEngine.calculatePredictivePrep(
      'ing-cheese',
      'Mozzarella Shredded',
      {
        historicalVelocityGramsPerHour: 1000,
        dayOfWeekMultiplier: 1.2, // Friday surge
        weatherFactor: 1.1,       // Rain
        localEventMultiplier: 1.25, // Game day
      },
      8 // 8 operating hours
    );

    // 1000 * 1.2 * 1.1 * 1.25 * 8 = 13200g. With +5% buffer = 13860g
    expect(recommendation.recommendedPrepQuantityGrams).toBe(13860);
    expect(recommendation.predictedWasteReductionPercent).toBe(15.2);
    expect(recommendation.confidenceScore).toBe(0.94);
  });

  it('Multi-Brand Router should correctly route virtual concept orders to kitchen stations', () => {
    const tx: POSTransaction = {
      id: 'tx-wings-99',
      storeId: 'store-01',
      terminalId: 'pos-ghost-1',
      timestamp: '2026-07-31T18:00:00Z',
      items: [{ menuItemId: 'item-wings', quantity: 2, unitPrice: 14.99 }],
      subtotal: 29.98,
      tax: 2.40,
      total: 32.38,
      tenders: [{ type: 'CARD', amount: 32.38 }],
      offlineMode: false,
      synced: true,
    };

    const routed = brandRouter.routeOrder('brand-wings', tx);
    expect(routed.brand.brandName).toBe('Wild Wings Express');
    expect(routed.targetKDSStation).toBe('WING_FRYER');
    expect(routed.brand.colorBadge).toBe('#f59e0b');
  });
});
