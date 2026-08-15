import { describe, it, expect } from 'vitest';
import { OrderStateMachine } from '../src/pos/order-state-machine.js';

describe('Restaurant Business Date & Trading Day Rollover Engine', () => {
  it('assigns 01:30 AM orders to the previous calendar day when rollover is 04:00 AM', () => {
    // Sunday August 16 at 01:30 AM local time
    const lateNightDate = new Date(2026, 7, 16, 1, 30, 0); // Month index 7 = August

    const businessDate = OrderStateMachine.calculateBusinessDate(lateNightDate, '04:00');

    // Should belong to Saturday August 15 trading session!
    expect(businessDate).toBe('2026-08-15');
  });

  it('assigns 04:05 AM orders to the current calendar day after morning rollover', () => {
    // Sunday August 16 at 04:05 AM local time
    const morningDate = new Date(2026, 7, 16, 4, 5, 0);

    const businessDate = OrderStateMachine.calculateBusinessDate(morningDate, '04:00');

    // Belongs to Sunday August 16 morning session!
    expect(businessDate).toBe('2026-08-16');
  });

  it('assigns regular dinner rush at 19:30 to the same calendar date', () => {
    const dinnerDate = new Date(2026, 7, 15, 19, 30, 0);

    const businessDate = OrderStateMachine.calculateBusinessDate(dinnerDate, '04:00');

    expect(businessDate).toBe('2026-08-15');
  });
});
