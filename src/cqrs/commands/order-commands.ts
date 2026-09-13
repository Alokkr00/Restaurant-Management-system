import { MenuMDMService } from '../../mdm/menu-mdm.js';

export interface OrderModifierCommand {
  modifierId: string;
  name: string;
  priceCents: number;
}

export interface OrderLineItemCommand {
  menuItemId: string; // product_id or sku
  name: string;
  quantity: number;
  unitPriceCents: number;
  modifiers?: OrderModifierCommand[];
  notes?: string;
}

export interface OrderTenderCommand {
  type: 'CASH' | 'CARD' | 'UPI' | 'EXTERNAL';
  amountCents: number;
}

export interface CreateOrderCommand {
  orderId: string;
  storeId: string;
  terminalId: string;
  tableId?: string;
  serverUserId?: string;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  items: OrderLineItemCommand[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  tenders: OrderTenderCommand[];
  offlineMode: boolean;
  timestamp?: string;
}

export interface CommandValidationResult {
  isValid: boolean;
  errors: string[];
}

export class OrderCommandValidator {
  private menuMDM?: MenuMDMService;

  constructor(menuMDM?: MenuMDMService) {
    this.menuMDM = menuMDM;
  }

  public validate(command: CreateOrderCommand): CommandValidationResult {
    const errors: string[] = [];

    if (!command.orderId || typeof command.orderId !== 'string') {
      errors.push('orderId is required and must be a valid string.');
    }
    if (!command.storeId) {
      errors.push('storeId is required.');
    }
    if (!command.terminalId) {
      errors.push('terminalId is required.');
    }
    if (!Array.isArray(command.items) || command.items.length === 0) {
      errors.push('Order must contain at least one line item.');
      return { isValid: false, errors };
    }

    let calculatedSubtotal = 0;

    for (let i = 0; i < command.items.length; i++) {
      const item = command.items[i];
      const prefix = `Item [${i}] (${item.name || item.menuItemId || 'unnamed'})`;

      if (!item.menuItemId) {
        errors.push(`${prefix}: menuItemId is required.`);
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        errors.push(`${prefix}: quantity must be an integer greater than zero.`);
      }

      if (typeof item.unitPriceCents !== 'number' || item.unitPriceCents < 0) {
        errors.push(`${prefix}: unitPriceCents must be a non-negative number.`);
      }

      let modSum = 0;
      if (item.modifiers && Array.isArray(item.modifiers)) {
        for (const mod of item.modifiers) {
          if (typeof mod.priceCents !== 'number' || mod.priceCents < 0) {
            errors.push(`${prefix}: modifier "${mod.name}" priceCents must be non-negative.`);
          } else {
            modSum += mod.priceCents;
          }
        }
      }

      calculatedSubtotal += (item.unitPriceCents * item.quantity) + (modSum * item.quantity);

      // Validate against Menu MDM if available
      if (this.menuMDM && item.menuItemId) {
        const product = this.menuMDM.getMenuItemById(item.menuItemId) || this.menuMDM.getMenuItemBySku(item.menuItemId);
        if (product && !product.is_available) {
          errors.push(`${prefix}: item "${product.name}" is currently 86'd (out of stock).`);
        }
      }
    }

    // Tolerance check for minor float calculations vs cents
    if (Math.abs(command.subtotalCents - calculatedSubtotal) > 2) {
      errors.push(
        `subtotalCents mismatch: expected ${calculatedSubtotal} cents based on line items, got ${command.subtotalCents} cents.`
      );
    }

    const calculatedTotal = command.subtotalCents + command.taxCents;
    if (Math.abs(command.totalCents - calculatedTotal) > 2) {
      errors.push(
        `totalCents mismatch: subtotal (${command.subtotalCents}) + tax (${command.taxCents}) must equal total (${command.totalCents}).`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
