import express from 'express';
import cors from 'cors';
import { HierarchicalInheritanceEngine } from './inheritance-engine.js';
import { MultiBrandGhostKitchenRouter } from './multi-brand-router.js';
import { TenantHierarchicalInheritanceEngine } from './tenant-inheritance-engine.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.HQ_PORT || 4000;

const inheritanceEngine = new HierarchicalInheritanceEngine();
const tenantInheritance = new TenantHierarchicalInheritanceEngine();
const ghostKitchenRouter = new MultiBrandGhostKitchenRouter();

// In-memory log of synced store batches
const syncedStoreBatches: Array<{ storeId: string; batchCount: number; timestamp: string }> = [];

// HQ Health Endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'HQ Cloud Central Ingestion Service',
    port: PORT,
    syncedBatchesReceived: syncedStoreBatches.length,
    timestamp: new Date().toISOString(),
  });
});

// Store Edge Sync Ingestion Endpoint
app.post('/api/v1/sync/ingest', (req, res) => {
  const { storeId, transactions } = req.body;
  const count = Array.isArray(transactions) ? transactions.length : 0;

  syncedStoreBatches.push({
    storeId: storeId || 'unknown',
    batchCount: count,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    acknowledgedCount: count,
    hqReceivedAt: new Date().toISOString(),
  });
});

// Multi-Brand Ghost Kitchen Order Routing Endpoint
app.post('/api/v1/orders/route', (req, res) => {
  const { brandId, transaction } = req.body;
  if (!transaction) {
    return res.status(400).json({ success: false, error: 'Transaction payload required.' });
  }

  const routed = ghostKitchenRouter.routeOrder(brandId || 'brand-pizza', transaction);
  res.json({ success: true, routedOrder: routed });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[HQ-Cloud] Central Ingestion & Multi-Brand Service listening on port ${PORT}`);
  });
}

export { app };
