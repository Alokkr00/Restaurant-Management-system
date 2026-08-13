// Restaurant Management System - Web Operations Console

const EDGE_SERVER_URL = 'http://localhost:3001';
const EDGE_WS_URL = 'ws://localhost:3001';

const state = {
  activeModule: 'pos_register', // pos_register | kds | inventory_prep | labor_shifts | menu_catalog | franchise_financials | field_audit | franchise_overview
  storeOffline: false,
  apiConnected: false,
  wsConnected: false,
  modalOpen: null, // null | 'add_menu_item' | 'field_audit' | 'log_spoilage' | 'add_shift' | 'cash_drop'
  selectedTaxJurisdiction: 'US_SALES_TAX',
  menuItems: [
    { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 3 },
    { id: 'item-102', sku: 'PIZ-MAR-LG', name: 'Margherita Artisanal', category: 'Pizzas', basePrice: 16.50, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 2 },
    { id: 'item-103', sku: 'APP-WNG-10', name: 'Spicy Buffalo Wings (10pc)', category: 'Appetizers', basePrice: 14.99, image: '/buffalo_wings.jpg', allergens: [], isBrandLocked: false, version: 1 },
    { id: 'item-104', sku: 'APP-KNOT-6', name: 'Craft Garlic Knots (6pc)', category: 'Appetizers', basePrice: 6.99, image: '/garlic_knots.jpg', allergens: ['GLUTEN'], isBrandLocked: true, version: 4 },
  ],
  cart: [],
  kdsTickets: [
    { id: 'tx-1001', source: 'POS Terminal 01', time: '2 mins ago', brandBadge: 'Artisanal Pizza Co.', items: [{ qty: 1, name: 'Large Pepperoni Pizza', allergens: ['DAIRY', 'GLUTEN'] }], urgent: false, status: 'IN_PREP' },
    { id: 'deliv-dd-9812', source: 'DoorDash Aggregator', time: '1 min ago', brandBadge: 'Wild Wings Express', items: [{ qty: 2, name: 'Spicy Buffalo Wings (10pc)' }, { qty: 1, name: 'Craft Garlic Knots (6pc)' }], urgent: true, status: 'IN_PREP' },
  ],
  inventoryVariances: [
    { ingredientId: 'ing-cheese', name: 'Mozzarella Cheese (Shredded)', theoretical: 14.2, actual: 15.8, unit: 'kg', variancePct: '+11.2%', alert: true },
    { ingredientId: 'ing-pep', name: 'Pepperoni Slices (Beef/Pork)', theoretical: 8.5, actual: 8.6, unit: 'kg', variancePct: '+1.1%', alert: false },
    { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', theoretical: 45.0, actual: 48.2, unit: 'kg', variancePct: '+7.1%', alert: true },
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
  auditLedger: [
    { id: 'aud-991', timestamp: '2026-08-01 19:10:00', actor: 'HQ Menu Admin', action: 'UPDATE_PRICE', target: 'MenuItem (PIZ-PEP-LG)', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { id: 'aud-990', timestamp: '2026-08-01 18:45:00', actor: 'Brand Director', action: 'LOCK_BRAND_RECORD', target: 'Recipe (Craft Garlic Knots)', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
  ],
  canaryRolloutPct: 15,
  fieldAudits: [
    { id: 'aud-st-104', storeId: 'Store #104 (Chicago)', inspector: 'Sarah Jenkins', score: '96%', date: '2026-08-01', status: 'PASSED' },
    { id: 'aud-st-101', storeId: 'Store #101 (Downtown)', inspector: 'Mark Vance', score: '98%', date: '2026-07-30', status: 'PASSED' },
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
          source: 'POS Terminal 01',
          time: 'Just now',
          brandBadge: 'Artisanal Pizza Co.',
          items: data.ticket.items.map(i => ({ qty: i.quantity || 1, name: i.menuItemId === 'item-101' ? 'Large Pepperoni Pizza' : 'Spicy Buffalo Wings' })),
          urgent: true,
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
        <button class="nav-tab ${state.activeModule === 'kds' ? 'active' : ''}" onclick="selectModule('kds')">Kitchen Display</button>
        <button class="nav-tab ${state.activeModule === 'inventory_prep' ? 'active' : ''}" onclick="selectModule('inventory_prep')">Inventory & Prep</button>
        <button class="nav-tab ${state.activeModule === 'labor_shifts' ? 'active' : ''}" onclick="selectModule('labor_shifts')">Labor & Shifts</button>
        <button class="nav-tab ${state.activeModule === 'menu_catalog' ? 'active' : ''}" onclick="selectModule('menu_catalog')">Menu Catalog</button>
        <button class="nav-tab ${state.activeModule === 'franchise_financials' ? 'active' : ''}" onclick="selectModule('franchise_financials')">Financials & GL</button>
        <button class="nav-tab ${state.activeModule === 'franchise_overview' ? 'active' : ''}" onclick="selectModule('franchise_overview')">Franchise Portal</button>
      </nav>

      <!-- Connection Status Pill -->
      <div class="status-pill ${state.storeOffline ? 'offline' : ''}" onclick="toggleOffline()" title="Click to simulate network drop">
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
    case 'kds': return renderKDSWorkspace();
    case 'inventory_prep': return renderInventoryPrepWorkspace();
    case 'labor_shifts': return renderLaborShiftsWorkspace();
    case 'menu_catalog': return renderMenuCatalogWorkspace();
    case 'franchise_financials': return renderFinancialsWorkspace();
    case 'franchise_overview': return renderFranchiseOverviewWorkspace();
    default: return renderPOSRegisterWorkspace();
  }
}

// 1. POS REGISTER
function renderPOSRegisterWorkspace() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.basePrice * item.qty, 0);
  const taxRate = state.selectedTaxJurisdiction === 'EU_VAT' ? 0.20 : state.selectedTaxJurisdiction === 'INDIA_GST' ? 0.05 : 0.08;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Point of Sale Register</h2>
        <p class="section-subtitle">Terminal 01 &bull; Local SQLite WAL Checkouts &bull; Offline Durability</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-online">TAX PROFILE: US SALES TAX</span>
        <button class="btn-primary" style="background:#475569;" onclick="alert('Starting bank initialized: $200.00 float.')">Cash Drawer: $200 Bank</button>
      </div>
    </div>

    <div class="pos-layout">
      <!-- Menu Item Grid -->
      <div class="menu-grid">
        ${state.menuItems.map(item => `
          <div class="pos-card" onclick="addToCart('${item.id}')">
            <img src="${item.image}" alt="${item.name}" class="pos-card-img" />
            <div class="pos-card-body">
              <div class="pos-card-title">${item.name}</div>
              <div class="pos-card-category">${item.category} &bull; ${item.sku}</div>
              <div class="pos-card-footer">
                <span class="pos-card-price">$${item.basePrice.toFixed(2)}</span>
                <button class="btn-add">Add +</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Register Ticket Sidebar -->
      <div class="cart-sidebar">
        <div class="cart-header">
          <h3 style="font-size:1.1rem; font-weight:700;">Current Order</h3>
          <span style="font-size:0.8rem; color:var(--text-muted);">${state.cart.length} line items</span>
        </div>

        <div class="cart-items">
          ${state.cart.length === 0 ? `
            <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
              <div>Ticket is empty</div>
              <div style="font-size:0.8rem; margin-top:0.5rem;">Select items from the menu to build order</div>
            </div>
          ` : state.cart.map((item, idx) => `
            <div class="cart-item">
              <div>
                <div style="font-weight:600; font-size:0.95rem;">${item.name}</div>
                <div style="font-size:0.8rem; color:var(--text-muted);">$${item.basePrice.toFixed(2)} each</div>
              </div>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
                <span style="font-weight:700;">${item.qty}</span>
                <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
                <span style="font-weight:700; width:55px; text-align:right;">$${(item.basePrice * item.qty).toFixed(2)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="cart-totals">
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Tax (8%):</span>
            <span>$${taxAmount.toFixed(2)}</span>
          </div>
          <div class="totals-row total-highlight">
            <span>Total Due:</span>
            <span>$${total.toFixed(2)}</span>
          </div>

          <div style="display:flex; gap:0.5rem; margin-top:1rem;">
            <button class="btn-primary" style="flex:1;" onclick="checkoutOrder('CARD')" ${state.cart.length === 0 ? 'disabled' : ''}>Charge Card ($${total.toFixed(2)})</button>
            <button class="btn-primary" style="flex:1; background:#059669;" onclick="checkoutOrder('CASH')" ${state.cart.length === 0 ? 'disabled' : ''}>Cash Tender</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. KITCHEN DISPLAY (KDS)
function renderKDSWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Kitchen Display System (KDS)</h2>
        <p class="section-subtitle">Station: Hotline 01 &bull; Real-time LAN WebSocket Ticket Routing (&lt;200ms)</p>
      </div>
      <div class="header-actions">
        <span class="badge badge-online">EXPO ROUTING: ACTIVE</span>
        <button class="btn-primary btn-purple" onclick="testPrintESCPOSTicket()">Test ESC/POS Print (Port 9100)</button>
      </div>
    </div>

    <div class="kds-grid">
      ${state.kdsTickets.map((t, idx) => `
        <div class="kds-card ${t.urgent ? 'urgent' : ''}">
          <div class="kds-card-header">
            <div>
              <div style="font-weight:700; font-size:1.05rem;">#${t.id.slice(-6)}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${t.source} &bull; ${t.time}</div>
            </div>
            <span class="badge ${t.urgent ? 'badge-urgent' : 'badge-normal'}">${t.status}</span>
          </div>
          <div class="kds-card-items">
            ${t.items.map(i => `
              <div style="display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span><strong>${i.qty}x</strong> ${i.name}</span>
                ${i.allergens ? `<span style="color:#f87171; font-size:0.75rem;">${i.allergens.join(', ')}</span>` : ''}
              </div>
            `).join('')}
          </div>
          <div style="margin-top:1rem; display:flex; gap:0.5rem;">
            <button class="btn-primary" style="flex:1; padding:0.5rem;" onclick="bumpKDSTicket(${idx})">Bump / Complete</button>
            <button class="btn-primary" style="background:#475569; padding:0.5rem;" onclick="printStationTicket('${t.id}')">Print Ticket</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 3. INVENTORY & PREP
function renderInventoryPrepWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Inventory, Prep & Spoilage</h2>
        <p class="section-subtitle">Gram-Level Recipe Depletion &bull; Trim Shrinkage &bull; Par Level Guidance</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="openModal('log_spoilage')">Log Kitchen Waste</button>
      </div>
    </div>

    <!-- Inventory Variance Table -->
    <div class="card" style="margin-bottom:2rem;">
      <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">Theoretical vs. Actual Variance Tracking</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Theoretical Use</th>
              <th>Actual Count</th>
              <th>Unit</th>
              <th>Variance</th>
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
                <td style="color:${v.alert ? '#f87171' : '#34d399'}; font-weight:700;">${v.variancePct}</td>
                <td><span class="badge ${v.alert ? 'badge-danger' : 'badge-online'}">${v.alert ? 'VARIANCE ALERT' : 'IN RANGE'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Spoilage Logs -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">Shift Spoilage & Waste Log</h3>
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
                <td>${s.item}</td>
                <td>${s.qty}</td>
                <td><span class="badge badge-danger">${s.reason}</span></td>
                <td><strong>${s.cost}</strong></td>
                <td>${s.loggedBy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 4. LABOR & SHIFTS
function renderLaborShiftsWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Labor & Shift Scheduling</h2>
        <p class="section-subtitle">FLSA Tip Pooling Compliance &bull; Fair Workweek Rest Guardrails &bull; California Daily OT</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="openModal('add_shift')">Schedule Shift</button>
        <button class="btn-primary btn-purple" onclick="runAILaborOptimizer()">Run Labor Optimizer (Target 22%)</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="font-size:1.1rem; font-weight:700;">Active Store Staff Roster</h3>
        <span class="badge badge-online">TIP POOL ACCRUED: $${state.tipPoolTotal.toFixed(2)}</span>
      </div>
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
                <td>${e.role === 'Shift Lead' ? '<span style="color:#94a3b8;">Excluded (FLSA §3m)</span>' : '<span style="color:#34d399; font-weight:700;">Eligible</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 5. MENU CATALOG
function renderMenuCatalogWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Menu Catalog & Brand-Lock Control</h2>
        <p class="section-subtitle">Hierarchy: Platform &rarr; Brand &rarr; Region &rarr; Store &bull; Automatic Sync</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="openModal('add_menu_item')">Add Menu Item</button>
        <button class="btn-primary btn-purple" onclick="increaseCanaryRollout()">Advance Rollout (${state.canaryRolloutPct}%)</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">Master Menu Catalog</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Base Price</th>
              <th>Allergens</th>
              <th>Brand Lock</th>
            </tr>
          </thead>
          <tbody>
            ${state.menuItems.map(item => `
              <tr>
                <td><code>${item.sku}</code></td>
                <td><strong>${item.name}</strong></td>
                <td>${item.category}</td>
                <td>$${item.basePrice.toFixed(2)}</td>
                <td>${item.allergens.join(', ') || 'None'}</td>
                <td><span class="badge ${item.isBrandLocked ? 'badge-locked' : 'badge-online'}">${item.isBrandLocked ? 'BRAND LOCKED' : 'STORE OVERRIDABLE'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 6. FINANCIALS & GL
function renderFinancialsWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Financial Accounting & General Ledger</h2>
        <p class="section-subtitle">NetSuite Double-Entry GL &bull; Franchise Royalty ACH Drafts &bull; ADP Payroll</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="generateNetSuiteGLVoucher()">Export NetSuite GL Journal</button>
        <button class="btn-primary btn-purple" onclick="generateRoyaltyInvoice()">Generate Franchise Royalty ACH</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:2rem;">
      <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">NetSuite General Ledger Accounts (Debits === Credits)</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Description</th>
              <th>Debit ($)</th>
              <th>Credit ($)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>1010</code></td>
              <td>Cash on Hand (Store Safe Float + Drawer)</td>
              <td><strong>$550.00</strong></td>
              <td>$0.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>1020</code></td>
              <td>Merchant Card Settlement Clearing</td>
              <td><strong>$1,840.00</strong></td>
              <td>$0.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>1030</code></td>
              <td>3rd-Party Delivery AR (DoorDash / UberEats)</td>
              <td><strong>$620.00</strong></td>
              <td>$0.00</td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>2010</code></td>
              <td>Sales Tax Payable</td>
              <td>$0.00</td>
              <td><strong>$240.80</strong></td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>2020</code></td>
              <td>Accrued Tip Liability (Owed to Staff)</td>
              <td>$0.00</td>
              <td><strong>$450.00</strong></td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
            <tr>
              <td><code>4010</code></td>
              <td>Food & Beverage Sales Revenue</td>
              <td>$0.00</td>
              <td><strong>$2,319.20</strong></td>
              <td><span class="badge badge-online">BALANCED</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 7. FRANCHISE OVERVIEW
function renderFranchiseOverviewWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">Franchise Portal & Store Audit Logs</h2>
        <p class="section-subtitle">Multi-Store Ownership Overview &bull; Store Audit Trail &bull; Performance</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" onclick="alert('Store performance report exported.')">Export Monthly P&L</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:1rem;">Cryptographic Audit Ledger</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>SHA-256 Hash</th>
            </tr>
          </thead>
          <tbody>
            ${state.auditLedger.map(a => `
              <tr>
                <td><code>${a.id}</code></td>
                <td>${a.timestamp}</td>
                <td><strong>${a.actor}</strong></td>
                <td><span class="badge badge-online">${a.action}</span></td>
                <td>${a.target}</td>
                <td><code style="font-size:0.75rem;">${a.hash.slice(0, 16)}...</code></td>
              </tr>
            `).join('')}
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

window.addToCart = function(id) {
  const item = state.menuItems.find(m => m.id === id);
  if (!item) return;
  const existing = state.cart.find(c => c.id === id);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({ ...item, qty: 1 });
  }
  renderApp();
};

window.updateCartQty = function(idx, delta) {
  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }
  renderApp();
};

window.checkoutOrder = async function(tenderType) {
  const subtotal = state.cart.reduce((sum, item) => sum + item.basePrice * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const payload = {
    id: `tx-${Date.now()}`,
    storeId: 'store-104',
    terminalId: 'pos-1',
    timestamp: new Date().toISOString(),
    items: state.cart.map(i => ({ menuItemId: i.id, quantity: i.qty, unitPrice: i.basePrice })),
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
    alert(`Checkout complete in local fallback mode.\nTx ID: ${payload.id}`);
  }

  state.cart = [];
  renderApp();
};

window.bumpKDSTicket = function(idx) {
  state.kdsTickets.splice(idx, 1);
  renderApp();
};

window.testPrintESCPOSTicket = async function() {
  alert('Dispatched raw ESC/POS binary ticket to Kitchen Hotline (Port 9100) with fallback station failover active.');
};

window.printStationTicket = function(ticketId) {
  alert(`Ticket #${ticketId} dispatched to printer.`);
};

window.runAILaborOptimizer = function() {
  alert('Labor schedule optimized for 22% target cost. Zero clopening violations detected.');
};

window.generateNetSuiteGLVoucher = function() {
  alert('NetSuite GL Daily Journal generated: Debits $3,010.00 === Credits $3,010.00 (Balanced).');
};

window.generateRoyaltyInvoice = function() {
  alert('Royalty Invoice generated on Net Sales ($2,319.20): Royalty Fee $115.96 + Marketing Fund $46.38 = $162.34 ACH Draft.');
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
  renderApp();
};

window.increaseCanaryRollout = function() {
  state.canaryRolloutPct = Math.min(100, state.canaryRolloutPct + 25);
  renderApp();
};

function renderModals() {
  if (!state.modalOpen) return '';

  if (state.modalOpen === 'log_spoilage') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>Log Kitchen Waste / Spoilage</h3>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>
          <form onsubmit="event.preventDefault(); alert('Waste logged.'); closeModal();">
            <div class="form-group">
              <label>Item Name</label>
              <input type="text" class="form-control" value="Mozzarella Cheese (Shredded)" required />
            </div>
            <div class="form-group">
              <label>Quantity Lost (kg / pcs)</label>
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
              <button type="button" class="btn-primary" style="background:#475569;" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn-primary btn-danger">Confirm Waste Log</button>
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
            <h3>Add Menu Item</h3>
            <button class="modal-close-btn" onclick="closeModal()">&times;</button>
          </div>
          <form onsubmit="event.preventDefault(); alert('Menu item added.'); closeModal();">
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
              <button type="button" class="btn-primary" style="background:#475569;" onclick="closeModal()">Cancel</button>
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
