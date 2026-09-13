import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Users, Coins, Clock, LogIn, LogOut } from 'lucide-react';

export const LaborShifts: React.FC = () => {
  const { employees, tipPoolTotal, toggleClock } = useStore();

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Labor Shifts, Clock-In & FLSA Tip Pooling</h2>
          <p className="workspace-subtitle">Fair Workweek compliance, role-based scheduling & tip allocation</p>
        </div>

        {/* Tip Pool Metric Pill */}
        <div className="tip-pool-pill">
          <Coins size={16} className="text-emerald" />
          <span>FLSA Tip Pool: <strong>${tipPoolTotal.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Staff Roster Table */}
      <div className="table-wrapper-card">
        <div className="table-header-title">
          <Users size={16} />
          <span>Active Shift Roster & Timecard Actions</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th>Shift Start</th>
                <th>Rate / Hr</th>
                <th>Week Hours</th>
                <th>Timecard Action</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    <div className="empty-table-content">
                      <Users size={32} className="empty-table-icon" />
                      <div className="empty-table-text">No Shift Staff Registered</div>
                      <div className="empty-table-sub">Employee rosters, scheduled shifts, and timecard punch statuses will appear here.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isClockedIn = emp.status === 'CLOCKED_IN';
                  return (
                    <tr key={emp.id}>
                      <td className="font-mono font-bold">{emp.id}</td>
                      <td>
                        <div className="font-bold">{emp.name}</div>
                      </td>
                      <td>{emp.role}</td>
                      <td>
                        <span className={`badge ${isClockedIn ? 'badge-online' : 'badge-offline'}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="text-muted">
                        {isClockedIn ? (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{emp.shiftStart || '09:00 AM'}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="font-mono">${Number(emp.hourlyRateUSD ?? 16.50).toFixed(2)}</td>
                      <td className="font-mono font-bold">{emp.hoursThisWeek ?? (emp as any).hours ?? 30}h</td>
                      <td>
                        <button
                          className={`btn-table-action ${isClockedIn ? 'btn-clock-out' : 'btn-clock-in'}`}
                          onClick={() => toggleClock(emp.id, !isClockedIn)}
                        >
                          {isClockedIn ? (
                            <>
                              <LogOut size={13} />
                              <span>Clock Out</span>
                            </>
                          ) : (
                            <>
                              <LogIn size={13} />
                              <span>Clock In</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
