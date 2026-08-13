import { MenuItem } from '../shared/types.js';

// ─── Domain Types ────────────────────────────────────────────────────────────

export type POStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'PARTIAL_RECEIVED' | 'CANCELLED';

export interface POLineItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  orderedQty: number;
  unitCostINR: number; // Cost per unit in INR (paisa-level precision via integer)
}

export interface PurchaseOrder {
  poId: string;
  supplierId: string;
  supplierName: string;
  storeId: string;
  lineItems: POLineItem[];
  status: POStatus;
  createdAt: string;
  expectedDeliveryDate: string;
  totalCostINR: number;
  notes?: string;
}

export interface GRNLineItem {
  ingredientId: string;
  orderedQty: number;
  receivedQty: number; // May be less than ordered (short delivery) or more (over-delivery)
  unit: string;
  unitCostINR: number;
  isShortDelivery: boolean;
  varianceQty: number;
}

export interface GoodsReceiptNote {
  grnId: string;
  poId: string;
  storeId: string;
  receivedAt: string;
  receivedBy: string;
  lineItems: GRNLineItem[];
  totalReceivedCostINR: number;
  hasShortDeliveries: boolean;
}

export interface StockTakeEntry {
  ingredientId: string;
  physicalCount: number;
  unit: string;
}

export interface StockVarianceEntry {
  ingredientId: string;
  ingredientName: string;
  theoreticalBalance: number;
  physicalCount: number;
  varianceQty: number;
  variancePct: number;
  costImpactINR: number;
  requiresInvestigation: boolean; // true when |variancePct| >= 2%
}

export interface Supplier {
  supplierId: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  leadTimeDays: number;
  paymentTermsDays: number;
  ingredientIds: string[]; // Which ingredients this supplier provides
}

export class PurchaseOrderEngine {
  private suppliers: Map<string, Supplier>;
  private ingredientStock: Map<string, { name: string; balance: number; unit: string; unitCostINR: number }>;
  private purchaseOrders: Map<string, PurchaseOrder>;
  private goodsReceiptNotes: Map<string, GoodsReceiptNote>;

  constructor() {
    this.suppliers = new Map([
      ['sup-001', {
        supplierId: 'sup-001',
        name: 'Mumbai Dairy Wholesalers Pvt. Ltd.',
        contactName: 'Rajan Mehta',
        phone: '+91-98201-11223',
        email: 'orders@mumbaidairy.in',
        leadTimeDays: 2,
        paymentTermsDays: 30,
        ingredientIds: ['ing-cheese'],
      }],
      ['sup-002', {
        supplierId: 'sup-002',
        name: 'Delhi Grain & Flour Mills',
        contactName: 'Amanpreet Singh',
        phone: '+91-99100-44556',
        email: 'supply@delhigrains.in',
        leadTimeDays: 1,
        paymentTermsDays: 15,
        ingredientIds: ['ing-flour'],
      }],
    ]);

    this.ingredientStock = new Map([
      ['ing-cheese', { name: 'Mozzarella Cheese (Shredded)', balance: 15.8, unit: 'kg', unitCostINR: 650 }],
      ['ing-pep',    { name: 'Pepperoni Slices (Beef/Pork)', balance: 8.6,  unit: 'kg', unitCostINR: 900 }],
      ['ing-flour',  { name: 'High-Gluten Flour Batch',      balance: 48.2, unit: 'kg', unitCostINR: 45  }],
      ['ing-sauce',  { name: 'Tomato Pizza Sauce',            balance: 12.0, unit: 'kg', unitCostINR: 120 }],
    ]);

    this.purchaseOrders = new Map();
    this.goodsReceiptNotes = new Map();
  }

  public listSuppliers(): Supplier[] {
    return Array.from(this.suppliers.values());
  }

  public getSupplier(supplierId: string): Supplier | undefined {
    return this.suppliers.get(supplierId);
  }

  // ─── Purchase Orders ─────────────────────────────────────────────────────

  /**
   * Creates a new DRAFT Purchase Order for a supplier.
   * Does not affect stock levels until a GRN is posted against it.
   */
  public createPurchaseOrder(
    supplierId: string,
    storeId: string,
    lineItems: { ingredientId: string; orderedQty: number; unitCostINR: number }[],
    expectedDeliveryDate: string,
    notes?: string
  ): PurchaseOrder {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${supplierId} not registered`);
    }

    const enrichedLines: POLineItem[] = lineItems.map((line) => {
      const stock = this.ingredientStock.get(line.ingredientId);
      if (!stock) throw new Error(`Ingredient ${line.ingredientId} not in stock ledger`);
      return {
        ingredientId: line.ingredientId,
        ingredientName: stock.name,
        unit: stock.unit,
        orderedQty: line.orderedQty,
        unitCostINR: line.unitCostINR,
      };
    });

    const totalCostINR = enrichedLines.reduce((sum, l) => sum + l.orderedQty * l.unitCostINR, 0);

    const po: PurchaseOrder = {
      poId: `PO-${storeId.toUpperCase()}-${Date.now()}`,
      supplierId,
      supplierName: supplier.name,
      storeId,
      lineItems: enrichedLines,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      expectedDeliveryDate,
      totalCostINR,
      notes,
    };

    this.purchaseOrders.set(po.poId, po);
    return po;
  }

  /**
   * Advances PO status to SENT (triggers supplier notification in production).
   */
  public sendPurchaseOrder(poId: string): PurchaseOrder {
    const po = this.purchaseOrders.get(poId);
    if (!po) throw new Error(`PO ${poId} not found`);
    if (po.status !== 'DRAFT') throw new Error(`PO ${poId} is already ${po.status} — cannot send`);
    po.status = 'SENT';
    return po;
  }

  // ─── Goods Receipt Note (GRN) ────────────────────────────────────────────

  /**
   * Receives a purchase order delivery. Reconciles ordered vs. actual received quantities.
   * Detects short/over deliveries and posts stock increments to the ingredient ledger.
   * Short deliveries mark the PO as PARTIAL_RECEIVED; full receipt marks it RECEIVED.
   */
  public receivePurchaseOrder(
    poId: string,
    receivedBy: string,
    actualReceived: { ingredientId: string; receivedQty: number }[]
  ): GoodsReceiptNote {
    const po = this.purchaseOrders.get(poId);
    if (!po) throw new Error(`PO ${poId} not found`);
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new Error(`PO ${poId} is ${po.status} — cannot receive again`);
    }

    const grnLines: GRNLineItem[] = po.lineItems.map((poLine) => {
      const received = actualReceived.find((r) => r.ingredientId === poLine.ingredientId);
      const receivedQty = received?.receivedQty ?? 0;
      const varianceQty = receivedQty - poLine.orderedQty;
      const isShortDelivery = receivedQty < poLine.orderedQty;

      // Increment stock ledger for received quantity
      const stockRecord = this.ingredientStock.get(poLine.ingredientId);
      if (stockRecord) {
        stockRecord.balance = Number((stockRecord.balance + receivedQty).toFixed(4));
      }

      return {
        ingredientId: poLine.ingredientId,
        orderedQty: poLine.orderedQty,
        receivedQty,
        unit: poLine.unit,
        unitCostINR: poLine.unitCostINR,
        isShortDelivery,
        varianceQty,
      };
    });

    const hasShortDeliveries = grnLines.some((l) => l.isShortDelivery);
    const totalReceivedCostINR = grnLines.reduce(
      (sum, l) => sum + l.receivedQty * l.unitCostINR, 0
    );

    po.status = hasShortDeliveries ? 'PARTIAL_RECEIVED' : 'RECEIVED';

    const grn: GoodsReceiptNote = {
      grnId: `GRN-${poId}-${Date.now()}`,
      poId,
      storeId: po.storeId,
      receivedAt: new Date().toISOString(),
      receivedBy,
      lineItems: grnLines,
      totalReceivedCostINR,
      hasShortDeliveries,
    };

    this.goodsReceiptNotes.set(grn.grnId, grn);
    return grn;
  }

  // ─── Stock Take & Physical Count Reconciliation ──────────────────────────

  /**
   * Runs a physical stock-take count against the theoretical running balance.
   * Posts variance to stock_variance_log. Flags ingredients with |variance| >= 2%.
   * Cashiers must enter blind physical counts without seeing theoretical values first.
   */
  public runStockTake(storeId: string, counts: StockTakeEntry[]): StockVarianceEntry[] {
    return counts.map((count) => {
      const stock = this.ingredientStock.get(count.ingredientId);
      if (!stock) {
        throw new Error(`Ingredient ${count.ingredientId} not in stock ledger`);
      }

      const varianceQty = count.physicalCount - stock.balance;
      const variancePct = stock.balance > 0
        ? Number(((varianceQty / stock.balance) * 100).toFixed(2))
        : 0;
      const costImpactINR = Number((Math.abs(varianceQty) * stock.unitCostINR).toFixed(2));
      const requiresInvestigation = Math.abs(variancePct) >= 2.0;

      return {
        ingredientId: count.ingredientId,
        ingredientName: stock.name,
        theoreticalBalance: stock.balance,
        physicalCount: count.physicalCount,
        varianceQty: Number(varianceQty.toFixed(4)),
        variancePct,
        costImpactINR,
        requiresInvestigation,
      };
    });
  }

  // ─── Read Accessors ──────────────────────────────────────────────────────

  public listPurchaseOrders(storeId: string): PurchaseOrder[] {
    return Array.from(this.purchaseOrders.values()).filter((po) => po.storeId === storeId);
  }

  public listGRNs(storeId: string): GoodsReceiptNote[] {
    return Array.from(this.goodsReceiptNotes.values()).filter((grn) => grn.storeId === storeId);
  }

  public getStockLevels(): { ingredientId: string; name: string; balance: number; unit: string }[] {
    return Array.from(this.ingredientStock.entries()).map(([id, rec]) => ({
      ingredientId: id,
      name: rec.name,
      balance: rec.balance,
      unit: rec.unit,
    }));
  }
}
