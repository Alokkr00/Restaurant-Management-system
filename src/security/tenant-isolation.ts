export interface TenantUserContext {
  userId: string;
  userRole: 'HQ_ADMIN' | 'FRANCHISEE_OPERATOR' | 'STORE_MANAGER';
  franchiseeId?: string;
  allowedStoreIds: string[];
}

export class TenantDataIsolationGuard {
  /**
   * Asserts whether a user is authorized to access a target store's operational or financial records.
   * Throws security exception if Franchisee attempts cross-tenant access.
   */
  public assertStoreAccess(context: TenantUserContext, targetStoreId: string): void {
    if (context.userRole === 'HQ_ADMIN') {
      return; // HQ Admin has global access
    }

    if (!context.allowedStoreIds.includes(targetStoreId)) {
      throw new Error(
        `SECURITY VIOLATION: User ${context.userId} (Franchisee: ${context.franchiseeId}) attempted unauthorized access to Store ${targetStoreId}`
      );
    }
  }

  /**
   * Filters multi-store record list strictly by authorized store IDs.
   */
  public filterRecordsForTenant<T extends { storeId: string }>(
    context: TenantUserContext,
    records: T[]
  ): T[] {
    if (context.userRole === 'HQ_ADMIN') {
      return records;
    }
    return records.filter((r) => context.allowedStoreIds.includes(r.storeId));
  }
}
