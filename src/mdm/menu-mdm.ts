import { DatabaseAdapter } from '../store-edge/db/database-adapter.js';

export interface MenuItemRecord {
  product_id: string;
  menu_version_id: string;
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  allergens: string[];
  image_url: string | null;
  is_available: boolean;
  sac_code?: string;
}

export interface CreateMenuItemInput {
  product_id?: string;
  menu_version_id?: string;
  sku: string;
  name: string;
  category: string;
  price_cents: number;
  allergens?: string[];
  image_url?: string;
  is_available?: boolean;
  sac_code?: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  sku?: string;
  category?: string;
  price_cents?: number;
  allergens?: string[];
  image_url?: string;
  is_available?: boolean;
  sac_code?: string;
}

export class MenuMDMService {
  private db: DatabaseAdapter;

  constructor(db: DatabaseAdapter) {
    this.db = db;
  }

  private ensureActiveMenuVersion(): string {
    const active = this.db.prepare('SELECT menu_version_id FROM menu_versions WHERE is_active = 1 LIMIT 1').get() as
      | { menu_version_id: string }
      | undefined;
    if (active) return active.menu_version_id;

    const versionId = 'menu-v1';
    this.db.prepare(
      'INSERT OR IGNORE INTO menu_versions (menu_version_id, version_number, published_at, is_active) VALUES (?, 1, ?, 1)'
    ).run(versionId, new Date().toISOString());
    return versionId;
  }

  public listMenuItems(): MenuItemRecord[] {
    const rows = this.db.prepare(`
      SELECT product_id, menu_version_id, sku, name, category, price_cents, allergens_json, image_url, is_available, sac_code
      FROM products
      ORDER BY category ASC, name ASC
    `).all() as any[];

    return rows.map((r) => ({
      product_id: r.product_id,
      menu_version_id: r.menu_version_id,
      sku: r.sku,
      name: r.name,
      category: r.category,
      price_cents: r.price_cents,
      allergens: JSON.parse(r.allergens_json || '[]'),
      image_url: r.image_url,
      is_available: Boolean(r.is_available),
      sac_code: r.sac_code,
    }));
  }

  public getMenuItemById(productId: string): MenuItemRecord | null {
    const r = this.db.prepare(`
      SELECT product_id, menu_version_id, sku, name, category, price_cents, allergens_json, image_url, is_available, sac_code
      FROM products
      WHERE product_id = ?
    `).get(productId) as any;

    if (!r) return null;

    return {
      product_id: r.product_id,
      menu_version_id: r.menu_version_id,
      sku: r.sku,
      name: r.name,
      category: r.category,
      price_cents: r.price_cents,
      allergens: JSON.parse(r.allergens_json || '[]'),
      image_url: r.image_url,
      is_available: Boolean(r.is_available),
      sac_code: r.sac_code,
    };
  }

  public getMenuItemBySku(sku: string): MenuItemRecord | null {
    const r = this.db.prepare(`
      SELECT product_id, menu_version_id, sku, name, category, price_cents, allergens_json, image_url, is_available, sac_code
      FROM products
      WHERE sku = ?
    `).get(sku) as any;

    if (!r) return null;

    return {
      product_id: r.product_id,
      menu_version_id: r.menu_version_id,
      sku: r.sku,
      name: r.name,
      category: r.category,
      price_cents: r.price_cents,
      allergens: JSON.parse(r.allergens_json || '[]'),
      image_url: r.image_url,
      is_available: Boolean(r.is_available),
      sac_code: r.sac_code,
    };
  }

  public createMenuItem(input: CreateMenuItemInput): MenuItemRecord {
    if (!input.name || !input.sku || input.price_cents === undefined) {
      throw new Error('name, sku, and price_cents are required fields.');
    }
    if (input.price_cents < 0) {
      throw new Error('price_cents cannot be negative.');
    }

    const versionId = input.menu_version_id || this.ensureActiveMenuVersion();
    const productId = input.product_id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const allergensJson = JSON.stringify(input.allergens || []);

    const stmt = this.db.prepare(`
      INSERT INTO products (
        product_id, menu_version_id, sku, name, category,
        price_cents, allergens_json, image_url, is_available, sac_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      productId,
      versionId,
      input.sku,
      input.name,
      input.category || 'General',
      input.price_cents,
      allergensJson,
      input.image_url || null,
      input.is_available !== false ? 1 : 0,
      input.sac_code || '996331'
    );

    return this.getMenuItemById(productId)!;
  }

  public updateMenuItem(productId: string, updates: UpdateMenuItemInput): MenuItemRecord {
    const existing = this.getMenuItemById(productId);
    if (!existing) {
      throw new Error(`Menu item with ID "${productId}" not found.`);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.sku !== undefined) { fields.push('sku = ?'); values.push(updates.sku); }
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.price_cents !== undefined) {
      if (updates.price_cents < 0) throw new Error('price_cents cannot be negative.');
      fields.push('price_cents = ?'); values.push(updates.price_cents);
    }
    if (updates.allergens !== undefined) {
      fields.push('allergens_json = ?'); values.push(JSON.stringify(updates.allergens));
    }
    if (updates.image_url !== undefined) { fields.push('image_url = ?'); values.push(updates.image_url); }
    if (updates.is_available !== undefined) {
      fields.push('is_available = ?'); values.push(updates.is_available ? 1 : 0);
    }
    if (updates.sac_code !== undefined) { fields.push('sac_code = ?'); values.push(updates.sac_code); }

    if (fields.length === 0) {
      return existing;
    }

    values.push(productId);
    const stmt = this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE product_id = ?`);
    stmt.run(...values);

    return this.getMenuItemById(productId)!;
  }

  public toggleItemAvailability(productId: string, isAvailable: boolean): boolean {
    const stmt = this.db.prepare('UPDATE products SET is_available = ? WHERE product_id = ?');
    const result = stmt.run(isAvailable ? 1 : 0, productId);
    return result.changes > 0;
  }

  public deleteMenuItem(productId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM products WHERE product_id = ?');
    const result = stmt.run(productId);
    return result.changes > 0;
  }
}
