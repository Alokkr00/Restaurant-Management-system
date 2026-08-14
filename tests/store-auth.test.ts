import { describe, it, expect, beforeEach } from 'vitest';
import { StoreAuthService, UserRecord } from '../src/security/store-auth.js';

describe('StoreAuthService', () => {
  let mockDb: any;
  let authService: StoreAuthService;
  let userStore: UserRecord[] = [];

  beforeEach(() => {
    userStore = [
      {
        user_id: 'usr-mgr-01',
        store_id: 'store-104',
        role: 'MANAGER',
        name: 'Michael Smith (GM)',
        pin_hash: StoreAuthService.hashPin('9999'),
        is_active: 1,
      },
      {
        user_id: 'usr-csh-01',
        store_id: 'store-104',
        role: 'CASHIER',
        name: 'Sarah Jenkins (Cashier)',
        pin_hash: StoreAuthService.hashPin('1234'),
        is_active: 1,
      },
    ];

    mockDb = {
      prepare: (sql: string) => ({
        all: (storeId: string) => {
          if (sql.includes("role IN ('MANAGER', 'ADMIN')")) {
            return userStore.filter(u => u.store_id === storeId && ['MANAGER', 'ADMIN'].includes(u.role) && u.is_active === 1);
          }
          return userStore.filter(u => u.store_id === storeId && u.is_active === 1);
        },
      }),
    };

    authService = new StoreAuthService(mockDb);
  });

  it('hashes and verifies employee PINs using salted PBKDF2 cryptography', () => {
    const pin = '4821';
    const hash = StoreAuthService.hashPin(pin);

    expect(hash).toContain(':');
    expect(StoreAuthService.verifyPin('4821', hash)).toBe(true);
    expect(StoreAuthService.verifyPin('0000', hash)).toBe(false);
  });

  it('authenticates valid cashier PIN and rejects incorrect PIN', () => {
    const cashier = authService.authenticateUser('store-104', '1234');
    expect(cashier).toBeDefined();
    expect(cashier?.name).toBe('Sarah Jenkins (Cashier)');
    expect(cashier?.role).toBe('CASHIER');

    const invalid = authService.authenticateUser('store-104', '9991');
    expect(invalid).toBeNull();
  });

  it('verifies manager step-up authorization for critical actions', () => {
    const validStepUp = authService.verifyManagerStepUp('store-104', '9999');
    expect(validStepUp.authorized).toBe(true);
    expect(validStepUp.managerUser?.name).toBe('Michael Smith (GM)');

    const invalidStepUp = authService.verifyManagerStepUp('store-104', '1111');
    expect(invalidStepUp.authorized).toBe(false);
  });
});
