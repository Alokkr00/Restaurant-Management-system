export type ModifierAction = 'ADD' | 'NO' | 'SUB' | 'EXTRA' | 'ON_SIDE';
export type PizzaPlacement = 'WHOLE' | 'LEFT_HALF' | 'RIGHT_HALF';

export interface OrderModifier {
  modifierId: string;
  groupId: string;
  name: string;
  action: ModifierAction;
  placement: PizzaPlacement;
  extraPrice: number;
  substituteIngredientId?: string;
  removedIngredientId?: string;
}

export type CompReasonCode =
  | 'GUEST_DISSATISFACTION'
  | 'LONG_TICKET_WAIT'
  | 'WRONG_ITEM_MADE'
  | 'DROPPED_BY_SERVER'
  | 'EMPLOYEE_MEAL_DISCOUNT'
  | 'VIP_PROMOTIONAL_COMP'
  | 'SPILL_OR_ACCIDENT';

export type VoidReasonCode =
  | 'ORDER_ENTERED_BY_MISTAKE'
  | 'GUEST_LEFT_BEFORE_PREP'
  | 'DUPLICATE_TICKET'
  | 'OUT_OF_STOCK_ITEM';

export interface LineItemComp {
  compType: 'FULL_COMP' | 'PERCENT_DISCOUNT' | 'DOLLAR_DISCOUNT';
  discountAmountUSD: number;
  reasonCode: CompReasonCode;
  managerApprovalId: string;
  managerPinHash: string;
  notes?: string;
}

export interface LineItemVoid {
  voidedAt: string;
  reasonCode: VoidReasonCode;
  managerApprovalId: string;
  wasItemPreparedInKitchen: boolean; // If true -> waste logged. If false -> inventory restored.
  notes?: string;
}

export interface AdvancedPOSLineItem {
  lineItemId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: OrderModifier[];
  comp?: LineItemComp;
  void?: LineItemVoid;
  isVoided: boolean;
  finalLineTotalUSD: number;
}

export class OrderLifecycleEngine {
  /**
   * Calculates final line item total accounting for modifiers and audited comps.
   */
  public calculateLineItemTotal(item: AdvancedPOSLineItem): number {
    if (item.isVoided) {
      return 0.0;
    }

    const modifierCost = item.modifiers.reduce((sum, mod) => sum + mod.extraPrice, 0);
    const grossPrice = (item.unitPrice + modifierCost) * item.quantity;

    if (!item.comp) {
      return Number(grossPrice.toFixed(2));
    }

    let finalPrice = grossPrice;
    if (item.comp.compType === 'FULL_COMP') {
      finalPrice = 0.0;
    } else if (item.comp.compType === 'DOLLAR_DISCOUNT') {
      finalPrice = Math.max(0, grossPrice - item.comp.discountAmountUSD);
    } else if (item.comp.compType === 'PERCENT_DISCOUNT') {
      const discount = (grossPrice * item.comp.discountAmountUSD) / 100;
      finalPrice = Math.max(0, grossPrice - discount);
    }

    return Number(finalPrice.toFixed(2));
  }

  /**
   * Applies an audited comp with manager authorization.
   */
  public applyCompToLineItem(
    item: AdvancedPOSLineItem,
    compType: LineItemComp['compType'],
    discountValue: number,
    reasonCode: CompReasonCode,
    managerApprovalId: string,
    managerPinHash: string,
    notes?: string
  ): AdvancedPOSLineItem {
    if (item.isVoided) {
      throw new Error(`Cannot apply comp to voided line item ${item.lineItemId}`);
    }

    item.comp = {
      compType,
      discountAmountUSD: discountValue,
      reasonCode,
      managerApprovalId,
      managerPinHash,
      notes,
    };

    item.finalLineTotalUSD = this.calculateLineItemTotal(item);
    return item;
  }

  /**
   * Voids a line item with manager authorization.
   * Tracks whether the item was already made in the kitchen to govern inventory depletion vs restoration.
   */
  public voidLineItem(
    item: AdvancedPOSLineItem,
    reasonCode: VoidReasonCode,
    managerApprovalId: string,
    wasPreparedInKitchen: boolean = false,
    notes?: string
  ): { lineItem: AdvancedPOSLineItem; requiresInventoryDepletion: boolean; logSpoilageWaste: boolean } {
    item.isVoided = true;
    item.void = {
      voidedAt: new Date().toISOString(),
      reasonCode,
      managerApprovalId,
      wasItemPreparedInKitchen: wasPreparedInKitchen,
      notes,
    };

    item.finalLineTotalUSD = 0.0;

    return {
      lineItem: item,
      requiresInventoryDepletion: wasPreparedInKitchen, // Depleted only if kitchen made it
      logSpoilageWaste: wasPreparedInKitchen, // Logged to spoilage if food was wasted
    };
  }
}
