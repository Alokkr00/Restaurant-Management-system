import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { PurchaseOrder } from '../../types/ui-types';
import { Truck, Plus, PackageCheck, X } from 'lucide-react';

export const PoReceiving: React.FC = () => {
  const { purchaseOrders, suppliers, showToast } = useStore();
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [grnInvoice, setGrnInvoice] = useState('INV-GRN-9901');

  const handleReceiveGRN = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingPO) return;
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
          onClick={() => showToast('PO Creation Dialog opened', 'info')}
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
              {suppliers.map((sup) => (
                <tr key={sup.supplierId}>
                  <td className="font-mono font-bold">{sup.supplierId}</td>
                  <td>{sup.name}</td>
                  <td className="font-mono">{sup.phone}</td>
                  <td>{sup.leadTimeDays} Days</td>
                  <td>Net {sup.paymentTermsDays}</td>
                </tr>
              ))}
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
              {purchaseOrders.map((po) => (
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
              ))}
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
    </div>
  );
};
