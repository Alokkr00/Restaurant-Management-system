import { describe, it, expect } from 'vitest';
import { InventoryRecipeEngine } from '../src/inventory/recipe-engine.js';
import { PrepBatchEngine } from '../src/inventory/prep-batch-engine.js';
import { Recipe } from '../src/shared/types.js';

describe('InventoryRecipeEngine & PrepBatchEngine', () => {
  const recipeEngine = new InventoryRecipeEngine();
  const prepEngine = new PrepBatchEngine();

  it('depletes recipe ingredients accounting for trim yield factors', () => {
    const recipe: Recipe = {
      id: 'rec-1',
      menuItemId: 'item-101',
      version: 1,
      isBrandLocked: true,
      ingredients: [
        { ingredientId: 'ing-cheese', name: 'Mozzarella', unit: 'GRAM', quantityRequired: 200, yieldFactor: 0.95 },
      ],
    };

    recipeEngine.registerRecipe(recipe);
    recipeEngine.registerInventoryRecord({
      ingredientId: 'ing-cheese',
      storeId: 'store-104',
      ingredientName: 'Mozzarella',
      unit: 'GRAM',
      onHandQuantity: 5000,
      theoreticalQuantity: 5000,
      lastCalculatedAt: new Date().toISOString(),
    });

    const updated = recipeEngine.depleteForOrderItem('item-101', 2);
    expect(updated.length).toBe(1);
    expect(updated[0].theoreticalQuantity).toBeCloseTo(4578.95, 1);
  });

  it('explodes batch recipes and logs spoilage with cost impact', () => {
    prepEngine.registerPrepBatch({
      id: 'batch-dough-50kg',
      batchName: '50kg Pizza Dough Batch',
      yieldUnitsProduced: 100,
      unitName: 'PIECE',
      recipeTree: [{ rawIngredientId: 'ing-flour', rawIngredientName: 'Flour', quantity: 30, unit: 'KILOGRAM' }],
      spoilageReasonCodes: ['EXPIRED', 'DROPPED_FLOOR'],
    });

    const rawNeeds = prepEngine.explodeBatchProduction('batch-dough-50kg', 2);
    expect(rawNeeds[0].totalRawQuantity).toBe(60);

    const spoilLog = prepEngine.logSpoilage(
      'store-104',
      'Dough Ball 500g',
      5,
      'PIECE',
      'DROPPED_FLOOR',
      1.5,
      'lead-1'
    );
    expect(spoilLog.costImpactUSD).toBe(7.5);
  });
});
