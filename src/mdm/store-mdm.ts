import { DatabaseAdapter } from '../store-edge/db/database-adapter.js';

export interface StoreOutletRecord {
  store_id: string;
  name: string;
  currency: string;
  tax_rate_bps: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  country_code: string;
  gstin?: string;
  state_code?: string;
  is_tax_inclusive: number;
  service_charge_bps: number;
  upi_vpa?: string;
  trading_day_rollover_time: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreInput {
  store_id: string;
  name: string;
  currency?: string;
  tax_rate_bps?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  country_code?: string;
  gstin?: string;
  state_code?: string;
  is_tax_inclusive?: boolean;
  service_charge_bps?: number;
  upi_vpa?: string;
  trading_day_rollover_time?: string;
}

export class StoreMDMService {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  public listStores(): StoreOutletRecord[] {
    const stmt = this.db.prepare('SELECT * FROM stores ORDER BY name ASC');
    return stmt.all() as StoreOutletRecord[];
  }

  public getStoreById(storeId: string): StoreOutletRecord | null {
    const stmt = this.db.prepare('SELECT * FROM stores WHERE store_id = ?');
    const result = stmt.get(storeId) as StoreOutletRecord | undefined;
    return result || null;
  }

  public createStore(input: CreateStoreInput): StoreOutletRecord {
    if (!input.store_id || !input.name) {
      throw new Error('store_id and name are required fields.');
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO stores (
        store_id, name, currency, tax_rate_bps, status,
        country_code, gstin, state_code, is_tax_inclusive,
        service_charge_bps, upi_vpa, trading_day_rollover_time,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.store_id,
      input.name,
      input.currency || 'USD',
      input.tax_rate_bps ?? 800,
      input.status || 'ACTIVE',
      input.country_code || 'US',
      input.gstin || null,
      input.state_code || null,
      input.is_tax_inclusive ? 1 : 0,
      input.service_charge_bps ?? 0,
      input.upi_vpa || null,
      input.trading_day_rollover_time || '04:00',
      now,
      now
    );

    return this.getStoreById(input.store_id)!;
  }

  public updateStore(storeId: string, updates: Partial<CreateStoreInput>): StoreOutletRecord {
    const existing = this.getStoreById(storeId);
    if (!existing) {
      throw new Error(`Store with ID "${storeId}" not found.`);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.currency !== undefined) { fields.push('currency = ?'); values.push(updates.currency); }
    if (updates.tax_rate_bps !== undefined) { fields.push('tax_rate_bps = ?'); values.push(updates.tax_rate_bps); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.country_code !== undefined) { fields.push('country_code = ?'); values.push(updates.country_code); }
    if (updates.gstin !== undefined) { fields.push('gstin = ?'); values.push(updates.gstin); }
    if (updates.state_code !== undefined) { fields.push('state_code = ?'); values.push(updates.state_code); }
    if (updates.is_tax_inclusive !== undefined) { fields.push('is_tax_inclusive = ?'); values.push(updates.is_tax_inclusive ? 1 : 0); }
    if (updates.service_charge_bps !== undefined) { fields.push('service_charge_bps = ?'); values.push(updates.service_charge_bps); }
    if (updates.upi_vpa !== undefined) { fields.push('upi_vpa = ?'); values.push(updates.upi_vpa); }
    if (updates.trading_day_rollover_time !== undefined) { fields.push('trading_day_rollover_time = ?'); values.push(updates.trading_day_rollover_time); }

    if (fields.length === 0) {
      return existing;
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(storeId);

    const stmt = this.db.prepare(`UPDATE stores SET ${fields.join(', ')} WHERE store_id = ?`);
    stmt.run(...values);

    return this.getStoreById(storeId)!;
  }

  public deactivateStore(storeId: string): boolean {
    const stmt = this.db.prepare("UPDATE stores SET status = 'INACTIVE', updated_at = ? WHERE store_id = ?");
    const result = stmt.run(new Date().toISOString(), storeId);
    return result.changes > 0;
  }
}
