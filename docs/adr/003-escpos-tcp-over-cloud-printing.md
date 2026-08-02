# ADR 003: Direct ESC/POS TCP Socket Printing vs Cloud Print Microservices

**Status:** Approved  
**Date:** 2026-08-02  
**Context:** Kitchen Display Systems (KDS) and POS checkouts must print receipts and prep tickets instantly. Cloud-based print services (e.g. Google Cloud Print or external HTTP print APIs) introduce 2–5 second latency and fail completely when WAN connectivity is down.

---

## 🎯 Decision

We implemented a **Native Direct ESC/POS Binary Buffer TCP Socket Driver (`Port 9100`)** directly inside the Store Edge Daemon.

---

## 💡 Rationale

1. **Sub-100ms Ticket Printing**:
   - Transmitting raw binary ESC/POS byte buffers directly over store LAN socket (`net.Socket`) to thermal printers delivers instant ticket generation at kitchen stations.

2. **Offline Hardware Resiliency**:
   - Printing functions locally over LAN without requiring internet access.
   - If a printer socket times out or drops power, the edge daemon captures the error and queues the receipt buffer in local SQLite WAL storage for automatic retry.

---

## ⚠️ Consequences

- Thermal printers must be assigned static IP addresses on the store LAN subnet.
- Binary command buffers (`ESC @`, `GS V 0`) must be constructed manually per hardware specification.
