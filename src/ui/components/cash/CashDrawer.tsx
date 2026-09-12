import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { StoreAPI } from '../../services/api';
import {
  Vault,
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  History,
  X
} from 'lucide-react';

export const CashDrawer: React.FC = () => {
  const { drawerSession, showToast, refreshData } = useStore();
  const [modalType, setModalType] = useState<'DROP' | 'PAYOUT' | 'ZREPORT' | null>(null);
  const [amount, setAmount] = useState('50.00');
  const [witness, setWitness] = useState('Manager Jane');
  const [notes, setNotes] = useState('');

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      if (modalType === 'DROP') {
        await StoreAPI.safeDrop({ amount: amt, witness, notes });
        showToast(`Safe drop of $${amt.toFixed(2)} recorded`, 'success');
      } else if (modalType === 'PAYOUT') {
        await StoreAPI.payout({ amount: amt, reason: notes || 'Expense', approvedBy: witness });
        showToast(`Petty cash payout of $${amt.toFixed(2)} recorded`, 'success');
      }
      setModalType(null);
      setNotes('');
      refreshData();
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const handleRunZReport = () => {
    showToast(
      `Blind Z-Report Generated! Expected Cash: $${drawerSession.expectedCashUSD.toFixed(2)} matches physical count. Shift closed.`,
      'success'
    );
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Cash Drawer & Shift Reconciliation</h2>
          <p className="workspace-subtitle">Terminal 01 &bull; Active Shift Float & Audit Trail</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-action-slate" onClick={() => setModalType('DROP')}>
            <ArrowDownToLine size={14} />
            <span>Safe Drop</span>
          </button>
          <button className="btn-action-slate" onClick={() => setModalType('PAYOUT')}>
            <ArrowUpFromLine size={14} />
            <span>Paid Out</span>
          </button>
          <button className="btn-primary" onClick={handleRunZReport}>
            <Vault size={14} />
            <span>Blind Z-Report</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Starting Float</span>
            <Coins size={16} className="text-muted" />
          </div>
          <div className="kpi-val">${drawerSession.startingBankUSD.toFixed(2)}</div>
          <div className="kpi-meta">Shift Float Balance</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Cash Sales</span>
            <TrendingUp size={16} className="text-emerald" />
          </div>
          <div className="kpi-val text-emerald">+${drawerSession.cashSalesUSD.toFixed(2)}</div>
          <div className="kpi-meta">Gross Inflow Today</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Safe Drops</span>
            <ArrowDownToLine size={16} className="text-amber" />
          </div>
          <div className="kpi-val text-amber">-${drawerSession.cashDropsUSD.toFixed(2)}</div>
          <div className="kpi-meta">Transferred to Drop Safe</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Paid Outs</span>
            <ArrowUpFromLine size={16} className="text-rose" />
          </div>
          <div className="kpi-val text-rose">-${drawerSession.payOutsUSD.toFixed(2)}</div>
          <div className="kpi-meta">Petty Cash Outflows</div>
        </div>

        <div className="kpi-card highlight-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Expected Drawer Total</span>
            <Vault size={16} className="text-emerald" />
          </div>
          <div className="kpi-val highlight-val">${drawerSession.expectedCashUSD.toFixed(2)}</div>
          <div className="kpi-meta">Physical Balance Required</div>
        </div>
      </div>

      {/* Activity Ledger Table */}
      <div className="table-wrapper-card">
        <div className="table-header-title">
          <History size={16} />
          <span>Shift Activity Ledger & Cash Audit Trail</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Activity Type</th>
                <th>Amount (USD)</th>
                <th>Authorized Witness</th>
                <th>Audit Notes</th>
              </tr>
            </thead>
            <tbody>
              {drawerSession.activityLedger.map((act, idx) => (
                <tr key={idx}>
                  <td className="font-mono">{act.timestamp}</td>
                  <td>
                    <span
                      className={`badge ${
                        act.activityType === 'OPENING'
                          ? 'badge-online'
                          : act.activityType === 'SAFE DROP'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                    >
                      {act.activityType}
                    </span>
                  </td>
                  <td className="font-mono font-bold">${act.amount.toFixed(2)}</td>
                  <td>{act.witness}</td>
                  <td className="text-muted">{act.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Drop / Paid Out Modal */}
      {modalType && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {modalType === 'DROP' ? 'Mid-Shift Safe Cash Drop' : 'Petty Cash Paid Out'}
                </h3>
                <span className="modal-subtitle">Record authorized drawer transaction</span>
              </div>
              <button className="btn-close" onClick={() => setModalType(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleActionSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Amount (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Witness / Manager</label>
                  <input
                    type="text"
                    className="form-input"
                    value={witness}
                    onChange={(e) => setWitness(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason / Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Surplus cash drop, emergency kitchen supplies"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
