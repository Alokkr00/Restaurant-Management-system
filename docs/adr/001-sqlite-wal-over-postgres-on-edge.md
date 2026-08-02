# ADR 001: SQLite WAL Mode over PostgreSQL for Store Edge Appliances

**Status:** Approved  
**Date:** 2026-08-02  
**Context:** Multi-unit restaurant store locations operate on local LAN edge nodes (industrial mini-PCs). Network connectivity to central cloud infrastructure is subject to WAN outages, ISP degradation, and physical store power interruptions.

---

## 🎯 Decision

We chose **SQLite in Write-Ahead Logging (WAL) Mode (`better-sqlite3`)** over running a local containerized PostgreSQL instance for the Store Edge Node daemon.

---

## 💡 Rationale

1. **Zero-Administration & Crash Resilience**:
   - SQLite WAL mode (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) writes transactions sequentially to an append-only WAL log (`.db-wal`).
   - If store power is cut during a peak lunch rush transaction, SQLite automatically recovers state upon boot without requiring database repair scripts or DB-admin intervention.

2. **Resource Footprint**:
   - PostgreSQL requires 150MB+ RAM base footprint and background process loops.
   - SQLite operates embedded in-process, utilizing under 15MB RAM on low-cost fanless industrial hardware.

3. **Sub-5ms Local Transaction Latency**:
   - Touch POS terminals checkout orders over local LAN WebSocket/REST. SQLite WAL provides concurrent readers alongside a single writer with single-digit millisecond latency.

---

## ⚠️ Consequences

- **Single-Writer Constraint**: SQLite handles single-writer concurrency. High-throughput edge writes are serialized; however, for a single restaurant outlet processing up to 300 orders/hour, write lock contention is non-existent.
- **Asymmetric Cloud Replication**: Edge node must maintain its own outbound sync event queue to replicate transactions to the HQ PostgreSQL cloud instance.
