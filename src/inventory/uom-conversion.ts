export type UnitOfMeasure =
  | 'CASE'
  | 'BAG_50LB'
  | 'BOX_10LB'
  | 'POUND'
  | 'KILOGRAM'
  | 'GRAM'
  | 'OUNCE'
  | 'GALLON'
  | 'LITER'
  | 'MILLILITER'
  | 'PIECE';

export interface UOMConversionFactor {
  fromUnit: UnitOfMeasure;
  toUnit: UnitOfMeasure;
  factor: number; // multiplier to convert fromUnit to toUnit (e.g. 1 POUND -> 453.592 GRAMS)
}

export interface DaypartParTarget {
  prepItemId: string;
  prepItemName: string;
  unit: UnitOfMeasure;
  currentOnHand: number;
  forecastedDaypartNeed: number;
  safetyBufferPercent: number; // e.g. 15%
  recommendedPrepQuantity: number;
}

export class UOMConversionEngine {
  private standardWeightConversions: Map<string, number> = new Map([
    // Weight
    ['POUND->GRAM', 453.592],
    ['POUND->OUNCE', 16.0],
    ['KILOGRAM->GRAM', 1000.0],
    ['KILOGRAM->POUND', 2.20462],
    ['OUNCE->GRAM', 28.3495],
    ['BAG_50LB->POUND', 50.0],
    ['BAG_50LB->GRAM', 22679.6],
    ['BOX_10LB->POUND', 10.0],
    ['BOX_10LB->GRAM', 4535.92],

    // Volume
    ['GALLON->LITER', 3.78541],
    ['GALLON->MILLILITER', 3785.41],
    ['LITER->MILLILITER', 1000.0],

    // Count
    ['PIECE->PIECE', 1.0],
  ]);

  /**
   * Converts a quantity from one Unit of Measure to another.
   */
  public convertQuantity(
    quantity: number,
    fromUnit: UnitOfMeasure,
    toUnit: UnitOfMeasure,
    customDensityMultiplier?: number
  ): number {
    if (fromUnit === toUnit) {
      return quantity;
    }

    const key = `${fromUnit}->${toUnit}`;
    const directFactor = this.standardWeightConversions.get(key);

    if (directFactor !== undefined) {
      const result = quantity * directFactor * (customDensityMultiplier || 1.0);
      return Number(result.toFixed(4));
    }

    // Check inverse
    const inverseKey = `${toUnit}->${fromUnit}`;
    const inverseFactor = this.standardWeightConversions.get(inverseKey);
    if (inverseFactor !== undefined && inverseFactor > 0) {
      const result = (quantity / inverseFactor) * (customDensityMultiplier || 1.0);
      return Number(result.toFixed(4));
    }

    throw new Error(`Unsupported UOM conversion from ${fromUnit} to ${toUnit}`);
  }

  /**
   * Calculates Dynamic Morning Prep Par Levels based on sales forecast and on-hand inventory.
   * Prep Need = (Forecasted Velocity * (1 + Safety Buffer)) - Current On-Hand
   */
  public calculateMorningPrepPar(
    prepItemId: string,
    prepItemName: string,
    unit: UnitOfMeasure,
    forecastedTotalSalesUSD: number,
    itemSalesVelocityPer1kUSD: number, // e.g., 20 dough balls prepped per $1,000 forecasted sales
    currentOnHandQuantity: number,
    safetyBufferPercent: number = 15.0
  ): DaypartParTarget {
    const rawForecastUnits = (forecastedTotalSalesUSD / 1000) * itemSalesVelocityPer1kUSD;
    const bufferedForecastNeed = rawForecastUnits * (1 + safetyBufferPercent / 100);
    const recommendedPrep = Math.max(0, Math.ceil(bufferedForecastNeed - currentOnHandQuantity));

    return {
      prepItemId,
      prepItemName,
      unit,
      currentOnHand: currentOnHandQuantity,
      forecastedDaypartNeed: Number(bufferedForecastNeed.toFixed(1)),
      safetyBufferPercent,
      recommendedPrepQuantity: recommendedPrep,
    };
  }
}
