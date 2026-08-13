# ADR 003: Direct ESC/POS TCP Socket Printing vs Cloud Print Microservices

- **Status:** Approved
- **Date:** 2026-08-02
- **Context:** Kitchen display systems and POS checkouts require immediate receipt and prep ticket generation. Cloud print services introduce 2–5 second network latency and fail completely when internet access drops.

---

## Decision

We implemented a **Native Direct ESC/POS Binary Buffer TCP Socket Driver (Port 9100)** within the Store Edge Daemon.

---

## Rationale

1. **Sub-100ms Ticket Printing**:
   - Sending binary ESC/POS command buffers directly over LAN sockets (`net.Socket`) delivers immediate ticket printing at prep stations.

2. **Offline Hardware Resiliency**:
   - Printing operates locally on the store subnet without internet dependencies.
   - If a printer socket times out or reports paper out via DLE EOT status polling, the edge daemon fails over to a backup expo printer or queues the buffer in local SQLite WAL storage for automatic retry.

---

## Consequences

- Thermal printers require static IP assignments on the local store subnet.
- Command buffers (`ESC @`, `GS V 0`) are constructed directly per ESC/POS specification.
