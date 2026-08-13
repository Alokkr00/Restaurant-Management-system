import { Shift, BreakAttestation } from '../labor/compliance-guardrails.js';
import { TipDistribution } from '../fintech/tip-pooling-engine.js';

export type StateOvertimeJurisdiction = 'FEDERAL' | 'CALIFORNIA' | 'COLORADO' | 'NEVADA';

export interface ADPPayrollRecord {
  associateID: string;
  employeeName: string;
  payPeriodDate: string;
  jurisdiction: StateOvertimeJurisdiction;
  regularHours: number;
  overtimeHours15x: number;
  doubleTimeHours20x: number;
  blendedRegularRateUSD: number;
  allocatedTipsUSD: number;
  breakAttestationStatus: 'COMPLIANT' | 'OVERRIDE_APPROVED' | 'NON_COMPLIANT';
  grossPayUSD: number;
}

export class ADPPayrollIntegration {
  /**
   * Transforms raw clock shifts, tip distributions, and break attestations into compliant ADP records.
   * Handles daily overtime (California per workday), split-rate shifts, and blended regular rates.
   */
  public generateADPPayrollPayload(
    shifts: Shift[],
    tipDistributions: TipDistribution[],
    attestations: BreakAttestation[],
    payPeriodDate: string,
    jurisdiction: StateOvertimeJurisdiction = 'FEDERAL'
  ): ADPPayrollRecord[] {
    // Group shifts by employee
    const employeeShiftsMap = new Map<string, Shift[]>();

    shifts.forEach((shift) => {
      const existing = employeeShiftsMap.get(shift.employeeId) || [];
      existing.push(shift);
      employeeShiftsMap.set(shift.employeeId, existing);
    });

    const records: ADPPayrollRecord[] = [];

    employeeShiftsMap.forEach((empShifts, empId) => {
      const employeeName = empShifts[0]?.employeeName || 'Unknown Employee';

      let totalBaseEarnings = 0;
      let totalHours = 0;
      let regularHours = 0;
      let overtimeHours15x = 0;
      let doubleTimeHours20x = 0;

      // Calculate shift duration and earnings
      const shiftsWithHours = empShifts.map((s) => {
        const start = new Date(s.startTime).getTime();
        const end = new Date(s.endTime).getTime();
        const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
        const rate = s.hourlyRate > 0 ? s.hourlyRate : 15.0;
        const workday = s.startTime.split('T')[0]; // Group by date
        return { shift: s, hours, rate, workday };
      });

      shiftsWithHours.forEach((sh) => {
        totalHours += sh.hours;
        totalBaseEarnings += sh.hours * sh.rate;
      });

      // Calculate blended regular rate of pay
      const blendedRegularRateUSD =
        totalHours > 0 ? Number((totalBaseEarnings / totalHours).toFixed(4)) : 0;

      // Apply Overtime Jurisdictional Rules
      if (jurisdiction === 'CALIFORNIA') {
        // Group hours by workday for true California daily overtime aggregation
        const workdayHoursMap = new Map<string, number>();
        shiftsWithHours.forEach((sh) => {
          const current = workdayHoursMap.get(sh.workday) || 0;
          workdayHoursMap.set(sh.workday, current + sh.hours);
        });

        workdayHoursMap.forEach((dailyTotal) => {
          if (dailyTotal > 12) {
            regularHours += 8;
            overtimeHours15x += 4;
            doubleTimeHours20x += dailyTotal - 12;
          } else if (dailyTotal > 8) {
            regularHours += 8;
            overtimeHours15x += dailyTotal - 8;
          } else {
            regularHours += dailyTotal;
          }
        });

        // Also check if total weekly regular hours exceed 40
        if (regularHours > 40) {
          const excess = regularHours - 40;
          regularHours = 40;
          overtimeHours15x += excess;
        }
      } else {
        // Federal standard: Weekly hours > 40 @ 1.5x
        regularHours = Math.min(40, totalHours);
        overtimeHours15x = Math.max(0, totalHours - 40);
        doubleTimeHours20x = 0;
      }

      // Tip Allocation
      const tipRecord = tipDistributions.find((t) => t.employeeId === empId);
      const allocatedTipsUSD = tipRecord ? tipRecord.allocatedTipAmount : 0;

      // Break Attestation
      const attestation = attestations.find((a) => a.employeeId === empId);
      let breakAttestationStatus: ADPPayrollRecord['breakAttestationStatus'] = 'COMPLIANT';

      if (attestation) {
        if (!attestation.tookRequiredMealBreak || !attestation.tookRequiredRestBreaks) {
          breakAttestationStatus = attestation.supervisorOverrideApproved
            ? 'OVERRIDE_APPROVED'
            : 'NON_COMPLIANT';
        }
      }

      // Gross Pay Calculation with OT Premium: Base + (OT * 0.5 * BlendedRate) + (DT * 1.0 * BlendedRate) + Tips
      const otPremium = overtimeHours15x * blendedRegularRateUSD * 0.5;
      const dtPremium = doubleTimeHours20x * blendedRegularRateUSD * 1.0;
      const grossPayUSD = Number(
        (totalBaseEarnings + otPremium + dtPremium + allocatedTipsUSD).toFixed(2)
      );

      records.push({
        associateID: `ADP-${empId}`,
        employeeName,
        payPeriodDate,
        jurisdiction,
        regularHours: Number(regularHours.toFixed(1)),
        overtimeHours15x: Number(overtimeHours15x.toFixed(1)),
        doubleTimeHours20x: Number(doubleTimeHours20x.toFixed(1)),
        blendedRegularRateUSD: Number(blendedRegularRateUSD.toFixed(2)),
        allocatedTipsUSD,
        breakAttestationStatus,
        grossPayUSD,
      });
    });

    return records;
  }
}
