export type HierarchyLevel = 'GLOBAL' | 'COUNTRY' | 'REGION' | 'STORE';

export interface EntityHierarchy {
  globalId: string;
  countryId?: string;
  regionId?: string;
  storeId: string;
}

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  basePrice: number;
  currency: string;
  hierarchyLevel: HierarchyLevel;
  targetId: string; // ID of global, country, region, or store
  isBrandLocked: boolean;
  allergens: string[];
  nutritionalInfo: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  version: number;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  unit: 'GRAM' | 'MILLILITER' | 'PIECE';
  quantityRequired: number;
  yieldFactor: number; // e.g. 0.95 for 5% trim/cooking shrinkage
}

export interface Recipe {
  id: string;
  menuItemId: string;
  ingredients: RecipeIngredient[];
  version: number;
  isBrandLocked: boolean;
}

export interface POSOrderItem {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  modifiers?: { name: string; extraPrice: number }[];
}

export interface POSTransaction {
  id: string;
  storeId: string;
  terminalId: string;
  timestamp: string;
  items: POSOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  tenders: {
    type: 'CASH' | 'CARD' | 'GIFT_CARD' | 'HOUSE_ACCOUNT' | 'COMP';
    amount: number;
    transactionRef?: string;
    deferredOfflineToken?: string;
  }[];
  offlineMode: boolean;
  synced: boolean;
}

export type SyncEventType = 
  | 'MENU_UPDATE' 
  | 'POS_TRANSACTION' 
  | 'INVENTORY_DELTA' 
  | 'AUDIT_LOG';

export interface SyncEvent {
  eventId: string;
  type: SyncEventType;
  storeId: string;
  timestamp: string;
  payload: any;
  sequence: number;
  checksum: string;
}

export interface InventoryRecord {
  ingredientId: string;
  storeId: string;
  ingredientName: string;
  unit: string;
  onHandQuantity: number;
  theoreticalQuantity: number;
  lastCalculatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  entityId: string;
  previousValue: any;
  newValue: any;
  hash: string;
}
