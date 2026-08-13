import { describe, it, expect } from 'vitest';
import { ADPPayrollIntegration } from '../src/integrations/adp.js';
import { Shift } from '../src/labor/compliance-guardrails.js';

describe('ADPPayrollIntegration', () => {
  const adp = new ADPPayrollIntegration();

  it('calculates California daily overtime (>8h @ 1.5x, >12h @ 2.0x)', () => {
    const shifts: Shift[] = [
      {
        id: 'sh-1',
        employeeId: 'emp-1',
        employeeName: 'Elena Rostova',
        role: 'LINE_COOK',
        startTime: '2026-08-01T06:00:00Z',
        endTime: '2026-08-01T20:00:00Z', // 14 hours total on 1 day
        hourlyRate: 20.0,
      },
    ];

    const records = adp.generateADPPayrollPayload(shifts, [], [], '2026-08-01', 'CALIFORNIA');
    expect(records.length).toBe(1);
    expect(records[0].regularHours).toBe(8.0);
    expect(records[0].overtimeHours15x).toBe(4.0);
    expect(records[0].doubleTimeHours20x).toBe(2.0);
    expect(records[0].grossPayUSD).toBe(360.0);
  });

  it('computes blended regular rate across dual-role shifts for overtime pay', () => {
    const shifts: Shift[] = [
      {
        id: 'sh-1',
        employeeId: 'emp-2',
        employeeName: 'Carlos Gomez',
        role: 'CASHIER',
        startTime: '2026-08-01T08:00:00Z',
        endTime: '2026-08-01T13:00:00Z', // 5h @ $15
        hourlyRate: 15.0,
      },
      {
        id: 'sh-2',
        employeeId: 'emp-2',
        employeeName: 'Carlos Gomez',
        role: 'LINE_COOK',
        startTime: '2026-08-01T13:00:00Z',
        endTime: '2026-08-01T18:00:00Z', // 5h @ $25
        hourlyRate: 25.0,
      },
    ];

    const records = adp.generateADPPayrollPayload(shifts, [], [], '2026-08-01', 'CALIFORNIA');
    expect(records[0].blendedRegularRateUSD).toBe(20.0);
    expect(records[0].regularHours).toBe(8.0);
    expect(records[0].overtimeHours15x).toBe(2.0);
    expect(records[0].grossPayUSD).toBe(220.0);
  });
});
