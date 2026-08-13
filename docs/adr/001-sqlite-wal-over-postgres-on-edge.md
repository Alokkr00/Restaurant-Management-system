# ADR 001: SQLite WAL Mode over PostgreSQL for Store Edge Appliances

- **Status:** Approved
- **Date:** 2026-08-02
- **Context:** Store locations run on local edge hardware (fanless mini-PCs). Network connectivity to central cloud infrastructure is subject to WAN outages, ISP degradation, and physical store power interruptions.

---

## Decision

We selected **SQLite in Write-Ahead Logging (WAL) Mode (`better-sqlite3`)** over a local containerized PostgreSQL instance for the Store Edge Node daemon.

---

## Rationale

1. **Zero-Administration and Crash Resilience**:
   - SQLite WAL mode (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) sequentially appends transactions to a write-ahead log.
   - If store power is cut during a transaction, SQLite recovers state upon restart without requiring database repair scripts or administrator intervention.

2. **Resource Footprint**:
   - PostgreSQL requires a 150MB+ base RAM footprint and multiple background processes.
   - SQLite runs in-process with a memory footprint under 15MB on low-cost fanless hardware.

3. **Local Transaction Latency**:
   - Registers submit orders over local LAN WebSockets. SQLite WAL provides concurrent readers alongside a single writer with single-digit millisecond latency.

---

## Consequences

- **Single-Writer Serialization**: Writes are serialized by SQLite. For a single restaurant processing under 300 orders/hour, write lock contention is minimal.
- **Asymmetric Cloud Replication**: The edge node must maintain its own sync worker to replicate transactions to central PostgreSQL.
