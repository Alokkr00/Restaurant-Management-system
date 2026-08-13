# ADR 002: Vector-Clock Conflict Resolution for Multi-Outlet Sync

- **Status:** Approved
- **Date:** 2026-08-02
- **Context:** Stores operate offline during network outages. When connectivity restores, offline transactions, inventory adjustments, and menu edits must sync to HQ without violating brand lock rules or corrupting audit history.

---

## Decision

We implemented a **Causal Hybrid Logical Clock (HLC) Vector-Clock Conflict Engine** combined with **HQ Brand-Lock Priority Enforcement**.

---

## Rationale

1. **Physical Clock Skew Invalidation**:
   - Store edge nodes can experience NTP clock drift. Relying strictly on wall-clock timestamps can cause newer updates to be overwritten by older ones.
   - Vector clocks establish causal ordering ($A \to B$) independent of physical clock drift.

2. **Hierarchical Brand Lock Enforcement**:
   - If a local manager edits a menu item price while HQ issues a global brand-locked price update (`isBrandLocked: true`), the conflict engine rejects the local override and enforces HQ policy.

---

## Consequences

- Sync payloads include vector clock state headers.
- Rejected conflicts are logged to the audit ledger for review.
