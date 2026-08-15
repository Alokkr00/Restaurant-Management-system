import crypto from 'crypto';

export type DaypartType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'LATE_NIGHT' | 'ALL_DAY';
export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export interface ModifierOption {
  modifierId: string;
  name: string;
  pricePaise: number; // Integer paise/cents
  isAvailable: boolean;
  isDefault?: boolean;
}

export interface ModifierGroup {
  groupId: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface ProductVariant {
  variantId: string; // e.g. 'var-pep-reg', 'var-pep-med', 'var-pep-lrg'
  sku: string;
  name: string; // e.g. 'Regular', 'Medium', 'Large'
  pricePaise: number;
  channelPrices?: Partial<Record<OrderChannel, number>>;
  isAvailable: boolean;
}

export interface StructuredProduct {
  productId: string;
  name: string;
  category: string;
  sacCode: string; // e.g. '996331'
  allergens: string[];
  dayparts: DaypartType[];
  variants: ProductVariant[];
  modifierGroups: ModifierGroup[];
  outletPriceOverrides?: Record<string, number>; // storeId -> pricePaise override
  is86Unavailable: boolean;
  imageUrl?: string;
}

export interface StructuredMenuVersion {
  versionId: string;
  versionNumber: number;
  publishedAt: string;
  effectiveFrom: string;
  checksumSha256: string;
  categories: string[];
  products: StructuredProduct[];
  daypartSchedules: {
    daypart: DaypartType;
    startTime: string; // e.g. '07:00'
    endTime: string; // e.g. '11:00'
  }[];
}

export class MenuStructureEngine {
  private activeVersion: StructuredMenuVersion | null = null;
  private store86List: Set<string> = new Set(); // Set of 86'd product IDs or variant IDs

  constructor(initialMenu?: StructuredMenuVersion) {
    if (initialMenu) {
      this.setActiveVersion(initialMenu);
    }
  }

  /**
   * Generates a SHA-256 checksum for atomic menu publishing integrity
   */
  public static computeMenuChecksum(menu: Omit<StructuredMenuVersion, 'checksumSha256'>): string {
    const serialized = JSON.stringify({
      versionId: menu.versionId,
      versionNumber: menu.versionNumber,
      effectiveFrom: menu.effectiveFrom,
      categories: menu.categories,
      products: menu.products,
      daypartSchedules: menu.daypartSchedules,
    });
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  public setActiveVersion(menu: StructuredMenuVersion): void {
    const computed = MenuStructureEngine.computeMenuChecksum(menu);
    if (menu.checksumSha256 && menu.checksumSha256 !== computed) {
      throw new Error(`Menu integrity check failed: expected checksum ${menu.checksumSha256}, got ${computed}`);
    }
    this.activeVersion = menu;
  }

  public getActiveVersion(): StructuredMenuVersion | null {
    return this.activeVersion;
  }

  /**
   * Toggles 86 / unavailable status for a product or variant
   */
  public set86Status(itemId: string, isUnavailable: boolean): void {
    if (isUnavailable) {
      this.store86List.add(itemId);
    } else {
      this.store86List.delete(itemId);
    }
  }

  public is86Unavailable(itemId: string): boolean {
    return this.store86List.has(itemId);
  }

  /**
   * Determines current active daypart based on outlet local time (HH:mm)
   */
  public getCurrentDaypart(localTimeHHMM: string): DaypartType {
    if (!this.activeVersion) return 'ALL_DAY';

    for (const sched of this.activeVersion.daypartSchedules) {
      if (sched.daypart === 'ALL_DAY') continue;
      if (sched.startTime <= sched.endTime) {
        if (localTimeHHMM >= sched.startTime && localTimeHHMM < sched.endTime) {
          return sched.daypart;
        }
      } else {
        // Spans midnight, e.g. 23:00 to 04:00
        if (localTimeHHMM >= sched.startTime || localTimeHHMM < sched.endTime) {
          return sched.daypart;
        }
      }
    }
    return 'ALL_DAY';
  }

  /**
   * Evaluates line item price taking into account variant, channel, outlet override, and selected modifiers
   */
  public priceLineItem(params: {
    storeId: string;
    productId: string;
    variantId?: string;
    channel: OrderChannel;
    selectedModifierIds?: string[];
    currentTimeHHMM?: string;
  }): {
    productName: string;
    variantName?: string;
    unitPricePaise: number;
    modifierBreakdown: { modifierId: string; name: string; pricePaise: number }[];
    totalLinePricePaise: number;
    sacCode: string;
  } {
    if (!this.activeVersion) {
      throw new Error('No active menu published.');
    }

    const product = this.activeVersion.products.find(p => p.productId === params.productId);
    if (!product) {
      throw new Error(`Product '${params.productId}' not found in active menu catalog.`);
    }

    if (this.is86Unavailable(product.productId) || product.is86Unavailable) {
      throw new Error(`Product '${product.name}' is currently 86'd (unavailable).`);
    }

    // Check Daypart availability
    if (params.currentTimeHHMM) {
      const currentDaypart = this.getCurrentDaypart(params.currentTimeHHMM);
      if (
        !product.dayparts.includes('ALL_DAY') &&
        !product.dayparts.includes(currentDaypart)
      ) {
        throw new Error(
          `Product '${product.name}' is only available during [${product.dayparts.join(', ')}], current daypart is '${currentDaypart}'.`
        );
      }
    }

    // Determine Base Price from Variant or Product
    let basePricePaise = 0;
    let selectedVariant: ProductVariant | undefined;

    if (product.variants && product.variants.length > 0) {
      selectedVariant = params.variantId
        ? product.variants.find(v => v.variantId === params.variantId)
        : product.variants[0];

      if (!selectedVariant) {
        throw new Error(`Variant '${params.variantId}' not found for product '${product.name}'.`);
      }

      if (this.is86Unavailable(selectedVariant.variantId) || !selectedVariant.isAvailable) {
        throw new Error(`Variant '${selectedVariant.name}' for product '${product.name}' is currently unavailable.`);
      }

      // Check Channel Pricing (Dine-in, Takeaway, Delivery)
      if (selectedVariant.channelPrices && selectedVariant.channelPrices[params.channel] !== undefined) {
        basePricePaise = selectedVariant.channelPrices[params.channel]!;
      } else {
        basePricePaise = selectedVariant.pricePaise;
      }
    }

    // Check Outlet Override
    if (product.outletPriceOverrides && product.outletPriceOverrides[params.storeId] !== undefined) {
      basePricePaise = product.outletPriceOverrides[params.storeId];
    }

    // Validate Required & Optional Modifier Group Rules
    const modifierBreakdown: { modifierId: string; name: string; pricePaise: number }[] = [];
    const selectedModsSet = new Set(params.selectedModifierIds || []);

    for (const group of product.modifierGroups) {
      const selectedInGroup = group.options.filter(opt => selectedModsSet.has(opt.modifierId));

      if (group.isRequired && selectedInGroup.length < group.minSelections) {
        throw new Error(
          `Required modifier selection missing for group '${group.name}'. Minimum required: ${group.minSelections}, selected: ${selectedInGroup.length}.`
        );
      }

      if (selectedInGroup.length > group.maxSelections) {
        throw new Error(
          `Too many modifiers selected for group '${group.name}'. Maximum allowed: ${group.maxSelections}, selected: ${selectedInGroup.length}.`
        );
      }

      for (const opt of selectedInGroup) {
        if (this.is86Unavailable(opt.modifierId) || !opt.isAvailable) {
          throw new Error(`Modifier '${opt.name}' is currently 86'd (unavailable).`);
        }
        modifierBreakdown.push({
          modifierId: opt.modifierId,
          name: opt.name,
          pricePaise: opt.pricePaise,
        });
      }
    }

    const modifiersTotalPaise = modifierBreakdown.reduce((sum, m) => sum + m.pricePaise, 0);
    const unitPricePaise = basePricePaise + modifiersTotalPaise;

    return {
      productName: product.name,
      variantName: selectedVariant?.name,
      unitPricePaise,
      modifierBreakdown,
      totalLinePricePaise: unitPricePaise,
      sacCode: product.sacCode || '996331',
    };
  }
}
