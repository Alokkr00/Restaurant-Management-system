# Restaurant Management System (RMS) - Multi-Unit Edge Architecture

[![CI Build](https://github.com/Alokkr00/Restaurant-Management-system/actions/workflows/ci.yml/badge.svg)](https://github.com/Alokkr00/Restaurant-Management-system/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL_Mode-003B57.svg)](https://www.sqlite.org/wal.html)
[![Vitest](https://img.shields.io/badge/Vitest-38%20Tests%20Passing-78C370.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A hybrid on-premise and cloud restaurant management system designed for multi-unit franchise networks and restaurant holding groups.

The system uses an offline-first local edge daemon (`store-edge-daemon`) running SQLite in Write-Ahead Logging (WAL) mode for low-latency store operations, a background reconciliation worker for cloud synchronization, ESC/POS hardware printer drivers with station failover, and operational back-office engines covering FLSA-compliant tip pooling, state overtime rules, NetSuite double-entry GL journals, and cash drawer management.

---

## Architectural Motivation

Cloud-only POS systems introduce a single point of failure during internet service provider (ISP) degradation or payment gateway outages. During peak lunch and dinner rushes, offline durability is critical to prevent halted kitchen prep and blocked checkout lines.

This repository implements a store-level edge node architecture:
- Each store operates a local node running an embedded SQLite database (`store-edge.db`) configured in Write-Ahead Logging (WAL) mode.
- POS registers and Kitchen Display System (KDS) screens communicate over local LAN WebSockets with sub-200ms latency.
- Transactions, inventory depletions, and shift timecards are written locally first.
- A background worker (`EdgeCloudSyncWorker`) monitors unsynced records (`synced = 0`) and flushes transaction batches to central cloud endpoints when WAN connectivity is available.

---

## System Architecture

```mermaid
flowchart TD
    subgraph Cloud["HQ Central Cloud Infrastructure"]
        HQ_API["HQ Cloud Engine"]
        HQ_DB[("PostgreSQL Database")]
        NATS["NATS JetStream Event Bus"]
        NS_INT["NetSuite GL Integration"]
        ADP_INT["ADP Payroll Integration"]
    end

    subgraph Store104["Store LAN Edge Appliance"]
        EDGE_DAEMON["Store Edge Daemon (Node.js)"]
        SYNC_WORKER["Async Sync Worker (5s loop)"]
        SQLITE_WAL[("SQLite WAL (store-edge.db)")]
        WS_LAN["WebSocket Ticket Router (<200ms)"]
        ESC_HOTLINE["ESC/POS Hotline Printer (Port 9100)"]
        ESC_EXPO["ESC/POS Expo Backup (Failover)"]
        POS_TERM["POS Register & Cash Drawer"]
        KDS_SCREEN["Kitchen Display Screen (KDS)"]
    end

    POS_TERM -->|REST / WS| EDGE_DAEMON
    EDGE_DAEMON -->|Atomic Write| SQLITE_WAL
    EDGE_DAEMON -->|LAN Broadcast| WS_LAN --> KDS_SCREEN
    EDGE_DAEMON -->|Primary Print| ESC_HOTLINE
    ESC_HOTLINE -.->|Paper Out Failover| ESC_EXPO
    EDGE_DAEMON --> SYNC_WORKER
    SYNC_WORKER <-->|Asymmetric Sync| NATS <--> HQ_API
    HQ_API --> HQ_DB
    HQ_API --> NS_INT
    HQ_API --> ADP_INT
```

---

## Architecture Decision Records (ADRs)

Detailed technical decisions and architectural tradeoffs are documented in the `docs/adr/` directory:

- **[ADR 001: SQLite WAL Mode over PostgreSQL on Edge](docs/adr/001-sqlite-wal-over-postgres-on-edge.md)** — Embedded memory footprint (<15MB), single-writer serial throughput, and crash recovery.
- **[ADR 002: Vector-Clock & Hybrid Logical Clocks for Sync](docs/adr/002-vector-clock-conflict-resolution.md)** — Handling physical clock drift and enforcing HQ brand lock priority.
- **[ADR 003: Direct ESC/POS TCP Socket Printing](docs/adr/003-escpos-tcp-over-cloud-printing.md)** — Direct socket binary printing over LAN Port 9100 with hardware status polling.

---

## Key Modules and Domain Logic

### 1. Cash Drawer Management (`src/pos/cash-management.ts`)
- Manages drawer opening float banks, mid-shift safe drops, and petty cash payouts with manager approval reason codes.
- Generates blind End-of-Day (EOD) Z-Reports where cashiers count physical currency without previewing expected system totals, computing over/short variance.

### 2. Order Lifecycle & Audited Comps (`src/pos/order-lifecycle.ts`)
- Distinguishes **Voids** (item not prepared, inventory restored) from **Comps** (item prepared and served, inventory depleted).
- Handles complex modifier hierarchies, ingredient exclusions (`NO Onion`), substitutions (`SUB Vegan Cheese`), and split pizza toppings (`LEFT_HALF`, `RIGHT_HALF`, `WHOLE`).

### 3. FLSA Tip Pooling Compliance (`src/fintech/tip-pooling-engine.ts`)
- Enforces FLSA Section 3(m)(2)(B) excluding managers and shift leads with supervisory authority from tip pools.
- Enforces tip credit regulations restricting back-of-house staff from tip pools when an employer claims a tip credit against minimum wage.
- **Table Floor Plan Engine (`src/pos/table-floor-plan.ts`)**: Manages 10-table visual floor grid with seating party, course staging (`HELD` &rarr; `FIRED`), table transfers, and payment settlement.
- **Purchase Orders & GRN Receiving (`src/inventory/purchase-order-engine.ts`)**: PO lifecycle (`DRAFT` &rarr; `SENT` &rarr; `RECEIVED`), Goods Receipt Notes (GRN) with automatic short-delivery detection, live stock balance increments, and blind physical stock-take variance calculations.
- **Cash Management (`src/pos/cash-management.ts`)**: Starting bank float, mid-shift safe drops, petty cash pay-outs, and blind End-of-Day (EOD) Z-reports.
- **Order Lifecycle (`src/pos/order-lifecycle.ts`)**: Audited separation of voids (restoring stock) vs comps (depleting stock to spoilage with manager token approval).
- **Unit-of-Measure Engine (`src/inventory/uom-conversion.ts`)**: Multi-tier conversion from purchasing units down to gram-level recipe depletions with morning prep par levels.
- **Hardware Integration (`src/hardware/escpos-printer.ts`)**: ESC/POS thermal printing with `DLE EOT` status polling and automatic fallback to backup expo printers.

---

## Test Suite & Load Verification

The repository contains 15 domain-specific test suites, a 50-concurrent-order load harness, and an offline WAN chaos simulator:

```bash
# Run domain test suites (15 test files, 38 tests passing)
npm test

# Run 50-concurrent-order load simulation (p50/p95/p99 latency)
npm run test:load

# Run offline WAN chaos simulation (offline queueing + cloud flush)
npm run test:chaos
```

```text
 Test Files  15 passed (15)
      Tests  38 passed (38)
```

---

## Getting Started

### Requirements
- Node.js >= 20.x
- npm >= 10.x

### Setup
```bash
git clone https://github.com/Alokkr00/Restaurant-Management-system.git
cd Restaurant-Management-system
npm install
```

### Development
```bash
# Start edge node daemon (SQLite WAL active on port 3001)
npm run dev:edge

# Start web interface (Vite on port 5173)
npm run dev:ui

# Run test suite
npm test

# Run load & chaos simulations
npm run test:load
npm run test:chaos
```

### Docker Deployment
```bash
docker-compose -f docker-compose.edge.yml up -d
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
