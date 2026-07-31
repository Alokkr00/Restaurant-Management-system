export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  role: 'CASHIER' | 'KITCHEN_PREP' | 'SHIFT_LEAD' | 'GENERAL_MANAGER';
  startTime: string; // ISO timestamp
  endTime: string;   // ISO timestamp
  hourlyRate: number;
}

export interface BreakAttestation {
  shiftId: string;
  employeeId: string;
  clockOutTime: string;
  tookRequiredMealBreak: boolean;
  tookRequiredRestBreaks: boolean;
  signatureToken: string;
  supervisorOverrideApproved?: boolean;
}

export class LaborComplianceGuardrails {
  private minRestHoursBetweenShifts: number = 11; // Clopening threshold

  /**
   * Evaluates whether a proposed shift violates "Clopening" laws (< 11 hours rest between shifts).
   */
  public evaluateClopeningViolation(
    existingShifts: Shift[],
    proposedShift: Shift
  ): { isViolated: boolean; restHoursActual?: number; premiumPayRequired: boolean } {
    const employeeShifts = existingShifts
      .filter((s) => s.employeeId === proposedShift.employeeId && s.id !== proposedShift.id)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const proposedStart = new Date(proposedShift.startTime).getTime();

    for (const shift of employeeShifts) {
      const shiftEnd = new Date(shift.endTime).getTime();

      // Check if proposed shift starts shortly after a prior shift ends
      if (proposedStart >= shiftEnd) {
        const restHoursActual = (proposedStart - shiftEnd) / (1000 * 60 * 60);
        if (restHoursActual < this.minRestHoursBetweenShifts) {
          return {
            isViolated: true,
            restHoursActual: Number(restHoursActual.toFixed(1)),
            premiumPayRequired: true,
          };
        }
      }
    }

    return { isViolated: false, premiumPayRequired: false };
  }

  /**
   * Verifies digital break attestation on POS clock-out.
   */
  public verifyBreakAttestation(attestation: BreakAttestation): {
    isValid: boolean;
    requiresManagerFlag: boolean;
    reason?: string;
  } {
    if (!attestation.tookRequiredMealBreak || !attestation.tookRequiredRestBreaks) {
      if (!attestation.supervisorOverrideApproved) {
        return {
          isValid: false,
          requiresManagerFlag: true,
          reason: 'Employee attested to missed meal/rest break without approved supervisor override.',
        };
      }
    }

    return { isValid: true, requiresManagerFlag: false };
  }
}
