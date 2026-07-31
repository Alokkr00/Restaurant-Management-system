import { describe, it, expect } from 'vitest';
import { LaborComplianceGuardrails, Shift } from '../src/labor/compliance-guardrails.js';
import { AISchedulingEngine } from '../src/labor/scheduling-engine.js';
import { PrepBatchEngine } from '../src/inventory/prep-batch-engine.js';
import { TipPoolingEngine } from '../src/fintech/tip-pooling-engine.js';

describe('Phase 2 Sprint 1: Labor Compliance, Prep Control & Tip Pooling', () => {
  const guardrails = new LaborComplianceGuardrails();
  const aiScheduler = new AISchedulingEngine();
  const prepEngine = new PrepBatchEngine();
  const tipEngine = new TipPoolingEngine();

  it('Labor Guardrails must block clopening shift (< 11 hours rest)', () => {
    const existingShift: Shift = {
      id: 'shift-close',
      employeeId: 'emp-001',
      employeeName: 'John Doe',
      role: 'SHIFT_LEAD',
      startTime: '2026-07-31T16:00:00Z',
      endTime: '2026-07-31T23:30:00Z', // Closes at 11:30 PM
      hourlyRate: 22.0,
    };

    const clopeningShift: Shift = {
      id: 'shift-open',
      employeeId: 'emp-001',
      employeeName: 'John Doe',
      role: 'SHIFT_LEAD',
      startTime: '2026-08-01T06:00:00Z', // Opens at 6:00 AM (6.5 hours rest!)
      endTime: '2026-08-01T14:00:00Z',
      hourlyRate: 22.0,
    };

    const check = guardrails.evaluateClopeningViolation([existingShift], clopeningShift);
    expect(check.isViolated).toBe(true);
    expect(check.restHoursActual).toBe(6.5);
    expect(check.premiumPayRequired).toBe(true);
  });

  it('AI Scheduler should keep labor cost within target <= 22% of forecasted sales', () => {
    const forecasts = [
      { hour: 11, predictedSales: 800 },
      { hour: 12, predictedSales: 1200 },
      { hour: 13, predictedSales: 900 },
      { hour: 17, predictedSales: 1500 },
      { hour: 18, predictedSales: 1800 },
    ];

    const staff = [
      { id: 'e1', name: 'Alice', role: 'CASHIER' as const, hourlyRate: 16.0 },
      { id: 'e2', name: 'Bob', role: 'KITCHEN_PREP' as const, hourlyRate: 18.0 },
      { id: 'e3', name: 'Charlie', role: 'SHIFT_LEAD' as const, hourlyRate: 22.0 },
    ];

    const schedule = aiScheduler.generateOptimizedSchedule(forecasts, staff);
    expect(schedule.forecastedTotalSales).toBe(6200);
    expect(schedule.projectedLaborPercentage).toBeLessThanOrEqual(22.0);
  });

  it('Prep Batch Engine should explode recipe tree and track spoilage cost', () => {
    prepEngine.registerPrepBatch({
      id: 'batch-dough-50kg',
      batchName: 'Artisanal Pizza Dough 50kg Batch',
      recipeTree: [
        { rawIngredientId: 'ing-flour', rawIngredientName: 'Flour', quantity: 30, unit: 'KILOGRAM' },
        { rawIngredientId: 'ing-yeast', rawIngredientName: 'Yeast', quantity: 0.5, unit: 'KILOGRAM' },
      ],
      yieldUnitsProduced: 100,
      unitName: 'Dough Ball 500g',
      spoilageReasonCodes: ['EXPIRED', 'BURNT', 'DROPPED_FLOOR'],
    });

    const rawNeeds = prepEngine.explodeBatchProduction('batch-dough-50kg', 2);
    expect(rawNeeds[0].totalRawQuantity).toBe(60); // 60kg flour for 2 batches

    const spoilLog = prepEngine.logSpoilage(
      'store-01',
      'Dough Ball 500g',
      5,
      'PIECE',
      'DROPPED_FLOOR',
      1.5,
      'user-kitchen-lead'
    );
    expect(spoilLog.costImpactUSD).toBe(7.5);
    expect(spoilLog.reasonCode).toBe('DROPPED_FLOOR');
  });

  it('Tip Pooling Engine should allocate tips based on weighted role and hours worked', () => {
    const staff = [
      { employeeId: 'e1', employeeName: 'Alice', role: 'CASHIER' as const, hoursWorked: 8 },
      { employeeId: 'e2', employeeName: 'Bob', role: 'KITCHEN_PREP' as const, hoursWorked: 8 },
    ];

    // Total tips: $220
    const result = tipEngine.calculateTipDistribution('store-01', '2026-07-31', 220, staff);
    expect(result.distributions.length).toBe(2);
    // Kitchen prep has 1.2 weight vs Cashier 1.0 -> Kitchen prep gets higher share
    const cashierTip = result.distributions.find((d) => d.employeeId === 'e1')?.allocatedTipAmount;
    const prepTip = result.distributions.find((d) => d.employeeId === 'e2')?.allocatedTipAmount;

    expect(prepTip).toBeGreaterThan(cashierTip!);
    expect(cashierTip! + prepTip!).toBeCloseTo(220, 1);
  });
});
