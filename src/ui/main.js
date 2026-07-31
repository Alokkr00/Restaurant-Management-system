// Enterprise Multi-Unit RMS - Definitive Multi-Persona Control Suite

// Master Application State
const state = {
  selectedPersona: 'hq_executive', // 'hq_executive' | 'regional_director' | 'franchisee' | 'store_gm' | 'kitchen_lead' | 'cashier' | 'procurement' | 'finance_admin'
  activeTab: 'inheritance', // Dynamic based on persona
  storeOffline: false,
  modalOpen: null, // null | 'add_item' | 'log_spoilage' | 'checkout' | 'canary_rollout'
  menuItems: [
    { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], locked: true, version: 3 },
    { id: 'item-102', name: 'Margherita Artisanal', sku: 'PIZ-MAR-LG', category: 'Pizzas', basePrice: 16.50, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], locked: true, version: 2 },
    { id: 'item-103', name: 'Spicy Buffalo Wings (10pc)', sku: 'APP-WNG-10', category: 'Appetizers', basePrice: 14.99, image: '/buffalo_wings.jpg', allergens: [], locked: false, version: 1 },
    { id: 'item-104', name: 'Craft Garlic Knots (6pc)', sku: 'APP-KNOT-6', category: 'Appetizers', basePrice: 6.99, image: '/garlic_knots.jpg', allergens: ['GLUTEN'], locked: true, version: 4 },
  ],
  cart: [],
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
  inventoryVariances: [
    { ingredientId: 'ing-cheese', name: 'Mozzarella Cheese (Shredded)', theoretical: 14.2, actual: 15.8, unit: 'kg', variancePct: '+11.2%', alert: true },
    { ingredientId: 'ing-pep', name: 'Pepperoni Slices (Beef/Pork)', theoretical: 8.5, actual: 8.6, unit: 'kg', variancePct: '+1.1%', alert: false },
    { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', theoretical: 45.0, actual: 48.2, unit: 'kg', variancePct: '+7.1%', alert: true },
  ],
  spoilageLogs: [
    { id: 'spoil-1', item: 'Dough Ball 500g', qty: '5 pcs', reason: 'DROPPED_FLOOR', cost: '$7.50', loggedBy: 'Kitchen Lead' },
    { id: 'spoil-2', item: 'Buffalo Wings (Raw)', qty: '1.2 kg', reason: 'EXPIRED', cost: '$14.20', loggedBy: 'GM Audit' },
  ],
  auditLedger: [
    { id: 'aud-991', timestamp: '2026-07-31 19:10:00', actor: 'HQ Menu Engineer', action: 'UPDATE_PRICE', target: 'MenuItem (PIZ-PEP-LG)', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { id: 'aud-990', timestamp: '2026-07-31 18:45:00', actor: 'Security Director', action: 'LOCK_BRAND_RECORD', target: 'Recipe (Craft Garlic Knots)', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
  ],
  laborSchedule: {
    targetLaborPct: '22.0%',
    projectedLaborPct: '18.4%',
    forecastSales: 6200.00,
    projectedLaborCost: 1140.00,
    clopeningAlerts: [
      { employee: 'John Doe', shift1: 'Jul 31 Close (11:30 PM)', shift2: 'Aug 1 Open (6:00 AM)', restHours: '6.5 hrs', status: 'BLOCKED (< 11h Rest)' }
    ],
  },
  royaltyData: {
    grossSales: 64250.00,
    netSales: 64250.00,
    royaltyRate: '4.5%',
    royaltyAmount: 2891.25,
    marketingFund: 1285.00,
    totalACHDue: 4176.25,
  },
  canaryRolloutPct: 15,
};

// Main App Render
function renderApp() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = `
    <!-- Top Navigation Header -->
    <header class="navbar">
      <div class="brand-section">
        <img src="/restaurant_logo.jpg" alt="Logo" class="logo-img" />
        <div>
          <div class="brand-title">Frenchize RMS</div>
          <div class="brand-subtitle">Distributed Multi-Unit Suite</div>
        </div>
      </div>

      <!-- Target Persona Selector -->
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

      <!-- Edge Status Indicator -->
      <div class="status-pill ${state.storeOffline ? 'offline' : ''}" onclick="toggleOffline()">
        <span class="status-dot"></span>
        <span>${state.storeOffline ? 'STORE EDGE (OFFLINE)' : 'STORE EDGE (ONLINE)'}</span>
      </div>
    </header>

    <!-- Main View Content -->
    <main class="view-container">
      ${renderPersonaView()}
    </main>

    <!-- Modals -->
    ${renderModals()}
  `;
}

// Render Specific Persona View
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

// 1. HQ EXECUTIVE / MENU ENGINEER VIEW
function renderHQExecutiveView() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">🏢 HQ Centralized Control & Hierarchical Inheritance</h2>
        <p class="section-subtitle">HQ ~95% Control • 5% Controlled Local Flexibility • Staged Rollout & 1-Click Rollback</p>
      </div>
      <div style="display:flex; gap: 0.75rem;">
        <button class="btn-primary" onclick="openModal('add_item')">➕ Add Master Menu Item</button>
        <button class="btn-primary" style="background:var(--bg-card-hover);" onclick="openModal('canary_rollout')">🚀 Staged Rollout (${state.canaryRolloutPct}%)</button>
      </div>
    </div>

    <!-- Metrics -->
    <div class="grid-4">
      <div class="card">
        <div class="card-title">Global Master Menu Items</div>
        <div class="stat-value" style="color:var(--accent-primary);">${state.menuItems.length}</div>
        <div class="stat-subtext">Brand-Locked Records Active</div>
      </div>
      <div class="card">
        <div class="card-title">Propagation Latency</div>
        <div class="stat-value" style="color:var(--accent-success);">1.1s</div>
        <div class="stat-subtext">NATS Event Bus SLA < 5s</div>
      </div>
      <div class="card">
        <div class="card-title">Canary Rollout Progress</div>
        <div class="stat-value" style="color:var(--accent-purple);">${state.canaryRolloutPct}%</div>
        <div class="stat-subtext">21 Stores Updated</div>
      </div>
      <div class="card">
        <div class="card-title">Audit Ledger Chain</div>
        <div class="stat-value" style="color:var(--accent-cyan);">VERIFIED</div>
        <div class="stat-subtext">SHA-256 Tamper-Proof</div>
      </div>
    </div>

    <!-- Master Menu Items & Inheritance Overrides Table -->
    <div class="card" style="margin-bottom: 2rem;">
      <div class="card-header">
        <h3 style="font-size:1.1rem; font-weight:800;">🔒 Master Menu Inheritance Tree (Global ➔ Store)</h3>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.menuItems.map(item => `
              <tr>
                <td style="font-family:var(--font-mono); font-weight:700;">${item.sku}</td>
                <td style="font-weight:700;">${item.name}</td>
                <td>${item.category}</td>
                <td style="font-family:var(--font-mono); color:var(--accent-success); font-weight:800;">$${item.basePrice.toFixed(2)}</td>
                <td>${item.allergens.length ? `<span class="badge badge-alert">⚠️ ${item.allergens.join(', ')}</span>` : '<span class="badge badge-success">NONE</span>'}</td>
                <td>${item.locked ? '<span class="badge badge-locked">🔒 HQ LOCKED</span>' : '<span class="badge badge-warning">REGIONAL OVERRIDE</span>'}</td>
                <td style="font-family:var(--font-mono);">v${item.version}</td>
                <td>
                  <button class="btn-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="toggleBrandLock('${item.id}')">${item.locked ? 'Unlock' : 'Lock'}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SHA-256 Audit Log Table -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">🛡️ Tamper-Proof Cryptographic SHA-256 Audit Ledger</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Audit ID</th>
              <th>Timestamp</th>
              <th>Actor Role</th>
              <th>Action</th>
              <th>Target Entity</th>
              <th>SHA-256 Hash Chaining</th>
            </tr>
          </thead>
          <tbody>
            ${state.auditLedger.map(a => `
              <tr>
                <td style="font-family:var(--font-mono); font-weight:700;">${a.id}</td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${a.timestamp}</td>
                <td style="font-weight:700; color:var(--accent-primary);">${a.actor}</td>
                <td><span class="badge badge-success">${a.action}</span></td>
                <td>${a.target}</td>
                <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">${a.hash}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 2. REGIONAL DIRECTOR / FIELD MANAGER VIEW
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
        <div class="stat-value" style="color:var(--accent-success);">18 / 18</div>
        <div class="stat-subtext">Chicago Metro Region</div>
      </div>
      <div class="card">
        <div class="card-title">Region Avg COGS %</div>
        <div class="stat-value" style="color:var(--accent-primary);">28.4%</div>
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

    <div class="grid-2">
      <div class="card">
        <h3 style="font-weight:800; font-size:1.1rem; margin-bottom:1rem;">📊 Cross-Location Performance Benchmarking</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Store Unit</th>
              <th>Sales (Shift)</th>
              <th>COGS %</th>
              <th>Labor %</th>
              <th>Variance Alert</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:700;">Store #101 (Downtown)</td>
              <td style="font-family:var(--font-mono);">$8,450.00</td>
              <td style="font-family:var(--font-mono);">27.8%</td>
              <td style="font-family:var(--font-mono); color:var(--accent-success);">18.1%</td>
              <td><span class="badge badge-success">NORMAL</span></td>
            </tr>
            <tr>
              <td style="font-weight:700;">Store #104 (Chicago West)</td>
              <td style="font-family:var(--font-mono);">$6,200.00</td>
              <td style="font-family:var(--font-mono);">29.1%</td>
              <td style="font-family:var(--font-mono); color:var(--accent-success);">18.4%</td>
              <td><span class="badge badge-alert">ALERT +11.2%</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="audit-score-card" style="margin-bottom:1rem;">
          <div>
            <h3 style="font-size:1.2rem; font-weight:800;">Mobile Field Inspection Score</h3>
            <p style="color:var(--text-secondary); font-size:0.85rem;">Inspected by Sarah Jenkins • Store #104</p>
          </div>
          <div class="score-circle">96%</div>
        </div>
        <button class="btn-primary" style="width:100%;" onclick="alert('✅ Mobile Audit Inspection Ticket Created!')">📱 START NEW MOBILE FIELD INSPECTION AUDIT</button>
      </div>
    </div>
  `;
}

// 3. FRANCHISEE OPERATOR VIEW
function renderFranchiseeView() {
  const r = state.royaltyData;
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
        <div class="stat-value" style="color:var(--accent-success);">$${r.grossSales.toLocaleString()}</div>
        <div class="stat-subtext">Direct POS Live Stream</div>
      </div>
      <div class="card">
        <div class="card-title">Royalty Fee (4.5%)</div>
        <div class="stat-value" style="color:var(--accent-primary);">$${r.royaltyAmount.toLocaleString()}</div>
        <div class="stat-subtext">Tiered Royalty Calculation</div>
      </div>
      <div class="card">
        <div class="card-title">Marketing Fund (2.0%)</div>
        <div class="stat-value" style="color:var(--accent-purple);">$${r.marketingFund.toLocaleString()}</div>
        <div class="stat-subtext">National Campaign Contribution</div>
      </div>
      <div class="card">
        <div class="card-title">Pending ACH Draft</div>
        <div class="stat-value" style="color:#34d399;">$${r.totalACHDue.toLocaleString()}</div>
        <div class="stat-subtext">Scheduled NetSuite Debit</div>
      </div>
    </div>

    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h3 style="font-size:1.15rem; font-weight:800;">📄 Franchise Agreement & Document Center</h3>
        <p style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">Version-Controlled Agreement v4.2 • Unit Opening Milestone: 100% Passed</p>
      </div>
      <button class="btn-primary" onclick="alert('Downloading NetSuite GL Settlement CSV...')">📥 Download GL Royalty Voucher CSV</button>
    </div>
  `;
}

// 4. STORE GENERAL MANAGER VIEW
function renderStoreGMView() {
  const l = state.laborSchedule;
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
        <div class="stat-value" style="color:var(--accent-success);">$${l.forecastSales.toLocaleString()}</div>
        <div class="stat-subtext">AI Hourly Revenue Model</div>
      </div>
      <div class="card">
        <div class="card-title">Projected Labor %</div>
        <div class="stat-value" style="color:var(--accent-primary);">${l.projectedLaborPct}</div>
        <div class="stat-subtext">Max Target: ${l.targetLaborPct}</div>
      </div>
      <div class="card">
        <div class="card-title">Clopening Guardrail Alerts</div>
        <div class="stat-value" style="color:var(--accent-warning);">${l.clopeningAlerts.length} Shift</div>
        <div class="stat-subtext">Clopening Shift Blocked</div>
      </div>
      <div class="card">
        <div class="card-title">Break Attestations</div>
        <div class="stat-value" style="color:#34d399;">100%</div>
        <div class="stat-subtext">Signed at POS Clock-Out</div>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">🚫 Fair Workweek Clopening Protection Log</h3>
      ${l.clopeningAlerts.map(alert => `
        <div style="padding:1rem; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#fcd34d;">${alert.employee}</strong>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">${alert.shift1} ➔ ${alert.shift2}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono); color:var(--accent-danger); font-weight:700;">Rest: ${alert.restHours}</div>
            <span class="badge badge-alert" style="margin-top:0.25rem; inline-block;">${alert.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 5. KITCHEN MANAGER / PREP LEAD VIEW
function renderKitchenLeadView() {
  const ml = state.predictiveML;
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">👨‍🍳 Kitchen Manager & Prep Batch Production Control</h2>
        <p class="section-subtitle">Multi-Tier Recipe Trees • Yield Tracking • Waste Spoilage Logging • USB Scale Integration</p>
      </div>
      <button class="btn-primary" onclick="openModal('log_spoilage')">🗑️ Log Kitchen Spoilage</button>
    </div>

    <div class="grid-4">
      <div class="card">
        <div class="card-title">ML Recommended Dough Prep</div>
        <div class="stat-value" style="color:var(--accent-success);">${ml.recommendedDoughGrams}</div>
        <div class="stat-subtext">+5% Safety Buffer Factor</div>
      </div>
      <div class="card">
        <div class="card-title">Predicted Waste Reduction</div>
        <div class="stat-value" style="color:var(--accent-primary);">${ml.predictedWasteReduction}</div>
        <div class="stat-subtext">vs Legacy Manual Prep</div>
      </div>
      <div class="card">
        <div class="card-title">ML Model Confidence</div>
        <div class="stat-value" style="color:var(--accent-purple);">${ml.confidenceScore}</div>
        <div class="stat-subtext">94% Accuracy Score</div>
      </div>
      <div class="card">
        <div class="card-title">Kitchen Pacing Status</div>
        <div class="stat-value" style="color:#34d399;">NORMAL</div>
        <div class="stat-subtext">KDS Load <= 15 Tickets</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:2rem;">
      <h3 style="font-weight:800; font-size:1.1rem; margin-bottom:1rem;">📦 Active Batch Production Trees & Spoilage Log</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Item / Batch Name</th>
            <th>Qty</th>
            <th>Reason Code</th>
            <th>Cost Impact</th>
            <th>Logged By</th>
          </tr>
        </thead>
        <tbody>
          ${state.spoilageLogs.map(s => `
            <tr>
              <td style="font-weight:700;">${s.item}</td>
              <td style="font-family:var(--font-mono);">${s.qty}</td>
              <td><span class="badge badge-alert">${s.reason}</span></td>
              <td style="font-family:var(--font-mono); color:var(--accent-danger); font-weight:700;">${s.cost}</td>
              <td style="font-size:0.85rem;">${s.loggedBy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 6. CASHIER / FRONT-OF-HOUSE VIEW
function renderCashierView() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  return `
    <div class="pos-layout">
      <!-- Touch POS Menu Grid -->
      <div class="pos-grid">
        ${state.menuItems.map(item => `
          <div class="pos-item-card" onclick="addToCart('${item.id}')">
            <img src="${item.image}" alt="${item.name}" class="pos-food-img" />
            <div class="pos-item-body">
              <div>
                <div class="pos-item-name">${item.name}</div>
                ${item.allergens.length ? `<span class="allergen-tag">⚠️ ${item.allergens.join(', ')}</span>` : ''}
              </div>
              <div class="pos-item-price">$${item.basePrice.toFixed(2)}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Live Cart Panel -->
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
              <div style="font-size: 0.8rem; margin-top: 0.25rem;">Tap menu items to add to order.</div>
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
            <span style="color:var(--accent-success);">$${total.toFixed(2)}</span>
          </div>

          <button class="checkout-btn" onclick="submitCheckout()" ${state.cart.length === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            ${state.storeOffline ? '⚡ PROCESS OFFLINE CHECKOUT (DEFERRED AUTH)' : '💳 COMPLETE CHECKOUT (ADYEN P2PE)'}
          </button>
        </div>
      </div>
    </div>
  `;
}

// 7. PROCUREMENT / SUPPLY CHAIN VIEW
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
        <div class="stat-value" style="color:var(--accent-primary);">148</div>
        <div class="stat-subtext">Gram-Level Tracking</div>
      </div>
      <div class="card">
        <div class="card-title">Variance Flagged Threshold</div>
        <div class="stat-value" style="color:var(--accent-danger);">±2.0%</div>
        <div class="stat-subtext">Auto Alert Threshold</div>
      </div>
      <div class="card">
        <div class="card-title">Items Exceeding Variance</div>
        <div class="stat-value" style="color:var(--accent-warning);">2 Items</div>
        <div class="stat-subtext">Shrinkage Protection Active</div>
      </div>
      <div class="card">
        <div class="card-title">Multi-Tier Transfers</div>
        <div class="stat-value" style="color:#34d399;">3 Pending</div>
        <div class="stat-subtext">Commissary ➔ Store #104</div>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:1rem;">⚠️ Real-Time Inventory Variance Log (Theoretical vs Actual)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Theoretical</th>
            <th>Actual Count</th>
            <th>Variance %</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${state.inventoryVariances.map(v => `
            <tr>
              <td style="font-weight:700;">${v.name}</td>
              <td style="font-family:var(--font-mono);">${v.theoretical} ${v.unit}</td>
              <td style="font-family:var(--font-mono);">${v.actual} ${v.unit}</td>
              <td style="font-family:var(--font-mono); color:${v.alert ? 'var(--accent-danger)' : 'var(--accent-success)'}; font-weight:800;">${v.variancePct}</td>
              <td>${v.alert ? '<span class="badge badge-alert">ALERT ≥ ±2%</span>' : '<span class="badge badge-success">NORMAL</span>'}</td>
              <td><button class="btn-primary" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="alert('Supplier Reorder Triggered for ${v.name}')">Reorder</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 8. FINANCE & ROYALTY ADMIN VIEW
function renderFinanceAdminView() {
  const r = state.royaltyData;
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
        <div class="stat-value" style="color:var(--accent-success);">BALANCED</div>
        <div class="stat-subtext">Debits = Credits ($41.02)</div>
      </div>
      <div class="card">
        <div class="card-title">Total Royalty Fee (4.5%)</div>
        <div class="stat-value" style="color:var(--accent-primary);">$${r.royaltyAmount.toLocaleString()}</div>
        <div class="stat-subtext">Tiered Fee Calculation</div>
      </div>
      <div class="card">
        <div class="card-title">Brand Marketing (2.0%)</div>
        <div class="stat-value" style="color:var(--accent-purple);">$${r.marketingFund.toLocaleString()}</div>
        <div class="stat-subtext">National Campaign Fund</div>
      </div>
      <div class="card">
        <div class="card-title">Total ACH Draft Pending</div>
        <div class="stat-value" style="color:#34d399;">$${r.totalACHDue.toLocaleString()}</div>
        <div class="stat-subtext">Scheduled ACH Invoicing</div>
      </div>
    </div>
  `;
}

// Render Modals
function renderModals() {
  if (!state.modalOpen) return '';

  if (state.modalOpen === 'add_item') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h3 style="font-weight:800; font-size:1.25rem; margin-bottom:1rem;">➕ Add Master Menu Item (HQ Control)</h3>
          <div class="form-group">
            <label class="form-label">SKU Code</label>
            <input type="text" id="new-sku" class="form-input" placeholder="e.g. PIZ-CHZ-LG" value="PIZ-CHZ-LG" />
          </div>
          <div class="form-group">
            <label class="form-label">Item Name</label>
            <input type="text" id="new-name" class="form-input" placeholder="e.g. Four Cheese Pizza" value="Four Cheese Artisanal Pizza" />
          </div>
          <div class="form-group">
            <label class="form-label">Base Price ($)</label>
            <input type="number" step="0.01" id="new-price" class="form-input" value="17.99" />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button class="btn-primary" style="background:var(--bg-card-hover);" onclick="closeModal()">Cancel</button>
            <button class="btn-success" onclick="saveMasterItem()">Save Master Item</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'log_spoilage') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <h3 style="font-weight:800; font-size:1.25rem; margin-bottom:1rem;">🗑️ Log Kitchen Spoilage / Waste</h3>
          <div class="form-group">
            <label class="form-label">Item Name</label>
            <input type="text" id="spoil-item" class="form-input" value="Artisanal Dough Ball 500g" />
          </div>
          <div class="form-group">
            <label class="form-label">Quantity Spoiled</label>
            <input type="text" id="spoil-qty" class="form-input" value="3 pcs" />
          </div>
          <div class="form-group">
            <label class="form-label">Reason Code</label>
            <select id="spoil-reason" class="form-select">
              <option value="BURNT">BURNT IN OVEN</option>
              <option value="DROPPED_FLOOR" selected>DROPPED ON FLOOR</option>
              <option value="EXPIRED">EXPIRED PAST SHELF LIFE</option>
              <option value="QUALITY_REJECT">QUALITY CONTROL REJECT</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button class="btn-primary" style="background:var(--bg-card-hover);" onclick="closeModal()">Cancel</button>
            <button class="btn-danger" onclick="saveSpoilageLog()">Log Spoilage</button>
          </div>
        </div>
      </div>
    `;
  }

  return '';
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

window.openModal = function(modalName) {
  state.modalOpen = modalName;
  renderApp();
};

window.closeModal = function() {
  state.modalOpen = null;
  renderApp();
};

window.saveMasterItem = function() {
  const sku = document.getElementById('new-sku').value;
  const name = document.getElementById('new-name').value;
  const price = parseFloat(document.getElementById('new-price').value);

  state.menuItems.unshift({
    id: `item-${Date.now()}`,
    sku,
    name,
    category: 'Pizzas',
    basePrice: price,
    image: '/pepperoni_pizza.jpg',
    allergens: ['DAIRY', 'GLUTEN'],
    locked: true,
    version: 1,
  });

  state.auditLedger.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    actor: 'HQ Menu Engineer',
    action: 'CREATE_MASTER_ITEM',
    target: `MenuItem (${sku})`,
    hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
  });

  closeModal();
};

window.saveSpoilageLog = function() {
  const item = document.getElementById('spoil-item').value;
  const qty = document.getElementById('spoil-qty').value;
  const reason = document.getElementById('spoil-reason').value;

  state.spoilageLogs.unshift({
    id: `spoil-${Date.now()}`,
    item,
    qty,
    reason,
    cost: '$4.50',
    loggedBy: 'Kitchen Lead',
  });

  closeModal();
};

window.toggleBrandLock = function(itemId) {
  const item = state.menuItems.find(i => i.id === itemId);
  if (item) {
    item.locked = !item.locked;
    state.auditLedger.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: 'Security Director',
      action: item.locked ? 'LOCK_BRAND_RECORD' : 'UNLOCK_BRAND_RECORD',
      target: `MenuItem (${item.sku})`,
      hash: 'ff8899aabbccddeeff00112233445566778899aabbccddeeff00112233445566',
    });
    renderApp();
  }
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

window.submitCheckout = function() {
  if (state.cart.length === 0) return;

  const newTicketId = `tx-${Math.floor(1000 + Math.random() * 9000)}`;
  state.kdsTickets.unshift({
    id: newTicketId,
    source: state.storeOffline ? 'POS Terminal 01 (Offline)' : 'POS Terminal 01',
    time: 'Just now',
    brandBadge: 'Artisanal Pizza Co.',
    badgeColor: '#3b82f6',
    items: state.cart.map(c => ({ qty: c.qty, name: c.name, allergens: c.allergens })),
    urgent: false,
  });

  state.cart = [];
  alert(state.storeOffline 
    ? '✅ Order Processed Offline! Saved to encrypted store edge vault.' 
    : '✅ Payment Approved via Adyen P2PE Terminal! Ticket sent to KDS in < 200ms.'
  );
  renderApp();
};

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});
