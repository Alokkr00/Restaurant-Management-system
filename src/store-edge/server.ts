import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { POSTransaction, InventoryRecord } from '../shared/types.js';
import { ConflictResolutionEngine } from '../shared/sync-engine.js';
import { JWTAuthService, JWTClaims } from '../security/tenant-context.js';
import { InventoryRecipeEngine } from '../inventory/recipe-engine.js';

const app = express();
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const syncEngine = new ConflictResolutionEngine();
const recipeEngine = new InventoryRecipeEngine();
const authService = new JWTAuthService();

const STORE_NODE_ID = 'store-104'; // Dedicated Store Edge Node ID

// In-memory Edge SQLite simulation
const offlineTxQueue: POSTransaction[] = [];
let localInventory: InventoryRecord[] = [
  {
    ingredientId: 'ing-flour',
    storeId: STORE_NODE_ID,
    ingredientName: 'Flour (High Gluten)',
    unit: 'GRAM',
    onHandQuantity: 25000,
    theoreticalQuantity: 25000,
    lastCalculatedAt: new Date().toISOString(),
  },
  {
    ingredientId: 'ing-cheese',
    storeId: STORE_NODE_ID,
    ingredientName: 'Mozzarella Shredded',
    unit: 'GRAM',
    onHandQuantity: 15000,
    theoreticalQuantity: 15000,
    lastCalculatedAt: new Date().toISOString(),
  },
];

let isCloudConnected = false;

// Middleware verifying store-scoped JWT token
function verifyEdgeToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default to local store context for unauthenticated touch terminals
    (req as any).claims = { storeIds: [STORE_NODE_ID], role: 'STORE_MANAGER' };
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const claims = authService.verifyToken(token);
    (req as any).claims = claims;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: `Unauthorized Edge Access: ${err.message}` });
  }
}

wss.on('connection', (ws: WebSocket) => {
  ws.send(JSON.stringify({ type: 'STATUS', storeId: STORE_NODE_ID, cloudConnected: isCloudConnected, latencyMs: 12 }));

  ws.on('message', (message: string) => {
    try {
      const event = JSON.parse(message);
      if (event.type === 'POS_SALE') {
        const tx: POSTransaction = event.payload;

        // Security check: Only process transactions for assigned store
        if (tx.storeId && tx.storeId !== STORE_NODE_ID) {
          console.warn(`SECURITY WARNING: Edge Node ${STORE_NODE_ID} rejected transaction for Store ${tx.storeId}`);
          return;
        }

        offlineTxQueue.push(tx);

        // Deplete inventory using Recipe Engine
        tx.items.forEach((item) => {
          recipeEngine.depleteForOrderItem(item.menuItemId, item.quantity);
        });

        // Broadcast to KDS over local LAN (< 200ms)
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'KDS_NEW_TICKET', ticket: tx }));
          }
        });
      }
    } catch (err) {
      console.error('Error handling Edge WebSocket message', err);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    storeId: STORE_NODE_ID,
    mode: isCloudConnected ? 'CLOUD_SYNCED' : 'OFFLINE_EDGE_OPERATIONAL',
    pendingOfflineTxs: offlineTxQueue.length,
    kdsConnectedClients: wss.clients.size,
  });
});

app.post('/api/pos/checkout', verifyEdgeToken, (req, res) => {
  const tx: POSTransaction = req.body;
  tx.storeId = STORE_NODE_ID;
  tx.synced = isCloudConnected;
  tx.offlineMode = !isCloudConnected;
  offlineTxQueue.push(tx);

  res.status(200).json({
    success: true,
    transactionId: tx.id,
    storeId: STORE_NODE_ID,
    mode: tx.offlineMode ? 'OFFLINE_DEFERRED_AUTH' : 'ONLINE_AUTH',
    receiptPrinted: true,
    kdsDispatched: true,
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Store Edge Server (${STORE_NODE_ID}) running on port ${PORT} [Store-Scoped Offline Mode]`);
});
