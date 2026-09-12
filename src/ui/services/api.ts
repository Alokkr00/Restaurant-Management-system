const EDGE_SERVER_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:3001`
  : 'http://127.0.0.1:3001';

interface RequestOptions extends RequestInit {
  timeout?: number;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const timeoutMs = options.timeout || 8000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${EDGE_SERVER_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

export const StoreAPI = {
  // Telemetry
  checkHealth: () => apiFetch('/health'),

  // Menu Catalog
  getMenu: () => apiFetch('/api/menu'),
  addMenuItem: (item: any) => apiFetch('/api/menu/items', { method: 'POST', body: JSON.stringify(item) }),

  // Table Floor Plan
  getTables: () => apiFetch('/api/tables'),
  seatTable: (data: { tableId: string; covers: number; serverName: string }) =>
    apiFetch('/api/tables/seat', { method: 'POST', body: JSON.stringify(data) }),
  fireTable: (data: { tableId: string; course: string }) =>
    apiFetch('/api/tables/fire', { method: 'POST', body: JSON.stringify(data) }),
  closeTable: (data: { tableId: string }) =>
    apiFetch('/api/tables/close', { method: 'POST', body: JSON.stringify(data) }),

  // Kitchen Display System (KDS)
  getKDSTickets: () => apiFetch('/api/kds/tickets'),
  bumpTicket: (ticketId: string) =>
    apiFetch(`/api/kds/tickets/${ticketId}/bump`, { method: 'POST' }),

  // Cash Drawer
  getDrawer: () => apiFetch('/api/cash/drawer'),
  safeDrop: (data: { amount: number; witness: string; notes?: string }) =>
    apiFetch('/api/cash/drop', { method: 'POST', body: JSON.stringify(data) }),
  payout: (data: { amount: number; reason: string; approvedBy: string }) =>
    apiFetch('/api/cash/payout', { method: 'POST', body: JSON.stringify(data) }),

  // Inventory & Purchasing
  getPurchaseOrders: () => apiFetch('/api/inventory/pos'),
  getSuppliers: () => apiFetch('/api/inventory/suppliers'),
  getStock: () => apiFetch('/api/inventory/stock'),
  getWasteLogs: () => apiFetch('/api/inventory/waste'),
  logWaste: (data: { item: string; qty: string; reason: string; costUSD: number }) =>
    apiFetch('/api/inventory/waste', { method: 'POST', body: JSON.stringify(data) }),
  getRecipes: () => apiFetch('/api/inventory/recipes'),

  // Labor & Shifts
  getLabor: () => apiFetch('/api/labor/shifts'),
  toggleClock: (employeeId: string, clockIn: boolean) =>
    apiFetch('/api/labor/clock', { method: 'POST', body: JSON.stringify({ employeeId, clockIn }) }),

  // Financials & NetSuite GL
  getFinancials: () => apiFetch('/api/financials/ledger'),

  // POS Checkout
  checkout: (orderData: any) =>
    apiFetch('/api/pos/checkout', { method: 'POST', body: JSON.stringify(orderData) }),

  // Training Mode & Support
  toggleTrainingMode: (enabled: boolean) =>
    apiFetch('/api/v1/training-mode', { method: 'POST', body: JSON.stringify({ trainingMode: enabled }) }),
  getSupportBundle: () => apiFetch('/api/v1/support/bundle')
};
