export type ModuleType =
  | 'pos_register'
  | 'table_floor_plan'
  | 'kds'
  | 'cash_management'
  | 'po_receiving'
  | 'inventory_prep'
  | 'labor_shifts'
  | 'menu_catalog'
  | 'franchise_financials';

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  basePrice: number;
  image: string;
  allergens?: string[];
  isBrandLocked?: boolean;
  isAvailable?: boolean;
  version?: number;
}

export interface CartItem {
  id: string;
  name: string;
  basePrice: number;
  qty: number;
  category?: string;
  modifiers?: string[];
  modifiersCost?: number;
  notes?: string;
}

export interface KdsTicketItem {
  qty: number;
  name: string;
  modifiers?: string[];
  allergens?: string[];
}

export interface KDSTicket {
  id: string;
  source: string;
  station: string;
  elapsedMinutes: number;
  elapsedSeconds: number;
  diningType: string;
  items: KdsTicketItem[];
  status: 'IN_PREP' | 'READY' | 'COMPLETED' | 'LATE';
}

export interface RestaurantTable {
  tableId: string;
  label: string;
  seats: number;
  section: string;
  status: 'VACANT' | 'SEATED' | 'ORDERING' | 'SERVED';
  openTicketId?: string;
  covers?: number;
  serverName?: string;
  seatedAt?: string;
}

export interface DrawerActivity {
  timestamp: string;
  activityType: 'OPENING' | 'SAFE DROP' | 'PAYOUT';
  amount: number;
  witness: string;
  notes: string;
}

export interface DrawerSession {
  sessionId: string;
  startingBankUSD: number;
  cashSalesUSD: number;
  cashDropsUSD: number;
  payOutsUSD: number;
  expectedCashUSD: number;
  status: string;
  activityLedger: DrawerActivity[];
}

export interface PurchaseOrder {
  poId: string;
  supplierId: string;
  supplierName: string;
  totalCostINR: number;
  status: 'SENT' | 'RECEIVED' | 'OVERDUE';
  createdAt: string;
  expectedDeliveryDate: string;
}

export interface Supplier {
  supplierId: string;
  name: string;
  phone: string;
  leadTimeDays: number;
  paymentTermsDays: number;
}

export interface StockLevel {
  ingredientId: string;
  name: string;
  balance: number;
  unit: string;
}

export interface SpoilageLog {
  id: string;
  date: string;
  item: string;
  qty: string;
  reason: string;
  costUSD: number;
}

export interface RecipeIngredient {
  name: string;
  qty: number;
  unit: string;
  cost: number;
}

export interface Recipe {
  id: string;
  name: string;
  targetYield: number;
  ingredients: RecipeIngredient[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  status: 'CLOCKED_IN' | 'CLOCKED_OUT';
  hourlyRateUSD: number;
  shiftStart?: string;
  hoursThisWeek: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  account: string;
  debit: number;
  credit: number;
  memo: string;
}

export interface StoreKPIs {
  grossSalesUSD: number;
  netSalesUSD: number;
  taxCollectedUSD: number;
  foodCostPct: number;
  laborCostPct: number;
  primeCostPct: number;
}
