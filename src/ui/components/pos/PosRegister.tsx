import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CategoryChips } from './CategoryChips';
import { MenuGrid } from './MenuGrid';
import { CartSidebar } from './CartSidebar';
import { ShieldAlert, ArrowDownToLine, X } from 'lucide-react';
import { StoreAPI } from '../../services/api';

export const PosRegister: React.FC = () => {
  const { drawerSession, showToast, refreshData } = useStore();
  const [safeDropModalOpen, setSafeDropModalOpen] = useState(false);
  const [dropAmount, setDropAmount] = useState('100.00');
  const [dropWitness, setDropWitness] = useState('Manager Sarah');
  const [dropNotes, setDropNotes] = useState('Surplus register drop to drop-safe');

  const handleSafeDropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(dropAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Enter a valid safe drop amount', 'error');
      return;
    }
    try {
      await StoreAPI.safeDrop({ amount: amt, witness: dropWitness, notes: dropNotes });
      showToast(`Safe drop of $${amt.toFixed(2)} logged to drawer ledger`, 'success');
      setSafeDropModalOpen(false);
      refreshData();
    } catch {
      showToast('Failed to log safe drop', 'error');
    }
  };

  return (
    <div className="pos-workspace-split">
      {/* Left Column: Menu Header, Categories, and Adaptive Food Grid */}
      <div className="pos-menu-column">
        {/* Section Header */}
        <div className="pos-section-header">
          <div>
            <h2 className="pos-title">Point of Sale Register</h2>
            <p className="pos-subtitle">Terminal 01 &bull; SQLite WAL Persistence &bull; Sub-200ms Dispatch</p>
          </div>
          <div className="pos-header-actions">
            <div className="drawer-badge">
              <ShieldAlert size={13} />
              <span>DRAWER: ${drawerSession.expectedCashUSD.toFixed(2)}</span>
            </div>
            <button
              className="btn-action-slate"
              onClick={() => setSafeDropModalOpen(true)}
              title="Perform mid-shift safe drop"
            >
              <ArrowDownToLine size={13} />
              <span>Safe Drop</span>
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
        <CategoryChips />

        {/* Scrollable Adaptive Food Cards */}
        <MenuGrid />
      </div>

      {/* Right Column: Pinned Cart Sidebar */}
      <CartSidebar />

      {/* Safe Drop Modal */}
      {safeDropModalOpen && (
        <div className="modal-overlay" onClick={() => setSafeDropModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Mid-Shift Safe Drop</h3>
                <span className="modal-subtitle">Transfer surplus cash from terminal drawer to safe</span>
              </div>
              <button className="btn-close" onClick={() => setSafeDropModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSafeDropSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Drop Amount (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={dropAmount}
                    onChange={(e) => setDropAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Witness / Manager Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={dropWitness}
                    onChange={(e) => setDropWitness(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Audit Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    value={dropNotes}
                    onChange={(e) => setDropNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSafeDropModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Safe Drop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
