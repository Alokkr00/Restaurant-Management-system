import { MenuItem, EntityHierarchy } from '../shared/types.js';

export interface HierarchyOverride {
  entityId: string;
  hierarchyLevel: 'COUNTRY' | 'REGION' | 'STORE';
  targetId: string;
  overrides: Partial<MenuItem>;
}

export class HierarchicalInheritanceEngine {
  private masterMenuItems: Map<string, MenuItem> = new Map();
  private overrides: HierarchyOverride[] = [];

  public addMasterItem(item: MenuItem): void {
    this.masterMenuItems.set(item.id, item);
  }

  public addOverride(override: HierarchyOverride): void {
    this.overrides.push(override);
  }

  /**
   * Resolves final Menu Item configuration for a specific store
   * by traversing Global -> Country -> Region -> Store hierarchy.
   */
  public resolveItemForStore(itemId: string, hierarchy: EntityHierarchy): MenuItem {
    const master = this.masterMenuItems.get(itemId);
    if (!master) {
      throw new Error(`Master item ${itemId} not found`);
    }

    let resolvedItem: MenuItem = { ...master };

    // Applicable levels in resolution order
    const levels: { level: 'COUNTRY' | 'REGION' | 'STORE'; targetId?: string }[] = [
      { level: 'COUNTRY', targetId: hierarchy.countryId },
      { level: 'REGION', targetId: hierarchy.regionId },
      { level: 'STORE', targetId: hierarchy.storeId },
    ];

    for (const { level, targetId } of levels) {
      if (!targetId) continue;

      const matchingOverrides = this.overrides.filter(
        (o) => o.entityId === itemId && o.hierarchyLevel === level && o.targetId === targetId
      );

      for (const override of matchingOverrides) {
        // If master is brand-locked, prevent overriding locked fields like name, allergens, recipes
        if (master.isBrandLocked) {
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
