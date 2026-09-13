import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseAdapter } from '../src/store-edge/db/database-adapter.js';
import { runMigrations } from '../src/store-edge/db/migrations.js';
import { StoreMDMService } from '../src/mdm/store-mdm.js';
import { StaffMDMService } from '../src/mdm/staff-mdm.js';
import { MenuMDMService } from '../src/mdm/menu-mdm.js';

describe('Master Data Management (CRUD Boundary)', () => {
  let db: DatabaseAdapter;
  let storeMDM: StoreMDMService;
  let staffMDM: StaffMDMService;
  let menuMDM: MenuMDMService;

  beforeEach(() => {
    db = new DatabaseAdapter(':memory:');
    runMigrations(db);
    storeMDM = new StoreMDMService(db);
    staffMDM = new StaffMDMService(db);
    menuMDM = new MenuMDMService(db);
  });

  describe('Store Outlet Configurations CRUD', () => {
    it('creates, retrieves, updates, and deactivates a store outlet', () => {
      const created = storeMDM.createStore({
        store_id: 'store-austin-01',
        name: 'Austin Downtown Flagship',
        currency: 'USD',
        tax_rate_bps: 825,
        country_code: 'US',
        state_code: 'TX',
      });

      expect(created.store_id).toBe('store-austin-01');
      expect(created.name).toBe('Austin Downtown Flagship');
      expect(created.tax_rate_bps).toBe(825);
      expect(created.status).toBe('ACTIVE');

      // Update store
      const updated = storeMDM.updateStore('store-austin-01', {
        tax_rate_bps: 850,
        service_charge_bps: 300,
      });
      expect(updated.tax_rate_bps).toBe(850);
      expect(updated.service_charge_bps).toBe(300);

      // List stores
      const list = storeMDM.listStores();
      expect(list.some((s) => s.store_id === 'store-austin-01')).toBe(true);

      // Deactivate
      const deactivated = storeMDM.deactivateStore('store-austin-01');
      expect(deactivated).toBe(true);
      const fetched = storeMDM.getStoreById('store-austin-01');
      expect(fetched?.status).toBe('INACTIVE');
    });
  });

  describe('Staff Rosters CRUD', () => {
    it('creates, updates roles, and manages active status with PIN hashing', () => {
      const staff = staffMDM.createStaff({
        store_id: 'store-104',
        name: 'Alex Rivera',
        role: 'CASHIER',
        pin: '4321',
      });

      expect(staff.name).toBe('Alex Rivera');
      expect(staff.role).toBe('CASHIER');
      expect(staff.is_active).toBe(1);

      // Update role
      const promoted = staffMDM.updateStaff(staff.user_id, {
        role: 'MANAGER',
      });
      expect(promoted.role).toBe('MANAGER');

      // Toggle active
      staffMDM.toggleStaffActive(staff.user_id, false);
      const inactive = staffMDM.getStaffById(staff.user_id);
      expect(inactive?.is_active).toBe(0);

      // List staff
      const roster = staffMDM.listStaff('store-104');
      expect(roster.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects invalid roles on staff creation', () => {
      expect(() =>
        staffMDM.createStaff({
          store_id: 'store-104',
          name: 'Invalid Staff',
          role: 'SUPERHERO' as any,
          pin: '0000',
        })
      ).toThrow(/Invalid role/);
    });
  });

  describe('Master Menu Items CRUD', () => {
    it('creates, retrieves, toggles 86 status, and updates menu products', () => {
      const item = menuMDM.createMenuItem({
        sku: 'PIZ-BBQ-01',
        name: 'BBQ Smoked Chicken Pizza',
        category: 'Pizzas',
        price_cents: 1950,
        allergens: ['DAIRY', 'GLUTEN'],
      });

      expect(item.sku).toBe('PIZ-BBQ-01');
      expect(item.price_cents).toBe(1950);
      expect(item.is_available).toBe(true);

      // Lookup by SKU
      const foundBySku = menuMDM.getMenuItemBySku('PIZ-BBQ-01');
      expect(foundBySku?.name).toBe('BBQ Smoked Chicken Pizza');

      // 86 item (out of stock)
      menuMDM.toggleItemAvailability(item.product_id, false);
      const unavailable = menuMDM.getMenuItemById(item.product_id);
      expect(unavailable?.is_available).toBe(false);

      // Update price
      const repriced = menuMDM.updateMenuItem(item.product_id, { price_cents: 2050 });
      expect(repriced.price_cents).toBe(2050);

      // List
      const all = menuMDM.listMenuItems();
      expect(all.some((m) => m.sku === 'PIZ-BBQ-01')).toBe(true);
    });

    it('rejects negative prices', () => {
      expect(() =>
        menuMDM.createMenuItem({
          sku: 'INV-01',
          name: 'Negative Item',
          category: 'Entrees',
          price_cents: -500,
        })
      ).toThrow(/cannot be negative/);
    });
  });
});
