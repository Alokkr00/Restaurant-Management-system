# Multi-Unit Restaurant Management System (RMS)

A distributed, event-driven restaurant management platform built for multi-unit corporate operations and franchise networks. Includes local edge node fallback, real-time POS/KDS routing, recipe depletion, labor compliance, and multi-tenant franchisee data isolation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.4-purple)

---

## Key Features

- **Offline-First Store Edge Node**: Runs a local Express + SQLite daemon per store location. Routes POS tickets to KDS screens over LAN WebSocket in `< 200ms`.
- **Hierarchical Inheritance Engine**: Resolves menu configurations in strict order: `Platform Default -> Brand -> Region -> Store`. Supports HQ brand locks to prevent store-level menu tampering.
- **Inventory BOM & Depletion**: Gram-level recipe exploding with trim yield factors and real-time $\pm 2\%$ theoretical vs. actual variance alerting.
- **P2PE Offline Card Payments**: Supports Adyen P2PE card authorizations with configurable offline risk limits ($100 per transaction, $2,500 store total) and supervisor PIN overrides.
- **Labor Compliance & AI Scheduling**: Enforces Fair Workweek rest rules (blocks shifts with $< 11\text{h}$ rest) and maintains target labor cost $\le 22\%$.
- **Pluggable Tax Engine**: Pluggable strategies for US Sales Tax, European VAT, and India GST.
- **Multi-Tenant Security Isolation**: Strict JWT session context carrying `tenantId`, `brandId`, `storeIds[]`, and RBAC claims (`HQ_ADMIN`, `FRANCHISEE_OWNER`, `STORE_MANAGER`, etc.).

---

## Repository Structure

```
├── src/
│   ├── shared/             # Shared types, Zod schemas, and SHA-256 sync engine
│   ├── hq-cloud/           # Inheritance engine and multi-brand concept router
│   ├── store-edge/          # Store Edge server daemon (Express + WebSocket)
│   ├── inventory/          # Recipe exploding, yield tracking, and ML prep forecasting
│   ├── fintech/            # P2PE offline payment vault, tip pooling, and royalty engine
│   ├── labor/              # Compliance guardrails and AI shift scheduler
│   ├── tax/                # Pluggable tax strategy engine (US, EU VAT, GST)
│   ├── security/           # Multi-tenant data isolation and JWT auth claims
│   └── ui/                 # Vite Single-Page Application (POS, KDS, HQ & Portals)
├── tests/                  # Vitest test suites (19 tests)
└── package.json            # Node.js dependencies and script entries
```

---

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/Alokkr00/Restaurant-Management-system.git
cd Restaurant-Management-system

# Install dependencies
npm install
```

### Running Locally

```bash
# Start the Store Edge Server Daemon (Port 3001)
npm run dev:edge

# In a separate terminal, start the Vite Web App (Port 5173)
npx vite --host 0.0.0.0 --port 5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

---

## Testing

Run the Vitest test suite:

```bash
npm test
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
