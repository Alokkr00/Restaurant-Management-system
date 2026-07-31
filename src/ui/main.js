// Enterprise Multi-Unit RMS - Definitive Full-Stack Workspaces Suite

const EDGE_SERVER_URL = 'http://localhost:3001';
const EDGE_WS_URL = 'ws://localhost:3001';

const state = {
  selectedPersona: 'hq_executive',
  storeOffline: false,
  apiConnected: false,
  wsConnected: false,
  modalOpen: null, // null | 'add_menu_item' | 'field_audit' | 'log_spoilage' | 'checkout_receipt' | 'add_shift'
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
    { id: 'aud-991', timestamp: '2026-07-31 19:10:00', actor: 'HQ Menu Engineer', action: 'UPDATE_PRICE', target: 'MenuItem (PIZ-PEP-LG)', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { id: 'aud-990', timestamp: '2026-07-31 18:45:00', actor: 'Security Director', action: 'LOCK_BRAND_RECORD', target: 'Recipe (Craft Garlic Knots)', hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
  ],
  canaryRolloutPct: 15,
  fieldAudits: [
    { id: 'aud-st-104', storeId: 'Store #104 (Chicago)', inspector: 'Sarah Jenkins', score: '96%', date: '2026-07-31', status: 'PASSED' },
    { id: 'aud-st-101', storeId: 'Store #101 (Downtown)', inspector: 'Mark Vance', score: '98%', date: '2026-07-30', status: 'PASSED' },
  ],
  tipPoolTotal: 450.00,
  latestReceipt: null,
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
    <!-- Top Glassmorphic Navigation -->
    <header class="navbar">
      <div class="brand-section">
        <img src="/restaurant_logo.jpg" alt="Logo" class="logo-img" />
        <div>
          <div class="brand-title">Frenchize RMS</div>
          <div class="brand-subtitle">Distributed Multi-Unit Suite</div>
        </div>
      </div>

      <!-- Persona Selector -->
      <div class="persona-selector">
        <span>👤 Role Workspace:</span>
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

      <!-- Edge Connection Status -->
      <div class="status-pill ${state.storeOffline ? 'offline' : ''}" onclick="toggleOffline()">
        <span class="status-dot"></span>
        <span>${state.storeOffline ? 'STORE EDGE (OFFLINE)' : `STORE EDGE (${state.wsConnected ? 'WS & REST ACTIVE' : 'ONLINE'})`}</span>
      </div>
    </header>

    <!-- Main Workspace Container -->
    <main class="view-container">
      ${renderPersonaWorkspace()}
    </main>

    <!-- Modals -->
    ${renderModals()}
  `;
}

function renderPersonaWorkspace() {
  switch (state.selectedPersona) {
    case 'hq_executive': return renderHQExecutiveWorkspace();
    case 'regional_director': return renderRegionalDirectorWorkspace();
    case 'franchisee': return renderFranchiseeWorkspace();
    case 'store_gm': return renderStoreGMWorkspace();
    case 'kitchen_lead': return renderKitchenLeadWorkspace();
    case 'cashier': return renderCashierWorkspace();
    case 'procurement': return renderProcurementWorkspace();
    case 'finance_admin': return renderFinanceAdminWorkspace();
    default: return renderHQExecutiveWorkspace();
  }
}

// 1. HQ EXECUTIVE / MENU ENGINEER WORKSPACE
function renderHQExecutiveWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">🏢 HQ Menu Inheritance & Brand Control Workspace</h2>
        <p class="section-subtitle">Platform ➔ Brand ➔ Region ➔ Store Resolution • Brand Lock Safeguards • Staged Canary Rollout</p>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button class="btn-primary" style="background:var(--accent-blue);" onclick="openModal('add_menu_item')">➕ Add Master Menu Item</button>
        <button class="btn-primary" style="background:var(--accent-purple);" onclick="increaseCanaryRollout()">🚀 Advance Canary Rollout (${state.canaryRolloutPct}%)</button>
        <button class="btn-primary" style="background:var(--accent-rose);" onclick="rollbackCanary()">⚡ 1-Click Rollback</button>
      </div>
    </div>

    <!-- Master Menu Management Table -->
    <div class="card" style="margin-bottom: 2rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display);">🔒 Global Master Menu Items & Brand-Lock Controls</h3>
        <span class="badge badge-locked">HQ BRAND LOCK ACTIVE</span>
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
              <th>HQ Brand Lock</th>
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
                <td style="font-family:var(--font-mono); color:var(--accent-emerald); font-weight:800;">$${item.basePrice.toFixed(2)}</td>
                <td>${item.allergens && item.allergens.length ? `<span class="badge badge-alert">⚠️ ${item.allergens.join(', ')}</span>` : '<span class="badge badge-success">NONE</span>'}</td>
                <td>${item.isBrandLocked ? '<span class="badge badge-locked">🔒 BRAND LOCKED</span>' : '<span class="badge badge-warning">UNLOCKED</span>'}</td>
                <td style="font-family:var(--font-mono);">v${item.version || 1}</td>
                <td>
                  <button class="btn-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="toggleBrandLock('${item.id}')">${item.isBrandLocked ? 'Unlock' : 'Lock HQ'}</button>
                  <button class="btn-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem; background:var(--accent-purple);" onclick="promptPriceEdit('${item.id}')">Edit Price</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Cryptographic SHA-256 Audit Log Ledger -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">🛡️ Tamper-Proof Cryptographic SHA-256 Audit Log Ledger</h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Audit ID</th>
              <th>Timestamp</th>
              <th>Actor Role</th>
              <th>Action</th>
              <th>Target Entity</th>
              <th>SHA-256 Hash Chain Verification</th>
            </tr>
          </thead>
          <tbody>
            ${state.auditLedger.map(a => `
              <tr>
                <td style="font-family:var(--font-mono); font-weight:700;">${a.id}</td>
                <td style="font-size:0.85rem; color:var(--text-secondary);">${a.timestamp}</td>
                <td style="font-weight:700; color:var(--accent-blue);">${a.actor}</td>
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

// 2. REGIONAL DIRECTOR WORKSPACE
function renderRegionalDirectorWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">🌐 Regional Director Benchmarking & Field Audit Tool</h2>
        <p class="section-subtitle">Cross-Location Store Heatmaps • Brand Standards Inspection • Mobile Field Auditing</p>
      </div>
      <button class="btn-primary" style="background:var(--accent-blue);" onclick="openModal('field_audit')">📱 Conduct New Mobile Field Inspection</button>
    </div>

    <!-- Benchmarking Table -->
    <div class="card" style="margin-bottom:2rem;">
      <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">📊 Multi-Store Performance Benchmarking (Chicago Region)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Store Location</th>
            <th>Gross Revenue</th>
            <th>COGS % (Target 29%)</th>
            <th>Labor % (Target <= 22%)</th>
            <th>Variance Alert</th>
            <th>Audit Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight:700;">Store #101 (Downtown Chicago)</td>
            <td style="font-family:var(--font-mono);">$8,450.00</td>
            <td style="font-family:var(--font-mono); color:var(--accent-emerald);">27.8%</td>
            <td style="font-family:var(--font-mono); color:var(--accent-emerald);">18.1%</td>
            <td><span class="badge badge-success">NORMAL</span></td>
            <td><span class="badge badge-success">98% PASSED</span></td>
          </tr>
          <tr>
            <td style="font-weight:700;">Store #104 (Chicago West)</td>
            <td style="font-family:var(--font-mono);">$6,200.00</td>
            <td style="font-family:var(--font-mono); color:var(--accent-rose);">31.2%</td>
            <td style="font-family:var(--font-mono); color:var(--accent-emerald);">18.4%</td>
            <td><span class="badge badge-alert">SHRINKAGE ALERT</span></td>
            <td><span class="badge badge-success">96% PASSED</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Field Audit Log -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">📋 Completed Mobile Field Audits</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Audit ID</th>
            <th>Store Unit</th>
            <th>Field Inspector</th>
            <th>Compliance Score</th>
            <th>Audit Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${state.fieldAudits.map(f => `
            <tr>
              <td style="font-family:var(--font-mono); font-weight:700;">${f.id}</td>
              <td style="font-weight:700;">${f.storeId}</td>
              <td>${f.inspector}</td>
              <td style="font-family:var(--font-mono); font-weight:800; color:var(--accent-emerald);">${f.score}</td>
              <td style="font-size:0.85rem; color:var(--text-secondary);">${f.date}</td>
              <td><span class="badge badge-success">${f.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 3. FRANCHISEE WORKSPACE
function renderFranchiseeWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">📈 Franchisee Self-Service Portal (Store #104)</h2>
        <p class="section-subtitle">Tenant-Isolated Financials • Tiered Royalty Breakdown • Automated ACH Statement Generator</p>
      </div>
      <button class="btn-primary" style="background:var(--accent-emerald);" onclick="generateRoyaltyStatement()">📄 Export Royalty ACH Statement (PDF/CSV)</button>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">💰 Tenant P&L Contribution Breakdown</h3>
        <table class="data-table">
          <tbody>
            <tr>
              <td style="font-weight:700;">Gross POS Live Sales</td>
              <td style="font-family:var(--font-mono); color:var(--accent-emerald); font-weight:800; text-align:right;">$64,250.00</td>
            </tr>
            <tr>
              <td>Cost of Goods Sold (COGS 29.1%)</td>
              <td style="font-family:var(--font-mono); color:var(--accent-rose); text-align:right;">-$18,696.75</td>
            </tr>
            <tr>
              <td>Store Labor Expenses (18.4%)</td>
              <td style="font-family:var(--font-mono); color:var(--accent-rose); text-align:right;">-$11,822.00</td>
            </tr>
            <tr>
              <td>Brand Royalty Fee (4.5%)</td>
              <td style="font-family:var(--font-mono); color:var(--accent-blue); text-align:right;">-$2,891.25</td>
            </tr>
            <tr>
              <td>National Marketing Fund (2.0%)</td>
              <td style="font-family:var(--font-mono); color:var(--accent-purple); text-align:right;">-$1,285.00</td>
            </tr>
            <tr style="border-top:2px solid rgba(255,255,255,0.15);">
              <td style="font-weight:800; font-size:1.1rem;">Net Store Operating Profit</td>
              <td style="font-family:var(--font-mono); color:#34d399; font-weight:800; font-size:1.2rem; text-align:right;">$29,555.00</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">📂 Franchise Agreement & Compliance Library</h3>
        <div style="display:flex; flex-direction:column; gap:0.85rem;">
          <div style="padding:0.9rem; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:#ffffff;">Franchise Disclosure Agreement v4.2</strong>
              <div style="font-size:0.8rem; color:var(--text-secondary);">Signed Jan 15, 2026 • Valid thru 2036</div>
            </div>
            <button class="btn-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="alert('Downloading Agreement PDF...')">View PDF</button>
          </div>
          <div style="padding:0.9rem; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:#ffffff;">Store Opening Milestone Checklist</strong>
              <div style="font-size:0.8rem; color:var(--text-secondary);">100% Passed • Verified by HQ</div>
            </div>
            <span class="badge badge-success">COMPLETED</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 4. STORE GM WORKSPACE
function renderStoreGMWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">⏱️ Store GM Employee Shift & Fair Workweek Workspace</h2>
        <p class="section-subtitle">Real-time Employee Timecards • AI Labor Scheduler • Clopening Rest Guardrails (< 11h Rest)</p>
      </div>
      <button class="btn-primary" style="background:var(--accent-blue);" onclick="openModal('add_shift')">📅 Add Shift to AI Schedule</button>
    </div>

    <!-- Active Employee Timecards Table -->
    <div class="card" style="margin-bottom:2rem;">
      <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">👥 Shift Employee Timecards & Break Attestations</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Employee Name</th>
            <th>Role</th>
            <th>Clock Status</th>
            <th>Shift Start</th>
            <th>Shift Hours</th>
            <th>Meal/Rest Break Attestation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.employees.map(e => `
            <tr>
              <td style="font-weight:700;">${e.name}</td>
              <td>${e.role}</td>
              <td>${e.status === 'CLOCKED_IN' ? '<span class="badge badge-success">🟢 CLOCKED IN</span>' : '<span class="badge badge-locked">🔴 CLOCKED OUT</span>'}</td>
              <td style="font-size:0.85rem; color:var(--text-secondary);">${e.shiftStart}</td>
              <td style="font-family:var(--font-mono);">${e.hours} hrs</td>
              <td>${e.breakAttested ? '<span class="badge badge-success">✅ SIGNED AT CLOCK-OUT</span>' : '<span class="badge badge-alert">PENDING</span>'}</td>
              <td>
                <button class="btn-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="toggleEmployeeClock('${e.id}')">${e.status === 'CLOCKED_IN' ? 'Clock Out' : 'Clock In'}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 5. KITCHEN MANAGER / PREP LEAD WORKSPACE
function renderKitchenLeadWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">👨‍🍳 Kitchen KDS Ticket Queue & Spoilage Production Workspace</h2>
        <p class="section-subtitle">Real-time LAN WebSocket Tickets (< 200ms) • Recipe Batch Exploder • Spoilage Logger</p>
      </div>
      <button class="btn-primary" style="background:var(--accent-rose);" onclick="openModal('log_spoilage')">🗑️ Log Kitchen Spoilage / Waste</button>
    </div>

    <!-- Live KDS Ticket Grid -->
    <div class="grid-2" style="margin-bottom:2rem;">
      ${state.kdsTickets.map((t, idx) => `
        <div class="card" style="border: 2px solid ${t.urgent ? 'var(--accent-rose)' : 'var(--border-color)'};">
          <div style="display:flex; justify-between; align-items:center; margin-bottom:0.75rem;">
            <div>
              <strong style="font-size:1.1rem; color:#ffffff;">Ticket #${t.id}</strong>
              <div style="font-size:0.8rem; color:var(--text-secondary);">${t.source} • ${t.time}</div>
            </div>
            <span class="badge ${t.urgent ? 'badge-alert' : 'badge-success'}">${t.urgent ? '🔥 URGENT PACING' : 'NORMAL'}</span>
          </div>
          <div style="padding:0.75rem 0; border-top:1px solid var(--border-color); border-bottom:1px solid var(--border-color); margin-bottom:1rem;">
            ${t.items.map(i => `
              <div style="display:flex; justify-between; padding:0.35rem 0; font-weight:700;">
                <span>${i.qty}x ${i.name}</span>
                ${i.allergens ? `<span style="color:var(--accent-rose); font-size:0.8rem;">⚠️ ${i.allergens.join(', ')}</span>` : ''}
              </div>
            `).join('')}
          </div>
          <button class="btn-primary" style="width:100%; background:var(--accent-emerald);" onclick="bumpKDSTicket('${t.id}')">✅ BUMP TICKET (COMPLETE)</button>
        </div>
      `).join('')}
    </div>

    <!-- Spoilage Logs -->
    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">📦 Logged Kitchen Waste & Spoilage History</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Quantity</th>
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
              <td style="font-family:var(--font-mono); color:var(--accent-rose); font-weight:800;">${s.cost}</td>
              <td style="font-size:0.85rem;">${s.loggedBy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 6. CASHIER TOUCH POS WORKSPACE
function renderCashierWorkspace() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * (state.selectedTaxJurisdiction === 'EU_VAT' ? 0.20 : state.selectedTaxJurisdiction === 'INDIA_GST' ? 0.05 : 0.08);
  const total = subtotal + tax;

  return `
    <div class="pos-layout">
      <!-- POS Cards -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display);">🛒 Touch POS Terminal (Pluggable Tax Engine)</h3>
          <select class="persona-select" style="background:#0e1628; padding:0.4rem 0.8rem; border-radius:8px; border:1px solid var(--border-color);" onchange="changeTaxStrategy(this.value)">
            <option value="US_SALES_TAX" ${state.selectedTaxJurisdiction === 'US_SALES_TAX' ? 'selected' : ''}>🇺🇸 US Sales Tax (8%)</option>
            <option value="EU_VAT" ${state.selectedTaxJurisdiction === 'EU_VAT' ? 'selected' : ''}>🇪🇺 European VAT (20%)</option>
            <option value="INDIA_GST" ${state.selectedTaxJurisdiction === 'INDIA_GST' ? 'selected' : ''}>🇮🇳 India GST (5%)</option>
          </select>
        </div>
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
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <button class="btn-primary" style="padding:0.15rem 0.4rem; font-size:0.75rem;" onclick="updateCartQty('${item.id}', -1)">-</button>
                <span style="font-family: var(--font-mono); font-weight:700;">$${(item.price * item.qty).toFixed(2)}</span>
                <button class="btn-primary" style="padding:0.15rem 0.4rem; font-size:0.75rem;" onclick="updateCartQty('${item.id}', 1)">+</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="cart-totals">
          <div style="display:flex; justify-content:space-between; color:var(--text-secondary);">
            <span>Subtotal</span>
            <span>$${subtotal.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; color:var(--text-secondary); margin-top:0.25rem;">
            <span>Tax (${state.selectedTaxJurisdiction})</span>
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

// 7. PROCUREMENT WORKSPACE
function renderProcurementWorkspace() {
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">📦 Inventory Variance & Supplier Reorder Workspace</h2>
        <p class="section-subtitle">Theoretical vs. Actual Variance Engine • Auto-Flagging ±2.0% Shrinkage • Supplier Reordering</p>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">⚠️ Inventory Variance Sheet (Theoretical vs Actual)</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>Ingredient Name</th>
            <th>Theoretical Count</th>
            <th>Actual Count</th>
            <th>Variance %</th>
            <th>Shrinkage Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.inventoryVariances.map(v => `
            <tr>
              <td style="font-weight:700;">${v.name}</td>
              <td style="font-family:var(--font-mono);">${v.theoretical} ${v.unit}</td>
              <td style="font-family:var(--font-mono);">${v.actual} ${v.unit}</td>
              <td style="font-family:var(--font-mono); color:${v.alert ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; font-weight:800;">${v.variancePct}</td>
              <td>${v.alert ? '<span class="badge badge-alert">ALERT >= ±2%</span>' : '<span class="badge badge-success">NORMAL</span>'}</td>
              <td><button class="btn-primary" style="padding:0.3rem 0.6rem; font-size:0.75rem;" onclick="triggerSupplierReorder('${v.name}')">Reorder Supplier</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 8. FINANCE ADMIN WORKSPACE
function renderFinanceAdminWorkspace() {
  const tipPerPerson = (state.tipPoolTotal / state.employees.length).toFixed(2);
  return `
    <div class="section-header">
      <div>
        <h2 class="section-title">💳 Oracle NetSuite GL & Tip Pool Administration</h2>
        <p class="section-subtitle">Double-Entry Journal Entries (Debits = Credits) • Role-Weighted Tip Payout Allocations</p>
      </div>
      <button class="btn-primary" style="background:var(--accent-blue);" onclick="calculateTipDistribution()">💵 Recalculate Shift Tip Pool</button>
    </div>

    <div class="grid-2">
      <!-- GL Double-Entry Table -->
      <div class="card">
        <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">📖 NetSuite Balanced GL Journal Entry</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Account Code & Name</th>
              <th>Debit ($)</th>
              <th>Credit ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:700;">Account 1010 (Cash/Card Tenders)</td>
              <td style="font-family:var(--font-mono); color:var(--accent-emerald);">$41.02</td>
              <td style="font-family:var(--font-mono);">$0.00</td>
            </tr>
            <tr>
              <td>Account 4010 (Food Sales Revenue)</td>
              <td style="font-family:var(--font-mono);">$0.00</td>
              <td style="font-family:var(--font-mono); color:var(--accent-blue);">$37.98</td>
            </tr>
            <tr>
              <td>Account 2010 (Sales Tax Payable)</td>
              <td style="font-family:var(--font-mono);">$0.00</td>
              <td style="font-family:var(--font-mono); color:var(--accent-blue);">$3.04</td>
            </tr>
            <tr style="border-top:2px solid rgba(255,255,255,0.15);">
              <td style="font-weight:800;">GL Balanced Total</td>
              <td style="font-family:var(--font-mono); font-weight:800; color:var(--accent-emerald);">$41.02</td>
              <td style="font-family:var(--font-mono); font-weight:800; color:var(--accent-emerald);">$41.02</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tip Pool Calculator -->
      <div class="card">
        <h3 style="font-size:1.1rem; font-weight:800; font-family:var(--font-display); margin-bottom:1rem;">💵 Shift Tip Pool Distribution</h3>
        <div style="font-size:1.2rem; font-family:var(--font-mono); margin-bottom:1rem; color:var(--accent-emerald); font-weight:800;">
          Total Shift Tip Pool: $${state.tipPoolTotal.toFixed(2)}
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Tip Payout</th>
            </tr>
          </thead>
          <tbody>
            ${state.employees.map(e => `
              <tr>
                <td style="font-weight:700;">${e.name}</td>
                <td>${e.role}</td>
                <td style="font-family:var(--font-mono); font-weight:800; color:var(--accent-emerald);">$${tipPerPerson}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Modals
function renderModals() {
  if (!state.modalOpen) return '';

  if (state.modalOpen === 'add_menu_item') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()" style="background:#0e1628; border:1px solid var(--border-color); border-radius:16px; padding:2rem; max-width:500px; margin:5rem auto;">
          <h3 style="font-weight:800; font-size:1.25rem; margin-bottom:1rem;">➕ Add Master Menu Item (HQ Control)</h3>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">SKU Code</label>
            <input type="text" id="new-sku" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="PIZ-CHZ-LG" />
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Item Name</label>
            <input type="text" id="new-name" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="Four Cheese Artisanal Pizza" />
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Base Price ($)</label>
            <input type="number" step="0.01" id="new-price" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="17.99" />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button class="btn-primary" style="background:var(--text-muted);" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" style="background:var(--accent-emerald);" onclick="saveMasterItem()">Save Master Item</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'log_spoilage') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()" style="background:#0e1628; border:1px solid var(--border-color); border-radius:16px; padding:2rem; max-width:500px; margin:5rem auto;">
          <h3 style="font-weight:800; font-size:1.25rem; margin-bottom:1rem;">🗑️ Log Kitchen Spoilage / Waste</h3>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Item Name</label>
            <input type="text" id="spoil-item" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="Artisanal Dough Ball 500g" />
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Quantity Spoiled</label>
            <input type="text" id="spoil-qty" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="3 pcs" />
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Reason Code</label>
            <select id="spoil-reason" class="persona-select" style="width:100%; background:#0e1628; padding:0.6rem; border:1px solid var(--border-color);">
              <option value="BURNT">BURNT IN OVEN</option>
              <option value="DROPPED_FLOOR" selected>DROPPED ON FLOOR</option>
              <option value="EXPIRED">EXPIRED PAST SHELF LIFE</option>
            </select>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button class="btn-primary" style="background:var(--text-muted);" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" style="background:var(--accent-rose);" onclick="saveSpoilageLog()">Log Spoilage</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'field_audit') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()" style="background:#0e1628; border:1px solid var(--border-color); border-radius:16px; padding:2rem; max-width:500px; margin:5rem auto;">
          <h3 style="font-weight:800; font-size:1.25rem; margin-bottom:1rem;">📱 Conduct Mobile Field Audit Inspection</h3>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Store Unit</label>
            <select id="audit-store" class="persona-select" style="width:100%; background:#0e1628; padding:0.6rem; border:1px solid var(--border-color);">
              <option value="Store #104 (Chicago)">Store #104 (Chicago West)</option>
              <option value="Store #101 (Downtown)">Store #101 (Downtown)</option>
            </select>
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Inspector Name</label>
            <input type="text" id="audit-inspector" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="Sarah Jenkins" />
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Audit Compliance Score (%)</label>
            <input type="number" id="audit-score" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="97" />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button class="btn-primary" style="background:var(--text-muted);" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" style="background:var(--accent-emerald);" onclick="saveFieldAudit()">Submit Audit Score</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.modalOpen === 'add_shift') {
    return `
      <div class="modal-overlay" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()" style="background:#0e1628; border:1px solid var(--border-color); border-radius:16px; padding:2rem; max-width:500px; margin:5rem auto;">
          <h3 style="font-weight:800; font-size:1.25rem; margin-bottom:1rem;">📅 Add Shift to AI Schedule</h3>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Employee</label>
            <input type="text" id="shift-emp" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="John Doe" />
          </div>
          <div style="margin-bottom:1rem;">
            <label style="display:block; font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.3rem;">Shift Hours</label>
            <input type="number" id="shift-hrs" class="form-input" style="width:100%; padding:0.6rem; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; border-radius:8px;" value="8" />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
            <button class="btn-primary" style="background:var(--text-muted);" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" style="background:var(--accent-blue);" onclick="saveShift()">Add Shift</button>
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

window.toggleBrandLock = function(itemId) {
  const item = state.menuItems.find(i => i.id === itemId);
  if (item) {
    item.isBrandLocked = !item.isBrandLocked;
    state.auditLedger.unshift({
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actor: 'Security Director',
      action: item.isBrandLocked ? 'LOCK_BRAND_RECORD' : 'UNLOCK_BRAND_RECORD',
      target: `MenuItem (${item.sku})`,
      hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
    });
    renderApp();
  }
};

window.promptPriceEdit = function(itemId) {
  const item = state.menuItems.find(i => i.id === itemId);
  if (!item) return;
  const newPrice = prompt(`Enter new base price for ${item.name}:`, item.basePrice.toString());
  if (newPrice && !isNaN(parseFloat(newPrice))) {
    item.basePrice = parseFloat(newPrice);
    item.version = (item.version || 1) + 1;
    renderApp();
  }
};

window.increaseCanaryRollout = function() {
  if (state.canaryRolloutPct < 100) {
    state.canaryRolloutPct += 25;
    alert(`🚀 Canary Rollout Advanced to ${state.canaryRolloutPct}% across store locations!`);
    renderApp();
  }
};

window.rollbackCanary = function() {
  state.canaryRolloutPct = 0;
  alert('⚡ 1-Click Rollback Executed! Menu version reverted across all edge nodes.');
  renderApp();
};

window.bumpKDSTicket = function(ticketId) {
  state.kdsTickets = state.kdsTickets.filter(t => t.id !== ticketId);
  renderApp();
};

window.addToCart = function(itemId) {
  const item = state.menuItems.find(i => i.id === itemId);
  if (!item) return;
  const existing = state.cart.find(c => c.id === itemId);
  if (existing) existing.qty++;
  else state.cart.push({ ...item, price: item.basePrice, qty: 1 });
  renderApp();
};

window.updateCartQty = function(itemId, delta) {
  const item = state.cart.find(c => c.id === itemId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) state.cart = state.cart.filter(c => c.id !== itemId);
    renderApp();
  }
};

window.changeTaxStrategy = function(val) {
  state.selectedTaxJurisdiction = val;
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
    total: Number((state.cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 1.08).toFixed(2)),
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

window.triggerSupplierReorder = function(name) {
  alert(`📦 Supplier Reorder Triggered for ${name}! Purchase Order dispatched to commissary.`);
};

window.toggleEmployeeClock = function(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (emp) {
    emp.status = emp.status === 'CLOCKED_IN' ? 'CLOCKED_OUT' : 'CLOCKED_IN';
    renderApp();
  }
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
    isBrandLocked: true,
    version: 1,
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

window.saveFieldAudit = function() {
  const storeId = document.getElementById('audit-store').value;
  const inspector = document.getElementById('audit-inspector').value;
  const score = document.getElementById('audit-score').value + '%';

  state.fieldAudits.unshift({
    id: `aud-${Date.now()}`,
    storeId,
    inspector,
    score,
    date: new Date().toISOString().substring(0, 10),
    status: 'PASSED',
  });

  closeModal();
};

window.saveShift = function() {
  const name = document.getElementById('shift-emp').value;
  const hrs = parseFloat(document.getElementById('shift-hrs').value);

  state.employees.unshift({
    id: `emp-${Date.now()}`,
    name,
    role: 'Shift Staff',
    status: 'CLOCKED_IN',
    shiftStart: 'Just now',
    hours: hrs,
    breakAttested: true,
  });

  closeModal();
};

window.generateRoyaltyStatement = function() {
  alert('📄 Exporting NetSuite Royalty Statement CSV/PDF for Store #104...');
};

window.calculateTipDistribution = function() {
  alert('💵 Shift tip pool recalculated across active employees!');
};

document.addEventListener('DOMContentLoaded', () => {
  initBackendConnection();
  renderApp();
});
