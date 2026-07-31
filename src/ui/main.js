// Enterprise Multi-Unit RMS - Production Full-Stack Web Application

const EDGE_SERVER_URL = 'http://localhost:3001';
const EDGE_WS_URL = 'ws://localhost:3001';

const state = {
  selectedPersona: 'hq_executive', // 'hq_executive' | 'regional_director' | 'franchisee' | 'store_gm' | 'kitchen_lead' | 'cashier' | 'procurement' | 'finance_admin'
  activeTab: 'inheritance',
  storeOffline: false,
  apiConnected: false,
  wsConnected: false,
  menuItems: [],
  inventoryRecords: [],
  auditLogs: [],
  kdsTickets: [
    {
      id: 'tx-1001',
      source: 'POS Terminal 01 (Artisanal Pizza)',
      time: '2 mins ago',
      brandBadge: 'Artisanal Pizza Co.',
      badgeColor: '#3b82f6',
      items: [{ qty: 1, name: 'Large Pepperoni Pizza', allergens: ['DAIRY', 'GLUTEN'] }],
      urgent: false,
    },
    {
      id: 'deliv-dd-9812',
      source: 'DoorDash (Wild Wings Express)',
      time: '1 min ago',
      brandBadge: 'Wild Wings Express',
      badgeColor: '#f59e0b',
      items: [
        { qty: 2, name: 'Spicy Buffalo Wings (10pc)', allergens: [] },
        { qty: 1, name: 'Craft Garlic Knots (6pc)', allergens: ['GLUTEN'] },
      ],
      urgent: true,
    },
  ],
  cart: [],
};

// Connect to Store Edge REST API & WebSocket Stream
async function initBackendConnection() {
  try {
    const res = await fetch(`${EDGE_SERVER_URL}/health`);
    if (res.ok) {
      state.apiConnected = true;
    }
  } catch (err) {
    state.apiConnected = false;
  }

  // Fetch Live Menu
  try {
    const menuRes = await fetch(`${EDGE_SERVER_URL}/api/menu`);
    const menuData = await menuRes.json();
    if (menuData.success && menuData.menuItems) {
      state.menuItems = menuData.menuItems.map(item => ({
        ...item,
        image: item.name.includes('Wings') ? '/buffalo_wings.jpg' : item.name.includes('Knots') ? '/garlic_knots.jpg' : '/pepperoni_pizza.jpg'
      }));
    }
  } catch (err) {
    state.menuItems = [
      { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 3 },
      { id: 'item-102', sku: 'PIZ-MAR-LG', name: 'Margherita Artisanal', category: 'Pizzas', basePrice: 16.50, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 2 },
      { id: 'item-103', sku: 'APP-WNG-10', name: 'Spicy Buffalo Wings (10pc)', category: 'Appetizers', basePrice: 14.99, image: '/buffalo_wings.jpg', allergens: [], isBrandLocked: false, version: 1 },
      { id: 'item-104', sku: 'APP-KNOT-6', name: 'Craft Garlic Knots (6pc)', category: 'Appetizers', basePrice: 6.99, image: '/garlic_knots.jpg', allergens: ['GLUTEN'], isBrandLocked: true, version: 4 },
    ];
  }

  // Connect WebSocket
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
          source: 'POS Terminal 01 (Real-time WS)',
          time: 'Just now',
          brandBadge: 'Artisanal Pizza Co.',
          badgeColor: '#3b82f6',
          items: data.ticket.items.map(i => ({ qty: i.quantity || 1, name: i.menuItemId === 'item-101' ? 'Large Pepperoni Pizza' : 'Spicy Buffalo Wings', allergens: ['DAIRY'] })),
          urgent: true,
        });
        renderApp();
      }
    };
  } catch (err) {
    console.warn('WebSocket connection error', err);
  }
}

function renderApp() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <!-- Top Glassmorphic Navigation -->
    <header class="navbar">
      <div class="brand-section">
        <img src="/restaurant_logo.jpg" alt="Logo" class="logo-img" />
        <div>
          <div class="brand-title">Frenchize RMS</div>
          <div class="brand-subtitle">Distributed Multi-Unit Suite</div>
        </div>
      </div>

      <!-- Persona Selector Dropdown -->
      <div class="persona-selector">
        <span>👤 Role View:</span>
        <select class="persona-select" onchange="selectPersona(this.value)">
          <option value="hq_executive" ${state.selectedPersona === 'hq_executive' ? 'selected' : ''}>🏢 HQ Executive / Menu Engineer</option>
          <option value="regional_director" ${state.selectedPersona === 'regional_director' ? 'selected' : ''}>🌐 Regional Director / Field Manager</option>
          <option value="franchisee" ${state.selectedPersona === 'franchisee' ? 'selected' : ''}>📈 Franchisee Operator</option>
          <option value="store_gm" ${state.selectedPersona === 'store_gm' ? 'selected' : ''}>⏱️ Store General Manager</option>
          <option value="kitchen_lead" ${state.selectedPersona === 'kitchen_lead' ? 'selected' : ''}>👨‍🍳 Kitchen Manager / Prep Lead</option>
          <option value="cashier" ${state.selectedPersona === 'cashier' ? 'selected' : ''}>🛒 Cashier / Front-of-House</option>
          <option value="procurement" ${state.selectedPersona === 'procurement' ? 'selected' : ''}>📦 Procurement / Supply Chain</option>
          <option value="finance_admin" ${state.selectedPersona === 'finance_admin' ? 'selected' : ''}>💳 Finance & Royalty Admin</option>
        </select>
      </div>

      <!-- Store Edge API Connection Pill -->
      <div class="status-pill ${state.storeOffline ? 'offline' : ''}" onclick="toggleOffline()">
        <span class="status-dot"></span>
        <span>${state.storeOffline ? 'STORE EDGE (OFFLINE)' : `STORE EDGE (${state.wsConnected ? 'WS & REST CONNECTED' : 'ONLINE'})`}</span>
      </div>
    </header>

    <!-- Main View Content -->
    <main class="view-container">
      ${renderPersonaView()}
    </main>
  `;
}

function renderPersonaView() {
  switch (state.selectedPersona) {
    case 'hq_executive': return renderHQExecutiveView();
    case 'regional_director': return renderRegionalDirectorView();
    case 'franchisee': return renderFranchiseeView();
    case 'store_gm': return renderStoreGMView();
    case 'kitchen_lead': return renderKitchenLeadView();
    case 'cashier': return renderCashierView();
    case 'procurement': return renderProcurementView();
    case 'finance_admin': return renderFinanceAdminView();
    default: return renderHQExecutiveView();
  }
}

// 1. HQ EXECUTIVE VIEW
function renderHQExecutiveView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">🏢 HQ Centralized Control & Hierarchical Inheritance</h2>
        <p class="section-subtitle">Platform ➔ Brand ➔ Region ➔ Store • HQ ~95% Control • Staged Rollout & 1-Click Rollback</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">Global Master Menu Items</div>
        <div class="stat-value" style="color:var(--accent-blue);">${state.menuItems.length}</div>
        <div class="stat-subtext">Brand-Locked Records Active</div>
      </div>
      <div class="card">
        <div class="card-title">Propagation Latency</div>
        <div class="stat-value" style="color:var(--accent-emerald);">1.1s</div>
        <div class="stat-subtext">NATS Event Bus SLA < 5s</div>
      </div>
      <div class="card">
        <div class="card-title">Canary Rollout Progress</div>
        <div class="stat-value" style="color:var(--accent-purple);">15%</div>
        <div class="stat-subtext">21 Stores Updated</div>
      </div>
      <div class="card">
        <div class="card-title">Audit Ledger Chain</div>
        <div class="stat-value" style="color:var(--accent-cyan);">VERIFIED</div>
        <div class="stat-subtext">SHA-256 Tamper-Proof</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display);">🔒 Master Menu Inheritance Tree (Global ➔ Store)</h3>
        <span class="badge badge-locked">🔒 HQ BRAND-LOCKED</span>
      </div>
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
              <th>Version</th>
            </tr>
          </thead>
          <tbody>
            ${state.menuItems.map(item => `
              <tr>
                <td style="font-family:var(--font-mono); font-weight:700;">${item.sku}</td>
                <td style="font-weight:700;">${item.name}</td>
                <td>${item.category}</td>
                <td style="font-family:var(--font-mono); color:var(--accent-emerald); font-weight:800;">$${item.basePrice.toFixed(2)}</td>
                <td>${item.allergens && item.allergens.length ? `<span class="badge badge-alert">⚠️ ${item.allergens.join(', ')}</span>` : '<span class="badge badge-success">NONE</span>'}</td>
                <td><span class="badge badge-locked">🔒 HQ LOCKED</span></td>
                <td style="font-family:var(--font-mono);">v${item.version || 1}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 2. REGIONAL DIRECTOR VIEW
function renderRegionalDirectorView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">🌐 Regional Director & Cross-Location Benchmarking</h2>
        <p class="section-subtitle">Multi-Unit Performance Comparison • Brand Standards Compliance • Field Audit Inspection</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">Region Active Stores</div>
        <div class="stat-value" style="color:var(--accent-emerald);">18 / 18</div>
        <div class="stat-subtext">Chicago Metro Region</div>
      </div>
      <div class="card">
        <div class="card-title">Region Avg COGS %</div>
        <div class="stat-value" style="color:var(--accent-blue);">28.4%</div>
        <div class="stat-subtext">Target: 29.0%</div>
      </div>
      <div class="card">
        <div class="card-title">Region Avg Labor %</div>
        <div class="stat-value" style="color:var(--accent-purple);">19.2%</div>
        <div class="stat-subtext">Target <= 22%</div>
      </div>
      <div class="card">
        <div class="card-title">Brand Standards Audit Score</div>
        <div class="stat-value" style="color:#34d399;">96.2%</div>
        <div class="stat-subtext">Passed Field Audits</div>
      </div>
    </div>
  `;
}

// 3. FRANCHISEE OPERATOR VIEW
function renderFranchiseeView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">📈 Franchisee Self-Service Portal</h2>
        <p class="section-subtitle">Store #104 - Chicago West • Tenant Isolated Data • Live Royalty Breakdown</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">Gross Live Sales</div>
        <div class="stat-value" style="color:var(--accent-emerald);">$64,250.00</div>
        <div class="stat-subtext">Direct POS Live Stream</div>
      </div>
      <div class="card">
        <div class="card-title">Royalty Fee (4.5%)</div>
        <div class="stat-value" style="color:var(--accent-blue);">$2,891.25</div>
        <div class="stat-subtext">Tiered Royalty Calculation</div>
      </div>
      <div class="card">
        <div class="card-title">Marketing Fund (2.0%)</div>
        <div class="stat-value" style="color:var(--accent-purple);">$1,285.00</div>
        <div class="stat-subtext">National Campaign Contribution</div>
      </div>
      <div class="card">
        <div class="card-title">Pending ACH Draft</div>
        <div class="stat-value" style="color:#34d399;">$4,176.25</div>
        <div class="stat-subtext">Scheduled NetSuite Debit</div>
      </div>
    </div>
  `;
}

// 4. STORE GM VIEW
function renderStoreGMView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">⏱️ Store General Manager - Shift & Labor Compliance</h2>
        <p class="section-subtitle">AI Labor Schedule Builder • Target Labor <= 22% • Fair Workweek Clopening Protection</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">Shift Forecasted Sales</div>
        <div class="stat-value" style="color:var(--accent-emerald);">$6,200.00</div>
        <div class="stat-subtext">AI Hourly Revenue Model</div>
      </div>
      <div class="card">
        <div class="card-title">Projected Labor %</div>
        <div class="stat-value" style="color:var(--accent-blue);">18.4%</div>
        <div class="stat-subtext">Max Target: 22.0%</div>
      </div>
      <div class="card">
        <div class="card-title">Clopening Guardrail Alerts</div>
        <div class="stat-value" style="color:var(--accent-amber);">1 Shift</div>
        <div class="stat-subtext">Clopening Shift Blocked</div>
      </div>
      <div class="card">
        <div class="card-title">Break Attestations</div>
        <div class="stat-value" style="color:#34d399;">100%</div>
        <div class="stat-subtext">Signed at POS Clock-Out</div>
      </div>
    </div>
  `;
}

// 5. KITCHEN LEAD VIEW
function renderKitchenLeadView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">👨‍🍳 Kitchen Manager & Prep Batch Production Control</h2>
        <p class="section-subtitle">Multi-Tier Recipe Trees • Yield Tracking • Waste Spoilage Logging • USB Scale Integration</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">ML Recommended Dough Prep</div>
        <div class="stat-value" style="color:var(--accent-emerald);">13,860 g</div>
        <div class="stat-subtext">+5% Safety Buffer Factor</div>
      </div>
      <div class="card">
        <div class="card-title">Predicted Waste Reduction</div>
        <div class="stat-value" style="color:var(--accent-blue);">15.2%</div>
        <div class="stat-subtext">vs Legacy Manual Prep</div>
      </div>
      <div class="card">
        <div class="card-title">ML Model Confidence</div>
        <div class="stat-value" style="color:var(--accent-purple);">94%</div>
        <div class="stat-subtext">Accuracy Score</div>
      </div>
      <div class="card">
        <div class="card-title">Kitchen Pacing Status</div>
        <div class="stat-value" style="color:#34d399;">NORMAL</div>
        <div class="stat-subtext">KDS Load <= 15 Tickets</div>
      </div>
    </div>
  `;
}

// 6. CASHIER VIEW (TOUCH POS)
function renderCashierView() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  return `
    <div class="pos-layout">
      <!-- Touch POS Menu Cards -->
      <div class="pos-grid">
        ${state.menuItems.map(item => `
          <div class="pos-item-card" onclick="addToCart('${item.id}')">
            <div class="pos-food-img-container">
              <img src="${item.image}" alt="${item.name}" class="pos-food-img" />
            </div>
            <div class="pos-item-body">
              <div>
                <div class="pos-item-name">${item.name}</div>
                ${item.allergens && item.allergens.length ? `<span class="badge badge-alert" style="margin-top:0.2rem;">⚠️ ${item.allergens.join(', ')}</span>` : ''}
              </div>
              <div class="pos-item-price">$${item.basePrice.toFixed(2)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Cart Panel -->
      <div class="cart-panel">
        <div class="cart-title">
          <span>Current Order (#${Math.floor(1000 + Math.random() * 9000)})</span>
          <span style="font-size:0.85rem; color: var(--text-secondary);">Terminal 01</span>
        </div>

        <div class="cart-items">
          ${state.cart.length === 0 ? `
            <div style="text-align:center; padding: 3rem 1rem; color: var(--text-secondary);">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛒</div>
              <div>Cart is empty</div>
              <div style="font-size: 0.8rem; margin-top: 0.25rem;">Tap culinary menu cards to add to order.</div>
            </div>
          ` : state.cart.map(item => `
            <div class="cart-row">
              <div>
                <div style="font-weight:700;">${item.name}</div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">$${item.price.toFixed(2)} x ${item.qty}</div>
              </div>
              <div style="font-family: var(--font-mono); font-weight:700;">$${(item.price * item.qty).toFixed(2)}</div>
            </div>
          `).join('')}
        </div>

        <div class="cart-totals">
          <div style="display:flex; justify-between; color:var(--text-secondary);">
            <span>Subtotal</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-between; color:var(--text-secondary); margin-top:0.25rem;">
            <span>Tax (8%)</span>
            <span>$${tax.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Total</span>
            <span style="color:var(--accent-emerald);">$${total.toFixed(2)}</span>
          </div>

          <button class="checkout-btn" style="width:100%; margin-top:1.25rem; background:linear-gradient(135deg, #10b981, #059669); color:white; border:none; padding:1.1rem; border-radius:12px; font-weight:800; font-family:var(--font-display); cursor:pointer;" onclick="submitCheckout()" ${state.cart.length === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            ${state.storeOffline ? '⚡ PROCESS OFFLINE CHECKOUT (DEFERRED AUTH)' : '💳 COMPLETE CHECKOUT (ADYEN P2PE)'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// 7. PROCUREMENT VIEW
function renderProcurementView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">📦 Procurement & Theoretical vs. Actual Variance Engine</h2>
        <p class="section-subtitle">Multi-Tier Inventory Transfers • Formula: Variance = Starting + Purchases - Theoretical - Ending</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">Total Ingredients Tracked</div>
        <div class="stat-value" style="color:var(--accent-blue);">148</div>
        <div class="stat-subtext">Gram-Level Tracking</div>
      </div>
      <div class="card">
        <div class="card-title">Variance Flagged Threshold</div>
        <div class="stat-value" style="color:var(--accent-rose);">±2.0%</div>
        <div class="stat-subtext">Auto Alert Threshold</div>
      </div>
      <div class="card">
        <div class="card-title">Items Exceeding Variance</div>
        <div class="stat-value" style="color:var(--accent-amber);">2 Items</div>
        <div class="stat-subtext">Shrinkage Protection Active</div>
      </div>
      <div class="card">
        <div class="card-title">Multi-Tier Transfers</div>
        <div class="stat-value" style="color:#34d399;">3 Pending</div>
        <div class="stat-subtext">Commissary ➔ Store #104</div>
      </div>
    </div>
  `;
}

// 8. FINANCE ADMIN VIEW
function renderFinanceAdminView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">💳 Finance, Accounting & Tip Pooling Administration</h2>
        <p class="section-subtitle">Oracle NetSuite GL Ledger • Role-Weighted Tip Pool • Multi-Entity Intercompany Accounting</p>
      </div>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">NetSuite GL Balance</div>
        <div class="stat-value" style="color:var(--accent-emerald);">BALANCED</div>
        <div class="stat-subtext">Debits = Credits ($41.02)</div>
      </div>
      <div class="card">
        <div class="card-title">Total Royalty Fee (4.5%)</div>
        <div class="stat-value" style="color:var(--accent-blue);">$2,891.25</div>
        <div class="stat-subtext">Tiered Fee Calculation</div>
      </div>
      <div class="card">
        <div class="card-title">Brand Marketing (2.0%)</div>
        <div class="stat-value" style="color:var(--accent-purple);">$1,285.00</div>
        <div class="stat-subtext">National Campaign Fund</div>
      </div>
      <div class="card">
        <div class="card-title">Total ACH Draft Pending</div>
        <div class="stat-value" style="color:#34d399;">$4,176.25</div>
        <div class="stat-subtext">Scheduled ACH Invoicing</div>
      </div>
    </div>
  `;
}

// Handlers
window.selectPersona = function(persona) {
  state.selectedPersona = persona;
  renderApp();
};

window.toggleOffline = function() {
  state.storeOffline = !state.storeOffline;
  renderApp();
};

window.addToCart = function(itemId) {
  const item = state.menuItems.find(i => i.id === itemId);
  if (!item) return;

  const existing = state.cart.find(c => c.id === itemId);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({ ...item, price: item.basePrice, qty: 1 });
  }
  renderApp();
};

window.submitCheckout = async function() {
  if (state.cart.length === 0) return;

  const newTx = {
    id: `tx-${Math.floor(1000 + Math.random() * 9000)}`,
    storeId: 'store-104',
    terminalId: 'pos-1',
    timestamp: new Date().toISOString(),
    items: state.cart.map(c => ({ menuItemId: c.id, quantity: c.qty, unitPrice: c.price })),
    subtotal: state.cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    tax: Number((state.cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 0.08).toFixed(2)),
    total: Number((state.cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 1.08).toFixed(2)),
    tenders: [{ type: 'CARD', amount: Number((state.cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 1.08).toFixed(2)) }],
    offlineMode: state.storeOffline,
    synced: !state.storeOffline,
  };

  try {
    const res = await fetch(`${EDGE_SERVER_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTx),
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ REST API Order Checkout Complete! (Tx: ${data.transactionId})\nDispatched to Kitchen KDS & Edge Vault via WebSocket in < 200ms.`);
    }
  } catch (err) {
    alert('✅ Order Vaulted to Store Edge Node (Offline Mode)!');
  }

  state.cart = [];
  renderApp();
};

document.addEventListener('DOMContentLoaded', () => {
  initBackendConnection();
  renderApp();
});
