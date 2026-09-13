import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { PurchaseOrder } from '../../types/ui-types';
import { Truck, Plus, PackageCheck, X } from 'lucide-react';

export const PoReceiving: React.FC = () => {
  const { purchaseOrders, suppliers, showToast } = useStore();
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [grnInvoice, setGrnInvoice] = useState('INV-GRN-9901');
  const [localPOs, setLocalPOs] = useState<PurchaseOrder[]>([]);

  // Create PO Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newPoRef, setNewPoRef] = useState('');
  const [newTotalINR, setNewTotalINR] = useState('18500');
  const [newDeliveryDays, setNewDeliveryDays] = useState('2');
  const [isSubmittingPo, setIsSubmittingPo] = useState(false);

  // Synchronize local POs with store
  useEffect(() => {
    setLocalPOs(purchaseOrders);
  }, [purchaseOrders]);

  // Set default supplier when suppliers load
  useEffect(() => {
    if (suppliers.length > 0 && !newSupplierId) {
      setNewSupplierId(suppliers[0].supplierId);
    }
  }, [suppliers, newSupplierId]);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSubmittingPo) {
          setReceivingPO(null);
          setIsCreateOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmittingPo]);

  const handleOpenCreateModal = () => {
    const nextNum = localPOs.length + 1;
    setNewPoRef(`PO-STORE-104-${String(nextNum).padStart(3, '0')}`);
    setIsCreateOpen(true);
  };

  const handleCreatePoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newTotalINR);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid total amount', 'error');
      return;
    }
    const sup = suppliers.find((s) => s.supplierId === newSupplierId);
    const supplierName = sup?.name || 'Approved Supplier';

    const d = new Date();
    const createdStr = d.toISOString().split('T')[0];
    d.setDate(d.getDate() + (parseInt(newDeliveryDays) || 2));
    const deliveryStr = d.toISOString().split('T')[0];

    const newOrder: PurchaseOrder = {
      poId: newPoRef || `PO-STORE-104-${Date.now().toString().slice(-3)}`,
      supplierName,
      totalCostINR: val,
      createdAt: createdStr,
      expectedDeliveryDate: deliveryStr,
      status: 'SENT'
    };

    setLocalPOs((prev) => [newOrder, ...prev]);
    showToast(`Purchase Order ${newOrder.poId} dispatched to ${supplierName}!`, 'success');
    setIsCreateOpen(false);
  };

  const handleReceiveGRN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;
    setLocalPOs((prev) =>
      prev.map((p) => (p.poId === receivingPO.poId ? { ...p, status: 'RECEIVED' as const } : p))
    );
    showToast(`GRN received for ${receivingPO.poId}! Stock balances incremented.`, 'success');
    setReceivingPO(null);
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Purchase Orders & Goods Receiving (GRN)</h2>
          <p className="workspace-subtitle">Supplier procurement, lead times & dock receipt logging</p>
        </div>

        <button
          className="btn-primary"
          onClick={handleOpenCreateModal}
        >
          <Plus size={14} />
          <span>Create New PO</span>
        </button>
      </div>

      {/* Approved Suppliers Table */}
      <div className="table-wrapper-card" style={{ marginBottom: '1.5rem' }}>
        <div className="table-header-title">
          <Truck size={16} />
          <span>Approved Franchise Suppliers</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier ID</th>
                <th>Company Name</th>
                <th>Direct Dispatch Phone</th>
                <th>Lead Time</th>
                <th>Payment Terms</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    <div className="empty-table-content">
                      <Truck size={32} className="empty-table-icon" />
                      <div className="empty-table-text">No Approved Suppliers Configured</div>
                      <div className="empty-table-sub">Franchise headquarters supplier master data will synchronize here automatically.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.supplierId}>
                    <td className="font-mono font-bold">{sup.supplierId}</td>
                    <td>{sup.name}</td>
                    <td className="font-mono">{sup.phone}</td>
                    <td>{sup.leadTimeDays} Days</td>
                    <td>Net {sup.paymentTermsDays}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Purchase Orders Table */}
      <div className="table-wrapper-card">
        <div className="table-header-title">
          <PackageCheck size={16} />
          <span>Active Purchase Orders & Inbound Shipments</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Total Value</th>
                <th>Order Date</th>
                <th>Expected Delivery</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {localPOs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    <div className="empty-table-content">
                      <PackageCheck size={32} className="empty-table-icon" />
                      <div className="empty-table-text">No Purchase Orders Placed</div>
                      <div className="empty-table-sub">Click "Create New PO" above to dispatch an inbound inventory replenishment order.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                localPOs.map((po) => (
                  <tr key={po.poId}>
                    <td className="font-mono font-bold">{po.poId}</td>
                    <td>{po.supplierName}</td>
                    <td className="font-mono font-bold">₹{po.totalCostINR.toLocaleString()}</td>
                    <td className="text-muted">{po.createdAt}</td>
                    <td className="text-muted">{po.expectedDeliveryDate}</td>
                    <td>
                      <span
                        className={`badge ${
                          po.status === 'RECEIVED'
                            ? 'badge-online'
                            : po.status === 'SENT'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td>
                      {po.status === 'SENT' ? (
                        <button
                          className="btn-table-action btn-seat"
                          onClick={() => setReceivingPO(po)}
                        >
                          <PackageCheck size={13} />
                          <span>Receive GRN</span>
                        </button>
                      ) : (
                        <span className="text-muted text-xs">Docked & Verified</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRN Receipt Modal */}
      {receivingPO && (
        <div className="modal-overlay" onClick={() => setReceivingPO(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Receive GRN for {receivingPO.poId}</h3>
                <span className="modal-subtitle">Verify items against supplier packing slip</span>
              </div>
              <button className="btn-close" onClick={() => setReceivingPO(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReceiveGRN}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Supplier Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={receivingPO.supplierName}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor Invoice / Challan #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={grnInvoice}
                    onChange={(e) => setGrnInvoice(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReceivingPO(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Verify & Receive Goods
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Purchase Order Modal */}
      {isCreateOpen && (
        <div className="modal-overlay" onClick={() => !isSubmittingPo && setIsCreateOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Create Purchase Order</h3>
                <span className="modal-subtitle">Dispatch new replenishment order to approved franchise vendor</span>
              </div>
              <button className="btn-close" disabled={isSubmittingPo} onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePoSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Approved Supplier</label>
                  <select
                    className="form-input"
                    value={newSupplierId}
                    onChange={(e) => setNewSupplierId(e.target.value)}
                    required
                  >
                    {suppliers.map((sup) => (
                      <option key={sup.supplierId} value={sup.supplierId}>
                        {sup.name} ({sup.leadTimeDays}d Lead Time &bull; Net {sup.paymentTermsDays})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">PO Reference Code</label>
                  <input
                    type="text"
                    className="form-input font-mono"
                    value={newPoRef}
                    onChange={(e) => setNewPoRef(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Estimated Order Value (INR ₹)</label>
                  <input
                    type="number"
                    step="100"
                    min="1"
                    className="form-input font-mono"
                    value={newTotalINR}
                    onChange={(e) => setNewTotalINR(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expected Lead Time Delivery (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="14"
                    className="form-input"
                    value={newDeliveryDays}
                    onChange={(e) => setNewDeliveryDays(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmittingPo}
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-primary ${isSubmittingPo ? 'btn-loading' : ''}`}
                  disabled={isSubmittingPo}
                >
                  {isSubmittingPo ? <span className="spin-loader" /> : 'Authorize & Issue PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
