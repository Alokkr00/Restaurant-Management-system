export interface ScaleReading {
  weightGrams: number;
  weightOunces: number;
  isStable: boolean;
  unit: 'GRAM' | 'OUNCE' | 'KILOGRAM';
  timestamp: string;
}

export class DigitalScaleDriver {
  private lastReading: ScaleReading = {
    weightGrams: 0,
    weightOunces: 0,
    isStable: true,
    unit: 'GRAM',
    timestamp: new Date().toISOString(),
  };

  /**
   * Simulates/reads USB Serial Digital Scale weight measurement.
   */
  public readScaleWeight(measuredGrams: number): ScaleReading {
    const weightOunces = Number((measuredGrams * 0.035274).toFixed(2));
    this.lastReading = {
      weightGrams: measuredGrams,
      weightOunces,
      isStable: true,
      unit: 'GRAM',
      timestamp: new Date().toISOString(),
    };
    return this.lastReading;
  }

  /**
   * Performs Tare zeroing operation on digital scale.
   */
  public tareZero(): ScaleReading {
    this.lastReading = {
      weightGrams: 0,
      weightOunces: 0,
      isStable: true,
      unit: 'GRAM',
      timestamp: new Date().toISOString(),
    };
    return this.lastReading;
  }
}
