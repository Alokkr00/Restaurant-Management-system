# ADR 002: Vector-Clock & Hybrid Logical Clocks (HLC) for Multi-Outlet Sync

**Status:** Approved  
**Date:** 2026-08-02  
**Context:** Stores operate offline for extended hours. When network connectivity restores, hundreds of offline POS transactions, inventory depletion logs, and price overrides must be synced to central HQ without overwriting corporate brand locks or losing transactional audit integrity.

---

## 🎯 Decision

We implemented a **Causal Hybrid Logical Clock (HLC) Vector-Clock Conflict Engine** combined with **HQ Priority Overrides**.

---

## 💡 Rationale

1. **Physical Clock Skew Invalidation**:
   - Store edge nodes may have NTP clock drift of several seconds or minutes. Relying purely on `wall_clock_timestamp` leads to data corruption (e.g. an older edit overwriting a newer edit).
   - Vector clocks (`{ store104: 14, hq: 3 }`) establish true causal ordering ($A \to B$) regardless of physical clock drift.

2. **Hierarchical Brand Lock Enforcement**:
   - If a Franchisee Store Manager updates a menu item price locally while HQ issues a global brand-locked price update (`isBrandLocked: true`), the conflict engine automatically rejects the franchisee override and enforces HQ brand policy.

---

## ⚠️ Consequences

- Requires vector clock state headers attached to sync payloads.
- Conflict logs must be stored in `audit_ledger` for franchisee visibility.
