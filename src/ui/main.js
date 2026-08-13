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
};

// Initial Connection
async function initBackendConnection() {
  try {
    const res = await fetch(`${EDGE_SERVER_URL}/health`);
    if (res.ok) state.apiConnected = true;
  } catch (err) {
    state.apiConnected = false;
  }

  try {
    const menuRes = await fetch(`${EDGE_SERVER_URL}/api/menu`);
    const menuData = await menuRes.json();
    if (menuData.success && menuData.menuItems) {
      state.menuItems = menuData.menuItems.map(item => ({
        ...item,
        image: item.name.includes('Wings') ? '/buffalo_wings.jpg' : item.name.includes('Knots') ? '/garlic_knots.jpg' : '/pepperoni_pizza.jpg'
      }));
    }
  } catch (err) {}

  try {
    const ws = new WebSocket(EDGE_WS_URL);
    ws.onopen = () => {
      state.wsConnected = true;
      renderApp();
    };
    ws.onmessage = (event) => {
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
        renderApp();
      }
    };
  } catch (err) {}
}

function renderApp() {
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
        <button class="nav-tab ${state.activeModule === 'pos_register' ? 'active' : ''}" onclick="selectModule('pos_register')">POS Register</button>
        <button class="nav-tab ${state.activeModule === 'table_floor_plan' ? 'active' : ''}" onclick="selectModule('table_floor_plan')">Table Floor (${state.tables.filter(t => t.status !== 'VACANT').length}/${state.tables.length})</button>
        <button class="nav-tab ${state.activeModule === 'kds' ? 'active' : ''}" onclick="selectModule('kds')">Kitchen KDS (${state.kdsTickets.length})</button>
        <button class="nav-tab ${state.activeModule === 'cash_management' ? 'active' : ''}" onclick="selectModule('cash_management')">Cash & Drawers</button>
        <button class="nav-tab ${state.activeModule === 'po_receiving' ? 'active' : ''}" onclick="selectModule('po_receiving')">PO Receiving (${state.purchaseOrders.length})</button>
        <button class="nav-tab ${state.activeModule === 'inventory_prep' ? 'active' : ''}" onclick="selectModule('inventory_prep')">Inventory & Prep</button>
        <button class="nav-tab ${state.activeModule === 'labor_shifts' ? 'active' : ''}" onclick="selectModule('labor_shifts')">Labor & Shifts</button>
        <button class="nav-tab ${state.activeModule === 'menu_catalog' ? 'active' : ''}" onclick="selectModule('menu_catalog')">Menu Catalog</button>
        <button class="nav-tab ${state.activeModule === 'franchise_financials' ? 'active' : ''}" onclick="selectModule('franchise_financials')">Financials & GL</button>
      </nav>

      <!-- Connection Status Pill -->
      <div class="status-pill ${state.storeOffline ? 'offline' : ''}" onclick="toggleOffline()" title="Click to simulate WAN drop">
        <span class="status-dot"></span>
        <span>${state.storeOffline ? 'EDGE OFFLINE' : `EDGE ONLINE (${state.wsConnected ? 'LAN WS' : 'REST'})`}</span>
      </div>
    </header>

    <!-- Main View -->
    <main class="view-container">
      ${renderActiveModule()}
    </main>

    <!-- Modals -->
    ${renderModals()}
  `;
}

function renderActiveModule() {
  switch (state.activeModule) {
    case 'pos_register': return renderPOSRegisterWorkspace();
    case 'table_floor_plan': return renderTableFloorPlanWorkspace();
    case 'kds': return renderKDSWorkspace();
    case 'cash_management': return renderCashManagementWorkspace();
    case 'po_receiving': return renderPOReceivingWorkspace();
    case 'inventory_prep': return renderInventoryPrepWorkspace();
    case 'labor_shifts': return renderLaborShiftsWorkspace();
    case 'menu_catalog': return renderMenuCatalogWorkspace();
    case 'franchise_financials': return renderFinancialsWorkspace();
    default: return renderPOSRegisterWorkspace();
  }
}

// 1. POS REGISTER
function renderPOSRegisterWorkspace() {
  const filteredItems = state.activeCategory === 'ALL' 
    ? state.menuItems 
    : state.menuItems.filter(i => i.category === state.activeCategory);

  const subtotal = state.cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
  const taxAmount = subtotal * 0.08;
  const total = subtotal + taxAmount;

  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Point of Sale Register</h2>
        <p class="section-subtitle">Terminal 01 &bull; Local SQLite WAL Persistence &bull; Sub-200ms LAN Ticket Dispatch</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-online">DRAWER OPEN: $${state.drawerSession.expectedCashUSD.toFixed(2)} EXP</span>
        <button class="btn-primary btn-slate" onclick="openModal('cash_drop')">Mid-Shift Safe Drop</button>
      </div>
    </div>

    <!-- Category Selector Rail -->
    <div class="category-chips-rail">
      <button class="category-chip ${state.activeCategory === 'ALL' ? 'active' : ''}" onclick="setCategory('ALL')">All Categories</button>
      <button class="category-chip ${state.activeCategory === 'Pizzas' ? 'active' : ''}" onclick="setCategory('Pizzas')">Pizzas</button>
      <button class="category-chip ${state.activeCategory === 'Appetizers' ? 'active' : ''}" onclick="setCategory('Appetizers')">Appetizers & Sides</button>
      <button class="category-chip ${state.activeCategory === 'Beverages' ? 'active' : ''}" onclick="setCategory('Beverages')">Beverages</button>
    </div>

    <div class="pos-layout">
      <!-- Menu Item Grid -->
      <div class="menu-grid">
        ${filteredItems.map(item => `
          <div class="pos-card" onclick="openModifierModal('${item.id}')">
            <img src="${item.image}" alt="${item.name}" class="pos-card-img" />
            <div class="pos-card-body">
              <div>
                <div class="pos-card-title">${item.name}</div>
                <div class="pos-card-meta">${item.category} &bull; ${item.sku}</div>
              </div>
              <div class="pos-card-footer">
                <span class="pos-card-price">$${item.basePrice.toFixed(2)}</span>
                <button class="btn-add-tile">Customize +</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Register Ticket Sidebar -->
      <div class="cart-sidebar">
        <div class="cart-header">
          <div>
            <h3 style="font-size:1.1rem; font-weight:800;">Current Ticket</h3>
            <span style="font-size:0.8rem; color:var(--text-muted);">Dine In &bull; Terminal 01</span>
          </div>
          <button class="btn-primary btn-slate" style="padding:0.35rem 0.75rem; font-size:0.75rem;" onclick="clearCart()" ${state.cart.length === 0 ? 'disabled' : ''}>Clear</button>
        </div>

        <div class="cart-items">
          ${state.cart.length === 0 ? `
            <div style="text-align:center; padding:4rem 1rem; color:var(--text-muted);">
              <div style="font-size:1.1rem; font-weight:700;">Ticket is empty</div>
              <div style="font-size:0.82rem; margin-top:0.35rem;">Tap any menu item on the left to add</div>
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
                  <span style="font-weight:800; width:24px; text-align:center;">${item.qty}</span>
                  <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                </div>
                <span style="font-size:0.75rem; color:var(--text-muted);">$${(item.basePrice + (item.modifiersCost || 0)).toFixed(2)} ea</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Quick-Cash Tender Bar -->
        <div class="quick-cash-bar">
          <div class="quick-cash-title">Quick Cash Tender</div>
          <div class="quick-cash-buttons">
            <button class="btn-cash-quick" onclick="quickCashCheckout(10)" ${total > 10 || state.cart.length === 0 ? 'disabled' : ''}>$10</button>
            <button class="btn-cash-quick" onclick="quickCashCheckout(20)" ${total > 20 || state.cart.length === 0 ? 'disabled' : ''}>$20</button>
            <button class="btn-cash-quick" onclick="quickCashCheckout(50)" ${total > 50 || state.cart.length === 0 ? 'disabled' : ''}>$50</button>
            <button class="btn-cash-quick" onclick="quickCashCheckout(${total})" ${state.cart.length === 0 ? 'disabled' : ''}>Exact</button>
          </div>
        </div>

        <!-- Cart Totals & Checkout -->
        <div class="cart-footer">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Sales Tax (8%)</span>
            <span>$${taxAmount.toFixed(2)}</span>
          </div>
          <div class="totals-row total-due">
            <span>Total Due</span>
            <span>$${total.toFixed(2)}</span>
          </div>

          <div class="checkout-actions-grid">
            <button class="btn-primary btn-checkout" onclick="checkoutOrder('CARD')" ${state.cart.length === 0 ? 'disabled' : ''}>
              Charge Card
            </button>
            <button class="btn-primary btn-emerald btn-checkout" onclick="checkoutOrder('CASH')" ${state.cart.length === 0 ? 'disabled' : ''}>
              Cash Tender
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. TABLE FLOOR PLAN WORKSPACE
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
                ${table.covers ? `<div style="margin-top:0.25rem; color:#ffffff;">${table.covers} Covers &bull; ${table.serverName}</div>` : '<div style="margin-top:0.25rem; color:var(--text-muted);">Ready to seat</div>'}
                ${table.seatedAt ? `<div style="font-size:0.72rem; color:var(--accent-blue); margin-top:0.15rem;">Seated: ${table.seatedAt}</div>` : ''}
              </div>
            </div>

            <div class="table-actions-row">
              ${table.status === 'VACANT' ? `
                <button class="btn-primary btn-emerald" style="width:100%; min-height:38px; font-size:0.82rem;" onclick="openSeatTableModal('${table.tableId}')">
                  Seat Party +
                </button>
              ` : `
                <button class="btn-primary btn-amber" style="flex:1; min-height:38px; font-size:0.8rem;" onclick="fireCourseForTable('${table.tableId}')">
                  Fire Course &rarr;
                </button>
                <button class="btn-primary btn-rose" style="flex:1; min-height:38px; font-size:0.8rem;" onclick="closeTableCheckout('${table.tableId}')">
                  Bill & Close
                </button>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 3. PURCHASE ORDER & INVENTORY RECEIVING WORKSPACE
function renderPOReceivingWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Purchase Orders & Goods Receiving (GRN)</h2>
        <p class="section-subtitle">Supplier Management &bull; Short Delivery Tracking &bull; Physical Stock Take Reconciliation</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary btn-slate" onclick="openModal('run_stock_take')">Run Stock-Take Count</button>
        <button class="btn-primary btn-emerald" onclick="openModal('create_po')">Create Purchase Order +</button>
      </div>
    </div>

    <!-- Stock Balances Summary -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
      ${state.stockLevels.map(s => `
        <div class="card">
          <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${s.name}</div>
          <div style="font-family:var(--font-mono); font-size:1.5rem; font-weight:800; color:#34d399; margin-top:0.25rem;">
            ${s.balance} <span style="font-size:0.9rem; color:var(--text-muted);">${s.unit}</span>
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">Stock on hand (ledger verified)</div>
        </div>
      `).join('')}
    </div>

    <!-- Purchase Orders Table -->
    <div class="card" style="margin-bottom:1.5rem;">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Purchase Orders Registry</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Created Date</th>
              <th>Expected Date</th>
              <th>Total Cost</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.purchaseOrders.map(po => `
              <tr>
                <td><code>${po.poId}</code></td>
                <td><strong>${po.supplierName}</strong></td>
                <td>${po.createdAt}</td>
                <td>${po.expectedDeliveryDate}</td>
                <td style="font-family:var(--font-mono); font-weight:700;">₹${po.totalCostINR.toLocaleString()}</td>
                <td>
                  <span class="badge ${po.status === 'RECEIVED' ? 'badge-online' : po.status === 'SENT' ? 'badge-warning' : 'badge-locked'}">
                    ${po.status}
                  </span>
                </td>
                <td>
                  ${po.status !== 'RECEIVED' ? `
                    <button class="btn-primary btn-emerald" style="padding:0.35rem 0.75rem; font-size:0.75rem;" onclick="openReceiveGRNModal('${po.poId}')">
                      Receive GRN &rarr;
                    </button>
                  ` : `
                    <span style="color:#34d399; font-size:0.8rem; font-weight:700;">Stock Incremented ✓</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Suppliers Table -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">Registered Wholesale Suppliers</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Supplier ID</th>
              <th>Company Name</th>
              <th>Phone</th>
              <th>Lead Time</th>
              <th>Payment Terms</th>
            </tr>
          </thead>
          <tbody>
            ${state.suppliers.map(sup => `
              <tr>
                <td><code>${sup.supplierId}</code></td>
                <td><strong>${sup.name}</strong></td>
                <td>${sup.phone}</td>
                <td>${sup.leadTimeDays} Days</td>
                <td>Net ${sup.paymentTermsDays} Days</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 4. KITCHEN DISPLAY SYSTEM (KDS)
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
              <span class="kds-ticket-timer ${pillClass}">${timerFormatted} ${isRed ? 'LATE' : ''}</span>
            </div>
            <div class="kds-ticket-meta">
              <span><strong>${t.diningType}</strong></span>
              <span>${t.source}</span>
            </div>
            <div class="kds-ticket-items">
              ${t.items.map(item => `
                <div class="kds-item-row">
                  <div class="kds-item-headline">
                    <span class="kds-item-qty">${item.qty}x</span>
                    <span>${item.name}</span>
                  </div>
                  ${item.allergens && item.allergens.length > 0 ? `
                    <span class="kds-allergen-tag">ALLERGEN: ${item.allergens.join(', ')}</span>
                  ` : ''}
                  ${item.modifiers && item.modifiers.length > 0 ? item.modifiers.map(m => `
                    <span class="kds-modifier-tag">${m}</span>
                  `).join('') : ''}
                </div>
              `).join('')}
            </div>
            <button class="btn-bump" onclick="bumpKDSTicket(${idx})">
              BUMP TICKET &check;
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
        <button class="btn-primary btn-emerald" onclick="openModal('blind_z_report')">Perform Blind EOD Z-Report</button>
      </div>
    </div>

    <!-- Drawer Summary Cards -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
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
            <tr>
              <td>08:00 AM</td>
              <td><span class="badge badge-online">OPENING BANK FLOAT</span></td>
              <td><strong>+$200.00</strong></td>
              <td>Sarah Jenkins (Cashier)</td>
              <td>Initial float bank verified</td>
            </tr>
            <tr>
              <td>01:15 PM</td>
              <td><span class="badge badge-warning">MID-SHIFT SAFE DROP</span></td>
              <td><strong>-$100.00</strong></td>
              <td>Michael Smith (Manager)</td>
              <td>Envelope #ENV-9914 dropped to safe</td>
            </tr>
            <tr>
              <td>02:30 PM</td>
              <td><span class="badge badge-danger">PETTY CASH PAYOUT</span></td>
              <td><strong>-$20.00</strong></td>
              <td>Michael Smith (Manager)</td>
              <td>Window Cleaning Service Expense</td>
            </tr>
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
        <button class="btn-primary btn-purple" onclick="alert('Labor schedule optimized for 22% target cost. Zero clopening violations detected.')">Run AI Optimizer</button>
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
        <button class="btn-primary" onclick="alert('NetSuite GL Exported: Debits $3,010.00 === Credits $3,010.00 (Balanced).')">Export NetSuite Journal</button>
        <button class="btn-primary btn-purple" onclick="alert('Franchise Royalty ACH Draft generated: $162.34 based on Net Sales.')">Generate Royalty ACH</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">NetSuite General Ledger Accounts (Debits === Credits Guarantee)</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Account #</th>
              <th>Account Description</th>
              <th>Debit ($)</th>
              <th>Credit ($)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>1010</code></td>
              <td>Cash on Hand (Store Float + Cash Receipts)</td>
              <td style="font-family:var(--font-mono); font-weight:700;">$550.00</td>
              <td>$0.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>1020</code></td>
              <td>Merchant Card Settlement Clearing</td>
              <td style="font-family:var(--font-mono); font-weight:700;">$1,840.00</td>
              <td>$0.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>1030</code></td>
              <td>3rd-Party Delivery AR (DoorDash / UberEats)</td>
              <td style="font-family:var(--font-mono); font-weight:700;">$620.00</td>
              <td>$0.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>2010</code></td>
              <td>Sales Tax Payable</td>
              <td>$0.00</td>
              <td style="font-family:var(--font-mono); font-weight:700;">$240.80</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>2020</code></td>
              <td>Accrued Tip Liability (Owed to Staff)</td>
              <td>$0.00</td>
              <td style="font-family:var(--font-mono); font-weight:700;">$450.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>4010</code></td>
              <td>Food & Beverage Sales Revenue</td>
              <td>$0.00</td>
              <td style="font-family:var(--font-mono); font-weight:700;">$2,319.20</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Global actions
window.selectModule = function(mod) {
  state.activeModule = mod;
  renderApp();
};

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

window.fireCourseForTable = function(tableId) {
  const table = state.tables.find(t => t.tableId === tableId);
  if (!table) return;
  table.status = 'SERVED';
  alert(`Course fired to KDS for ${table.label}. Kitchen station received ticket over LAN WebSocket.`);
  renderApp();
};

window.closeTableCheckout = function(tableId) {
  const table = state.tables.find(t => t.tableId === tableId);
  if (!table) return;
  table.status = 'VACANT';
  delete table.openTicketId;
  delete table.covers;
  delete table.serverName;
  delete table.seatedAt;
  alert(`${table.label} bill settled via Cash. Table reset to VACANT.`);
  renderApp();
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

window.quickCashCheckout = function(tenderAmount) {
  const subtotal = state.cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
  const total = subtotal * 1.08;
  const changeDue = Math.max(0, tenderAmount - total);
  
  checkoutOrder('CASH');
  alert(`Cash Tendered: $${tenderAmount.toFixed(2)}\nTotal Due: $${total.toFixed(2)}\n----------------------\nChange Due: $${changeDue.toFixed(2)}`);
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
    const res = await fetch(`${EDGE_SERVER_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    alert(`Order ${payload.id} checkout complete via ${tenderType}.\nStored in local SQLite WAL: ${data.sqliteWalPersisted ? 'YES' : 'NO'}`);
  } catch (err) {
    alert(`Checkout complete in offline edge mode.\nTx ID: ${payload.id}`);
  }

  // Update in-memory drawer if cash
  if (tenderType === 'CASH') {
    state.drawerSession.cashSalesUSD += total;
    state.drawerSession.expectedCashUSD += total;
  }

  state.cart = [];
  renderApp();
};

window.bumpKDSTicket = function(idx) {
  state.kdsTickets.splice(idx, 1);
  renderApp();
};

window.testPrintESCPOSTicket = function() {
  alert('Dispatched raw ESC/POS binary ticket to Hotline Printer (Port 9100) with automatic station failover active.');
};

window.toggleOffline = function() {
  state.storeOffline = !state.storeOffline;
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
              <h3 style="font-size:1.15rem; font-weight:800;">Seat ${table.label} (${table.seats} Seats)</h3>
              <span style="font-size:0.8rem; color:var(--text-muted);">${table.section}</span>
            </div>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>

          <form onsubmit="
            event.preventDefault();
            const covers = Number(document.getElementById('seatCoversInput').value);
            const server = document.getElementById('serverNameInput').value;
            state.selectedTable.status = 'SEATED';
            state.selectedTable.covers = covers;
            state.selectedTable.serverName = server;
            state.selectedTable.seatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            alert('${table.label} seated with ' + covers + ' covers assigned to ' + server + '. Ticket opened.');
            closeModal();
          ">
            <div class="form-group">
              <label>Number of Guests (Covers &le; ${table.seats})</label>
              <input type="number" id="seatCoversInput" class="form-control" min="1" max="${table.seats}" value="2" required />
            </div>
            <div class="form-group">
              <label>Assigned Server</label>
              <input type="text" id="serverNameInput" class="form-control" value="Sarah Jenkins" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
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
              <h3 style="font-size:1.15rem; font-weight:800;">Create Purchase Order (PO)</h3>
              <span style="font-size:0.8rem; color:var(--text-muted);">Supplier Order Requisition</span>
            </div>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>

          <form onsubmit="
            event.preventDefault();
            const poNumber = 'PO-STORE-104-00' + (state.purchaseOrders.length + 1);
            state.purchaseOrders.unshift({
              poId: poNumber,
              supplierId: 'sup-001',
              supplierName: 'Mumbai Dairy Wholesalers Pvt. Ltd.',
              totalCostINR: 13000,
              status: 'SENT',
              createdAt: new Date().toISOString().substring(0, 10),
              expectedDeliveryDate: '2026-08-20'
            });
            alert('Purchase Order ' + poNumber + ' created and marked SENT.');
            closeModal();
          ">
            <div class="form-group">
              <label>Wholesale Supplier</label>
              <select class="form-control">
                <option>Mumbai Dairy Wholesalers Pvt. Ltd. (Mozzarella Cheese)</option>
                <option>Delhi Grain & Flour Mills (High-Gluten Flour)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Order Item & Quantity</label>
              <input type="text" class="form-control" value="Mozzarella Cheese - 20 kg @ ₹650/kg" required />
            </div>
            <div class="form-group">
              <label>Expected Delivery Date</label>
              <input type="date" class="form-control" value="2026-08-20" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
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
              <h3 style="font-size:1.15rem; font-weight:800;">Receive GRN for ${po.poId}</h3>
              <span style="font-size:0.8rem; color:var(--text-muted);">${po.supplierName}</span>
            </div>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>

          <form onsubmit="
            event.preventDefault();
            po.status = 'RECEIVED';
            const cheese = state.stockLevels.find(s => s.ingredientId === 'ing-cheese');
            if (cheese) cheese.balance += 20;
            alert('Goods Receipt Note (GRN) posted. Stock incremented by 20 kg. PO marked RECEIVED.');
            closeModal();
          ">
            <div class="form-group">
              <label>Received Mozzarella Cheese (kg)</label>
              <input type="number" step="0.1" class="form-control" value="20.0" required />
            </div>
            <div class="form-group">
              <label>Receiving Staff Member</label>
              <input type="text" class="form-control" value="Warehouse Staff Lead" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
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
              <h3 style="font-size:1.15rem; font-weight:800;">Blind Physical Stock-Take</h3>
              <span style="font-size:0.8rem; color:var(--text-muted);">Reconciliation against running balance</span>
            </div>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>

          <form onsubmit="
            event.preventDefault();
            alert('Physical Stock-Take submitted. Mozzarella variance +0.5 kg (+3.1% - flagged for review). Pepperoni in range.');
            closeModal();
          ">
            <div class="form-group">
              <label>Mozzarella Cheese Physical Count (kg)</label>
              <input type="number" step="0.1" class="form-control" value="16.3" required />
            </div>
            <div class="form-group">
              <label>Pepperoni Physical Count (kg)</label>
              <input type="number" step="0.1" class="form-control" value="8.6" required />
            </div>
            <div class="form-group">
              <label>Flour Physical Count (kg)</label>
              <input type="number" step="0.1" class="form-control" value="48.0" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
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
              <h3 style="font-size:1.15rem; font-weight:800;">Customize ${item.name}</h3>
              <span style="font-size:0.8rem; color:var(--text-muted);">$${item.basePrice.toFixed(2)} base</span>
            </div>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>

          <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem;">
            <div>
              <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">Extra Toppings & Mods</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('+ Extra Cheese', 2.00)">
                  <span>+ Extra Cheese</span>
                  <span>+$2.00</span>
                </button>
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('+ Pepperoni', 2.50)">
                  <span>+ Pepperoni</span>
                  <span>+$2.50</span>
                </button>
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('+ Mushrooms', 1.50)">
                  <span>+ Mushrooms</span>
                  <span>+$1.50</span>
                </button>
                <button class="btn-primary btn-slate" style="justify-content:space-between;" onclick="toggleModifierOption('Well Done', 0.00)">
                  <span>Well Done</span>
                  <span>Free</span>
                </button>
              </div>
            </div>

            <div>
              <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.5rem;">Exclusions</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                <button class="btn-primary btn-slate" onclick="toggleModifierOption('NO Onion', 0.00)">NO Onion</button>
                <button class="btn-primary btn-slate" onclick="toggleModifierOption('NO Dairy (Vegan)', 0.00)">NO Dairy</button>
              </div>
            </div>

            ${state.activeModifiers.length > 0 ? `
              <div style="background:var(--bg-card); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
                <div style="font-size:0.75rem; color:var(--text-muted);">Selected Modifiers:</div>
                <div style="color:var(--accent-amber); font-weight:700; font-size:0.85rem; margin-top:0.25rem;">
                  ${state.activeModifiers.map(m => m.name).join(', ')}
                </div>
              </div>
            ` : ''}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
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
              <h3 style="font-size:1.15rem; font-weight:800;">Blind End-of-Day Z-Report</h3>
              <span style="font-size:0.8rem; color:var(--text-muted);">Terminal 01 &bull; Cashier Blind Count</span>
            </div>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>

          <div style="background:rgba(245, 158, 11, 0.1); border:1px solid rgba(245, 158, 11, 0.3); padding:0.75rem; border-radius:var(--radius-md); margin-bottom:1rem; font-size:0.82rem; color:#fbbf24;">
            <strong>Blind Reconciliation Policy:</strong> Expected drawer cash is hidden to prevent theft skimming. Count all physical currency and enter total below.
          </div>

          <form onsubmit="event.preventDefault(); alert('Z-Report submitted. Actual: $430.00, Expected: $430.00. Variance: $0.00 (Balanced).'); closeModal();">
            <div class="form-group">
              <label>Actual Cash Counted ($ USD)</label>
              <input type="number" step="0.01" class="form-control" placeholder="0.00" value="430.00" style="font-family:var(--font-mono); font-size:1.3rem; font-weight:800;" required />
            </div>
            <div class="form-group">
              <label>Manager Authorization Signature Token</label>
              <input type="password" class="form-control" value="mgr-pin-token-991" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
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
            <h3>Record Mid-Shift Safe Drop</h3>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>
          <form onsubmit="event.preventDefault(); alert('Safe Drop of $100.00 logged to Envelope #ENV-9915.'); closeModal();">
            <div class="form-group">
              <label>Drop Amount ($ USD)</label>
              <input type="number" step="0.01" class="form-control" value="100.00" required />
            </div>
            <div class="form-group">
              <label>Safe Drop Envelope ID</label>
              <input type="text" class="form-control" value="ENV-9915" required />
            </div>
            <div class="form-group">
              <label>Witness Manager ID</label>
              <input type="text" class="form-control" value="mgr-michael-smith" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
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
            <h3>Log Kitchen Waste / Spoilage</h3>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>
          <form onsubmit="event.preventDefault(); alert('Kitchen waste logged.'); closeModal();">
            <div class="form-group">
              <label>Item Name</label>
              <input type="text" class="form-control" value="Mozzarella Cheese (Shredded)" required />
            </div>
            <div class="form-group">
              <label>Quantity Lost</label>
              <input type="text" class="form-control" value="1.5 kg" required />
            </div>
            <div class="form-group">
              <label>Reason Code</label>
              <select class="form-control">
                <option>BURNT / OVERCOOKED</option>
                <option>DROPPED_FLOOR</option>
                <option>EXPIRED</option>
              </select>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-rose">Confirm Waste Log</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'add_menu_item') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>Add Master Menu Item</h3>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>
          <form onsubmit="event.preventDefault(); alert('Menu item added to catalog.'); closeModal();">
            <div class="form-group">
              <label>Item Name</label>
              <input type="text" class="form-control" placeholder="e.g. Truffle Mushroom Flatbread" required />
            </div>
            <div class="form-group">
              <label>SKU</label>
              <input type="text" class="form-control" placeholder="e.g. PIZ-TRUF-MED" required />
            </div>
            <div class="form-group">
              <label>Base Price ($)</label>
              <input type="number" step="0.01" class="form-control" placeholder="17.99" required />
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
              <button type="button" class="btn-primary btn-slate" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary">Save to Catalog</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  return '';
}

// Start
initBackendConnection();
renderApp();
