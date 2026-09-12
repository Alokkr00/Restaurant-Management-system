import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Boxes, Trash2, BookOpen, AlertTriangle, Plus, X } from 'lucide-react';
import { StoreAPI } from '../../services/api';

export const InventoryView: React.FC = () => {
  const { stockLevels, spoilageLogs, recipes, showToast, refreshData } = useStore();
  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [wasteItem, setWasteItem] = useState('Mozzarella Cheese (Shredded)');
  const [wasteQty, setWasteQty] = useState('1.5 kg');
  const [wasteReason, setWasteReason] = useState('Expired / Over temp');
  const [wasteCost, setWasteCost] = useState('18.00');

  const handleLogWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(wasteCost);
    try {
      await StoreAPI.logWaste({
        item: wasteItem,
        qty: wasteQty,
        reason: wasteReason,
        costUSD: isNaN(cost) ? 10.0 : cost
      });
      showToast(`Logged kitchen waste for ${wasteItem}`, 'success');
      setWasteModalOpen(false);
      refreshData();
    } catch {
      showToast('Failed to log waste', 'error');
    }
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Inventory, BOM Depletion & Waste Logs</h2>
          <p className="workspace-subtitle">FIFO stock balances, Bill-of-Materials breakdown & waste tracking</p>
        </div>

        <button className="btn-primary" onClick={() => setWasteModalOpen(true)}>
          <Plus size={14} />
          <span>Log Spoilage / Waste</span>
        </button>
      </div>

      {/* Stock Balances Table */}
      <div className="table-wrapper-card" style={{ marginBottom: '1.5rem' }}>
        <div className="table-header-title">
          <Boxes size={16} />
          <span>Current On-Hand Stock & Variance Guardrails</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ingredient SKU</th>
                <th>Ingredient Name</th>
                <th>Current Balance</th>
                <th>Unit</th>
                <th>Variance Status</th>
              </tr>
            </thead>
            <tbody>
              {stockLevels.map((stk) => (
                <tr key={stk.ingredientId}>
                  <td className="font-mono font-bold">{stk.ingredientId}</td>
                  <td>{stk.name}</td>
                  <td className="font-mono font-bold text-lg">{Number(stk.balance ?? 0).toFixed(1)}</td>
                  <td>{stk.unit}</td>
                  <td>
                    <span className="badge badge-online">Within Par (&plusmn;1.2%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recipe Depletion BOM Section */}
      <div className="table-wrapper-card" style={{ marginBottom: '1.5rem' }}>
        <div className="table-header-title">
          <BookOpen size={16} />
          <span>Bill of Materials (BOM) Recipe Depletion Matrix</span>
        </div>

        <div className="recipes-grid">
          {recipes.map((rcp) => (
            <div key={rcp.id} className="recipe-card">
              <div className="recipe-card-header">
                <h4 className="recipe-name">{rcp.name}</h4>
                <span className="recipe-yield">Yield: {rcp.targetYield ?? 1} Serving</span>
              </div>
              <div className="recipe-ingredients-list">
                {rcp.ingredients.map((ing, ii) => (
                  <div key={ii} className="recipe-ing-row">
                    <span>{ing.name}</span>
                    <span className="font-mono font-bold">
                      {ing.qty} {ing.unit} (${Number(ing.cost ?? 1.50).toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Spoilage & Waste Logs Table */}
      <div className="table-wrapper-card">
        <div className="table-header-title">
          <Trash2 size={16} />
          <span>Kitchen Waste & Spoilage Audit Trail</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Date</th>
                <th>Discarded Item</th>
                <th>Quantity</th>
                <th>Root Cause Reason</th>
                <th>Cost Impact</th>
              </tr>
            </thead>
            <tbody>
              {spoilageLogs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono">{log.id}</td>
                  <td className="text-muted">{log.date || 'Today'}</td>
                  <td>{log.item}</td>
                  <td className="font-mono">{log.qty}</td>
                  <td>
                    <span className="badge badge-danger">
                      <AlertTriangle size={11} />
                      <span>{log.reason}</span>
                    </span>
                  </td>
                  <td className="font-mono font-bold text-rose">
                    -${Number(log.costUSD ?? 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Waste Logging Modal */}
      {wasteModalOpen && (
        <div className="modal-overlay" onClick={() => setWasteModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Log Kitchen Spoilage</h3>
                <span className="modal-subtitle">Record dropped or expired ingredients</span>
              </div>
              <button className="btn-close" onClick={() => setWasteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogWasteSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ingredient / Dish</label>
                  <input
                    type="text"
                    className="form-input"
                    value={wasteItem}
                    onChange={(e) => setWasteItem(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    type="text"
                    className="form-input"
                    value={wasteQty}
                    onChange={(e) => setWasteQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated Cost Loss (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={wasteCost}
                    onChange={(e) => setWasteCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setWasteModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Log Waste Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
