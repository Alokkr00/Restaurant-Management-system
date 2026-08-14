import crypto from 'crypto';
import Database from 'better-sqlite3';

export type UserRole = 'CASHIER' | 'SERVER' | 'KITCHEN' | 'MANAGER' | 'ADMIN';

export interface UserRecord {
  user_id: string;
  store_id: string;
  role: UserRole;
  name: string;
  pin_hash: string;
  is_active: number;
}

export class StoreAuthService {
  constructor(private db: any) {}

  /**
   * Hashes an employee PIN with a cryptographic salt using PBKDF2
   */
  public static hashPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(pin, salt, 10000, 32, 'sha256').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verifies an entered PIN against a stored salted hash
   */
  public static verifyPin(pin: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, hash] = parts;
    const computed = crypto.pbkdf2Sync(pin, salt, 10000, 32, 'sha256').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const compBuf = Buffer.from(computed, 'hex');
    if (hashBuf.length !== compBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, compBuf);
  }

  /**
   * Authenticates a user by store ID and PIN
   */
  public authenticateUser(storeId: string, pin: string): UserRecord | null {
    const users = this.db
      .prepare('SELECT * FROM users WHERE store_id = ? AND is_active = 1')
      .all(storeId) as UserRecord[];

    for (const u of users) {
      if (StoreAuthService.verifyPin(pin, u.pin_hash)) {
        return u;
      }
    }
    return null;
  }

  /**
   * Step-Up Manager Verification for High-Risk Actions (Voids, Refunds, Drawer Drops)
   */
  public verifyManagerStepUp(storeId: string, managerPin: string): { authorized: boolean; managerUser?: UserRecord } {
    const managers = this.db
      .prepare("SELECT * FROM users WHERE store_id = ? AND role IN ('MANAGER', 'ADMIN') AND is_active = 1")
      .all(storeId) as UserRecord[];

    for (const m of managers) {
      if (StoreAuthService.verifyPin(managerPin, m.pin_hash)) {
        return { authorized: true, managerUser: m };
      }
    }

    return { authorized: false };
  }
}
