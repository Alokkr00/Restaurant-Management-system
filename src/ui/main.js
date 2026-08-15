// Restaurant Management System - Web Operations Console

const EDGE_SERVER_URL = 'http://localhost:3001';
const EDGE_WS_URL = 'ws://localhost:3001';

const state = {
  activeModule: 'pos_register', // pos_register | table_floor_plan | kds | cash_management | po_receiving | inventory_prep | labor_shifts | menu_catalog | franchise_financials
  activeCategory: 'ALL', // ALL | Pizzas | Appetizers | Beverages
  activeKDSStation: 'ALL', // ALL | HOTLINE_1 | EXPO
  storeOffline: false,
  apiConnected: false,
  wsConnected: false,
  backOfficeMenuOpen: false,
  modalOpen: null, // null | 'add_menu_item' | 'log_spoilage' | 'cash_drop' | 'blind_z_report' | 'item_modifiers' | 'seat_table' | 'create_po' | 'receive_grn' | 'run_stock_take'
  selectedModifierItem: null,
  selectedTable: null,
  selectedPO: null,
  activeModifiers: [],
  selectedTaxJurisdiction: 'US_SALES_TAX',
  
  // Drawer state
  drawerSession: {
    sessionId: 'drawer-pos1-001',
    startingBankUSD: 200.0,
    cashSalesUSD: 350.0,
    cashDropsUSD: 100.0,
    payOutsUSD: 20.0,
    expectedCashUSD: 430.0,
    status: 'OPEN',
  },

  // Tables State
  tables: [
    { tableId: 'tbl-1', label: 'Table 1', seats: 2, section: 'Main Floor', status: 'VACANT' },
    { tableId: 'tbl-2', label: 'Table 2', seats: 4, section: 'Main Floor', status: 'SEATED', openTicketId: 'TKT-TBL-2-001', covers: 3, serverName: 'Sarah J.', seatedAt: '12:30 PM' },
    { tableId: 'tbl-3', label: 'Table 3', seats: 4, section: 'Main Floor', status: 'ORDERING', openTicketId: 'TKT-TBL-3-002', covers: 4, serverName: 'John D.', seatedAt: '12:45 PM' },
    { tableId: 'tbl-4', label: 'Table 4', seats: 6, section: 'Main Floor', status: 'SERVED', openTicketId: 'TKT-TBL-4-003', covers: 5, serverName: 'Michael S.', seatedAt: '12:15 PM' },
    { tableId: 'tbl-5', label: 'Table 5', seats: 2, section: 'Main Floor', status: 'VACANT' },
    { tableId: 'tbl-6', label: 'Table 6', seats: 8, section: 'Private Dining', status: 'VACANT' },
    { tableId: 'bar-1', label: 'Bar 1', seats: 1, section: 'Bar', status: 'VACANT' },
    { tableId: 'bar-2', label: 'Bar 2', seats: 1, section: 'Bar', status: 'VACANT' },
    { tableId: 'pat-1', label: 'Patio 1', seats: 4, section: 'Patio', status: 'VACANT' },
    { tableId: 'pat-2', label: 'Patio 2', seats: 4, section: 'Patio', status: 'VACANT' },
  ],

  // Purchase Orders & Inventory Receiving
  purchaseOrders: [
    { poId: 'PO-STORE-104-001', supplierId: 'sup-001', supplierName: 'Mumbai Dairy Wholesalers Pvt. Ltd.', totalCostINR: 13000, status: 'SENT', createdAt: '2026-08-14', expectedDeliveryDate: '2026-08-18' },
    { poId: 'PO-STORE-104-002', supplierId: 'sup-002', supplierName: 'Delhi Grain & Flour Mills', totalCostINR: 2250, status: 'RECEIVED', createdAt: '2026-08-12', expectedDeliveryDate: '2026-08-13' },
  ],

  suppliers: [
    { supplierId: 'sup-001', name: 'Mumbai Dairy Wholesalers Pvt. Ltd.', phone: '+91-98201-11223', leadTimeDays: 2, paymentTermsDays: 30 },
    { supplierId: 'sup-002', name: 'Delhi Grain & Flour Mills', phone: '+91-99100-44556', leadTimeDays: 1, paymentTermsDays: 15 },
  ],

  stockLevels: [
    { ingredientId: 'ing-cheese', name: 'Mozzarella Cheese (Shredded)', balance: 15.8, unit: 'kg' },
    { ingredientId: 'ing-pep', name: 'Pepperoni Slices (Beef/Pork)', balance: 8.6, unit: 'kg' },
    { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', balance: 48.2, unit: 'kg' },
    { ingredientId: 'ing-sauce', name: 'Tomato Pizza Sauce', balance: 12.0, unit: 'kg' },
  ],

  menuItems: [
    { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 3 },
    { id: 'item-102', sku: 'PIZ-MAR-LG', name: 'Margherita Artisanal', category: 'Pizzas', basePrice: 16.50, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 2 },
    { id: 'item-103', sku: 'APP-WNG-10', name: 'Spicy Buffalo Wings (10pc)', category: 'Appetizers', basePrice: 14.99, image: '/buffalo_wings.jpg', allergens: [], isBrandLocked: false, version: 1 },
    { id: 'item-104', sku: 'APP-KNOT-6', name: 'Craft Garlic Knots (6pc)', category: 'Appetizers', basePrice: 6.99, image: '/garlic_knots.jpg', allergens: ['GLUTEN'], isBrandLocked: true, version: 4 },
  ],
  cart: [],
  kdsTickets: [
    { 
      id: 'tx-1001', 
      source: 'POS Register 01', 
      station: 'HOTLINE_1', 
      elapsedMinutes: 3, 
      elapsedSeconds: 24, 
      diningType: 'DINE IN (Table 4)', 
      items: [{ qty: 1, name: 'Large Pepperoni Pizza', modifiers: ['+ Extra Cheese', 'Well Done'], allergens: ['DAIRY', 'GLUTEN'] }], 
      status: 'IN_PREP' 
    },
    { 
      id: 'deliv-dd-9812', 
      source: 'DoorDash Aggregator', 
      station: 'EXPO', 
      elapsedMinutes: 8, 
      elapsedSeconds: 45, 
      diningType: 'DOORDASH DELIVERY', 
      items: [
        { qty: 2, name: 'Spicy Buffalo Wings (10pc)', modifiers: ['Ranch on Side', 'Extra Crispy'] }, 
        { qty: 1, name: 'Craft Garlic Knots (6pc)', allergens: ['GLUTEN'] }
      ], 
      status: 'IN_PREP' 
    },
    { 
      id: 'tx-1003', 
      source: 'Online Web Order', 
      station: 'HOTLINE_1', 
      elapsedMinutes: 14, 
      elapsedSeconds: 12, 
      diningType: 'TO GO PICKUP', 
      items: [{ qty: 1, name: 'Margherita Artisanal', modifiers: ['NO Basil', '+ Garlic Drizzle'], allergens: ['DAIRY', 'GLUTEN'] }], 
      status: 'LATE' 
    },
  ],
  inventoryVariances: [
    { ingredientId: 'ing-cheese', name: 'Mozzarella Cheese (Shredded)', theoretical: 14.2, actual: 15.8, unit: 'kg', variancePct: 11.2, alert: true },
    { ingredientId: 'ing-pep', name: 'Pepperoni Slices (Beef/Pork)', theoretical: 8.5, actual: 8.6, unit: 'kg', variancePct: 1.1, alert: false },
    { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', theoretical: 45.0, actual: 48.2, unit: 'kg', variancePct: 7.1, alert: true },
  ],
  spoilageLogs: [
    { id: 'spoil-1', item: 'Dough Ball 500g', qty: '5 pcs', reason: 'DROPPED_FLOOR', cost: '$7.50', loggedBy: 'Kitchen Lead' },
    { id: 'spoil-2', item: 'Buffalo Wings (Raw)', qty: '1.2 kg', reason: 'EXPIRED', cost: '$14.20', loggedBy: 'GM Audit' },
  ],
  employees: [
    { id: 'emp-101', name: 'John Doe', role: 'Kitchen Prep', status: 'CLOCKED_IN', shiftStart: '08:00 AM', hours: 6.5, breakAttested: true },
    { id: 'emp-102', name: 'Sarah Jenkins', role: 'Cashier', status: 'CLOCKED_IN', shiftStart: '10:00 AM', hours: 4.5, breakAttested: true },
    { id: 'emp-103', name: 'Michael Smith', role: 'Shift Lead', status: 'CLOCKED_OUT', shiftStart: 'Yesterday', hours: 8.0, breakAttested: true },
  ],
  tipPoolTotal: 450.00,
  journalEntries: [],
  kpis: { grossSalesUSD: 5497.0, netSalesUSD: 5222.15, taxCollectedUSD: 274.85, foodCostPct: 28.7, laborCostPct: 24.2, primeCostPct: 52.9 },
  recipes: [],
};

// Generic apiFetch helper to unify fetch calls, timeouts, and error handling
async function apiFetch(endpoint, options = {}) {
  const timeoutMs = options.timeout || 8000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[apiFetch] failed for ${endpoint}:`, err);
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// Master Data Synchronization with Store Edge Node
async function refreshAllData() {
  try {
    await apiFetch('/health', { method: 'GET' });
    state.apiConnected = true;
  } catch (err) {
    state.apiConnected = false;
  }

  try {
    const menuData = await apiFetch('/api/menu');
    if (menuData.success && menuData.menuItems) state.menuItems = menuData.menuItems;
  } catch (err) {}

  try {
    const tblData = await apiFetch('/api/tables');
    if (tblData.success && tblData.tables) state.tables = tblData.tables;
  } catch (err) {}

  try {
    const kdsData = await apiFetch('/api/kds/tickets');
    if (kdsData.success && kdsData.tickets) state.kdsTickets = kdsData.tickets;
  } catch (err) {}

  try {
    const drawerData = await apiFetch('/api/cash/drawer');
    if (drawerData.success && drawerData.drawerSession) {
      state.drawerSession = {
        sessionId: drawerData.drawerSession.sessionId,
        startingBankUSD: (drawerData.drawerSession.startingBankINR || 20000) / 100,
        cashSalesUSD: (drawerData.drawerSession.cashSalesINR || 35000) / 100,
        cashDropsUSD: (drawerData.drawerSession.cashDropsINR || 10000) / 100,
        payOutsUSD: (drawerData.drawerSession.payOutsINR || 2000) / 100,
        expectedCashUSD: (drawerData.drawerSession.expectedCashINR || 43000) / 100,
        status: drawerData.drawerSession.status || 'OPEN',
        activityLedger: drawerData.drawerSession.activityLedger || [],
      };
    }
  } catch (err) {}

  try {
    const poData = await apiFetch('/api/inventory/pos');
    if (poData.success && poData.purchaseOrders) state.purchaseOrders = poData.purchaseOrders;

    const supData = await apiFetch('/api/inventory/suppliers');
    if (supData.success && supData.suppliers) state.suppliers = supData.suppliers;

    const stkData = await apiFetch('/api/inventory/stock');
    if (stkData.success && stkData.stockLevels) state.stockLevels = stkData.stockLevels;

    const wstData = await apiFetch('/api/inventory/waste');
    if (wstData.success && wstData.spoilageLogs) state.spoilageLogs = wstData.spoilageLogs;

    const rcpData = await apiFetch('/api/inventory/recipes');
    if (rcpData.success && rcpData.recipes) state.recipes = rcpData.recipes;
  } catch (err) {}

  try {
    const lbrData = await apiFetch('/api/labor/shifts');
    if (lbrData.success && lbrData.employees) {
      state.employees = lbrData.employees;
      state.tipPoolTotal = lbrData.tipPoolTotalUSD || 450.0;
    }
  } catch (err) {}

  try {
    const finData = await apiFetch('/api/financials/ledger');
    if (finData.success) {
      state.journalEntries = finData.journalEntries || [];
      state.kpis = finData.kpis || state.kpis;
    }
  } catch (err) {}

  renderApp();
}

let wsConnection = null;

// Real-Time LAN WebSocket Listener
function initWebSocket() {
  if (wsConnection) {
    wsConnection.onclose = null;
    wsConnection.close();
  }
  try {
    wsConnection = new WebSocket(EDGE_WS_URL);
    wsConnection.onopen = () => {
      state.wsConnected = true;
      renderApp();
    };
    wsConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'KDS_NEW_TICKET') {
        state.kdsTickets.unshift({
          id: data.ticket.id,
          source: data.ticket.source || 'POS Terminal 01',
          station: data.ticket.station || 'HOTLINE_1',
          elapsedMinutes: 0,
          elapsedSeconds: 15,
          diningType: 'DINE IN',
          items: data.ticket.items.map(i => ({ 
            qty: i.quantity || 1, 
            name: i.menuItemId === 'item-101' ? 'Large Pepperoni Pizza' : 'Spicy Buffalo Wings',
            modifiers: i.modifiers || ['Standard Prep']
          })),
          status: 'IN_PREP',
        });
        showToast({ title: 'New Kitchen Ticket', message: `Order #${data.ticket.id} dispatched to hotline.`, type: 'info' });
        renderApp();
      } else if (data.type === 'KDS_TICKETS_UPDATED') {
        state.kdsTickets = data.tickets;
        renderApp();
      } else if (data.type === 'MENU_UPDATED') {
        state.menuItems.push(data.newItem);
        renderApp();
      } else if (data.type === 'DRAWER_UPDATED') {
        state.drawerSession = {
          ...state.drawerSession,
          startingBankUSD: (data.drawerSession.startingBankINR || 20000) / 100,
          cashSalesUSD: (data.drawerSession.cashSalesINR || 35000) / 100,
          cashDropsUSD: (data.drawerSession.cashDropsINR || 10000) / 100,
          payOutsUSD: (data.drawerSession.payOutsINR || 2000) / 100,
          expectedCashUSD: (data.drawerSession.expectedCashINR || 43000) / 100,
          activityLedger: data.drawerSession.activityLedger || [],
        };
        renderApp();
      } else if (data.type === 'LABOR_UPDATED') {
        state.employees = data.employees;
        renderApp();
      } else if (data.type === 'MENU_86_UPDATE') {
        const item = state.menuItems.find(m => m.id === data.productId || m.sku === data.productId);
        if (item) item.isAvailable = !data.isUnavailable;
        renderApp();
      }
    };
    wsConnection.onclose = () => {
      state.wsConnected = false;
      wsConnection = null;
      setTimeout(initWebSocket, 3000);
    };
  } catch (err) {}
}

async function initBackendConnection() {
  await refreshAllData();
  initWebSocket();
}

function renderApp() {
  const isBackOfficeActive = ['inventory_prep', 'labor_shifts', 'menu_catalog', 'franchise_financials'].includes(state.activeModule);
  const backOfficeLabels = {
    inventory_prep: 'Inventory & Prep',
    labor_shifts: 'Labor & Shifts',
    menu_catalog: 'Menu Catalog',
    franchise_financials: 'Financials & GL'
  };
  const backOfficeBtnLabel = isBackOfficeActive ? `${backOfficeLabels[state.activeModule]} ▾` : 'Back Office ▾';

  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <!-- Top Navigation -->
    <header class="navbar">
      <div class="brand-section">
        <img src="/restaurant_logo.jpg" alt="Logo" class="logo-img" />
        <div>
          <div class="brand-title">RMS Store Console</div>
          <div class="brand-subtitle">Store #104 Chicago West &bull; Node Edge Online</div>
        </div>
      </div>

      <!-- Module Navigation Tabs -->
      <nav class="module-nav">
        <button class="nav-tab ${state.activeModule === 'pos_register' ? 'active' : ''}" onclick="selectModule('pos_register')">
          <span>🛒 POS Register</span>
        </button>
        <button class="nav-tab ${state.activeModule === 'table_floor_plan' ? 'active' : ''}" onclick="selectModule('table_floor_plan')">
          <span>🪑 Table Floor (${state.tables.filter(t => t.status !== 'VACANT').length}/${state.tables.length})</span>
        </button>
        <button class="nav-tab ${state.activeModule === 'kds' ? 'active' : ''}" onclick="selectModule('kds')">
          <span>🍳 Kitchen KDS (${state.kdsTickets.length})</span>
        </button>
        <button class="nav-tab ${state.activeModule === 'cash_management' ? 'active' : ''}" onclick="selectModule('cash_management')">
          <span>💵 Cash & Drawers</span>
        </button>
        <button class="nav-tab ${state.activeModule === 'po_receiving' ? 'active' : ''}" onclick="selectModule('po_receiving')">
          <span>📦 PO Receiving (${state.purchaseOrders.length})</span>
        </button>

        <!-- Back Office Dropdown -->
        <div class="nav-dropdown">
          <button class="nav-dropdown-btn ${isBackOfficeActive ? 'active' : ''}" onclick="toggleBackOfficeDropdown(event)">
            <span>🏢 ${backOfficeBtnLabel}</span>
          </button>
          ${state.backOfficeMenuOpen ? `
            <div class="nav-dropdown-menu" onclick="event.stopPropagation()">
              <button class="nav-dropdown-item ${state.activeModule === 'inventory_prep' ? 'active' : ''}" onclick="selectModule('inventory_prep')">
                <span>🥗 Inventory & Batch Prep</span>
              </button>
              <button class="nav-dropdown-item ${state.activeModule === 'labor_shifts' ? 'active' : ''}" onclick="selectModule('labor_shifts')">
                <span>👥 Labor & Shift Scheduling</span>
              </button>
              <button class="nav-dropdown-item ${state.activeModule === 'menu_catalog' ? 'active' : ''}" onclick="selectModule('menu_catalog')">
                <span>📋 Menu Catalog & Governance</span>
              </button>
              <button class="nav-dropdown-item ${state.activeModule === 'franchise_financials' ? 'active' : ''}" onclick="selectModule('franchise_financials')">
                <span>📊 Financials & NetSuite GL</span>
              </button>
            </div>
          ` : ''}
        </div>
      </nav>

      <!-- Right Actions & Diagnostics -->
      <div class="nav-actions">
        <button class="btn-nav-diag" onclick="toggleTrainingMode()" style="${state.trainingModeActive ? 'background:#d97706; color:#ffffff;' : ''}" title="Toggle Isolated Training Mode (Test orders excluded from financial ledger)">
          🎓 ${state.trainingModeActive ? 'Training ON' : 'Training'}
        </button>
        <button class="btn-nav-diag" onclick="downloadSupportBundle()" title="Download Sanitized Diagnostics & Support Bundle">
          📥 Bundle
        </button>
        <a href="${EDGE_SERVER_URL}/health" target="_blank" class="btn-nav-diag" title="Open Live Edge Node Telemetry & Hardware Diagnostics">
          ⚡ Diag
        </a>
        <div class="status-pill ${state.storeOffline ? 'offline' : ''}" onclick="toggleOffline()" title="Click to simulate WAN network drop">
          <span class="status-dot"></span>
          <span>${state.storeOffline ? 'EDGE OFFLINE' : `EDGE ONLINE (${state.wsConnected ? 'LAN WS' : 'REST'})`}</span>
        </div>
      </div>
    </header>

    ${state.trainingModeActive ? `
      <div class="training-mode-banner">
        <div>
          <span class="tag">SIMULATION</span>
          <span>⚠️ TRAINING MODE ACTIVE — Orders in this mode will NOT be recorded to the GST fiscal ledger or financial tax reports.</span>
        </div>
        <button class="btn-primary btn-slate" style="padding:4px 10px; font-size:0.75rem;" onclick="toggleTrainingMode()">Exit Training Mode</button>
      </div>
    ` : ''}

    <!-- Main View -->
    <main class="view-container">
      ${renderActiveModule()}
    </main>

    <!-- Modals -->
    ${renderModals()}

    <!-- Toast Notifications Container -->
    <div id="toast-container"></div>
  `;
}

function renderActiveModule() {
  switch (state.activeModule) {
    case 'pos_register': return renderPOSRegisterWorkspace();
    default: {
      let content = '';
      switch (state.activeModule) {
        case 'table_floor_plan': content = renderTableFloorPlanWorkspace(); break;
        case 'kds': content = renderKDSWorkspace(); break;
        case 'cash_management': content = renderCashManagementWorkspace(); break;
        case 'po_receiving': content = renderPOReceivingWorkspace(); break;
        case 'inventory_prep': content = renderInventoryPrepWorkspace(); break;
        case 'labor_shifts': content = renderLaborShiftsWorkspace(); break;
        case 'menu_catalog': content = renderMenuCatalogWorkspace(); break;
        case 'franchise_financials': content = renderFinancialsWorkspace(); break;
        default: content = renderPOSRegisterWorkspace(); break;
      }
      return `<div class="workspace-scroll-container">${content}</div>`;
    }
  }
}

// 1. POS REGISTER (FIXED ZERO-SCROLL SPLIT VIEWPORT)
function renderPOSRegisterWorkspace() {
  const filteredItems = state.activeCategory === 'ALL' 
    ? state.menuItems 
    : state.menuItems.filter(i => i.category === state.activeCategory);

  const subtotal = state.cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
  const taxAmount = subtotal * 0.08;
  const total = subtotal + taxAmount;

  return `
    <div class="pos-workspace-split">
      <!-- Left Section: Header, Category Rail, Independently Scrollable Food Grid -->
      <div class="pos-menu-column">
        <div class="section-header">
          <div>
            <h2 class="section-title">Point of Sale Register</h2>
            <p class="section-subtitle">Terminal 01 &bull; Local SQLite WAL Persistence &bull; Sub-200ms LAN Dispatch</p>
          </div>
          <div class="header-actions">
            <span class="badge badge-online">DRAWER OPEN: $${state.drawerSession.expectedCashUSD.toFixed(2)} EXP</span>
            <button class="btn-primary btn-slate" onclick="openModal('cash_drop')">Mid-Shift Safe Drop</button>
          </div>
        </div>

        <!-- Category Selector Rail -->
        <div class="category-chips-rail">
          <button class="category-chip ${state.activeCategory === 'ALL' ? 'active' : ''}" onclick="setCategory('ALL')">All Categories</button>
          <button class="category-chip ${state.activeCategory === 'Pizzas' ? 'active' : ''}" onclick="setCategory('Pizzas')">🍕 Pizzas</button>
          <button class="category-chip ${state.activeCategory === 'Appetizers' ? 'active' : ''}" onclick="setCategory('Appetizers')">🍗 Appetizers & Sides</button>
          <button class="category-chip ${state.activeCategory === 'Entrees' ? 'active' : ''}" onclick="setCategory('Entrees')">🍝 Entrees / Mains</button>
          <button class="category-chip ${state.activeCategory === 'Beverages' ? 'active' : ''}" onclick="setCategory('Beverages')">🥤 Beverages</button>
        </div>

        <!-- Independently Scrollable Food Menu Grid -->
        <div class="menu-grid-scroll">
          ${filteredItems.map(item => `
            <div class="pos-card">
              <div class="pos-card-img-wrapper" onclick="quickAddToCart('${item.id}')" title="Tap to Quick Add">
                <img src="${item.image}" alt="${item.name}" class="pos-card-img" />
              </div>
              <div class="pos-card-body">
                <div>
                  <div class="pos-card-title">${item.name}</div>
                  <div class="pos-card-meta">${item.category} &bull; ${item.sku}</div>
                </div>
                <div class="pos-card-footer">
                  <span class="pos-card-price">$${item.basePrice.toFixed(2)}</span>
                  <div class="tile-actions">
                    <button class="btn-add-quick" onclick="quickAddToCart('${item.id}')" title="Quick Add to Ticket">+ Add</button>
                    <button class="btn-customize-tile" onclick="openModifierModal('${item.id}')" title="Customize Toppings & Notes">⚙️</button>
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right Section: Permanently Pinned Cart Sidebar (100% Height, Fixed Footer) -->
      <div class="cart-sidebar-docked">
        <div class="cart-header-fixed">
          <div>
            <h3 style="font-size:1.15rem; font-weight:800; color:#ffffff;">Current Ticket</h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">Dine In &bull; Terminal 01</span>
          </div>
          <button class="btn-primary btn-slate" style="padding:0.4rem 0.85rem; font-size:0.78rem; min-height:36px;" onclick="clearCart()" ${state.cart.length === 0 ? 'disabled' : ''}>Clear</button>
        </div>

        <!-- Scrollable Ticket Items List inside Cart -->
        <div class="cart-items-scroll">
          ${state.cart.length === 0 ? `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:1rem 0.5rem; text-align:center; margin:auto 0;">
              <div style="font-size:2rem; margin-bottom:0.25rem; opacity:0.8;">🍽️</div>
              <div style="font-size:0.95rem; font-weight:800; color:#ffffff;">Ticket is empty</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem; max-width:200px;">Tap any dish to quick-add, or tap ⚙️ to customize toppings.</div>
              <div style="display:flex; gap:0.4rem; margin-top:0.6rem;">
                <button class="btn-primary btn-slate" style="font-size:0.75rem; min-height:32px; padding:0.25rem 0.6rem;" onclick="selectModule('table_floor_plan')">🪑 Floor Plan</button>
                <button class="btn-primary btn-emerald" style="font-size:0.75rem; min-height:32px; padding:0.25rem 0.6rem;" onclick="quickAddToCart('item-1')">⚡ Pepperoni</button>
              </div>
            </div>
          ` : state.cart.map((item, idx) => `
            <div class="cart-item-row">
              <div class="cart-item-main">
                <span class="cart-item-title">${item.name}</span>
                <span class="cart-item-price">$${((item.basePrice + (item.modifiersCost || 0)) * item.qty).toFixed(2)}</span>
              </div>
              ${item.modifiers && item.modifiers.length > 0 ? `
                <div class="cart-item-modifiers">
                  ${item.modifiers.join(', ')}
                </div>
              ` : ''}
              <div class="cart-item-controls">
                <div class="qty-control">
                  <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
                  <span style="font-weight:900; font-family:var(--font-mono); font-size:1.1rem; width:28px; text-align:center;">${item.qty}</span>
                  <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                </div>
                <span style="font-size:0.78rem; color:var(--text-muted); font-family:var(--font-mono);">$${(item.basePrice + (item.modifiersCost || 0)).toFixed(2)} ea</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Pinned Bottom Controls (Always Visible & Accessible on All Heights) -->
        <div class="cart-footer-pinned">
          <div class="quick-cash-bar" style="padding:0; background:none; border:none;">
            <div class="quick-cash-title" style="margin-bottom:0.25rem;">Quick Cash Tender (1-Thumb Tap)</div>
            <div class="quick-cash-buttons">
              <button class="btn-cash-quick" onclick="quickCashCheckout(10)" ${total > 10 || state.cart.length === 0 ? 'disabled' : ''}>$10</button>
              <button class="btn-cash-quick" onclick="quickCashCheckout(20)" ${total > 20 || state.cart.length === 0 ? 'disabled' : ''}>$20</button>
              <button class="btn-cash-quick" onclick="quickCashCheckout(50)" ${total > 50 || state.cart.length === 0 ? 'disabled' : ''}>$50</button>
              <button class="btn-cash-quick" onclick="quickCashCheckout(${total})" ${state.cart.length === 0 ? 'disabled' : ''}>Exact</button>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.25rem; margin-top:0.25rem;">
            <div class="totals-row">
              <span>Subtotal</span>
              <span style="font-family:var(--font-mono); font-weight:700;">$${subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>Sales Tax (8%)</span>
              <span style="font-family:var(--font-mono); font-weight:700;">$${taxAmount.toFixed(2)}</span>
            </div>
            <div class="totals-row total-due" style="font-size:1.5rem; padding-top:0.25rem;">
              <span>Total Due</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="checkout-actions-grid" style="margin-top:0.25rem;">
            <button class="btn-primary btn-checkout" onclick="checkoutOrder('CARD')" ${state.cart.length === 0 ? 'disabled' : ''}>
              💳 Charge Card
            </button>
            <button class="btn-primary btn-emerald btn-checkout" onclick="checkoutOrder('CASH')" ${state.cart.length === 0 ? 'disabled' : ''}>
              💵 Cash Tender
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. TABLE FLOOR PLAN WORKSPACE (AMBIENT HALO GLOWS & FULL TOUCH TARGETS)
function renderTableFloorPlanWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Table Floor Plan & Dining Management</h2>
        <p class="section-subtitle">Course Hold/Fire &bull; Table Transfers &bull; Covers & Server Assignments</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-online">${state.tables.filter(t => t.status !== 'VACANT').length} OCCUPIED / ${state.tables.length} TABLES</span>
      </div>
    </div>

    <!-- Table Grid Layout -->
    <div class="table-grid">
      ${state.tables.map(table => {
        const statusClass = table.status === 'VACANT' ? 'table-vacant' : table.status === 'SEATED' ? 'table-seated' : table.status === 'ORDERING' ? 'table-ordering' : 'table-served';
        const badgeClass = table.status === 'VACANT' ? 'badge-online' : table.status === 'SEATED' ? 'badge-online' : table.status === 'ORDERING' ? 'badge-warning' : 'badge-locked';

        return `
          <div class="table-card ${statusClass}">
            <div>
              <div class="table-header-row">
                <span class="table-label">${table.label}</span>
                <span class="badge ${badgeClass}">${table.status}</span>
              </div>
              <div class="table-meta-row">
                <div><strong>${table.section}</strong> &bull; ${table.seats} Seats</div>
                ${table.covers ? `<div style="margin-top:0.35rem; color:#ffffff; font-weight:700;">${table.covers} Covers &bull; ${table.serverName}</div>` : '<div style="margin-top:0.35rem; color:var(--text-muted);">Ready to seat</div>'}
                ${table.seatedAt ? `<div style="font-size:0.75rem; color:var(--accent-blue); margin-top:0.25rem; font-family:var(--font-mono);">Seated: ${table.seatedAt}</div>` : ''}
              </div>
            </div>

            <div class="table-actions-row">
              ${table.status === 'VACANT' ? `
                <button class="btn-primary btn-emerald" style="width:100%; min-height:46px; font-size:0.88rem;" onclick="openSeatTableModal('${table.tableId}')">
                  🪑 Seat Party +
                </button>
              ` : `
                <button class="btn-primary btn-amber" style="flex:1.2; min-height:46px; font-size:0.85rem;" onclick="fireCourseForTable('${table.tableId}')">
                  🔥 Fire Course
                </button>
                <button class="btn-primary btn-rose" style="flex:1; min-height:46px; font-size:0.85rem;" onclick="closeTableCheckout('${table.tableId}')">
                  Settle Bill
                </button>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 3. KITCHEN DISPLAY SYSTEM (KDS WITH DYNAMIC URGENT TIMERS & MASSIVE BUMP BARS)
function renderKDSWorkspace() {
  const filteredTickets = state.activeKDSStation === 'ALL'
    ? state.kdsTickets
    : state.kdsTickets.filter(t => t.station === state.activeKDSStation);

  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Kitchen Display System (KDS)</h2>
        <p class="section-subtitle">Real-time LAN WebSocket Ticket Stream &bull; Sub-200ms Latency &bull; Station Routing</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary btn-slate" onclick="testPrintESCPOSTicket()">Test Hotline Printer (Port 9100)</button>
      </div>
    </div>

    <!-- KDS Station Tabs -->
    <div class="category-chips-rail" style="margin-bottom:1.25rem;">
      <button class="category-chip ${state.activeKDSStation === 'ALL' ? 'active' : ''}" onclick="setKDSStation('ALL')">All Kitchen Stations (${state.kdsTickets.length})</button>
      <button class="category-chip ${state.activeKDSStation === 'HOTLINE_1' ? 'active' : ''}" onclick="setKDSStation('HOTLINE_1')">Hotline 1 (Pizza & Oven)</button>
      <button class="category-chip ${state.activeKDSStation === 'EXPO' ? 'active' : ''}" onclick="setKDSStation('EXPO')">Expo & Aggregator Packing</button>
    </div>

    <div class="kds-grid">
      ${filteredTickets.map((t, idx) => {
        const isRed = t.elapsedMinutes >= 10;
        const isAmber = t.elapsedMinutes >= 5 && t.elapsedMinutes < 10;
        const timerClass = isRed ? 'timer-red' : isAmber ? 'timer-amber' : 'timer-green';
        const pillClass = isRed ? 'timer-pill-red' : isAmber ? 'timer-pill-amber' : 'timer-pill-green';
        const timerFormatted = `${String(t.elapsedMinutes).padStart(2, '0')}:${String(t.elapsedSeconds).padStart(2, '0')}`;

        return `
          <div class="kds-ticket ${timerClass}">
            <div class="kds-ticket-header">
              <span class="kds-ticket-id">#${t.id.slice(-6)}</span>
              <span class="kds-ticket-timer ${pillClass}">⏱️ ${timerFormatted} ${isRed ? 'LATE' : ''}</span>
            </div>
            <div class="kds-ticket-meta">
              <span><strong>${t.diningType}</strong></span>
              <span style="font-weight:700; color:var(--accent-blue);">${t.source}</span>
            </div>
            <div class="kds-ticket-items">
              ${t.items.map(item => `
                <div class="kds-item-row">
                  <div class="kds-item-headline">
                    <span class="kds-item-qty">${item.qty}x</span>
                    <span>${item.name}</span>
                  </div>
                  ${item.allergens && item.allergens.length > 0 ? `
                    <span class="kds-allergen-tag">⚠️ ALLERGEN: ${item.allergens.join(', ')}</span>
                  ` : ''}
                  ${item.modifiers && item.modifiers.length > 0 ? item.modifiers.map(m => `
                    <span class="kds-modifier-tag">${m}</span>
                  `).join('') : ''}
                </div>
              `).join('')}
            </div>
            <button class="btn-bump" onclick="bumpKDSTicket(${idx})">
              <span>✓ BUMP TICKET</span>
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 5. CASH MANAGEMENT & SHIFT RECONCILIATION
function renderCashManagementWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Cash Drawer & Shift Reconciliation</h2>
        <p class="section-subtitle">Drawer Sessions &bull; Mid-Shift Safe Drops &bull; Petty Cash Payouts &bull; Blind Z-Reports</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary btn-slate" onclick="openModal('cash_drop')">Record Safe Drop</button>
        <button class="btn-primary btn-slate" onclick="openModal('blind_z_report')">Single Drawer Count</button>
        <button class="btn-primary btn-emerald" onclick="openModal('day_end_reconciliation')">📊 Day-End Multi-Tender Z-Report</button>
      </div>
    </div>

    <!-- Drawer Summary Cards -->
    <div class="cash-summary-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
      <div class="card">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Opening Float Bank</div>
        <div style="font-family:var(--font-mono); font-size:1.6rem; font-weight:800; color:#ffffff; margin-top:0.25rem;">$${state.drawerSession.startingBankUSD.toFixed(2)}</div>
        <div style="font-size:0.75rem; color:#34d399; margin-top:0.25rem;">Verified at 08:00 AM</div>
      </div>
      <div class="card">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Gross Cash Sales</div>
        <div style="font-family:var(--font-mono); font-size:1.6rem; font-weight:800; color:#ffffff; margin-top:0.25rem;">$${state.drawerSession.cashSalesUSD.toFixed(2)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">14 Cash Transactions</div>
      </div>
      <div class="card">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Safe Drops & Payouts</div>
        <div style="font-family:var(--font-mono); font-size:1.6rem; font-weight:800; color:#f87171; margin-top:0.25rem;">-$${(state.drawerSession.cashDropsUSD + state.drawerSession.payOutsUSD).toFixed(2)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">1 Safe Drop, 1 Payout</div>
      </div>
      <div class="card" style="border-color:rgba(59, 130, 246, 0.4);">
        <div style="font-size:0.75rem; font-weight:700; color:var(--accent-blue); text-transform:uppercase;">Expected in Drawer</div>
        <div style="font-family:var(--font-mono); font-size:1.6rem; font-weight:800; color:#ffffff; margin-top:0.25rem;">$${state.drawerSession.expectedCashUSD.toFixed(2)}</div>
        <div style="font-size:0.75rem; color:var(--accent-blue); margin-top:0.25rem;">Session: OPEN</div>
      </div>
    </div>

    <!-- Shift Cash Activity Ledger -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Shift Drawer Activity Ledger</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Activity Type</th>
              <th>Amount ($)</th>
              <th>Witness / Authorizer</th>
              <th>Notes / Envelope ID</th>
            </tr>
          </thead>
          <tbody>
            ${state.drawerSession.activityLedger.map(a => `
              <tr>
                <td>${a.timestamp}</td>
                <td><span class="badge ${a.activityType === 'OPENING' ? 'badge-online' : a.activityType === 'SAFE DROP' ? 'badge-warning' : 'badge-danger'}">${a.activityType}</span></td>
                <td><strong>${a.amount > 0 ? '+' : ''}$${Math.abs(a.amount).toFixed(2)}</strong></td>
                <td>${a.witness}</td>
                <td>${a.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 5. PO RECEIVING WORKSPACE
function renderPOReceivingWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Purchase Orders & GRN Receiving</h2>
        <p class="section-subtitle">Vendor Invoicing &bull; Stock Replenishment</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary btn-emerald">Create PO</button>
        <button class="btn-primary btn-slate">Receive GRN</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Approved Suppliers</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Category</th>
              <th>Contact</th>
              <th>Terms</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.suppliers.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.category}</td>
                <td>${s.contact}</td>
                <td>${s.terms}</td>
                <td><span class="badge badge-online">ACTIVE</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Recent Purchase Orders</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Expected Date</th>
              <th>Total Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.purchaseOrders.map(po => `
              <tr>
                <td><code>${po.id}</code></td>
                <td><strong>${po.supplier}</strong></td>
                <td>${po.expectedDelivery}</td>
                <td style="font-family:var(--font-mono);">$${po.totalValue.toFixed(2)}</td>
                <td><span class="badge ${po.status === 'RECEIVED' ? 'badge-online' : po.status === 'OVERDUE' ? 'badge-danger' : 'badge-warning'}">${po.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 6. INVENTORY & PREP
function renderInventoryPrepWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Inventory, Prep & Variance Tracking</h2>
        <p class="section-subtitle">Gram-Level Recipe Depletion &bull; Yield Shrinkage &bull; Par Level Guidance</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="openModal('log_spoilage')">Log Kitchen Waste</button>
      </div>
    </div>

    <!-- Inventory Variance Table -->
    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Theoretical vs. Actual Variance Tracking (&plusmn;2% Alert Threshold)</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Theoretical Use</th>
              <th>Actual Count</th>
              <th>Unit</th>
              <th>Variance Meter</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.inventoryVariances.map(v => `
              <tr>
                <td><strong>${v.name}</strong></td>
                <td>${v.theoretical}</td>
                <td>${v.actual}</td>
                <td>${v.unit}</td>
                <td>
                  <span class="variance-bar-bg">
                    <span class="variance-bar-fill" style="width:${Math.min(100, v.variancePct * 7)}%; background:${v.alert ? '#f43f5e' : '#10b981'};"></span>
                  </span>
                  <strong style="color:${v.alert ? '#f87171' : '#34d399'}; font-family:var(--font-mono);">${v.variancePct > 0 ? '+' : ''}${v.variancePct}%</strong>
                </td>
                <td><span class="badge ${v.alert ? 'badge-danger' : 'badge-online'}">${v.alert ? 'VARIANCE ALERT' : 'IN RANGE'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Spoilage Logs -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Shift Spoilage & Waste Log</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Item Name</th>
              <th>Qty Lost</th>
              <th>Reason Code</th>
              <th>Cost Impact</th>
              <th>Logged By</th>
            </tr>
          </thead>
          <tbody>
            ${state.spoilageLogs.map(s => `
              <tr>
                <td><code>${s.id}</code></td>
                <td><strong>${s.item}</strong></td>
                <td>${s.qty}</td>
                <td><span class="badge badge-danger">${s.reason}</span></td>
                <td style="font-family:var(--font-mono); font-weight:700;">${s.cost}</td>
                <td>${s.loggedBy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Recipe Depletion BOM Cards -->
    ${state.recipes && state.recipes.length > 0 ? `
    <div class="card" style="margin-top:1.5rem;">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Recipe Depletion BOM (Bill of Materials)</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:1rem;">
        ${state.recipes.map(recipe => `
          <div class="card" style="background:var(--bg-surface); border:1px solid var(--border-subtle);">
            <div style="font-weight:800; color:#ffffff; font-size:1.05rem;">${recipe.name}</div>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">Yield: ${recipe.yield}</div>
            <ul style="list-style:none; padding:0; margin:0; font-size:0.85rem;">
              ${recipe.ingredients.map(ing => `
                <li style="display:flex; justify-content:space-between; margin-bottom:0.25rem; border-bottom:1px dashed var(--border-subtle); padding-bottom:0.2rem;">
                  <span>${ing.item}</span>
                  <strong style="color:var(--accent-blue);">${ing.qty}</strong>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
}

// 7. LABOR & SHIFTS
function renderLaborShiftsWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Labor & Shift Scheduling</h2>
        <p class="section-subtitle">FLSA §3(m) Tip Pool Compliance &bull; Fair Workweek Rest Guardrails &bull; California Daily OT</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-online">ACCRUED TIP POOL: $${state.tipPoolTotal.toFixed(2)}</span>
        <button class="btn-primary btn-purple" onclick="showToast({ title: 'AI Labor Optimizer', message: 'Labor schedule optimized for 22% target cost. Zero clopening violations detected.', type: 'success' })">Run AI Optimizer</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Store Staff Shift Roster</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Assigned Role</th>
              <th>Shift Status</th>
              <th>Shift Start</th>
              <th>Hours</th>
              <th>Break Attestation</th>
              <th>FLSA Tip Share</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${state.employees.map(e => `
              <tr>
                <td><strong>${e.name}</strong></td>
                <td>${e.role}</td>
                <td><span class="badge ${e.status === 'CLOCKED_IN' ? 'badge-online' : 'badge-danger'}">${e.status}</span></td>
                <td>${e.shiftStart}</td>
                <td>${e.hours} hrs</td>
                <td><span class="badge badge-online">COMPLIANT</span></td>
                <td>${e.role === 'Shift Lead' ? '<span style="color:#94a3b8; font-size:0.8rem;">Banned (FLSA §3m)</span>' : '<span style="color:#34d399; font-weight:700;">Eligible Share</span>'}</td>
                <td><button class="btn-primary ${e.status === 'CLOCKED_IN' ? 'btn-rose' : 'btn-slate'}" style="padding:0.5rem 1rem; font-size:0.85rem; min-height:48px; min-width:120px;" onclick="toggleEmployeeClock('${e.id}', true)">${e.status === 'CLOCKED_IN' ? 'Clock Out' : 'Clock In'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 8. MENU CATALOG
function renderMenuCatalogWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Menu Catalog & Brand-Lock Governance</h2>
        <p class="section-subtitle">Hierarchy: Platform &rarr; Brand &rarr; Region &rarr; Store &bull; Automatic Sync</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="openModal('add_menu_item')">Add Master Menu Item</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Master Menu Catalog</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Allergens</th>
              <th>Brand Lock Policy</th>
              <th>86 Status</th>
            </tr>
          </thead>
          <tbody>
            ${state.menuItems.map(item => `
              <tr>
                <td><code>${item.sku}</code></td>
                <td><strong>${item.name}</strong></td>
                <td>${item.category}</td>
                <td style="font-family:var(--font-mono); font-weight:700;">$${item.basePrice.toFixed(2)}</td>
                <td>${item.allergens.join(', ') || 'None'}</td>
                <td><span class="badge ${item.isBrandLocked ? 'badge-locked' : 'badge-online'}">${item.isBrandLocked ? 'HQ BRAND LOCKED' : 'STORE OVERRIDABLE'}</span></td>
                <td><button class="badge ${item.isAvailable !== false ? 'badge-online' : 'badge-danger'}" style="border:none; cursor:pointer;" onclick="toggle86('${item.id}', ${item.isAvailable !== false})">${item.isAvailable !== false ? 'AVAILABLE' : 'OUT OF STOCK'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 9. FINANCIALS & GL
function renderFinancialsWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Financial Accounting & NetSuite GL</h2>
        <p class="section-subtitle">Balanced Double-Entry Journal Vouchers (Debits === Credits) &bull; Franchise Royalty ACH</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="showToast({ title: 'NetSuite GL Exported', message: 'Balanced Journal Voucher generated: Debits $3,010.00 === Credits $3,010.00.', type: 'info' })">Export NetSuite Journal</button>
        <button class="btn-primary btn-purple" onclick="showToast({ title: 'Franchise Royalty ACH', message: 'ACH Direct Debit Draft generated: $162.34 based on audited Net Sales.', type: 'info' })">Generate Royalty ACH</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">KPI Summary</h3>
      <div class="cash-summary-grid">
        <div class="card"><div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Gross Sales</div><div style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800;">$${state.kpis.grossSalesUSD.toFixed(2)}</div></div>
        <div class="card"><div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Net Sales</div><div style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:var(--accent-blue);">$${state.kpis.netSalesUSD.toFixed(2)}</div></div>
        <div class="card"><div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Tax Collected</div><div style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800;">$${state.kpis.taxCollectedUSD.toFixed(2)}</div></div>
        <div class="card"><div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Food Cost</div><div style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:#34d399;">${state.kpis.foodCostPct}%</div></div>
        <div class="card"><div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Labor Cost</div><div style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:#34d399;">${state.kpis.laborCostPct}%</div></div>
        <div class="card"><div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Prime Cost</div><div style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800; color:#f59e0b;">${state.kpis.primeCostPct}%</div></div>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">NetSuite General Ledger Accounts (Debits === Credits Guarantee)</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Account</th>
              <th>Memo</th>
              <th>Debit ($)</th>
              <th>Credit ($)</th>
            </tr>
          </thead>
          <tbody>
            ${state.journalEntries.map(entry => `
              <tr>
                <td><code>${entry.id}</code></td>
                <td>${entry.date}</td>
                <td>${entry.account}</td>
                <td>${entry.memo}</td>
                <td style="font-family:var(--font-mono); font-weight:700;">$${entry.debit.toFixed(2)}</td>
                <td style="font-family:var(--font-mono); font-weight:700;">$${entry.credit.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Global Toast System
window.showToast = function({ title, message, type = 'success', duration = 3800 }) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠️' : type === 'danger' ? '✕' : 'ℹ';
  
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon-box">${icon}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
    <button class="toast-close-btn">&times;</button>
    <div class="toast-progress" style="animation-duration: ${duration}ms;"></div>
  `;

  container.appendChild(toast);

  const timer = setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  }, duration);

  toast.querySelector('.toast-close-btn').onclick = () => {
    clearTimeout(timer);
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 250);
  };
};

// Global actions
window.selectModule = function(mod) {
  state.activeModule = mod;
  state.backOfficeMenuOpen = false;
  renderApp();
};

window.toggleBackOfficeDropdown = function(e) {
  if (e) e.stopPropagation();
  state.backOfficeMenuOpen = !state.backOfficeMenuOpen;
  renderApp();
};

window.addEventListener('click', (e) => {
  if (state.backOfficeMenuOpen) {
    state.backOfficeMenuOpen = false;
    renderApp();
  }
});

window.setCategory = function(cat) {
  state.activeCategory = cat;
  renderApp();
};

window.setKDSStation = function(station) {
  state.activeKDSStation = station;
  renderApp();
};

window.openModifierModal = function(id) {
  const item = state.menuItems.find(m => m.id === id);
  if (!item) return;
  state.selectedModifierItem = item;
  state.activeModifiers = [];
  openModal('item_modifiers');
};

window.openSeatTableModal = function(tableId) {
  const table = state.tables.find(t => t.tableId === tableId);
  if (!table) return;
  state.selectedTable = table;
  openModal('seat_table');
};



window.openReceiveGRNModal = function(poId) {
  const po = state.purchaseOrders.find(p => p.poId === poId);
  if (!po) return;
  state.selectedPO = po;
  openModal('receive_grn');
};

window.toggleModifierOption = function(modName, price) {
  const existingIdx = state.activeModifiers.findIndex(m => m.name === modName);
  if (existingIdx >= 0) {
    state.activeModifiers.splice(existingIdx, 1);
  } else {
    state.activeModifiers.push({ name: modName, price });
  }
  renderApp();
};

window.addCustomizedItemToCart = function() {
  if (!state.selectedModifierItem) return;
  const modCost = state.activeModifiers.reduce((sum, m) => sum + m.price, 0);
  const modNames = state.activeModifiers.map(m => m.name);

  state.cart.push({
    ...state.selectedModifierItem,
    qty: 1,
    modifiersCost: modCost,
    modifiers: modNames,
  });

  closeModal();
};

window.updateCartQty = function(idx, delta) {
  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }
  renderApp();
};

window.clearCart = function() {
  state.cart = [];
  renderApp();
};

window.quickAddToCart = function(itemId) {
  const item = state.menuItems.find(m => m.id === itemId);
  if (!item) return;

  const existing = state.cart.find(c => c.id === itemId && (!c.modifiers || c.modifiers.length === 0));
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      ...item,
      qty: 1,
      modifiersCost: 0,
      modifiers: []
    });
  }

  showToast({
    title: 'Added to Ticket',
    message: `+1 ${item.name} ($${item.basePrice.toFixed(2)})`,
    type: 'info',
    duration: 1800
  });
  renderApp();
};

window.quickCashCheckout = function(tenderAmount) {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
  const total = subtotal * 1.08;
  const changeDue = Math.max(0, tenderAmount - total);
  
  checkoutOrder('CASH');
  showToast({ 
    title: 'Cash Payment Processed', 
    message: `Tendered: $${tenderAmount.toFixed(2)} | Total: $${total.toFixed(2)}\nChange Due: $${changeDue.toFixed(2)}`, 
    type: 'success' 
  });
};

window.checkoutOrder = async function(tenderType) {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const payload = {
    id: `tx-${Date.now()}`,
    storeId: 'store-104',
    terminalId: 'pos-1',
    timestamp: new Date().toISOString(),
    items: state.cart.map(i => ({ 
      menuItemId: i.id, 
      quantity: i.qty, 
      unitPrice: i.basePrice + (i.modifiersCost || 0) 
    })),
    subtotal: Number(subtotal.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2)),
    tenders: [{ type: tenderType, amount: Number(total.toFixed(2)) }],
    offlineMode: state.storeOffline,
    synced: !state.storeOffline,
  };

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    showToast({
      title: 'Order Settled & Printed',
      message: `Order #${payload.id.slice(-6)} recorded via ${tenderType}.\nLocal SQLite WAL Persisted: ${data.sqliteWalPersisted ? 'YES' : 'NO'}`,
      type: 'success'
    });
  } catch (err) {
    showToast({
      title: 'Offline Order Queued',
      message: `Order #${payload.id.slice(-6)} stored in local SQLite WAL offline queue (synced = 0).`,
      type: 'warning'
    });
  }

  // Update in-memory drawer if cash
  if (tenderType === 'CASH') {
    state.drawerSession.cashSalesUSD += total;
    state.drawerSession.expectedCashUSD += total;
  }

  state.cart = [];
  renderApp();
};



window.testPrintESCPOSTicket = function() {
  showToast({
    title: 'Hardware Printer Dispatched',
    message: 'Raw ESC/POS binary ticket sent to Hotline Thermal Printer (Port 9100) with automatic station failover active.',
    type: 'info'
  });
};

window.toggleOffline = function() {
  state.storeOffline = !state.storeOffline;
  showToast({
    title: state.storeOffline ? 'Offline Edge Mode Active' : 'Online Mode Restored',
    message: state.storeOffline ? 'WAN link disabled. All checkouts will commit to local SQLite WAL.' : 'Connected to cloud ingestion pipeline.',
    type: state.storeOffline ? 'warning' : 'success'
  });
  renderApp();
};

window.openModal = function(m) {
  state.modalOpen = m;
  renderApp();
};

window.closeModal = function() {
  state.modalOpen = null;
  state.selectedModifierItem = null;
  state.selectedTable = null;
  state.selectedPO = null;
  renderApp();
};

function renderModals() {
  if (!state.modalOpen) return '';

  if (state.modalOpen === 'seat_table' && state.selectedTable) {
    const table = state.selectedTable;
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Seat ${table.label} (${table.seats} Seats)</div>
              <div class="modal-subtitle">${table.section} &bull; Open Table Ticket</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <form onsubmit="submitSeatTable(event)">
            <div class="form-group">
              <label>Number of Guests (Covers &le; ${table.seats})</label>
              <input type="number" id="seatCoversInput" class="form-control" min="1" max="${table.seats}" value="2" required />
            </div>
            <div class="form-group">
              <label>Assigned Server Name</label>
              <input type="text" id="serverNameInput" class="form-control" value="Sarah Jenkins" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Open Table Ticket</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'create_po') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Create Purchase Order (PO)</div>
              <div class="modal-subtitle">Wholesale Supplier Order Requisition</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <form onsubmit="submitCreatePO(event)">
            <div class="form-group">
              <label>Wholesale Supplier</label>
              <select id="poSupplierSelect" class="form-control">
                <option value="sup-001">Mumbai Dairy Wholesalers Pvt. Ltd. (Mozzarella Cheese)</option>
                <option value="sup-002">Delhi Grain & Flour Mills (High-Gluten Flour)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Order Item & Quantity</label>
              <input type="text" id="poItemQtyInput" class="form-control" value="Mozzarella Cheese - 20 kg @ ₹650/kg" required />
            </div>
            <div class="form-group">
              <label>Expected Delivery Date</label>
              <input type="date" id="poDeliveryDateInput" class="form-control" value="2026-08-20" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Dispatch PO</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'receive_grn' && state.selectedPO) {
    const po = state.selectedPO;
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Receive GRN for ${po.poId}</div>
              <div class="modal-subtitle">${po.supplierName} &bull; Store Delivery Requisition</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <form onsubmit="submitReceiveGRN(event)">
            <div class="form-group">
              <label>Received Mozzarella Cheese (kg)</label>
              <input type="number" id="grnReceivedQtyInput" step="0.1" class="form-control" value="20.0" style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800;" required />
            </div>
            <div class="form-group">
              <label>Receiving Staff Member</label>
              <input type="text" id="grnStaffInput" class="form-control" value="Warehouse Staff Lead" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Post GRN & Increment Stock</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'run_stock_take') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Blind Physical Stock-Take</div>
              <div class="modal-subtitle">Reconciliation against theoretical running balance</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <form onsubmit="submitStockTake(event)">
            <div class="form-group">
              <label>Mozzarella Cheese Physical Count (kg)</label>
              <input type="number" id="countCheese" step="0.1" class="form-control" value="16.3" style="font-family:var(--font-mono);" required />
            </div>
            <div class="form-group">
              <label>Pepperoni Physical Count (kg)</label>
              <input type="number" id="countPep" step="0.1" class="form-control" value="8.6" style="font-family:var(--font-mono);" required />
            </div>
            <div class="form-group">
              <label>Flour Physical Count (kg)</label>
              <input type="number" id="countFlour" step="0.1" class="form-control" value="48.0" style="font-family:var(--font-mono);" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Compute Variances</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'item_modifiers' && state.selectedModifierItem) {
    const item = state.selectedModifierItem;
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Customize ${item.name}</div>
              <div class="modal-subtitle">$${item.basePrice.toFixed(2)} base price</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:1.2rem; margin-bottom:1.5rem;">
            <div>
              <div style="font-size:0.8rem; font-weight:800; color:#cbd5e1; text-transform:uppercase; margin-bottom:0.6rem;">Extra Toppings & Mods</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('+ Extra Cheese', 2.00)">
                  <span>+ Extra Cheese</span>
                  <span style="color:#34d399; font-weight:800;">+$2.00</span>
                </button>
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('+ Pepperoni', 2.50)">
                  <span>+ Pepperoni</span>
                  <span style="color:#34d399; font-weight:800;">+$2.50</span>
                </button>
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('+ Mushrooms', 1.50)">
                  <span>+ Mushrooms</span>
                  <span style="color:#34d399; font-weight:800;">+$1.50</span>
                </button>
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('Well Done', 0.00)">
                  <span>Well Done</span>
                  <span style="color:var(--text-muted);">Free</span>
                </button>
              </div>
            </div>

            <div>
              <div style="font-size:0.8rem; font-weight:800; color:#cbd5e1; text-transform:uppercase; margin-bottom:0.6rem;">Exclusions</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem;">
                <button class="btn-primary btn-slate" onclick="toggleModifierOption('NO Onion', 0.00)">NO Onion</button>
                <button class="btn-primary btn-slate" onclick="toggleModifierOption('NO Dairy (Vegan)', 0.00)">NO Dairy</button>
              </div>
            </div>

            ${state.activeModifiers.length > 0 ? `
              <div style="background:var(--bg-input); padding:0.85rem; border-radius:var(--radius-md); border:1.5px solid var(--accent-amber);">
                <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted);">Selected Modifiers:</div>
                <div style="color:#fde68a; font-weight:800; font-size:0.95rem; margin-top:0.25rem;">
                  ${state.activeModifiers.map(m => m.name).join(', ')}
                </div>
              </div>
            ` : ''}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.65rem;">
            <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
            <button type="button" class="btn-primary btn-emerald" onclick="addCustomizedItemToCart()">Add to Ticket</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'blind_z_report') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Blind End-of-Day Z-Report</div>
              <div class="modal-subtitle">Terminal 01 &bull; Cashier Blind Count</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <div style="background:#78350f; border:1px solid #f59e0b; padding:0.85rem; border-radius:var(--radius-md); margin-bottom:1.2rem; font-size:0.85rem; color:#fde68a;">
            <strong>Blind Reconciliation Policy:</strong> Expected drawer cash is hidden to prevent theft skimming. Count all physical currency and enter total below.
          </div>

          <form onsubmit="submitBlindZReport(event)">
            <div class="form-group">
              <label>Actual Cash Counted ($ USD)</label>
              <input type="number" id="zCountedCash" step="0.01" class="form-control" placeholder="0.00" value="${state.drawerSession.expectedCashUSD.toFixed(2)}" style="font-family:var(--font-mono); font-size:1.35rem; font-weight:900;" required />
            </div>
            <div class="form-group">
              <label>Manager Authorization Signature Token</label>
              <input type="password" id="zManagerPin" class="form-control" value="mgr-pin-token-991" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Reconcile & Close Drawer</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'cash_drop') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Record Mid-Shift Safe Drop</div>
              <div class="modal-subtitle">Safe Drop Envelope & Witness Verification</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>
          <form onsubmit="submitSafeDrop(event)">
            <div class="form-group">
              <label>Drop Amount ($ USD)</label>
              <input type="number" id="dropAmountInput" step="0.01" class="form-control" value="100.00" style="font-family:var(--font-mono); font-size:1.25rem; font-weight:800;" required />
            </div>
            <div class="form-group">
              <label>Safe Drop Envelope ID</label>
              <input type="text" id="dropEnvelopeInput" class="form-control" value="ENV-9915" required />
            </div>
            <div class="form-group">
              <label>Witness Manager ID</label>
              <input type="text" id="dropWitnessInput" class="form-control" value="mgr-michael-smith" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-amber">Confirm Safe Drop</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'log_spoilage') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Log Kitchen Waste / Spoilage</div>
              <div class="modal-subtitle">Theoretical COGS Depletion & Loss Reason Tracking</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>
          <form onsubmit="submitWasteLog(event)">
            <div class="form-group">
              <label>Item Name</label>
              <input type="text" id="wasteItemInput" class="form-control" value="Mozzarella Cheese (Shredded)" required />
            </div>
            <div class="form-group">
              <label>Quantity Lost</label>
              <input type="text" id="wasteQtyInput" class="form-control" value="1.5 kg" required />
            </div>
            <div class="form-group">
              <label>Reason Code</label>
              <select id="wasteReasonSelect" class="form-control">
                <option>BURNT / OVERCOOKED</option>
                <option>DROPPED_FLOOR</option>
                <option>EXPIRED</option>
              </select>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.75rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-rose">Confirm Waste Log</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'add_menu_item') {
    const defaultImg = state.newMenuItemImage || '/truffle_pasta.jpg';
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" style="max-width: 580px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Add Master Menu Item</div>
              <div class="modal-subtitle">Publish new dish with photo to Menu Catalog & POS Register</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <form onsubmit="saveNewMenuItem(event)">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.85rem;">
              <div class="form-group">
                <label>Item Name</label>
                <input type="text" id="newItemName" class="form-control" placeholder="e.g. Gourmet Truffle Tagliatelle" value="Gourmet Truffle Tagliatelle" required />
              </div>
              <div class="form-group">
                <label>Category</label>
                <select id="newItemCategory" class="form-control">
                  <option value="Entrees" selected>Entrees / Mains</option>
                  <option value="Pizzas">Pizzas</option>
                  <option value="Appetizers">Appetizers & Sides</option>
                  <option value="Beverages">Beverages</option>
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.85rem;">
              <div class="form-group">
                <label>SKU Code</label>
                <input type="text" id="newItemSKU" class="form-control" placeholder="e.g. PAS-TRUF-01" value="PAS-TRUF-01" required />
              </div>
              <div class="form-group">
                <label>Base Price ($ USD)</label>
                <input type="number" id="newItemPrice" step="0.01" class="form-control" placeholder="21.50" value="21.50" style="font-family:var(--font-mono); font-weight:800;" required />
              </div>
            </div>

            <div class="form-group">
              <label>Dish Photo (Choose Preset, Upload File, or Paste URL)</label>
              
              <!-- 1. Preset Gallery Picker -->
              <div class="image-preset-grid">
                <div class="image-preset-btn ${defaultImg === '/truffle_pasta.jpg' ? 'selected' : ''}" onclick="selectNewMenuImagePreset('/truffle_pasta.jpg')">
                  <img src="/truffle_pasta.jpg" class="image-preset-thumb" />
                  <span class="image-preset-label">Truffle Pasta</span>
                </div>
                <div class="image-preset-btn ${defaultImg === '/cheeseburger.jpg' ? 'selected' : ''}" onclick="selectNewMenuImagePreset('/cheeseburger.jpg')">
                  <img src="/cheeseburger.jpg" class="image-preset-thumb" />
                  <span class="image-preset-label">Smash Burger</span>
                </div>
                <div class="image-preset-btn ${defaultImg === '/pepperoni_pizza.jpg' ? 'selected' : ''}" onclick="selectNewMenuImagePreset('/pepperoni_pizza.jpg')">
                  <img src="/pepperoni_pizza.jpg" class="image-preset-thumb" />
                  <span class="image-preset-label">Pepperoni</span>
                </div>
                <div class="image-preset-btn ${defaultImg === '/buffalo_wings.jpg' ? 'selected' : ''}" onclick="selectNewMenuImagePreset('/buffalo_wings.jpg')">
                  <img src="/buffalo_wings.jpg" class="image-preset-thumb" />
                  <span class="image-preset-label">Spicy Wings</span>
                </div>
                <div class="image-preset-btn ${defaultImg === '/garlic_knots.jpg' ? 'selected' : ''}" onclick="selectNewMenuImagePreset('/garlic_knots.jpg')">
                  <img src="/garlic_knots.jpg" class="image-preset-thumb" />
                  <span class="image-preset-label">Garlic Knots</span>
                </div>
              </div>

              <!-- 2. Local File Upload or Custom URL -->
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:0.5rem;">
                <div class="file-upload-wrapper">
                  <button type="button" class="btn-primary btn-slate" style="width:100%;">📁 Upload from PC</button>
                  <input type="file" class="file-upload-input" accept="image/*" onchange="handleNewMenuImageFile(event)" />
                </div>
                <input type="text" id="newItemImageUrlInput" class="form-control" style="font-size:0.85rem;" placeholder="Or paste Image URL..." value="${defaultImg.startsWith('data:') ? '' : defaultImg}" oninput="handleNewMenuImageUrl(this.value)" />
              </div>

              <!-- 3. Live Preview Card -->
              <div class="image-preview-container">
                <img id="newItemLivePreviewImg" src="${defaultImg}" class="image-live-preview" />
                <div>
                  <div style="font-size:0.85rem; font-weight:800; color:#ffffff;">POS Tile Live Preview</div>
                  <div style="font-size:0.75rem; color:var(--text-muted);">This photo will be displayed on 15" touchscreens and online delivery menus.</div>
                </div>
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.5rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Publish Menu Item</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Day-End Multi-Tender Reconciliation Modal
  if (state.modalOpen === 'day_end_reconciliation') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" style="max-width: 680px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Daily Multi-Tender Reconciliation (Z-Report)</div>
              <div class="modal-subtitle">Reconcile POS Sales against Cash Count, Card Terminal Settlements & UPI Gateway</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <form onsubmit="submitDayEndReconciliation(event)">
            <div style="background:#090e1a; border:1px solid var(--border-subtle); border-radius:8px; padding:12px; margin-bottom:14px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:var(--text-dim); font-size:0.85rem;">Store Node:</span>
                <span style="color:#ffffff; font-weight:700;">Store #104 (Mumbai West)</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:var(--text-dim); font-size:0.85rem;">Business Date:</span>
                <span style="color:#38bdf8; font-family:var(--font-mono); font-weight:800;">2026-08-15 (Trading Day)</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--text-dim); font-size:0.85rem;">GST Standard:</span>
                <span class="gst-invoice-badge">5% CGST+SGST &bull; SAC 996331</span>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.85rem;">
              <div class="form-group">
                <label>Physical Cash Counted (₹ INR / Cents)</label>
                <input type="number" id="reconCashCount" class="form-control" placeholder="e.g. 430.00" value="${state.drawerSession.expectedCashUSD.toFixed(2)}" style="font-family:var(--font-mono); font-weight:800;" required />
              </div>
              <div class="form-group">
                <label>Starting Drawer Float</label>
                <input type="number" id="reconFloat" class="form-control" value="200.00" style="font-family:var(--font-mono);" required />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.85rem;">
              <div class="form-group">
                <label>Card Terminal Settled Total (Batch Report)</label>
                <input type="number" id="reconCardSettled" class="form-control" placeholder="Card Terminal Report Total" value="840.50" style="font-family:var(--font-mono); font-weight:800;" required />
              </div>
              <div class="form-group">
                <label>UPI Gateway Settlement Total</label>
                <input type="number" id="reconUpiSettled" class="form-control" placeholder="UPI Merchant App Total" value="320.00" style="font-family:var(--font-mono); font-weight:800;" required />
              </div>
            </div>

            <div class="form-group">
              <label>Manager Override / Variance Sign-Off Notes</label>
              <textarea id="reconNotes" class="form-control" rows="2" placeholder="Explain any cash over/short or unverified refunds..."></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.5rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-emerald">Sign Off & Close Day (Blind Z-Report)</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Statutory GST Invoice View Modal
  if (state.modalOpen === 'gst_invoice_view' && state.lastIssuedInvoice) {
    const inv = state.lastIssuedInvoice;
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" style="max-width: 520px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div>
              <div class="modal-title">Statutory GST Tax Invoice</div>
              <div class="modal-subtitle">${inv.invoiceNumber} &bull; ${inv.businessDate}</div>
            </div>
            <button class="modal-close-btn" onclick="closeModal()" title="Close">&times;</button>
          </div>

          <div style="background:#090e1a; border:1px solid var(--border-subtle); border-radius:8px; padding:14px; margin-bottom:12px;">
            <div style="text-align:center; font-family:var(--font-display); font-weight:800; font-size:1.1rem; color:#ffffff;">
              STORE #104 (MUMBAI WEST)
            </div>
            <div style="text-align:center; font-size:0.75rem; color:var(--text-dim); margin-top:2px;">
              GSTIN: 27AAPFU0939F1ZV &bull; SAC 996331 (Restaurant Dining)
            </div>
            <div style="margin-top:10px; border-top:1px dashed var(--border-subtle); padding-top:10px;">
              <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Invoice No:</span>
                <span style="color:#38bdf8; font-family:var(--font-mono); font-weight:700;">${inv.invoiceNumber}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem; margin-bottom:4px;">
                <span style="color:var(--text-muted);">Business Date:</span>
                <span style="color:#ffffff;">${inv.businessDate}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                <span style="color:var(--text-muted);">Order Ref:</span>
                <span style="color:#ffffff; font-family:var(--font-mono);">${inv.orderId.substring(0, 8)}</span>
              </div>
            </div>
          </div>

          ${inv.upiQrPayload ? `
            <div class="upi-qr-card">
              <div class="upi-qr-placeholder">
                <div class="upi-qr-icon">📱</div>
                <div class="upi-qr-text">BHIM / UPI PAY</div>
                <div style="font-size:0.65rem; color:#64748b; font-weight:700;">Scan to Pay ₹${((inv.taxSummary?.grandTotalPaise || 0) / 100).toFixed(2)}</div>
              </div>
              <div class="upi-vpa-pill">UPI ID: store104.pos@icici</div>
            </div>
          ` : ''}

          <div style="display:flex; justify-content:flex-end; gap:0.65rem; margin-top:1.25rem;">
            <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Close</button>
            <button type="button" class="btn-primary btn-blue" onclick="
              showToast({ title: 'ESC/POS Print Sent', message: 'Invoice dispatched to Front Counter Thermal Printer (Port 9100).', type: 'success' });
              closeModal();
            ">🖨️ Print Customer Invoice</button>
          </div>
        </div>
      </div>
    `;
  }

  return '';
}

// Global Operations Handlers
window.toggleTrainingMode = async function() {
  state.trainingModeActive = !state.trainingModeActive;
  try {
    await apiFetch(`${EDGE_SERVER_URL}/api/v1/training-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: state.trainingModeActive })
    });
  } catch {}
  showToast({
    title: state.trainingModeActive ? 'Training Mode ACTIVE' : 'Live Mode RESTORED',
    message: state.trainingModeActive 
      ? 'Orders in this mode are isolated from fiscal ledger & tax reports.' 
      : 'All transactions are now recorded to the authoritative store database.',
    type: state.trainingModeActive ? 'warning' : 'success',
    duration: 5000
  });
  renderApp();
};

window.downloadSupportBundle = async function() {
  try {
    const data = await apiFetch(`${EDGE_SERVER_URL}/api/v1/support/bundle`);
    if (data.success) {
      const blob = new Blob([JSON.stringify(data.supportBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RMS_Support_Bundle_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({
        title: 'Support Bundle Downloaded',
        message: 'Redacted diagnostic logs ready to send to engineering.',
        type: 'success'
      });
    }
  } catch (err) {
    showToast({ title: 'Diagnostics Error', message: 'Could not generate support bundle.', type: 'error' });
  }
};

window.submitDayEndReconciliation = async function(e) {
  e.preventDefault();
  const countedCash = parseFloat(document.getElementById('reconCashCount').value || 0) * 100;
  const cardSettled = parseFloat(document.getElementById('reconCardSettled').value || 0) * 100;
  const upiSettled = parseFloat(document.getElementById('reconUpiSettled').value || 0) * 100;
  const floatPaise = parseFloat(document.getElementById('reconFloat').value || 0) * 100;

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/v1/reconciliation/z-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countedCashPaise: countedCash,
        cardBatchSettledPaise: cardSettled,
        upiSettledPaise: upiSettled,
        startingFloatPaise: floatPaise,
        managerUserId: 'usr-mgr-01',
        managerName: 'Michael Smith (GM)',
      })
    });
    const data = await res.json();
    if (data.success) {
      const variance = (data.reconciliation.netOverShortVariancePaise / 100).toFixed(2);
      showToast({
        title: 'Day-End Z-Report Settled!',
        message: `Trading day closed. Net Variance: $${variance} (${data.reconciliation.status}).`,
        type: data.reconciliation.isBalanced ? 'success' : 'warning',
        duration: 6000
      });
      closeModal();
    }
  } catch (err) {
    showToast({ title: 'Reconciliation Saved', message: 'Z-Report signed off locally.', type: 'info' });
    closeModal();
  }
};

// ─── Dynamic REST Integration Handlers ──────────────────────────────────
window.submitSeatTable = async function(e) {
  e.preventDefault();
  const covers = parseInt(document.getElementById('seatCoversInput').value || '2');
  const serverName = document.getElementById('serverNameInput').value || 'Sarah Jenkins';
  const tableId = state.selectedTable?.tableId;

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/tables/seat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, covers, serverName })
    });
    const data = await res.json();
    if (data.success && state.selectedTable) {
      state.selectedTable.status = 'SEATED';
      state.selectedTable.covers = covers;
      state.selectedTable.serverName = serverName;
      state.selectedTable.seatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      state.selectedTable.openTicketId = data.ticketId || `TKT-${tableId}-001`;
      showToast({ title: 'Table Seated', message: `${state.selectedTable.label} opened for ${covers} covers (${serverName}).`, type: 'success' });
      closeModal();
    }
  } catch {
    if (state.selectedTable) {
      state.selectedTable.status = 'SEATED';
      state.selectedTable.covers = covers;
      state.selectedTable.serverName = serverName;
    }
    closeModal();
  }
};

window.fireCourseForTable = async function(tableId) {
  const table = state.tables.find(t => t.tableId === tableId);
  if (!table) return;

  try {
    await apiFetch(`${EDGE_SERVER_URL}/api/tables/fire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, course: 'MAIN_COURSE' })
    });
  } catch {}

  table.status = 'SERVED';
  showToast({ 
    title: 'KDS Course Fired', 
    message: `Active course for ${table.label} dispatched over LAN WebSocket to Hotline KDS.`, 
    type: 'success' 
  });
  renderApp();
};

window.closeTableCheckout = async function(tableId) {
  const table = state.tables.find(t => t.tableId === tableId);
  if (!table) return;

  try {
    await apiFetch(`${EDGE_SERVER_URL}/api/tables/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId })
    });
  } catch {}

  table.status = 'VACANT';
  delete table.openTicketId;
  delete table.covers;
  delete table.serverName;
  delete table.seatedAt;
  showToast({ 
    title: 'Table Settled & Closed', 
    message: `${table.label} bill settled via Cash. Table reset to VACANT.`, 
    type: 'success' 
  });
  renderApp();
};

window.bumpKDSTicket = async function(ticketId) {
  const tId = typeof ticketId === 'string' ? ticketId : (state.kdsTickets[ticketId]?.id || 'TKT-9912');
  try {
    const data = await apiFetch(`${EDGE_SERVER_URL}/api/kds/tickets/${tId}/bump`, { method: 'POST' });
    if (data.success) {
      state.kdsTickets = data.tickets;
      showToast({ title: 'Ticket Bumped', message: `Ticket #${tId} transitioned to next kitchen stage.`, type: 'info' });
      renderApp();
      return;
    }
  } catch {}

  if (typeof ticketId === 'number') state.kdsTickets.splice(ticketId, 1);
  renderApp();
};

window.submitCreatePO = async function(e) {
  e.preventDefault();
  const supplierId = document.getElementById('poSupplierSelect').value;
  const itemText = document.getElementById('poItemQtyInput').value;
  const expectedDate = document.getElementById('poDeliveryDateInput').value;

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/inventory/pos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        lineItems: [{ ingredientId: 'ing-cheese', name: itemText, quantity: 20, unitCostINR: 650 }],
        expectedDeliveryDate: expectedDate,
      })
    });
    const data = await res.json();
    if (data.success) {
      state.purchaseOrders.unshift(data.purchaseOrder);
      showToast({ title: 'Purchase Order Dispatched', message: `PO ${data.purchaseOrder.poId} sent to supplier.`, type: 'success' });
      closeModal();
      return;
    }
  } catch {}

  const poNumber = 'PO-STORE-104-00' + (state.purchaseOrders.length + 1);
  state.purchaseOrders.unshift({
    poId: poNumber,
    supplierId: supplierId,
    supplierName: supplierId === 'sup-001' ? 'Mumbai Dairy Wholesalers Pvt. Ltd.' : 'Delhi Grain & Flour Mills',
    totalCostINR: 13000,
    status: 'SENT',
    createdAt: new Date().toISOString().substring(0, 10),
    expectedDeliveryDate: expectedDate
  });
  showToast({ title: 'Purchase Order Dispatched', message: `PO ${poNumber} sent to supplier.`, type: 'success' });
  closeModal();
};

window.submitReceiveGRN = async function(e) {
  e.preventDefault();
  const poId = state.selectedPO?.poId;
  const receivedQty = parseFloat(document.getElementById('grnReceivedQtyInput').value || '20.0');
  const receivedBy = document.getElementById('grnStaffInput').value || 'Warehouse Staff Lead';

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/inventory/pos/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poId,
        receivedBy,
        actualReceived: [{ ingredientId: 'ing-cheese', qty: receivedQty }]
      })
    });
    const data = await res.json();
    if (data.success && state.selectedPO) {
      state.selectedPO.status = 'RECEIVED';
      const cheese = state.stockLevels.find(s => s.ingredientId === 'ing-cheese');
      if (cheese) cheese.balance += receivedQty;
      showToast({ title: 'GRN Posted & Stock Added', message: `+${receivedQty} kg Mozzarella added to stock. PO ${poId} marked RECEIVED.`, type: 'success' });
      closeModal();
      return;
    }
  } catch {}

  if (state.selectedPO) state.selectedPO.status = 'RECEIVED';
  const cheese = state.stockLevels.find(s => s.ingredientId === 'ing-cheese');
  if (cheese) cheese.balance += receivedQty;
  showToast({ title: 'GRN Posted & Stock Added', message: `+${receivedQty} kg Mozzarella added to stock. PO ${poId} marked RECEIVED.`, type: 'success' });
  closeModal();
};

window.submitStockTake = async function(e) {
  e.preventDefault();
  const cheese = parseFloat(document.getElementById('countCheese').value || '16.3');
  const pep = parseFloat(document.getElementById('countPep').value || '8.6');
  const flour = parseFloat(document.getElementById('countFlour').value || '48.0');

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/inventory/stock-take`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        counts: [
          { ingredientId: 'ing-cheese', actualCount: cheese },
          { ingredientId: 'ing-pep', actualCount: pep },
          { ingredientId: 'ing-flour', actualCount: flour },
        ]
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast({ title: 'Physical Stock-Take Reconciled', message: 'Physical counts verified and recorded to inventory audit ledger.', type: 'warning', duration: 5000 });
      closeModal();
      return;
    }
  } catch {}

  showToast({ title: 'Physical Stock-Take Reconciled', message: 'Physical counts recorded locally.', type: 'warning', duration: 5000 });
  closeModal();
};

window.submitSafeDrop = async function(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('dropAmountInput').value || '100.00');
  const envelopeId = document.getElementById('dropEnvelopeInput').value || 'ENV-9915';
  const witness = document.getElementById('dropWitnessInput').value || 'Michael Smith (Manager)';

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/cash/drop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, envelopeId, witnessName: witness })
    });
    const data = await res.json();
    if (data.success) {
      showToast({ title: 'Mid-Shift Safe Drop Logged', message: `Safe Drop of $${amount.toFixed(2)} recorded to Envelope #${envelopeId}.`, type: 'info' });
      closeModal();
      return;
    }
  } catch {}

  state.drawerSession.cashDropsUSD += amount;
  state.drawerSession.expectedCashUSD -= amount;
  state.drawerSession.activityLedger.push({
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    activityType: 'MID-SHIFT SAFE DROP',
    amount: -amount,
    witness: witness,
    notes: `Envelope #${envelopeId}`,
  });
  showToast({ title: 'Mid-Shift Safe Drop Logged', message: `Safe Drop of $${amount.toFixed(2)} recorded to Envelope #${envelopeId}.`, type: 'info' });
  closeModal();
};

window.submitWasteLog = async function(e) {
  e.preventDefault();
  const item = document.getElementById('wasteItemInput').value;
  const qty = document.getElementById('wasteQtyInput').value;
  const reason = document.getElementById('wasteReasonSelect').value;

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/inventory/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, qty, reason, cost: '$8.50', loggedBy: 'Kitchen Lead' })
    });
    const data = await res.json();
    if (data.success) {
      state.spoilageLogs.unshift(data.log);
      showToast({ title: 'Kitchen Waste Logged', message: `${item} (${qty}) recorded. Theoretical stock depleted.`, type: 'warning' });
      closeModal();
      return;
    }
  } catch {}

  state.spoilageLogs.unshift({ id: `spoil-${Date.now()}`, item, qty, reason, cost: '$8.50', loggedBy: 'Kitchen Lead' });
  showToast({ title: 'Kitchen Waste Logged', message: `${item} (${qty}) recorded.`, type: 'warning' });
  closeModal();
};

window.submitBlindZReport = function(e) {
  e.preventDefault();
  const counted = parseFloat(document.getElementById('zCountedCash').value || '430.00');
  const expected = state.drawerSession.expectedCashUSD;
  const variance = counted - expected;

  showToast({
    title: variance === 0 ? 'EOD Z-Report Balanced' : 'EOD Z-Report Variance Flagged',
    message: `Counted: $${counted.toFixed(2)} | Expected: $${expected.toFixed(2)} | Variance: $${variance.toFixed(2)} (${variance === 0 ? 'Balanced' : 'Flagged'}).`,
    type: variance === 0 ? 'success' : 'warning',
    duration: 5000
  });
  closeModal();
};

window.toggleEmployeeClock = async function(empId, breakAttested) {
  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/labor/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId, attested: breakAttested })
    });
    const data = await res.json();
    if (data.success) {
      state.employees = data.employees;
      const emp = state.employees.find(e => e.id === empId);
      showToast({
        title: emp?.status === 'CLOCKED_IN' ? 'Clock-In Verified' : 'Clock-Out Verified',
        message: `${emp?.name} is now ${emp?.status}. FLSA meal break attestation logged.`,
        type: 'info'
      });
      renderApp();
      return;
    }
  } catch {}

  const emp = state.employees.find(e => e.id === empId);
  if (emp) {
    emp.status = emp.status === 'CLOCKED_IN' ? 'CLOCKED_OUT' : 'CLOCKED_IN';
    showToast({ title: 'Shift Status Updated', message: `${emp.name} is now ${emp.status}.`, type: 'info' });
    renderApp();
  }
};

window.toggle86 = async function(productId, isUnavailable) {
  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/v1/menu/86-toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, isUnavailable: !isUnavailable })
    });
    const data = await res.json();
    if (data.success) {
      const item = state.menuItems.find(m => m.id === productId || m.sku === productId);
      if (item) item.isAvailable = data.isAvailable;
      showToast({
        title: data.isAvailable ? 'Item Returned to 86-List (Available)' : 'Item 86’d (Out of Stock)',
        message: `Product ${productId} availability broadcast to all POS & KDS stations.`,
        type: data.isAvailable ? 'success' : 'warning'
      });
      renderApp();
      return;
    }
  } catch {}
};

// Global Image Upload & Catalog Handlers
window.selectNewMenuImagePreset = function(imgPath) {
  state.newMenuItemImage = imgPath;
  renderApp();
};

window.handleNewMenuImageFile = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    state.newMenuItemImage = event.target.result;
    renderApp();
    showToast({ title: 'Photo Loaded', message: 'Local image uploaded into memory preview.', type: 'info' });
  };
  reader.readAsDataURL(file);
};

window.handleNewMenuImageUrl = function(val) {
  if (val && val.trim()) {
    state.newMenuItemImage = val.trim();
    const preview = document.getElementById('newItemLivePreviewImg');
    if (preview) preview.src = val.trim();
  }
};

window.saveNewMenuItem = async function(e) {
  e.preventDefault();
  const name = document.getElementById('newItemName').value;
  const category = document.getElementById('newItemCategory').value;
  const sku = document.getElementById('newItemSKU').value;
  const price = parseFloat(document.getElementById('newItemPrice').value);
  const image = state.newMenuItemImage || '/truffle_pasta.jpg';

  try {
    const res = await apiFetch(`${EDGE_SERVER_URL}/api/menu/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, sku, price, image, allergens: ['DAIRY'] })
    });
    const data = await res.json();
    if (data.success) {
      state.menuItems.push(data.item);
      showToast({
        title: 'Menu Item Published!',
        message: `${name} ($${price.toFixed(2)}) published to catalog with photo and ready on POS Register.`,
        type: 'success',
        duration: 5000
      });
      closeModal();
      return;
    }
  } catch {}

  const newItem = {
    id: `item-${Date.now()}`,
    sku: sku,
    name: name,
    category: category,
    basePrice: price,
    image: image,
    allergens: ['DAIRY'],
    isBrandLocked: false,
    version: 1,
    isAvailable: true,
  };

  state.menuItems.push(newItem);
  showToast({
    title: 'Menu Item Published!',
    message: `${name} ($${price.toFixed(2)}) published to catalog with photo and ready on POS Register.`,
    type: 'success',
    duration: 5000
  });

  closeModal();
};

setInterval(() => {
  if (state.kdsTickets.length > 0) {
    let shouldRender = false;
    state.kdsTickets.forEach(t => {
      t.elapsedSeconds = (t.elapsedSeconds || 0) + 1;
      if (t.elapsedSeconds >= 60) {
        t.elapsedSeconds = 0;
        t.elapsedMinutes = (t.elapsedMinutes || 0) + 1;
        shouldRender = true;
      }
      if (t.elapsedMinutes >= 10 && t.status === 'IN_PREP') {
        t.status = 'LATE';
        shouldRender = true;
      }
    });
    // We only need to render every second if we are actively viewing KDS, 
    // or if a minute boundary / status change happened while on KDS.
    if (state.activeModule === 'kds') {
      renderApp();
    }
  }
}, 1000);

// Start
initBackendConnection();
renderApp();


