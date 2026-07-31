export interface StaffShiftHours {
  employeeId: string;
  employeeName: string;
  role: 'CASHIER' | 'KITCHEN_PREP' | 'SHIFT_LEAD';
  hoursWorked: number;
}

export interface TipDistribution {
  employeeId: string;
  employeeName: string;
  role: string;
  hoursWorked: number;
  allocatedTipAmount: number;
}

export interface TipPoolResult {
  storeId: string;
  shiftDate: string;
  totalCollectedTips: number;
  totalHoursWorked: number;
  distributions: TipDistribution[];
  timestamp: string;
}

export class TipPoolingEngine {
  private roleWeights: Record<StaffShiftHours['role'], number> = {
    CASHIER: 1.0,
    KITCHEN_PREP: 1.2, // Kitchen prep receives 20% higher weight factor
    SHIFT_LEAD: 0.8,
  };

  /**
   * Calculates tip pool allocation weighted by role and hours worked.
   */
  public calculateTipDistribution(
    storeId: string,
    shiftDate: string,
    totalCollectedTips: number,
    staffList: StaffShiftHours[]
  ): TipPoolResult {
    let totalWeightedHours = 0;

    staffList.forEach((s) => {
      const weight = this.roleWeights[s.role] || 1.0;
      totalWeightedHours += s.hoursWorked * weight;
    });

    const totalHoursWorked = staffList.reduce((sum, s) => sum + s.hoursWorked, 0);

    const distributions: TipDistribution[] = staffList.map((s) => {
      const weight = this.roleWeights[s.role] || 1.0;
      const weightedHours = s.hoursWorked * weight;
      const share = totalWeightedHours > 0 ? weightedHours / totalWeightedHours : 0;
      const allocatedTipAmount = Number((totalCollectedTips * share).toFixed(2));

      return {
        employeeId: s.employeeId,
        employeeName: s.employeeName,
        role: s.role,
        hoursWorked: s.hoursWorked,
        allocatedTipAmount,
      };
    });

    return {
      storeId,
      shiftDate,
      totalCollectedTips: Number(totalCollectedTips.toFixed(2)),
      totalHoursWorked,
      distributions,
      timestamp: new Date().toISOString(),
    };
  }
}
