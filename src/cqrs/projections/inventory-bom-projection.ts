import { DatabaseAdapter } from '../../store-edge/db/database-adapter.js';
import { InventoryRecipeEngine } from '../../inventory/recipe-engine.js';
import { OrderCreatedEvent } from '../events/order-events.js';
import { Recipe } from '../../shared/types.js';

export interface StockLevelRecord {
  ingredient_id: string;
  store_id: string;
  name: string;
  category: string;
  unit: string;
  stock_on_hand: number;
  theoretical_quantity: number;
  par_level: number;
  reorder_point: number;
  unit_cost_cents: number;
  is_reorder_needed: boolean;
  last_depleted_at: string | null;
  updated_at: string;
}

export interface DepletionRecord {
  depletion_id: string;
  order_id: string;
  event_id: string;
  ingredient_id: string;
  ingredient_name: string;
  quantity_depleted: number;
  unit: string;
  yield_factor: number;
  gross_usage: number;
  cost_cents: number;
  depleted_at: string;
}

export class InventoryBOMProjectionWorker {
  private db: DatabaseAdapter;
  private recipeEngine: InventoryRecipeEngine;
  private defaultRecipes: Map<string, Recipe> = new Map();

  constructor(db: DatabaseAdapter, recipeEngine: InventoryRecipeEngine) {
    this.db = db;
    this.recipeEngine = recipeEngine;
    this.initDefaultRecipes();
  }

  private initDefaultRecipes() {
    // Standard default BOM recipes for core menu items
    this.registerRecipe({
      id: 'rcp-101',
      menuItemId: 'item-101', // Large Pepperoni Pizza
      version: 1,
      isBrandLocked: true,
      ingredients: [
        { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', unit: 'GRAM', quantityRequired: 0.35, yieldFactor: 0.95 },
        { ingredientId: 'ing-cheese', name: 'Mozzarella Cheese (Shredded)', unit: 'GRAM', quantityRequired: 0.25, yieldFactor: 0.98 },
        { ingredientId: 'ing-pepperoni', name: 'Pepperoni Slices', unit: 'GRAM', quantityRequired: 0.12, yieldFactor: 0.90 },
      ],
    });

    this.registerRecipe({
      id: 'rcp-104',
      menuItemId: 'item-104', // Spicy Buffalo Wings
      version: 1,
      isBrandLocked: true,
      ingredients: [
        { ingredientId: 'ing-wings', name: 'Raw Chicken Wings', unit: 'GRAM', quantityRequired: 0.50, yieldFactor: 0.92 },
        { ingredientId: 'ing-hot-sauce', name: 'Buffalo Hot Sauce', unit: 'MILLILITER', quantityRequired: 0.08, yieldFactor: 1.0 },
      ],
    });

    this.registerRecipe({
      id: 'rcp-105',
      menuItemId: 'item-105', // Artisanal Garlic Knots
      version: 1,
      isBrandLocked: true,
      ingredients: [
        { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', unit: 'GRAM', quantityRequired: 0.20, yieldFactor: 0.95 },
        { ingredientId: 'ing-garlic-butter', name: 'Artisanal Garlic Butter', unit: 'GRAM', quantityRequired: 0.05, yieldFactor: 0.95 },
      ],
    });
  }

  public registerRecipe(recipe: Recipe) {
    this.defaultRecipes.set(recipe.menuItemId, recipe);
    this.recipeEngine.registerRecipe(recipe);
  }

  /**
   * Asynchronously consumes OrderCreatedEvent and executes recipe Bill of Materials (BOM) yield depletion out-of-band.
   */
  public async handleOrderCreated(event: OrderCreatedEvent): Promise<DepletionRecord[]> {
    const order = event.payload;
    const depletions: DepletionRecord[] = [];
    const now = new Date().toISOString();

    const insertDepletionStmt = this.db.prepare(`
      INSERT INTO inventory_depletions (
        depletion_id, order_id, event_id, ingredient_id,
        ingredient_name, quantity_depleted, unit, yield_factor,
        gross_usage, cost_cents, depleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStockStmt = this.db.prepare(`
      UPDATE inventory_stock
      SET stock_on_hand = ?,
          theoretical_quantity = ?,
          last_depleted_at = ?,
          updated_at = ?
      WHERE ingredient_id = ?
    `);

    const getStockStmt = this.db.prepare('SELECT stock_on_hand, theoretical_quantity, unit_cost_cents FROM inventory_stock WHERE ingredient_id = ?');

    for (const item of order.items) {
      const recipe = this.defaultRecipes.get(item.menuItemId);
      if (!recipe) continue;

      for (const ing of recipe.ingredients) {
        const yieldFactor = ing.yieldFactor > 0 ? ing.yieldFactor : 1.0;
        const netRequired = ing.quantityRequired * item.quantity;
        const grossUsage = Number((netRequired / yieldFactor).toFixed(4));

        const stockRecord = getStockStmt.get(ing.ingredientId) as
          | { stock_on_hand: number; theoretical_quantity: number; unit_cost_cents: number }
          | undefined;

        const currentStock = stockRecord?.stock_on_hand !== undefined ? Number(stockRecord.stock_on_hand) : 0;
        const currentTheo = stockRecord?.theoretical_quantity !== undefined ? Number(stockRecord.theoretical_quantity) : 0;
        const newStock = Math.max(0.0, Number((currentStock - grossUsage).toFixed(4)));
        const newTheo = Math.max(0.0, Number((currentTheo - grossUsage).toFixed(4)));

        const unitCost = stockRecord?.unit_cost_cents || 0;
        const totalCostCents = Math.round(unitCost * grossUsage);

        const depletionId = `dpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        // Atomic write to relational SQLite
        updateStockStmt.run(newStock, newTheo, now, now, ing.ingredientId);
        insertDepletionStmt.run(
          depletionId,
          order.orderId,
          event.eventId,
          ing.ingredientId,
          ing.name,
          netRequired,
          ing.unit,
          yieldFactor,
          grossUsage,
          totalCostCents,
          now
        );

        depletions.push({
          depletion_id: depletionId,
          order_id: order.orderId,
          event_id: event.eventId,
          ingredient_id: ing.ingredientId,
          ingredient_name: ing.name,
          quantity_depleted: netRequired,
          unit: ing.unit,
          yield_factor: yieldFactor,
          gross_usage: grossUsage,
          cost_cents: totalCostCents,
          depleted_at: now,
        });
      }
    }

    return depletions;
  }

  public getStockLevels(storeId: string = 'store-104'): StockLevelRecord[] {
    const rows = this.db.prepare('SELECT * FROM inventory_stock WHERE store_id = ? ORDER BY name ASC').all(storeId) as any[];
    return rows.map((r) => ({
      ingredient_id: r.ingredient_id,
      store_id: r.store_id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      stock_on_hand: Number(r.stock_on_hand),
      theoretical_quantity: Number(r.theoretical_quantity),
      par_level: Number(r.par_level),
      reorder_point: Number(r.reorder_point),
      unit_cost_cents: Number(r.unit_cost_cents),
      is_reorder_needed: Number(r.stock_on_hand) <= Number(r.reorder_point),
      last_depleted_at: r.last_depleted_at,
      updated_at: r.updated_at,
    }));
  }

  public getDepletionHistory(orderId?: string): DepletionRecord[] {
    let sql = 'SELECT * FROM inventory_depletions';
    const params: any[] = [];
    if (orderId) {
      sql += ' WHERE order_id = ?';
      params.push(orderId);
    }
    sql += ' ORDER BY depleted_at DESC LIMIT 100';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      depletion_id: r.depletion_id,
      order_id: r.order_id,
      event_id: r.event_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: r.ingredient_name,
      quantity_depleted: Number(r.quantity_depleted),
      unit: r.unit,
      yield_factor: Number(r.yield_factor),
      gross_usage: Number(r.gross_usage),
      cost_cents: Number(r.cost_cents),
      depleted_at: r.depleted_at,
    }));
  }
}
