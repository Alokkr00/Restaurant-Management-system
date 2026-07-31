import { Recipe, RecipeIngredient, InventoryRecord } from '../shared/types.js';

export interface VarianceReport {
  ingredientId: string;
  ingredientName: string;
  startingInventory: number;
  purchases: number;
  theoreticalUsage: number;
  endingInventory: number;
  actualUsage: number;
  varianceAmount: number;
  variancePercentage: number;
  isAlertTriggered: boolean; // Flagged if variance >= ±2%
}

export class InventoryRecipeEngine {
  private recipes: Map<string, Recipe> = new Map();
  private inventoryStore: Map<string, InventoryRecord> = new Map();

  public registerRecipe(recipe: Recipe): void {
    this.recipes.set(recipe.menuItemId, recipe);
  }

  public registerInventoryRecord(record: InventoryRecord): void {
    this.inventoryStore.set(record.ingredientId, record);
  }

  /**
   * Depletes theoretical raw ingredients based on a POS order item and nested recipe.
   * Takes into account yield shrinkage factor (e.g. 0.90 for 10% cooking loss).
   */
  public depleteForOrderItem(menuItemId: string, orderQuantity: number): InventoryRecord[] {
    const recipe = this.recipes.get(menuItemId);
    if (!recipe) return [];

    const updatedRecords: InventoryRecord[] = [];

    for (const ing of recipe.ingredients) {
      const record = this.inventoryStore.get(ing.ingredientId);
      if (record) {
        // Calculate exact usage accounting for yield loss factor (guarded against 0)
        const yieldFactor = ing.yieldFactor > 0 ? ing.yieldFactor : 1.0;
        const rawRequired = ing.quantityRequired * orderQuantity;
        const grossUsage = rawRequired / yieldFactor;

        record.theoreticalQuantity = Math.max(0, record.theoreticalQuantity - grossUsage);
        record.lastCalculatedAt = new Date().toISOString();
        updatedRecords.push({ ...record });
      }
    }

    return updatedRecords;
  }

  /**
   * Calculates Theoretical vs. Actual Variance:
   * Formula: Variance = Starting Inventory + Purchases – Theoretical Usage – Ending Inventory
   * Flags any ingredient where variance percentage exceeds ±2% (configurable threshold).
   */
  public calculateVariance(
    ingredientId: string,
    startingInventory: number,
    purchases: number,
    endingInventory: number,
    alertThresholdPercent: number = 2.0
  ): VarianceReport {
    const record = this.inventoryStore.get(ingredientId);
    if (!record) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }

    // Theoretical Usage = Starting + Purchases - Theoretical Remaining
    const theoreticalUsage = startingInventory + purchases - record.theoreticalQuantity;
    // Actual Usage = Starting + Purchases - Actual Ending
    const actualUsage = startingInventory + purchases - endingInventory;

    const varianceAmount = actualUsage - theoreticalUsage;
    const variancePercentage = theoreticalUsage > 0 ? (varianceAmount / theoreticalUsage) * 100 : 0;
    const isAlertTriggered = Math.abs(variancePercentage) >= alertThresholdPercent;

    return {
      ingredientId,
      ingredientName: record.ingredientName,
      startingInventory,
      purchases,
      theoreticalUsage,
      endingInventory,
      actualUsage,
      varianceAmount,
      variancePercentage,
      isAlertTriggered,
    };
  }
}
