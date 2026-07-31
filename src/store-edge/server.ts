import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { POSTransaction, MenuItem } from '../shared/types.js';
import { ESCPOSThermalPrinterDriver } from '../hardware/escpos-printer.js';
import { JWTAuthService } from '../security/tenant-context.js';
import { InventoryRecipeEngine } from '../inventory/recipe-engine.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const STORE_NODE_ID = 'store-104';
const printerDriver = new ESCPOSThermalPrinterDriver();
const recipeEngine = new InventoryRecipeEngine();
const authService = new JWTAuthService();

// Initialize Physical SQLite Engine in Write-Ahead Logging (WAL) Mode
const dbPath = path.resolve(process.cwd(), 'store-edge.db');
const db = new Database(dbPath);

// Enforce SQLite WAL Mode for High-Performance Fault Tolerance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize Database Schemas
db.exec(`
  CREATE TABLE IF NOT EXISTS store_config (
    store_id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    region_id TEXT NOT NULL,
    config_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pos_transactions (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    terminal_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    subtotal REAL NOT NULL,
    tax REAL NOT NULL,
    total REAL NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    offline_mode INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit_ledger (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    hash TEXT NOT NULL
  );
`);

// Insert default store config if empty
const configCheck = db.prepare('SELECT store_id FROM store_config WHERE store_id = ?').get(STORE_NODE_ID);
if (!configCheck) {
  db.prepare('INSERT INTO store_config (store_id, brand_id, region_id, config_json, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    STORE_NODE_ID,
    'brand-pizza-co',
    'region-chicago',
    JSON.stringify({ name: 'Store #104 Chicago West', targetLaborPct: 22.0 }),
    new Date().toISOString()
  );
}

// In-Memory Fallback & Menu Data
let menuItems: MenuItem[] = [
  { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, hierarchyLevel: 'GLOBAL', targetId: 'global', currency: 'USD', version: 3, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 2200, proteinGrams: 90, carbsGrams: 210, fatGrams: 95 } },
  { id: 'item-102', sku: 'PIZ-MAR-LG', name: 'Margherita Artisanal', category: 'Pizzas', basePrice: 16.50, allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, hierarchyLevel: 'GLOBAL', targetId: 'global', currency: 'USD', version: 2, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 1800, proteinGrams: 70, carbsGrams: 190, fatGrams: 75 } },
  { id: 'item-103', sku: 'APP-WNG-10', name: 'Spicy Buffalo Wings (10pc)', category: 'Appetizers', basePrice: 14.99, allergens: [], isBrandLocked: false, hierarchyLevel: 'REGION', targetId: 'region-chicago', currency: 'USD', version: 1, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 950, proteinGrams: 65, carbsGrams: 12, fatGrams: 60 } },
  { id: 'item-104', sku: 'APP-KNOT-6', name: 'Craft Garlic Knots (6pc)', category: 'Appetizers', basePrice: 6.99, allergens: ['GLUTEN'], isBrandLocked: true, hierarchyLevel: 'GLOBAL', targetId: 'global', currency: 'USD', version: 4, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 540, proteinGrams: 14, carbsGrams: 80, fatGrams: 22 } },
];

let isCloudConnected = false;

// WebSocket real-time LAN ticket router (< 200ms)
wss.on('connection', (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: 'STATUS', storeId: STORE_NODE_ID, walActive: true, cloudConnected: isCloudConnected }));

  ws.on('message', (message: string) => {
    try {
      const event = JSON.parse(message);
      if (event.type === 'POS_SALE') {
        const tx: POSTransaction = event.payload;

        // Persist to physical SQLite WAL database
        db.prepare('INSERT INTO pos_transactions (id, store_id, terminal_id, timestamp, payload_json, subtotal, tax, total, synced, offline_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          tx.id,
          STORE_NODE_ID,
          tx.terminalId || 'pos-1',
          tx.timestamp || new Date().toISOString(),
          JSON.stringify(tx),
          tx.subtotal,
          tx.tax,
          tx.total,
          isCloudConnected ? 1 : 0,
          isCloudConnected ? 0 : 1
        );

        // Broadcast ticket instantly over LAN WebSocket
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'KDS_NEW_TICKET', ticket: tx }));
          }
        });
      }
    } catch (err) {
      console.error('Error handling WebSocket message', err);
    }
  });
});

// REST API Endpoints
app.get('/health', (req, res) => {
  const pendingCount = (db.prepare('SELECT COUNT(*) as count FROM pos_transactions WHERE synced = 0').get() as any).count;
  res.json({
    status: 'ONLINE',
    storeId: STORE_NODE_ID,
    sqliteWalMode: true,
    mode: isCloudConnected ? 'CLOUD_SYNCED' : 'OFFLINE_EDGE_OPERATIONAL',
    pendingOfflineTxs: pendingCount,
    kdsConnectedClients: wss.clients.size,
  });
});

app.get('/api/menu', (req, res) => {
  res.json({ success: true, storeId: STORE_NODE_ID, menuItems });
});

app.post('/api/pos/checkout', (req, res) => {
  const tx: POSTransaction = req.body;
  tx.storeId = STORE_NODE_ID;
  tx.synced = isCloudConnected;
  tx.offlineMode = !isCloudConnected;

  // Persist to physical SQLite WAL database
  db.prepare('INSERT INTO pos_transactions (id, store_id, terminal_id, timestamp, payload_json, subtotal, tax, total, synced, offline_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    tx.id,
    STORE_NODE_ID,
    tx.terminalId || 'pos-1',
    tx.timestamp || new Date().toISOString(),
    JSON.stringify(tx),
    tx.subtotal,
    tx.tax,
    tx.total,
    isCloudConnected ? 1 : 0,
    isCloudConnected ? 0 : 1
  );

  // Generate ESC/POS Thermal Receipt Buffer
  const receiptBuffer = printerDriver.generateReceiptBuffer({
    storeName: 'Store #104 Chicago West',
    ticketId: tx.id,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    items: tx.items.map(i => ({ name: i.menuItemId === 'item-101' ? 'Large Pepperoni Pizza' : 'Spicy Buffalo Wings', qty: i.quantity, price: i.unitPrice })),
    subtotal: tx.subtotal,
    tax: tx.tax,
    total: tx.total,
  });

  // Broadcast ticket over LAN WebSocket
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'KDS_NEW_TICKET', ticket: tx }));
    }
  });

  res.status(200).json({
    success: true,
    transactionId: tx.id,
    storeId: STORE_NODE_ID,
    sqliteWalPersisted: true,
    escposBufferBytes: receiptBuffer.length,
    mode: tx.offlineMode ? 'OFFLINE_DEFERRED_AUTH' : 'ONLINE_AUTH',
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Store Edge Server (${STORE_NODE_ID}) running on port ${PORT} [SQLite WAL Persistence Active]`);
});
