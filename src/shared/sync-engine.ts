import crypto from 'crypto';
import { SyncEvent, MenuItem, POSTransaction, InventoryRecord, AuditLogEntry } from './types.js';

export class ConflictResolutionEngine {
  /**
   * Resolves Menu/Price update conflicts between Cloud and Edge.
   * HQ Cloud master always wins if item is brand locked or update is from HQ.
   */
  public resolveMenuConflict(cloudItem: MenuItem, edgeItem: MenuItem): MenuItem {
    if (cloudItem.isBrandLocked) {
      return { ...cloudItem, version: Math.max(cloudItem.version, edgeItem.version) + 1 };
    }
    // HQ Priority Last-Write-Wins
    return new Date(cloudItem.updatedAt) >= new Date(edgeItem.updatedAt) ? cloudItem : edgeItem;
  }

  /**
   * Resolves POS transaction streams.
   * POS Transactions are append-only. No transaction is ever deleted or overwritten.
   */
  public resolvePOSTransactionStream(
    masterStream: POSTransaction[],
    incomingEvents: POSTransaction[]
  ): { mergedStream: POSTransaction[]; newAdded: number } {
    const existingIds = new Set(masterStream.map((t) => t.id));
    const newItems: POSTransaction[] = [];

    for (const tx of incomingEvents) {
      if (!existingIds.has(tx.id)) {
        newItems.push({ ...tx, synced: true });
        existingIds.add(tx.id);
      }
    }

    const mergedStream = [...masterStream, ...newItems].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return { mergedStream, newAdded: newItems.length };
  }

  /**
   * Resolves Inventory Depletion via Relative Delta calculations.
   * Prevents overwriting on-hand inventory balances during offline reconnection.
   */
  public resolveInventoryDelta(
    currentRecord: InventoryRecord,
    depletionAmount: number
  ): InventoryRecord {
    const updatedTheoretical = Math.max(0, currentRecord.theoreticalQuantity - depletionAmount);
    return {
      ...currentRecord,
      theoreticalQuantity: updatedTheoretical,
      lastCalculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a tamper-proof cryptographic audit hash for audit ledger entries.
   */
  public createAuditHash(previousHash: string, entry: Omit<AuditLogEntry, 'hash'>): string {
    const payload = `${previousHash}|${entry.timestamp}|${entry.actorId}|${entry.action}|${entry.targetEntity}|${entry.entityId}|${JSON.stringify(entry.newValue)}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
