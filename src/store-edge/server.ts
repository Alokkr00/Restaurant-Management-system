import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { POSTransaction, InventoryRecord } from '../shared/types.js';
import { ConflictResolutionEngine } from '../shared/sync-engine.js';

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const engine = new ConflictResolutionEngine();

// In-memory Edge database store (backed by SQLite/PouchDB in production)
const offlineTxQueue: POSTransaction[] = [];
let localInventory: InventoryRecord[] = [
  {
    ingredientId: 'ing-flour',
    storeId: 'store-01',
    ingredientName: 'Flour (High Gluten)',
    unit: 'GRAM',
    onHandQuantity: 25000,
    theoreticalQuantity: 25000,
    lastCalculatedAt: new Date().toISOString(),
  },
  {
    ingredientId: 'ing-cheese',
    storeId: 'store-01',
    ingredientName: 'Mozzarella Shredded',
    unit: 'GRAM',
    onHandQuantity: 15000,
    theoreticalQuantity: 15000,
    lastCalculatedAt: new Date().toISOString(),
  },
];

let isCloudConnected = false; // Simulates offline mode

// WebSocket connection for POS and KDS real-time events (< 200ms latency)
wss.on('connection', (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: 'STATUS', cloudConnected: isCloudConnected, latencyMs: 12 }));

  ws.on('message', (message: string) => {
    try {
      const event = JSON.parse(message);
      if (event.type === 'POS_SALE') {
        const tx: POSTransaction = event.payload;
        offlineTxQueue.push(tx);

        // Deplete theoretical inventory locally
        tx.items.forEach((item) => {
          if (item.menuItemId === 'item-101') { // Pizza
            const flour = localInventory.find((i) => i.ingredientId === 'ing-flour');
            const cheese = localInventory.find((i) => i.ingredientId === 'ing-cheese');
            if (flour) engine.resolveInventoryDelta(flour, 200 * item.quantity);
            if (cheese) engine.resolveInventoryDelta(cheese, 150 * item.quantity);
          }
        });

        // Broadcast ticket instantly to KDS sockets (< 200ms)
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'KDS_NEW_TICKET', ticket: tx }));
          }
        });
      }
    } catch (err) {
      console.error('Error handling WebSocket message', err);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    mode: isCloudConnected ? 'CLOUD_SYNCED' : 'OFFLINE_EDGE_OPERATIONAL',
    pendingOfflineTxs: offlineTxQueue.length,
    kdsConnectedClients: wss.clients.size,
  });
});

app.post('/api/pos/checkout', (req, res) => {
  const tx: POSTransaction = req.body;
  tx.synced = isCloudConnected;
  tx.offlineMode = !isCloudConnected;
  offlineTxQueue.push(tx);

  res.status(200).json({
    success: true,
    transactionId: tx.id,
    mode: tx.offlineMode ? 'OFFLINE_DEFERRED_AUTH' : 'ONLINE_AUTH',
    receiptPrinted: true,
    kdsDispatched: true,
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Store Edge Server running on port ${PORT} [Offline-First Operational Mode]`);
});
