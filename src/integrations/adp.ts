import { Shift, BreakAttestation } from '../labor/compliance-guardrails.js';
import { TipDistribution } from '../fintech/tip-pooling-engine.js';

export interface ADPPayrollRecord {
  associateID: string;
  employeeName: string;
  payPeriodDate: string;
  regularHours: number;
  overtimeHours: number;
  allocatedTipsUSD: number;
  breakAttestationStatus: 'COMPLIANT' | 'OVERRIDE_APPROVED' | 'NON_COMPLIANT';
  grossPayUSD: number;
}

export class ADPPayrollIntegration {
  /**
   * Transforms shifts, tips, and break attestations into ADP Payroll records.
   */
  public generateADPPayrollPayload(
    shifts: Shift[],
    tipDistributions: TipDistribution[],
    attestations: BreakAttestation[],
    payPeriodDate: string
  ): ADPPayrollRecord[] {
    const employeeMap = new Map<string, { name: string; hours: number; rate: number }>();

    shifts.forEach((shift) => {
      const start = new Date(shift.startTime).getTime();
      const end = new Date(shift.endTime).getTime();
      const hours = (end - start) / (1000 * 60 * 60);

      const existing = employeeMap.get(shift.employeeId);
      if (existing) {
        existing.hours += hours;
      } else {
        employeeMap.set(shift.employeeId, {
          name: shift.employeeName,
          hours,
          rate: shift.hourlyRate,
        });
      }
    });

    const records: ADPPayrollRecord[] = [];

    employeeMap.forEach((data, empId) => {
      const regularHours = Math.min(40, data.hours);
      const overtimeHours = Math.max(0, data.hours - 40);

      const tipRecord = tipDistributions.find((t) => t.employeeId === empId);
      const allocatedTipsUSD = tipRecord ? tipRecord.allocatedTipAmount : 0;

      const attestation = attestations.find((a) => a.employeeId === empId);
      let breakAttestationStatus: ADPPayrollRecord['breakAttestationStatus'] = 'COMPLIANT';

      if (attestation) {
        if (!attestation.tookRequiredMealBreak || !attestation.tookRequiredRestBreaks) {
          breakAttestationStatus = attestation.supervisorOverrideApproved
            ? 'OVERRIDE_APPROVED'
            : 'NON_COMPLIANT';
        }
      }

      const grossPayUSD = Number(
        (regularHours * data.rate + overtimeHours * data.rate * 1.5 + allocatedTipsUSD).toFixed(2)
      );

      records.push({
        associateID: `ADP-${empId}`,
        employeeName: data.name,
        payPeriodDate,
        regularHours: Number(regularHours.toFixed(1)),
        overtimeHours: Number(overtimeHours.toFixed(1)),
        allocatedTipsUSD,
        breakAttestationStatus,
        grossPayUSD,
      });
    });

    return records;
  }
}
