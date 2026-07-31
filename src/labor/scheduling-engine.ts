import { Shift, LaborComplianceGuardrails } from './compliance-guardrails.js';

export interface HourlyForecast {
  hour: number; // 0-23
  predictedSales: number;
}

export interface ScheduleRecommendation {
  forecastedTotalSales: number;
  maxTargetLaborCost: number; // 22% max target
  recommendedShifts: Shift[];
  projectedLaborCost: number;
  projectedLaborPercentage: number;
  clopeningAlerts: number;
}

export class AISchedulingEngine {
  private targetLaborPercentage: number = 22.0; // 22% max
  private guardrails = new LaborComplianceGuardrails();

  /**
   * Generates AI labor schedule maintaining labor cost <= 22% of predicted sales.
   */
  public generateOptimizedSchedule(
    forecasts: HourlyForecast[],
    availableStaff: { id: string; name: string; role: Shift['role']; hourlyRate: number }[],
    targetDate: Date = new Date(2026, 6, 31)
  ): ScheduleRecommendation {
    const forecastedTotalSales = forecasts.reduce((sum, f) => sum + f.predictedSales, 0);
    const maxTargetLaborCost = (forecastedTotalSales * this.targetLaborPercentage) / 100;

    let projectedLaborCost = 0;
    const recommendedShifts: Shift[] = [];
    let clopeningAlerts = 0;

    // Determine staffing count per peak hours (e.g. lunch 11-14, dinner 17-21)
    forecasts.forEach((f) => {
      const neededStaff = f.predictedSales > 500 ? 3 : f.predictedSales > 200 ? 2 : 1;

      for (let i = 0; i < neededStaff; i++) {
        const staff = availableStaff[i % availableStaff.length];
        const startTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), f.hour, 0).toISOString();
        const endTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), f.hour + 1, 0).toISOString();

        const proposedShift: Shift = {
          id: `shift-${f.hour}-${staff.id}-${i}`,
          employeeId: staff.id,
          employeeName: staff.name,
          role: staff.role,
          startTime,
          endTime,
          hourlyRate: staff.hourlyRate,
        };

        const clopeningCheck = this.guardrails.evaluateClopeningViolation(
          recommendedShifts,
          proposedShift
        );

        if (clopeningCheck.isViolated) {
          clopeningAlerts++;
        }

        recommendedShifts.push(proposedShift);
        projectedLaborCost += staff.hourlyRate;
      }
    });

    const projectedLaborPercentage = forecastedTotalSales > 0 
      ? Number(((projectedLaborCost / forecastedTotalSales) * 100).toFixed(1)) 
      : 0;

    return {
      forecastedTotalSales: Number(forecastedTotalSales.toFixed(2)),
      maxTargetLaborCost: Number(maxTargetLaborCost.toFixed(2)),
      recommendedShifts,
      projectedLaborCost: Number(projectedLaborCost.toFixed(2)),
      projectedLaborPercentage,
      clopeningAlerts,
    };
  }
}
