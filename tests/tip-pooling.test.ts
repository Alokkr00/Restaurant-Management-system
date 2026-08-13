import { describe, it, expect } from 'vitest';
import { TipPoolingEngine, StaffShiftHours } from '../src/fintech/tip-pooling-engine.js';

describe('TipPoolingEngine', () => {
  const engine = new TipPoolingEngine();

  it('excludes managers and shift supervisors under FLSA §3(m)(2)(B)', () => {
    const staff: StaffShiftHours[] = [
      { employeeId: 'emp-1', employeeName: 'Alice', role: 'SERVER', hoursWorked: 10, isManagerial: false },
      { employeeId: 'emp-2', employeeName: 'Bob', role: 'BUSSER', hoursWorked: 10, isManagerial: false },
      { employeeId: 'emp-3', employeeName: 'Charlie', role: 'SHIFT_LEAD', hoursWorked: 10, isManagerial: true },
    ];

    const result = engine.calculateTipDistribution('store-104', '2026-08-01', 170.0, staff, false);
    const supervisor = result.distributions.find((d) => d.employeeId === 'emp-3');

    expect(supervisor?.isEligibleFLSA).toBe(false);
    expect(supervisor?.allocatedTipAmount).toBe(0);

    const server = result.distributions.find((d) => d.employeeId === 'emp-1');
    const busser = result.distributions.find((d) => d.employeeId === 'emp-2');
    expect(server?.allocatedTipAmount).toBe(100.0);
    expect(busser?.allocatedTipAmount).toBe(70.0);
  });

  it('restricts BOH staff from tip pool when employer takes FOH tip credit', () => {
    const staff: StaffShiftHours[] = [
      { employeeId: 'emp-1', employeeName: 'Alice', role: 'SERVER', hoursWorked: 8, isManagerial: false },
      { employeeId: 'emp-2', employeeName: 'Dan', role: 'LINE_COOK', hoursWorked: 8, isManagerial: false },
    ];

    const result = engine.calculateTipDistribution('store-104', '2026-08-01', 100.0, staff, true);
    const cook = result.distributions.find((d) => d.employeeId === 'emp-2');
    expect(cook?.isEligibleFLSA).toBe(false);
    expect(cook?.allocatedTipAmount).toBe(0);
  });
});
