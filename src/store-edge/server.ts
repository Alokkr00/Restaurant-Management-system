import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { POSTransaction, MenuItem } from '../shared/types.js';
import { ESCPOSThermalPrinterDriver, PrinterStationConfig } from '../hardware/escpos-printer.js';
import { JWTAuthService } from '../security/tenant-context.js';
import { InventoryRecipeEngine } from '../inventory/recipe-engine.js';
import { TableFloorPlanEngine } from '../pos/table-floor-plan.js';
import { PurchaseOrderEngine } from '../inventory/purchase-order-engine.js';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const STORE_NODE_ID = process.env.STORE_ID || 'store-104';
const printerDriver = new ESCPOSThermalPrinterDriver();
const recipeEngine = new InventoryRecipeEngine();
const authService = new JWTAuthService();
const floorPlanEngine = new TableFloorPlanEngine();
const poEngine = new PurchaseOrderEngine();

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

// Prepared statement cache for high-throughput non-blocking operations
const insertTxStmt = db.prepare(
  'INSERT INTO pos_transactions (id, store_id, terminal_id, timestamp, payload_json, subtotal, tax, total, synced, offline_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
const getPendingSyncStmt = db.prepare('SELECT id, payload_json FROM pos_transactions WHERE synced = 0 ORDER BY timestamp ASC LIMIT 50');
const countPendingSyncStmt = db.prepare('SELECT COUNT(*) as count FROM pos_transactions WHERE synced = 0');
const markTxSyncedStmt = db.prepare('UPDATE pos_transactions SET synced = 1, offline_mode = 0 WHERE id = ?');

// Hardware Printer Station Configurations
const primaryHotlinePrinter: PrinterStationConfig = {
  stationId: 'print-hotline-1',
  stationName: 'Hotline Kitchen Station 1',
  ip: '192.168.1.150',
  port: 9100,
  fallbackStationId: 'print-expo-backup',
};

const fallbackExpoPrinter: PrinterStationConfig = {
  stationId: 'print-expo-backup',
  stationName: 'Expo Backup Printer',
  ip: '192.168.1.151',
  port: 9100,
};

let isCloudConnected = false;
let lastSyncTimestamp: string | null = null;
let syncCycleCount = 0;

// Background Cloud Sync Worker: Asynchronously flushes offline transactions (synced = 0) to HQ
async function runCloudSyncWorkerCycle(): Promise<{ flushedCount: number; remainingCount: number }> {
  try {
    const pendingRows = getPendingSyncStmt.all() as { id: string; payload_json: string }[];
    if (pendingRows.length === 0) {
      return { flushedCount: 0, remainingCount: 0 };
    }

    // In a live deployment, this dispatches a batch payload to HQ Fastify / NATS JetStream
    // Simulated cloud ingestion with transaction acknowledgement
    const syncedIds: string[] = [];
    const transaction = db.transaction((rows: typeof pendingRows) => {
      for (const row of rows) {
        markTxSyncedStmt.run(row.id);
        syncedIds.push(row.id);
      }
    });

    transaction(pendingRows);
    lastSyncTimestamp = new Date().toISOString();
    syncCycleCount++;

    // Broadcast sync status update to all connected POS / KDS clients
    const pendingCount = (countPendingSyncStmt.get() as any).count;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'SYNC_FLUSHED',
            flushedCount: syncedIds.length,
            remainingPending: pendingCount,
            lastSyncTimestamp,
          })
        );
      }
    });

    return { flushedCount: syncedIds.length, remainingCount: pendingCount };
  } catch (err) {
    console.error('EdgeCloudSyncWorker error:', err);
    return { flushedCount: 0, remainingCount: (countPendingSyncStmt.get() as any).count };
  }
}

// Start background worker polling loop every 5 seconds
const syncInterval = setInterval(() => {
  if (isCloudConnected) {
    runCloudSyncWorkerCycle();
  }
}, 5000);

// In-Memory Fallback Menu Data
let menuItems: MenuItem[] = [
  { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, hierarchyLevel: 'GLOBAL', targetId: 'global', currency: 'USD', version: 3, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 2200, proteinGrams: 90, carbsGrams: 210, fatGrams: 95 } },
  { id: 'item-102', sku: 'PIZ-MAR-LG', name: 'Margherita Artisanal', category: 'Pizzas', basePrice: 16.50, allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, hierarchyLevel: 'GLOBAL', targetId: 'global', currency: 'USD', version: 2, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 1800, proteinGrams: 70, carbsGrams: 190, fatGrams: 75 } },
  { id: 'item-103', sku: 'APP-WNG-10', name: 'Spicy Buffalo Wings (10pc)', category: 'Appetizers', basePrice: 14.99, allergens: [], isBrandLocked: false, hierarchyLevel: 'REGION', targetId: 'region-chicago', currency: 'USD', version: 1, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 950, proteinGrams: 65, carbsGrams: 12, fatGrams: 60 } },
  { id: 'item-104', sku: 'APP-KNOT-6', name: 'Craft Garlic Knots (6pc)', category: 'Appetizers', basePrice: 6.99, allergens: ['GLUTEN'], isBrandLocked: true, hierarchyLevel: 'GLOBAL', targetId: 'global', currency: 'USD', version: 4, updatedAt: new Date().toISOString(), nutritionalInfo: { calories: 540, proteinGrams: 14, carbsGrams: 80, fatGrams: 22 } },
];

// WebSocket real-time LAN ticket router (< 200ms)
wss.on('connection', (ws: WebSocket) => {
  const pendingCount = (countPendingSyncStmt.get() as any).count;
  ws.send(
    JSON.stringify({
      type: 'STATUS',
      storeId: STORE_NODE_ID,
      walActive: true,
      cloudConnected: isCloudConnected,
      pendingOfflineTxs: pendingCount,
      lastSyncTimestamp,
    })
  );

  ws.on('message', (message: string) => {
    try {
      const event = JSON.parse(message);
      if (event.type === 'POS_SALE') {
        const tx: POSTransaction = event.payload;

        // Persist to physical SQLite WAL database
        insertTxStmt.run(
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
  const pendingCount = (countPendingSyncStmt.get() as any).count;
  res.json({
    status: 'ONLINE',
    storeId: STORE_NODE_ID,
    sqliteWalMode: true,
    mode: isCloudConnected ? 'CLOUD_SYNCED' : 'OFFLINE_EDGE_OPERATIONAL',
    cloudConnected: isCloudConnected,
    pendingOfflineTxs: pendingCount,
    lastSyncTimestamp,
    syncCycleCount,
    syncWorkerActive: true,
    kdsConnectedClients: wss.clients.size,
  });
});

app.get('/api/menu', (req, res) => {
  res.json({ success: true, storeId: STORE_NODE_ID, menuItems });
});

// Manual or automated cloud sync flush endpoint
app.post('/api/sync/trigger', async (req, res) => {
  isCloudConnected = true;
  const result = await runCloudSyncWorkerCycle();
  res.json({
    success: true,
    message: `Flushed ${result.flushedCount} offline transactions to cloud.`,
    remainingPending: result.remainingCount,
    lastSyncTimestamp,
  });
});

// Toggle network state (simulate online vs offline WAN drop)
app.post('/api/network/toggle', (req, res) => {
  isCloudConnected = !isCloudConnected;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'NETWORK_STATE_CHANGED', cloudConnected: isCloudConnected }));
    }
  });
  res.json({ success: true, cloudConnected: isCloudConnected });
});

// ─── Table Floor Plan Endpoints ──────────────────────────────────────────
app.get('/api/tables', (req, res) => {
  res.json({ success: true, tables: floorPlanEngine.getFloorPlan() });
});

app.post('/api/tables/seat', (req, res) => {
  try {
    const { tableId, covers, serverName } = req.body;
    const ticket = floorPlanEngine.seatTable(tableId, covers, serverName || 'Server 1', STORE_NODE_ID);
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/tables/hold', (req, res) => {
  try {
    const { ticketId, items } = req.body;
    const ticket = floorPlanEngine.holdItems(ticketId, items);
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/tables/fire', (req, res) => {
  try {
    const { ticketId } = req.body;
    const result = floorPlanEngine.fireCourse(ticketId);

    // Broadcast fired items to KDS over LAN WebSockets
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'KDS_NEW_TICKET',
          ticket: {
            id: ticketId,
            source: 'Table Floor Service',
            station: 'HOTLINE_1',
            items: result.firedItems.map(i => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
              unitPrice: 10,
              modifiers: i.modifiers || [],
            })),
            subtotal: 0,
            tax: 0,
            total: 0,
            tenders: [],
            offlineMode: !isCloudConnected,
            synced: isCloudConnected,
          }
        }));
      }
    });

    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/tables/transfer', (req, res) => {
  try {
    const { fromTableId, toTableId, authorizedBy } = req.body;
    const record = floorPlanEngine.transferTable(fromTableId, toTableId, authorizedBy || 'Manager');
    res.json({ success: true, record });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/tables/close', (req, res) => {
  try {
    const { tableId, payments } = req.body;
    const result = floorPlanEngine.closeTable(tableId, payments || [{ type: 'CASH', amount: 999 }]);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Purchase Order & Inventory Endpoints ────────────────────────────────
app.get('/api/inventory/suppliers', (req, res) => {
  res.json({ success: true, suppliers: poEngine.listSuppliers() });
});

app.get('/api/inventory/pos', (req, res) => {
  res.json({ success: true, purchaseOrders: poEngine.listPurchaseOrders(STORE_NODE_ID) });
});

app.post('/api/inventory/pos', (req, res) => {
  try {
    const { supplierId, lineItems, expectedDeliveryDate, notes } = req.body;
    const po = poEngine.createPurchaseOrder(supplierId, STORE_NODE_ID, lineItems, expectedDeliveryDate, notes);
    res.json({ success: true, purchaseOrder: po });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory/pos/receive', (req, res) => {
  try {
    const { poId, receivedBy, actualReceived } = req.body;
    const grn = poEngine.receivePurchaseOrder(poId, receivedBy || 'Store Staff', actualReceived);
    res.json({ success: true, grn });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory/stock', (req, res) => {
  res.json({ success: true, stockLevels: poEngine.getStockLevels() });
});

app.post('/api/inventory/stock-take', (req, res) => {
  try {
    const { counts } = req.body;
    const variances = poEngine.runStockTake(STORE_NODE_ID, counts);
    res.json({ success: true, variances });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/pos/checkout', async (req, res) => {
  try {
    const tx: POSTransaction = req.body;
    tx.storeId = STORE_NODE_ID;
    tx.synced = isCloudConnected;
    tx.offlineMode = !isCloudConnected;

    // Persist to physical SQLite WAL database atomically
    insertTxStmt.run(
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

    // Dispatch to Thermal Printer with Station Fallback
    const printResult = await printerDriver.printWithFallback(
      primaryHotlinePrinter,
      fallbackExpoPrinter,
      {
        storeName: 'Store #104 Chicago West',
        ticketId: tx.id,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        items: tx.items.map((i) => ({
          name: i.menuItemId === 'item-101' ? 'Large Pepperoni Pizza' : 'Spicy Buffalo Wings',
          qty: i.quantity,
          price: i.unitPrice,
        })),
        subtotal: tx.subtotal,
        tax: tx.tax,
        total: tx.total,
      }
    );

    // If printing had to fallback, notify KDS / Terminals
    if (printResult.wasRerouted) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: 'HARDWARE_ALERT',
              level: 'WARNING',
              message: printResult.message,
            })
          );
        }
      });
    }

    // Broadcast ticket over LAN WebSocket (< 200ms)
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
      printerResult: printResult,
      mode: tx.offlineMode ? 'OFFLINE_DEFERRED_AUTH' : 'ONLINE_AUTH',
    });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ success: false, error: 'Duplicate transaction ID', id: req.body?.id });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Store Edge Server (${STORE_NODE_ID}) running on port ${PORT} [SQLite WAL + Background Sync Worker Active]`);
});
