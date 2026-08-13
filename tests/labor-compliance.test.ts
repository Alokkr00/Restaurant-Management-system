import { describe, it, expect } from 'vitest';
import { LaborComplianceGuardrails, Shift } from '../src/labor/compliance-guardrails.js';
import { AISchedulingEngine } from '../src/labor/scheduling-engine.js';

describe('LaborComplianceGuardrails & Scheduling', () => {
  const guardrails = new LaborComplianceGuardrails();
  const scheduler = new AISchedulingEngine();

  it('detects clopening violations with rest periods under 11 hours', () => {
    const existingShifts: Shift[] = [
      {
        id: 's1',
        employeeId: 'emp-1',
        employeeName: 'Sarah',
        role: 'CASHIER',
        startTime: '2026-08-01T15:00:00Z',
        endTime: '2026-08-01T23:00:00Z',
        hourlyRate: 16.0,
      },
    ];

    const nextShift: Shift = {
      id: 's2',
      employeeId: 'emp-1',
      employeeName: 'Sarah',
      role: 'CASHIER',
      startTime: '2026-08-02T06:00:00Z', // 7 hours rest (11 hours required)
      endTime: '2026-08-02T14:00:00Z',
      hourlyRate: 16.0,
    };

    const check = guardrails.evaluateClopeningViolation(existingShifts, nextShift);
    expect(check.isViolated).toBe(true);
    expect(check.restHoursActual).toBe(7.0);
    expect(check.premiumPayRequired).toBe(true);
  });

  it('generates schedule within target labor cost percentage', () => {
    const forecasts = [
      { hour: 11, predictedSales: 600 },
      { hour: 12, predictedSales: 1200 },
    ];

    const staff = [
      { id: 'e1', name: 'John', role: 'KITCHEN_PREP' as const, hourlyRate: 18.0 },
      { id: 'e2', name: 'Sarah', role: 'CASHIER' as const, hourlyRate: 16.0 },
    ];

    const rec = scheduler.generateOptimizedSchedule(forecasts, staff);
    expect(rec.forecastedTotalSales).toBe(1800);
    expect(rec.projectedLaborPercentage).toBeLessThanOrEqual(22.0);
  });
});
