import { describe, it, expect } from 'vitest';
import { UOMConversionEngine } from '../src/inventory/uom-conversion.js';

describe('UOMConversionEngine', () => {
  const engine = new UOMConversionEngine();

  it('converts bulk purchasing units to recipe gram weights', () => {
    const gramsFrom50lbBag = engine.convertQuantity(1, 'BAG_50LB', 'GRAM');
    expect(gramsFrom50lbBag).toBe(22679.6);

    const gramsFromPound = engine.convertQuantity(1, 'POUND', 'GRAM');
    expect(gramsFromPound).toBe(453.592);
  });

  it('computes daily morning par levels based on sales velocity and safety buffer', () => {
    const par = engine.calculateMorningPrepPar(
      'prep-dough-500g',
      'Pizza Dough Ball (500g)',
      'PIECE',
      5000.0,
      20,
      40,
      15.0
    );

    expect(par.forecastedDaypartNeed).toBe(115.0);
    expect(par.recommendedPrepQuantity).toBe(75);
  });
});
