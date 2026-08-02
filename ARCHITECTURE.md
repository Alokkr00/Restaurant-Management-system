# 🏛️ Distributed Multi-Unit RMS System Architecture

This document details the architectural design, edge-cloud data topology, hardware driver layer, and conflict resolution model for the **Enterprise Multi-Unit Restaurant Management System (RMS)**.

---

## 1. System Topology Overview

```mermaid
flowchart TD
    subgraph Cloud["HQ Central Cloud Infrastructure"]
        HQ_API["HQ Fastify Cloud Engine"]
        HQ_DB[("PostgreSQL Multi-Tenant DB")]
        NATS["NATS JetStream Event Bus"]
        NS_INT["Oracle NetSuite GL Connector"]
        ADP_INT["ADP Payroll Exporter"]
    end

    subgraph Store104["Store #104 LAN Edge Node (Chicago West)"]
        EDGE_DAEMON["Store Edge Appliance Daemon"]
        SQLITE_WAL[("SQLite WAL Engine (store-edge.db)")]
        WS_LAN["WebSocket Ticket Router (< 200ms)"]
        ESC_PRINT["ESC/POS Thermal Printer (Port 9100)"]
        POS_TERM["Touch POS Terminal"]
        KDS_SCREEN["Kitchen Display System (KDS)"]
    end

    POS_TERM -->|REST / WS| EDGE_DAEMON
    EDGE_DAEMON -->|Atomic Writes| SQLITE_WAL
    EDGE_DAEMON -->|Instant LAN Ticket Broadcast| WS_LAN --> KDS_SCREEN
    EDGE_DAEMON -->|Raw ESC/POS Buffer| ESC_PRINT
    EDGE_DAEMON <-->|Asymmetric Event Sync| NATS <--> HQ_API
    HQ_API --> HQ_DB
    HQ_API --> NS_INT
    HQ_API --> ADP_INT
```

---

## 2. Key Subsystems & Design Guarantees

### A. Edge Store Daemon (`store-edge-daemon`)
- **Native Persistence**: Runs `better-sqlite3` in Write-Ahead Logging (`WAL`) mode with `PRAGMA synchronous = NORMAL;`.
- **Fault Isolation**: Transactions are written locally before acknowledgement. If WAN drops, POS terminals continue functioning with 100% feature parity.
- **Hardware Layer**: Generates raw ESC/POS binary buffers (`0x1b 0x40` init, `0x1d 0x56 0x00` paper cut) dispatched via Node.js `net.Socket` to LAN thermal printers on Port 9100.

### B. Hierarchical Inheritance Engine (`core-inheritance`)
- **Resolution Order**:
  $$\text{Platform Default} \longrightarrow \text{Brand Policy} \longrightarrow \text{Regional Config} \longrightarrow \text{Store Local Override}$$
- **Brand Lock Protection**: Any menu item or recipe property flagged with `isBrandLocked === true` at the HQ level strips store-level local overrides automatically.

### C. Financial & BOM Depletion Engines
- **Gram-Level Recipe Engine**: Depletes raw ingredients based on recipe portion sizes, accounting for trim yield shrinkage factors ($Yield \% = \frac{\text{Edible Weight}}{\text{As Purchased Weight}}$).
- **Oracle NetSuite GL Accounting**: Constructs daily double-entry journal vouchers ensuring $\sum \text{Debits} = \sum \text{Credits}$.
- **ADP Payroll Exporter**: Exports regular hours, overtime (over 40h at $1.5\times$), role-weighted tip distribution math, and Fair Workweek break attestations.

---

## 3. Architecture Decision Records (ADRs)

- [ADR 001: SQLite WAL Mode over PostgreSQL on Edge Appliances](docs/adr/001-sqlite-wal-over-postgres-on-edge.md)
- [ADR 002: Vector-Clock & Hybrid Logical Clocks for Multi-Outlet Sync](docs/adr/002-vector-clock-conflict-resolution.md)
- [ADR 003: Direct ESC/POS TCP Socket Printing vs Cloud Print Microservices](docs/adr/003-escpos-tcp-over-cloud-printing.md)
