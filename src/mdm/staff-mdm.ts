import { DatabaseAdapter } from '../store-edge/db/database-adapter.js';
import { StoreAuthService, UserRole } from '../security/store-auth.js';

export interface StaffRecord {
  user_id: string;
  store_id: string;
  role: UserRole;
  name: string;
  is_active: number;
  created_at: string;
}

export interface CreateStaffInput {
  user_id?: string;
  store_id: string;
  role: UserRole;
  name: string;
  pin: string;
  is_active?: boolean;
}

export interface UpdateStaffInput {
  name?: string;
  role?: UserRole;
  pin?: string;
  is_active?: boolean;
}

export class StaffMDMService {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  public listStaff(storeId?: string): StaffRecord[] {
    if (storeId) {
      const stmt = this.db.prepare(
        'SELECT user_id, store_id, role, name, is_active, created_at FROM users WHERE store_id = ? ORDER BY name ASC'
      );
      return stmt.all(storeId) as StaffRecord[];
    }
    const stmt = this.db.prepare(
      'SELECT user_id, store_id, role, name, is_active, created_at FROM users ORDER BY name ASC'
    );
    return stmt.all() as StaffRecord[];
  }

  public getStaffById(userId: string): StaffRecord | null {
    const stmt = this.db.prepare(
      'SELECT user_id, store_id, role, name, is_active, created_at FROM users WHERE user_id = ?'
    );
    const user = stmt.get(userId) as StaffRecord | undefined;
    return user || null;
  }

  public createStaff(input: CreateStaffInput): StaffRecord {
    if (!input.store_id || !input.name || !input.role || !input.pin) {
      throw new Error('store_id, name, role, and pin are required fields.');
    }

    const validRoles: UserRole[] = ['CASHIER', 'SERVER', 'KITCHEN', 'MANAGER', 'ADMIN'];
    if (!validRoles.includes(input.role)) {
      throw new Error(`Invalid role "${input.role}". Allowed roles: ${validRoles.join(', ')}`);
    }

    const userId = input.user_id || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pinHash = StoreAuthService.hashPin(input.pin);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO users (user_id, store_id, role, name, pin_hash, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      input.store_id,
      input.role,
      input.name,
      pinHash,
      input.is_active !== false ? 1 : 0,
      now
    );

    return this.getStaffById(userId)!;
  }

  public updateStaff(userId: string, updates: UpdateStaffInput): StaffRecord {
    const existing = this.getStaffById(userId);
    if (!existing) {
      throw new Error(`Staff member with ID "${userId}" not found.`);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.role !== undefined) {
      const validRoles: UserRole[] = ['CASHIER', 'SERVER', 'KITCHEN', 'MANAGER', 'ADMIN'];
      if (!validRoles.includes(updates.role)) {
        throw new Error(`Invalid role "${updates.role}".`);
      }
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.pin !== undefined) {
      fields.push('pin_hash = ?');
      values.push(StoreAuthService.hashPin(updates.pin));
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      return existing;
    }

    values.push(userId);
    const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`);
    stmt.run(...values);

    return this.getStaffById(userId)!;
  }

  public toggleStaffActive(userId: string, isActive: boolean): boolean {
    const stmt = this.db.prepare('UPDATE users SET is_active = ? WHERE user_id = ?');
    const result = stmt.run(isActive ? 1 : 0, userId);
    return result.changes > 0;
  }

  public deleteStaff(userId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE user_id = ?');
    const result = stmt.run(userId);
    return result.changes > 0;
  }
}
