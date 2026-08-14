import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: any) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: '001_initial_production_schema',
    up: (db: Database.Database) => {
      db.exec(`
        -- Migration Tracking Table
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        -- Stores Table
        CREATE TABLE IF NOT EXISTS stores (
          store_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          tax_rate_bps INTEGER NOT NULL DEFAULT 800, -- 8.00% = 800 bps
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        -- Users & Roles Table
        CREATE TABLE IF NOT EXISTS users (
          user_id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('CASHIER', 'SERVER', 'KITCHEN', 'MANAGER', 'ADMIN')),
          name TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          FOREIGN KEY (store_id) REFERENCES stores(store_id)
        );

        -- Versioned Menu Catalogs
        CREATE TABLE IF NOT EXISTS menu_versions (
          menu_version_id TEXT PRIMARY KEY,
          version_number INTEGER NOT NULL,
          published_at TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1
        );

        -- Products Table (Prices stored in integer minor units / cents)
        CREATE TABLE IF NOT EXISTS products (
          product_id TEXT PRIMARY KEY,
          menu_version_id TEXT NOT NULL,
          sku TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price_cents INTEGER NOT NULL,
          allergens_json TEXT NOT NULL DEFAULT '[]',
          image_url TEXT,
          is_available INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (menu_version_id) REFERENCES menu_versions(menu_version_id)
        );

        -- Modifiers Table
        CREATE TABLE IF NOT EXISTS modifiers (
          modifier_id TEXT PRIMARY KEY,
          menu_version_id TEXT NOT NULL,
          name TEXT NOT NULL,
          price_cents INTEGER NOT NULL DEFAULT 0,
          category TEXT NOT NULL DEFAULT 'GENERAL',
          FOREIGN KEY (menu_version_id) REFERENCES menu_versions(menu_version_id)
        );

        -- Orders Table (Authoritative State Machine)
        CREATE TABLE IF NOT EXISTS orders (
          order_id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          terminal_id TEXT NOT NULL,
          table_id TEXT,
          order_type TEXT NOT NULL CHECK(order_type IN ('DINE_IN', 'TAKEAWAY', 'DELIVERY')),
          status TEXT NOT NULL CHECK(status IN ('DRAFT', 'SENT_TO_KITCHEN', 'READY', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'VOIDED', 'REFUNDED')),
          menu_version_id TEXT NOT NULL,
          subtotal_cents INTEGER NOT NULL DEFAULT 0,
          tax_cents INTEGER NOT NULL DEFAULT 0,
          discount_cents INTEGER NOT NULL DEFAULT 0,
          total_cents INTEGER NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'USD',
          idempotency_key TEXT UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          closed_at TEXT,
          FOREIGN KEY (store_id) REFERENCES stores(store_id),
          FOREIGN KEY (menu_version_id) REFERENCES menu_versions(menu_version_id)
        );

        -- Order Line Items
        CREATE TABLE IF NOT EXISTS order_lines (
          line_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL CHECK(quantity > 0),
          unit_price_cents INTEGER NOT NULL,
          total_price_cents INTEGER NOT NULL,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(product_id)
        );

        -- Line Modifiers
        CREATE TABLE IF NOT EXISTS line_modifiers (
          line_mod_id TEXT PRIMARY KEY,
          line_id TEXT NOT NULL,
          modifier_id TEXT NOT NULL,
          modifier_name TEXT NOT NULL,
          unit_price_cents INTEGER NOT NULL,
          FOREIGN KEY (line_id) REFERENCES order_lines(line_id) ON DELETE CASCADE
        );

        -- Payments / Tenders Table (PCI Scoped: No PAN/CVV stored)
        CREATE TABLE IF NOT EXISTS payments (
          payment_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          store_id TEXT NOT NULL,
          tender_type TEXT NOT NULL CHECK(tender_type IN ('CASH', 'CARD_TERMINAL', 'EXTERNAL_AGGREGATOR')),
          amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
          change_cents INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK(status IN ('INITIATED', 'AUTHORIZED', 'SETTLED', 'DECLINED', 'REFUNDED')),
          terminal_ref TEXT,
          idempotency_key TEXT UNIQUE,
          created_at TEXT NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(order_id),
          FOREIGN KEY (store_id) REFERENCES stores(store_id)
        );

        -- Refunds & Voids Table (Append-Only Financial Corrections)
        CREATE TABLE IF NOT EXISTS refunds_and_voids (
          action_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          payment_id TEXT,
          action_type TEXT NOT NULL CHECK(action_type IN ('VOID', 'REFUND')),
          amount_cents INTEGER NOT NULL,
          reason TEXT NOT NULL,
          approved_by_user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(order_id),
          FOREIGN KEY (approved_by_user_id) REFERENCES users(user_id)
        );

        -- Cash Shifts & Drawers Table
        CREATE TABLE IF NOT EXISTS shifts (
          shift_id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          opened_at TEXT NOT NULL,
          closed_at TEXT,
          opening_float_cents INTEGER NOT NULL,
          closing_count_cents INTEGER,
          expected_cash_cents INTEGER NOT NULL DEFAULT 0,
          variance_cents INTEGER,
          status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED')),
          FOREIGN KEY (store_id) REFERENCES stores(store_id),
          FOREIGN KEY (user_id) REFERENCES users(user_id)
        );

        -- Cash Movements (Float In, Safe Drops, Petty Cash Payouts)
        CREATE TABLE IF NOT EXISTS cash_movements (
          movement_id TEXT PRIMARY KEY,
          shift_id TEXT NOT NULL,
          movement_type TEXT NOT NULL CHECK(movement_type IN ('FLOAT_IN', 'SAFE_DROP', 'PETTY_PAYOUT')),
          amount_cents INTEGER NOT NULL,
          envelope_ref TEXT,
          witness_user_id TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (shift_id) REFERENCES shifts(shift_id)
        );

        -- Kitchen Tickets
        CREATE TABLE IF NOT EXISTS kitchen_tickets (
          ticket_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          station_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'COOKING', 'BUMPED')),
          fired_at TEXT NOT NULL,
          bumped_at TEXT,
          FOREIGN KEY (order_id) REFERENCES orders(order_id)
        );

        -- Durable Print Jobs Queue (Atomic Commit with Order)
        CREATE TABLE IF NOT EXISTS print_jobs (
          job_id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL,
          printer_id TEXT NOT NULL,
          job_type TEXT NOT NULL CHECK(job_type IN ('KOT', 'RECEIPT', 'Z_REPORT')),
          payload_raw TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('PENDING', 'PRINTING', 'COMPLETED', 'FAILED')),
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(order_id)
        );

        -- Append-Only Security & Audit Events
        CREATE TABLE IF NOT EXISTS audit_events (
          event_id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          user_id TEXT,
          device_id TEXT NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          before_json TEXT,
          after_json TEXT,
          created_at TEXT NOT NULL
        );

        -- Transactional Sync Outbox (Ordered Reliable Cloud Sync)
        CREATE TABLE IF NOT EXISTS sync_outbox (
          event_id TEXT PRIMARY KEY,
          store_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          sequence_number INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          delivered_at TEXT,
          ack_token TEXT
        );

        -- Indexes for High Performance
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders(store_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_delivered ON sync_outbox(delivered_at, sequence_number);

        -- Initial Store Seed Data (Store #104 Chicago West)
        INSERT OR IGNORE INTO stores (store_id, name, currency, tax_rate_bps, status, created_at, updated_at)
        VALUES ('store-104', 'Store #104 Chicago West', 'USD', 800, 'ACTIVE', datetime('now'), datetime('now'));

        -- Seed Initial Menu Version v1
        INSERT OR IGNORE INTO menu_versions (menu_version_id, version_number, published_at, is_active)
        VALUES ('menu-v1', 1, datetime('now'), 1);

        -- Seed Products in Integer Cents
        INSERT OR IGNORE INTO products (product_id, menu_version_id, sku, name, category, price_cents, allergens_json, image_url, is_available)
        VALUES 
          ('item-101', 'menu-v1', 'PIZ-PEP-LG', 'Large Pepperoni Pizza', 'Pizzas', 1899, '["DAIRY","GLUTEN"]', '/pepperoni_pizza.jpg', 1),
          ('item-102', 'menu-v1', 'PAS-TRUF-01', 'Gourmet Truffle Tagliatelle', 'Entrees', 2150, '["DAIRY","GLUTEN"]', '/truffle_pasta.jpg', 1),
          ('item-103', 'menu-v1', 'BUR-SMASH-01', 'Gourmet Smash Burger', 'Entrees', 1650, '["DAIRY","GLUTEN"]', '/cheeseburger.jpg', 1),
          ('item-104', 'menu-v1', 'APP-WINGS-01', 'Spicy Buffalo Wings', 'Appetizers', 1299, '["DAIRY"]', '/buffalo_wings.jpg', 1),
          ('item-105', 'menu-v1', 'APP-KNOTS-01', 'Artisanal Garlic Knots', 'Appetizers', 699, '["GLUTEN"]', '/garlic_knots.jpg', 1);

        -- Seed Modifiers in Integer Cents
        INSERT OR IGNORE INTO modifiers (modifier_id, menu_version_id, name, price_cents, category)
        VALUES 
          ('mod-extra-cheese', 'menu-v1', 'Extra Mozzarella', 200, 'TOPPINGS'),
          ('mod-gluten-free', 'menu-v1', 'Gluten-Free Crust', 300, 'CRUST'),
          ('mod-no-onion', 'menu-v1', 'NO Onion', 0, 'EXCLUSIONS'),
          ('mod-well-done', 'menu-v1', 'Well Done / Crispy', 0, 'PREPARATION');

        -- Seed Initial Users (Hashed PINs: Manager = 9999, Cashier = 1234)
        -- Salted PBKDF2 hash for 9999: salt "a1b2c3d4e5f60718"
        INSERT OR IGNORE INTO users (user_id, store_id, role, name, pin_hash, is_active, created_at)
        VALUES 
          ('usr-mgr-01', 'store-104', 'MANAGER', 'Michael Smith (GM)', 'a1b2c3d4e5f60718:8e9c56f8f5370335e985b3bcf72c3d42c38d2121e784566c3a647f11818ff243', 1, datetime('now')),
          ('usr-csh-01', 'store-104', 'CASHIER', 'Sarah Jenkins (Cashier)', 'a1b2c3d4e5f60718:8e9c56f8f5370335e985b3bcf72c3d42c38d2121e784566c3a647f11818ff243', 1, datetime('now'));
      `);
    }
  }
];

export function runMigrations(db: any): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const getApplied = db.prepare('SELECT version FROM schema_migrations');
  const appliedVersions = new Set((getApplied.all() as { version: number }[]).map(r => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    }
  }
}
