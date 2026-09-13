import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseAdapter } from '../src/store-edge/db/database-adapter.js';
import { runMigrations } from '../src/store-edge/db/migrations.js';
import { InventoryRecipeEngine } from '../src/inventory/recipe-engine.js';
import { MenuMDMService } from '../src/mdm/menu-mdm.js';
import { CQRSOrderEngine } from '../src/cqrs/projection-engine.js';
import { CreateOrderCommand } from '../src/cqrs/commands/order-commands.js';

describe('CQRS Architecture (Offline POS, Vector Queue & Out-of-Band Projections)', () => {
  let db: DatabaseAdapter;
  let recipeEngine: InventoryRecipeEngine;
  let menuMDM: MenuMDMService;
  let cqrsEngine: CQRSOrderEngine;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    runMigrations(db);
    recipeEngine = new InventoryRecipeEngine();
    menuMDM = new MenuMDMService(db);
    cqrsEngine = new CQRSOrderEngine(db, recipeEngine, menuMDM, 'store-104');
  });

  describe('Command Path (Writes & Line Item Validation)', () => {
    it('validates line items, writes to append-only SQLite WAL, and returns fast acknowledgement', async () => {
      const command: CreateOrderCommand = {
        orderId: 'ord-test-101',
        storeId: 'store-104',
        terminalId: 'pos-1',
        tableId: 'tbl-04',
        orderType: 'DINE_IN',
        items: [
          {
            menuItemId: 'item-101',
            name: 'Large Pepperoni Pizza',
            quantity: 2,
            unitPriceCents: 1899,
            modifiers: [{ modifierId: 'mod-extra-cheese', name: 'Extra Mozzarella', priceCents: 200 }],
          },
        ],
        subtotalCents: (1899 + 200) * 2, // 4198
        taxCents: 336,
        totalCents: 4534,
        tenders: [{ type: 'CARD', amountCents: 4534 }],
        offlineMode: false,
      };

      const ack = await cqrsEngine.executeCreateOrder(command);

      expect(ack.success).toBe(true);
      expect(ack.orderId).toBe('ord-test-101');
      expect(ack.status).toBe('ACCEPTED_IN_WAL');
      expect(ack.vectorClock['store-104']).toBe(1);

      // Verify physical persistence in SQLite WAL append-only table
      const walRow = db
        .prepare('SELECT * FROM order_events_wal WHERE order_id = ?')
        .get('ord-test-101') as any;
      expect(walRow).toBeDefined();
      expect(walRow.event_type).toBe('OrderCreated');
      expect(JSON.parse(walRow.payload_json).totalCents).toBe(4534);

      // Verify orders write-model
      const orderRow = db.prepare('SELECT * FROM orders WHERE order_id = ?').get('ord-test-101') as any;
      expect(orderRow.total_cents).toBe(4534);
    });

    it('rejects commands with zero or negative item quantities', async () => {
      const invalidCommand: CreateOrderCommand = {
        orderId: 'ord-fail-01',
        storeId: 'store-104',
        terminalId: 'pos-1',
        orderType: 'TAKEAWAY',
        items: [
          {
            menuItemId: 'item-101',
            name: 'Large Pepperoni Pizza',
            quantity: 0, // Invalid!
            unitPriceCents: 1899,
          },
        ],
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        tenders: [],
        offlineMode: true,
      };

      await expect(cqrsEngine.executeCreateOrder(invalidCommand)).rejects.toThrow(
        /quantity must be an integer greater than zero/
      );
    });

    it('rejects commands where subtotal or total does not match line item math', async () => {
      const mathMismatchCommand: CreateOrderCommand = {
        orderId: 'ord-fail-02',
        storeId: 'store-104',
        terminalId: 'pos-1',
        orderType: 'DINE_IN',
        items: [
          {
            menuItemId: 'item-101',
            name: 'Large Pepperoni Pizza',
            quantity: 1,
            unitPriceCents: 1899,
          },
        ],
        subtotalCents: 1899,
        taxCents: 100,
        totalCents: 9999, // Math mismatch!
        tenders: [],
        offlineMode: false,
      };

      await expect(cqrsEngine.executeCreateOrder(mathMismatchCommand)).rejects.toThrow(/totalCents mismatch/);
    });
  });

  describe('Query Path & Asynchronous Projections', () => {
    it('updates KDS read projections with station routing without scanning transaction histories', async () => {
      const pizzaOrder: CreateOrderCommand = {
        orderId: 'ord-kds-01',
        storeId: 'store-104',
        terminalId: 'pos-1',
        tableId: 'tbl-02',
        orderType: 'DINE_IN',
        items: [
          {
            menuItemId: 'item-101',
            name: 'Large Pepperoni Pizza',
            quantity: 1,
            unitPriceCents: 1899,
          },
        ],
        subtotalCents: 1899,
        taxCents: 152,
        totalCents: 2051,
        tenders: [{ type: 'CASH', amountCents: 2051 }],
        offlineMode: false,
      };

      await cqrsEngine.executeCreateOrder(pizzaOrder);
      // Flush projections
      await cqrsEngine.flushProjections();

      // Read KDS projection directly
      const kdsTickets = cqrsEngine.getKDSTickets('store-104');
      expect(kdsTickets.length).toBe(1);
      expect(kdsTickets[0].orderId).toBe('ord-kds-01');
      expect(kdsTickets[0].station).toBe('PIZZA_LINE');
      expect(kdsTickets[0].status).toBe('IN_PREP');
      expect(kdsTickets[0].items[0].name).toBe('Large Pepperoni Pizza');

      // Bump ticket
      const bumped = cqrsEngine.bumpKDSTicket(kdsTickets[0].id);
      expect(bumped?.status).toBe('READY');

      // Bump again to complete
      const served = cqrsEngine.bumpKDSTicket(kdsTickets[0].id);
      expect(served?.status).toBe('BUMPED');

      // Now active tickets list should be empty
      const activeAfterBump = cqrsEngine.getKDSTickets('store-104');
      expect(activeAfterBump.length).toBe(0);
    });

    it('asynchronously computes recipe BOM yield depletion and updates inventory stock out-of-band', async () => {
      // Starting stock of cheese: 45.0 kg
      const initialStock = cqrsEngine.getInventoryStock('store-104');
      const initialCheese = initialStock.find((s) => s.ingredient_id === 'ing-cheese')!;
      expect(initialCheese.stock_on_hand).toBe(45.0);

      const order: CreateOrderCommand = {
        orderId: 'ord-bom-01',
        storeId: 'store-104',
        terminalId: 'pos-1',
        orderType: 'TAKEAWAY',
        items: [
          {
            menuItemId: 'item-101', // Large Pepperoni Pizza uses 0.25kg cheese (yieldFactor 0.98), 0.35kg flour (yield 0.95), 0.12kg pepperoni (yield 0.90)
            name: 'Large Pepperoni Pizza',
            quantity: 2,
            unitPriceCents: 1899,
          },
        ],
        subtotalCents: 3798,
        taxCents: 304,
        totalCents: 4102,
        tenders: [{ type: 'CARD', amountCents: 4102 }],
        offlineMode: false,
      };

      await cqrsEngine.executeCreateOrder(order);
      // Asynchronous worker processes the order event out-of-band
      await cqrsEngine.flushProjections();

      // Check depleted inventory stock
      const updatedStock = cqrsEngine.getInventoryStock('store-104');
      const updatedCheese = updatedStock.find((s) => s.ingredient_id === 'ing-cheese')!;

      // 2 pizzas * 0.25kg / 0.98 = ~0.5102 kg cheese gross depletion
      const expectedCheeseLeft = 45.0 - (0.50 / 0.98);
      expect(updatedCheese.stock_on_hand).toBeCloseTo(expectedCheeseLeft, 2);

      // Verify audit trail in inventory_depletions table
      const depletions = cqrsEngine.getDepletionHistory('ord-bom-01');
      expect(depletions.length).toBe(3); // flour, cheese, pepperoni
      const cheeseDepletion = depletions.find((d) => d.ingredient_id === 'ing-cheese')!;
      expect(cheeseDepletion.gross_usage).toBeCloseTo(0.5102, 3);
      expect(cheeseDepletion.yield_factor).toBe(0.98);
    });

    it('queries pre-indexed cashier active orders without full historical table scans', async () => {
      const order: CreateOrderCommand = {
        orderId: 'ord-csh-01',
        storeId: 'store-104',
        terminalId: 'pos-2',
        tableId: 'tbl-09',
        orderType: 'DINE_IN',
        items: [
          {
            menuItemId: 'item-104',
            name: 'Spicy Buffalo Wings',
            quantity: 3,
            unitPriceCents: 1299,
          },
        ],
        subtotalCents: 3897,
        taxCents: 312,
        totalCents: 4209,
        tenders: [{ type: 'CASH', amountCents: 4209 }],
        offlineMode: false,
      };

      await cqrsEngine.executeCreateOrder(order);
      await cqrsEngine.flushProjections();

      const cashierOrders = cqrsEngine.getCashierActiveOrders('store-104');
      expect(cashierOrders.length).toBe(1);
      expect(cashierOrders[0].orderId).toBe('ord-csh-01');
      expect(cashierOrders[0].terminalId).toBe('pos-2');
      expect(cashierOrders[0].itemsSummary).toContain('3x Spicy Buffalo Wings');
      expect(cashierOrders[0].totalCents).toBe(4209);
    });
  });
});
