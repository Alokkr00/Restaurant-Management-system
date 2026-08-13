export type StaffRole =
  | 'SERVER'
  | 'BARTENDER'
  | 'BUSSER'
  | 'CASHIER'
  | 'KITCHEN_PREP'
  | 'LINE_COOK'
  | 'DISHWASHER'
  | 'SHIFT_LEAD'
  | 'ASSISTANT_MANAGER'
  | 'GENERAL_MANAGER';

export interface StaffShiftHours {
  employeeId: string;
  employeeName: string;
  role: StaffRole;
  hoursWorked: number;
  isManagerial?: boolean; // Employees with hiring, firing, or supervisory powers
}

export interface TipDistribution {
  employeeId: string;
  employeeName: string;
  role: StaffRole;
  hoursWorked: number;
  isEligibleFLSA: boolean;
  exclusionReason?: string;
  allocatedTipAmount: number;
}

export interface TipPoolResult {
  storeId: string;
  shiftDate: string;
  totalCollectedTips: number;
  eligibleHoursWorked: number;
  takesTipCredit: boolean;
  distributions: TipDistribution[];
  timestamp: string;
}

export class TipPoolingEngine {
  // Role weighting factors for eligible non-exempt staff
  private defaultRoleWeights: Record<StaffRole, number> = {
    SERVER: 1.0,
    BARTENDER: 1.0,
    BUSSER: 0.7,
    CASHIER: 1.0,
    KITCHEN_PREP: 1.2, // Non-exempt BOH in non-tip-credit setup
    LINE_COOK: 1.0,
    DISHWASHER: 0.6,
    SHIFT_LEAD: 0.0, // FLSA Banned: 0% allocation
    ASSISTANT_MANAGER: 0.0, // FLSA Banned: 0% allocation
    GENERAL_MANAGER: 0.0, // FLSA Banned: 0% allocation
  };

  /**
   * Evaluates role and FLSA compliance rules.
   * Under FLSA §3(m)(2)(B): Managers and supervisors cannot participate in employee tip pools.
   * If an employer claims a tip credit against minimum wage, BOH cannot participate in tip pool.
   * If an employer pays full statutory minimum wage (no tip credit taken), non-exempt BOH may participate.
   */
  public evaluateFLSAEligibility(
    staff: StaffShiftHours,
    takesTipCredit: boolean
  ): { isEligible: boolean; reason?: string } {
    // 1. Strict Managerial Exclusion (FLSA § 3(m)(2)(B))
    if (
      staff.isManagerial ||
      staff.role === 'SHIFT_LEAD' ||
      staff.role === 'ASSISTANT_MANAGER' ||
      staff.role === 'GENERAL_MANAGER'
    ) {
      return {
        isEligible: false,
        reason: 'FLSA §3(m)(2)(B) Violation: Managers and supervisors are barred from employee tip pools.',
      };
    }

    // 2. Tip Credit Rule: BOH staff ineligible if employer takes tip credit for FOH
    const isBOH =
      staff.role === 'KITCHEN_PREP' ||
      staff.role === 'LINE_COOK' ||
      staff.role === 'DISHWASHER';

    if (takesTipCredit && isBOH) {
      return {
        isEligible: false,
        reason: 'FLSA Tip Credit Rule: BOH staff cannot share in tip pools when employer claims FOH tip credit.',
      };
    }

    return { isEligible: true };
  }

  /**
   * Calculates compliant tip pool distribution weighted by hours worked and role weights.
   */
  public calculateTipDistribution(
    storeId: string,
    shiftDate: string,
    totalCollectedTips: number,
    staffList: StaffShiftHours[],
    takesTipCredit: boolean = false
  ): TipPoolResult {
    const evaluatedStaff = staffList.map((s) => {
      const eligibility = this.evaluateFLSAEligibility(s, takesTipCredit);
      return {
        ...s,
        isEligible: eligibility.isEligible,
        reason: eligibility.reason,
      };
    });

    let totalWeightedHours = 0;
    let eligibleHoursWorked = 0;

    evaluatedStaff.forEach((s) => {
      if (s.isEligible && s.hoursWorked > 0) {
        const weight = this.defaultRoleWeights[s.role] || 1.0;
        totalWeightedHours += s.hoursWorked * weight;
        eligibleHoursWorked += s.hoursWorked;
      }
    });

    const distributions: TipDistribution[] = evaluatedStaff.map((s) => {
      if (!s.isEligible || totalWeightedHours <= 0) {
        return {
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          role: s.role,
          hoursWorked: s.hoursWorked,
          isEligibleFLSA: false,
          exclusionReason: s.reason,
          allocatedTipAmount: 0.0,
        };
      }

      const weight = this.defaultRoleWeights[s.role] || 1.0;
      const weightedHours = s.hoursWorked * weight;
      const share = weightedHours / totalWeightedHours;
      const allocatedTipAmount = Number((totalCollectedTips * share).toFixed(2));

      return {
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        role: s.role,
        hoursWorked: s.hoursWorked,
        isEligibleFLSA: true,
        allocatedTipAmount,
      };
    });

    return {
      storeId,
      shiftDate,
      totalCollectedTips: Number(totalCollectedTips.toFixed(2)),
      eligibleHoursWorked,
      takesTipCredit,
      distributions,
      timestamp: new Date().toISOString(),
    };
  }
}
