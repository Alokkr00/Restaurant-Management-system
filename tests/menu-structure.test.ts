import { describe, it, expect, beforeEach } from 'vitest';
import { MenuStructureEngine, StructuredMenuVersion } from '../src/pos/menu-structure-engine.js';

describe('MenuStructureEngine - Variants, Required/Optional Modifiers, Dayparts, and 86-Lists', () => {
  let engine: MenuStructureEngine;

  const mockMenu: StructuredMenuVersion = {
    versionId: 'menu-v2-prod',
    versionNumber: 2,
    publishedAt: '2026-08-15T00:00:00Z',
    effectiveFrom: '2026-08-15T06:00:00Z',
    checksumSha256: '', // Will be computed
    categories: ['Pizzas', 'Beverages', 'Breakfast Combos'],
    daypartSchedules: [
      { daypart: 'BREAKFAST', startTime: '06:00', endTime: '11:00' },
      { daypart: 'LUNCH', startTime: '11:00', endTime: '16:00' },
      { daypart: 'DINNER', startTime: '16:00', endTime: '23:00' },
      { daypart: 'LATE_NIGHT', startTime: '23:00', endTime: '04:00' },
    ],
    products: [
      {
        productId: 'item-pizza-gourmet',
        name: 'Gourmet Artisanal Pizza',
        category: 'Pizzas',
        sacCode: '996331',
        allergens: ['DAIRY', 'GLUTEN'],
        dayparts: ['LUNCH', 'DINNER', 'LATE_NIGHT'],
        is86Unavailable: false,
        variants: [
          { variantId: 'var-reg-10', sku: 'PIZ-REG-10', name: 'Regular 10"', pricePaise: 1499, isAvailable: true },
          { variantId: 'var-med-12', sku: 'PIZ-MED-12', name: 'Medium 12"', pricePaise: 1899, isAvailable: true },
          { variantId: 'var-lrg-14', sku: 'PIZ-LRG-14', name: 'Large 14"', pricePaise: 2299, isAvailable: true },
        ],
        modifierGroups: [
          {
            groupId: 'grp-crust',
            name: 'Choose Crust (Required)',
            isRequired: true,
            minSelections: 1,
            maxSelections: 1,
            options: [
              { modifierId: 'mod-crust-thin', name: 'Thin Crust', pricePaise: 0, isAvailable: true },
              { modifierId: 'mod-crust-cheese', name: 'Cheese Burst', pricePaise: 300, isAvailable: true },
            ],
          },
          {
            groupId: 'grp-toppings',
            name: 'Extra Toppings (Optional)',
            isRequired: false,
            minSelections: 0,
            maxSelections: 3,
            options: [
              { modifierId: 'mod-top-olives', name: 'Black Olives', pricePaise: 150, isAvailable: true },
              { modifierId: 'mod-top-mushrooms', name: 'Wild Mushrooms', pricePaise: 200, isAvailable: true },
            ],
          },
        ],
        outletPriceOverrides: {
          'store-airport-01': 2699, // Airport premium
        },
      },
      {
        productId: 'item-breakfast-burrito',
        name: 'Breakfast Burrito Combo',
        category: 'Breakfast Combos',
        sacCode: '996331',
        allergens: ['EGG', 'DAIRY'],
        dayparts: ['BREAKFAST'],
        is86Unavailable: false,
        variants: [
          { variantId: 'var-burrito-std', sku: 'BRK-BURR-01', name: 'Standard', pricePaise: 899, isAvailable: true },
        ],
        modifierGroups: [],
      },
    ],
  };

  beforeEach(() => {
    mockMenu.checksumSha256 = MenuStructureEngine.computeMenuChecksum(mockMenu);
    engine = new MenuStructureEngine(mockMenu);
  });

  it('prices item by variant and adds required and optional modifiers', () => {
    const priced = engine.priceLineItem({
      storeId: 'store-104',
      productId: 'item-pizza-gourmet',
      variantId: 'var-med-12', // 1899 paise
      channel: 'DINE_IN',
      selectedModifierIds: ['mod-crust-cheese', 'mod-top-olives'], // 300 + 150 paise
      currentTimeHHMM: '13:00', // Lunch
    });

    expect(priced.productName).toBe('Gourmet Artisanal Pizza');
    expect(priced.variantName).toBe('Medium 12"');
    expect(priced.totalLinePricePaise).toBe(2349); // 1899 + 300 + 150 = 2349 paise ($23.49)
    expect(priced.modifierBreakdown.length).toBe(2);
  });

  it('throws error when a required modifier group is omitted', () => {
    expect(() => {
      engine.priceLineItem({
        storeId: 'store-104',
        productId: 'item-pizza-gourmet',
        variantId: 'var-reg-10',
        channel: 'DINE_IN',
        selectedModifierIds: [], // Missing required crust!
        currentTimeHHMM: '13:00',
      });
    }).toThrow(/Required modifier selection missing/);
  });

  it('enforces daypart availability and rejects breakfast items during dinner', () => {
    expect(() => {
      engine.priceLineItem({
        storeId: 'store-104',
        productId: 'item-breakfast-burrito',
        channel: 'DINE_IN',
        currentTimeHHMM: '19:30', // Dinner time
      });
    }).toThrow(/is only available during \[BREAKFAST\]/);
  });

  it('applies outlet-specific price override for airport store', () => {
    const airportPriced = engine.priceLineItem({
      storeId: 'store-airport-01',
      productId: 'item-pizza-gourmet',
      variantId: 'var-reg-10',
      channel: 'DINE_IN',
      selectedModifierIds: ['mod-crust-thin'],
      currentTimeHHMM: '14:00',
    });

    expect(airportPriced.totalLinePricePaise).toBe(2699); // Airport override price
  });

  it('blocks items or modifiers that are toggled on the 86-list', () => {
    engine.set86Status('item-pizza-gourmet', true);

    expect(() => {
      engine.priceLineItem({
        storeId: 'store-104',
        productId: 'item-pizza-gourmet',
        channel: 'DINE_IN',
        selectedModifierIds: ['mod-crust-thin'],
      });
    }).toThrow(/currently 86'd/);
  });
});
