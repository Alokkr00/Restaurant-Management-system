import { describe, it, expect } from 'vitest';
import { OrderLifecycleEngine, AdvancedPOSLineItem } from '../src/pos/order-lifecycle.js';

describe('OrderLifecycleEngine', () => {
  const engine = new OrderLifecycleEngine();

  it('calculates totals with modifiers and applies audited comp discounts', () => {
    const lineItem: AdvancedPOSLineItem = {
      lineItemId: 'li-1',
      menuItemId: 'item-pizza-1',
      name: 'Large Artisanal Pizza',
      quantity: 1,
      unitPrice: 18.0,
      modifiers: [
        { modifierId: 'm1', groupId: 'TOPPINGS', name: 'Extra Cheese', action: 'EXTRA', placement: 'WHOLE', extraPrice: 2.5 },
      ],
      isVoided: false,
      finalLineTotalUSD: 20.5,
    };

    expect(engine.calculateLineItemTotal(lineItem)).toBe(20.5);

    engine.applyCompToLineItem(lineItem, 'DOLLAR_DISCOUNT', 5.0, 'GUEST_DISSATISFACTION', 'mgr-1', 'pin-123');
    expect(lineItem.finalLineTotalUSD).toBe(15.5);
  });

  it('tracks inventory waste flag for kitchen-made voids', () => {
    const lineItem: AdvancedPOSLineItem = {
      lineItemId: 'li-2',
      menuItemId: 'item-wings-1',
      name: 'Buffalo Wings',
      quantity: 1,
      unitPrice: 15.0,
      modifiers: [],
      isVoided: false,
      finalLineTotalUSD: 15.0,
    };

    const voidResult = engine.voidLineItem(lineItem, 'GUEST_LEFT_BEFORE_PREP', 'mgr-1', true);
    expect(voidResult.lineItem.isVoided).toBe(true);
    expect(voidResult.requiresInventoryDepletion).toBe(true);
    expect(voidResult.logSpoilageWaste).toBe(true);
  });
});
