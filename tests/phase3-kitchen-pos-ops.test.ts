import { describe, it, expect } from 'vitest';
import { CashManagementEngine } from '../src/pos/cash-management.js';
import { OrderLifecycleEngine, AdvancedPOSLineItem } from '../src/pos/order-lifecycle.js';
import { UOMConversionEngine } from '../src/inventory/uom-conversion.js';

describe('Sprint 3: Deep Kitchen & POS Operations Engine', () => {
  const cashEngine = new CashManagementEngine();
  const orderEngine = new OrderLifecycleEngine();
  const uomEngine = new UOMConversionEngine();

  describe('1. Cash Drawer Management & Blind EOD Z-Reports', () => {
    it('must manage full drawer lifecycle: open float, cash sales, drops, payouts, and blind Z-Report', () => {
      // 1. Open Drawer with $200 float
      const session = cashEngine.openDrawerSession('store-104', 'term-pos-1', 'emp-101', 'Alice Cashier', 200.0);
      expect(session.startingBankUSD).toBe(200.0);
      expect(session.expectedCashInDrawerUSD).toBe(200.0);

      // 2. Cash sales of $350.00
      cashEngine.recordCashTender(session.sessionId, 350.0);
      expect(session.expectedCashInDrawerUSD).toBe(550.0);

      // 3. Mid-shift Safe Drop of $300.00 to reduce robbery risk
      const drop = cashEngine.recordCashDrop(session.sessionId, 300.0, 'mgr-01', 'ENV-9912');
      expect(drop.amountUSD).toBe(300.0);
      expect(session.expectedCashInDrawerUSD).toBe(250.0);

      // 4. Petty Cash Pay-Out of $20.00 for window washing
      const payout = cashEngine.recordPayOut(session.sessionId, 20.0, 'WINDOW_WASHING', 'Clean Windows Inc.', 'mgr-01');
      expect(payout.amountUSD).toBe(20.0);
      expect(session.expectedCashInDrawerUSD).toBe(230.0);

      // 5. Blind EOD Z-Report: Cashier counts $228.00 physical cash in drawer ($2 short)
      const zReport = cashEngine.reconcileAndCloseZReport(session.sessionId, 228.0, 'sig-token-mgr-01', 5.0);

      expect(zReport.netExpectedCashUSD).toBe(230.0);
      expect(zReport.actualCountedCashUSD).toBe(228.0);
      expect(zReport.overShortVarianceUSD).toBe(-2.0);
      // Below $5 variance threshold -> not flagged as critical alert
      expect(zReport.isVarianceAlertTriggered).toBe(false);
    });
  });

  describe('2. Order Lifecycle: Audited Comps, Voids, & Complex Modifiers', () => {
    it('must calculate line total with modifiers and apply manager-approved dollar discount comp', () => {
      const lineItem: AdvancedPOSLineItem = {
        lineItemId: 'li-101',
        menuItemId: 'item-pizza-1',
        name: 'Large Artisanal Pizza',
        quantity: 1,
        unitPrice: 18.0,
        modifiers: [
          { modifierId: 'mod-1', groupId: 'TOPPINGS', name: 'Extra Cheese', action: 'EXTRA', placement: 'WHOLE', extraPrice: 2.5 },
          { modifierId: 'mod-2', groupId: 'TOPPINGS', name: 'Mushrooms', action: 'ADD', placement: 'LEFT_HALF', extraPrice: 1.5 },
        ],
        isVoided: false,
        finalLineTotalUSD: 22.0,
      };

      // Gross = 18.0 + 2.5 + 1.5 = $22.00
      expect(orderEngine.calculateLineItemTotal(lineItem)).toBe(22.0);

      // Apply $5.00 Guest Dissatisfaction comp
      orderEngine.applyCompToLineItem(
        lineItem,
        'DOLLAR_DISCOUNT',
        5.0,
        'GUEST_DISSATISFACTION',
        'mgr-01',
        'pin-hash-99'
      );

      // Final Price = $22.00 - $5.00 = $17.00
      expect(lineItem.finalLineTotalUSD).toBe(17.0);
    });

    it('must distinguish kitchen-made void from pre-cook void for inventory waste tracking', () => {
      const lineItem: AdvancedPOSLineItem = {
        lineItemId: 'li-102',
        menuItemId: 'item-wings-1',
        name: 'Spicy Buffalo Wings (10pc)',
        quantity: 1,
        unitPrice: 15.0,
        modifiers: [],
        isVoided: false,
        finalLineTotalUSD: 15.0,
      };

      // Void item AFTER kitchen already prepared it (e.g. guest left before pickup)
      const voidResult = orderEngine.voidLineItem(
        lineItem,
        'GUEST_LEFT_BEFORE_PREP',
        'mgr-01',
        true, // wasPreparedInKitchen = true
        'Customer walked out after wings were boxed'
      );

      expect(voidResult.lineItem.isVoided).toBe(true);
      expect(voidResult.lineItem.finalLineTotalUSD).toBe(0.0);
      expect(voidResult.requiresInventoryDepletion).toBe(true); // Inventory was wasted!
      expect(voidResult.logSpoilageWaste).toBe(true);
    });
  });

  describe('3. Multi-Tier UOM Conversions & Morning Par Level Calculation', () => {
    it('must convert Purchasing 50lb flour bag to grams for recipe depletion', () => {
      // 1 BAG_50LB -> 22,679.6 GRAMS
      const grams = uomEngine.convertQuantity(1, 'BAG_50LB', 'GRAM');
      expect(grams).toBe(22679.6);

      // 1 POUND -> 453.592 GRAMS
      const poundToGram = uomEngine.convertQuantity(2, 'POUND', 'GRAM');
      expect(poundToGram).toBeCloseTo(907.184, 2);
    });

    it('must calculate dynamic morning prep par levels based on sales forecast', () => {
      // Forecasted sales = $5,000
      // Velocity: 20 dough balls prepped per $1,000 sales -> raw need = 100 dough balls
      // 15% safety buffer -> 115 dough balls
      // Current on-hand = 40 dough balls
      // Recommended prep = 115 - 40 = 75 dough balls
      const parTarget = uomEngine.calculateMorningPrepPar(
        'prep-dough-500g',
        'Pizza Dough Ball (500g)',
        'PIECE',
        5000.0,
        20,
        40,
        15.0
      );

      expect(parTarget.forecastedDaypartNeed).toBe(115.0);
      expect(parTarget.currentOnHand).toBe(40);
      expect(parTarget.recommendedPrepQuantity).toBe(75);
    });
  });
});
