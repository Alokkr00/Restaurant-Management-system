export interface PrepBatchItem {
  id: string;
  batchName: string;
  recipeTree: {
    rawIngredientId: string;
    rawIngredientName: string;
    quantity: number;
    unit: 'GRAM' | 'KILOGRAM' | 'LITER';
  }[];
  yieldUnitsProduced: number; // e.g. 100 dough balls from 1 batch
  unitName: string;
  spoilageReasonCodes: string[];
}

export interface SpoilageLog {
  id: string;
  storeId: string;
  batchOrItemId: string;
  itemName: string;
  quantitySpoiled: number;
  unit: string;
  reasonCode: 'EXPIRED' | 'BURNT' | 'DROPPED_FLOOR' | 'TRIM_LOSS' | 'QUALITY_REJECT';
  loggedBy: string;
  timestamp: string;
  costImpactUSD: number;
}

export class PrepBatchEngine {
  private batches: Map<string, PrepBatchItem> = new Map();
  private spoilageLogs: SpoilageLog[] = [];

  public registerPrepBatch(batch: PrepBatchItem): void {
    this.batches.set(batch.id, batch);
  }

  /**
   * Explodes batch prep into raw ingredient depletions.
   */
  public explodeBatchProduction(
    batchId: string,
    numberOfBatches: number
  ): { rawIngredientId: string; totalRawQuantity: number }[] {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error(`Prep batch ${batchId} not found`);

    return batch.recipeTree.map((item) => ({
      rawIngredientId: item.rawIngredientId,
      totalRawQuantity: item.quantity * numberOfBatches,
    }));
  }

  /**
   * Logs kitchen waste/spoilage with reason code and calculates cost impact.
   */
  public logSpoilage(
    storeId: string,
    itemName: string,
    quantity: number,
    unit: string,
    reasonCode: SpoilageLog['reasonCode'],
    unitCost: number,
    loggedBy: string
  ): SpoilageLog {
    const costImpactUSD = Number((quantity * unitCost).toFixed(2));
    const log: SpoilageLog = {
      id: `spoil-${Date.now()}`,
      storeId,
      batchOrItemId: `item-${Date.now()}`,
      itemName,
      quantitySpoiled: quantity,
      unit,
      reasonCode,
      loggedBy,
      timestamp: new Date().toISOString(),
      costImpactUSD,
    };

    this.spoilageLogs.push(log);
    return log;
  }

  public getSpoilageLogs(): SpoilageLog[] {
    return [...this.spoilageLogs];
  }
}
