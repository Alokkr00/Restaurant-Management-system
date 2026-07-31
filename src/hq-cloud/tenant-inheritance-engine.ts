import { MenuItem } from '../shared/types.js';

export interface TenantHierarchyNode {
  platformId: string;
  brandId: string;
  regionId?: string;
  storeId: string;
}

export interface TenantConfigOverride {
  id: string;
  entityId: string;
  targetLevel: 'PLATFORM' | 'BRAND' | 'REGION' | 'STORE';
  targetId: string; // ID of Platform, Brand, Region, or Store
  overrides: Partial<MenuItem>;
  updatedByRole: string;
}

export class TenantHierarchicalInheritanceEngine {
  private platformDefaults: Map<string, MenuItem> = new Map();
  private overrides: TenantConfigOverride[] = [];

  public registerPlatformDefault(item: MenuItem): void {
    this.platformDefaults.set(item.id, item);
  }

  public registerOverride(override: TenantConfigOverride): void {
    this.overrides.push(override);
  }

  /**
   * Resolves configuration in order: Platform Default -> Brand -> Region -> Store
   * Enforces HQ Brand-Lock rule: Franchisees can ONLY override fields if isBrandLocked === false.
   */
  public resolveItemConfiguration(
    entityId: string,
    hierarchy: TenantHierarchyNode
  ): MenuItem {
    const platformItem = this.platformDefaults.get(entityId);
    if (!platformItem) {
      throw new Error(`Platform default item ${entityId} not found`);
    }

    let resolvedItem: MenuItem = { ...platformItem };

    // Resolution steps in priority order
    const resolutionSteps: { level: 'BRAND' | 'REGION' | 'STORE'; targetId: string }[] = [
      { level: 'BRAND', targetId: hierarchy.brandId },
      { level: 'REGION', targetId: hierarchy.regionId || '' },
      { level: 'STORE', targetId: hierarchy.storeId },
    ];

    for (const step of resolutionSteps) {
      if (!step.targetId) continue;

      const matchingOverrides = this.overrides.filter(
        (o) => o.entityId === entityId && o.targetLevel === step.level && o.targetId === step.targetId
      );

      for (const override of matchingOverrides) {
        // If master record is brand locked, prevent store/franchisee overrides of locked fields
        if (resolvedItem.isBrandLocked && (step.level === 'STORE' || override.updatedByRole === 'FRANCHISEE_OWNER')) {
          const safeOverrides = { ...override.overrides };
          delete safeOverrides.name;
          delete safeOverrides.allergens;
          delete safeOverrides.isBrandLocked;
          resolvedItem = { ...resolvedItem, ...safeOverrides };
        } else {
          resolvedItem = { ...resolvedItem, ...override.overrides };
        }
      }
    }

    return resolvedItem;
  }
}
