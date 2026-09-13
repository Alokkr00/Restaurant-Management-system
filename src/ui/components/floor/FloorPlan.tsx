import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { RestaurantTable } from '../../types/ui-types';
import { Users, Flame, CheckCircle2, UserPlus, X, AlertTriangle } from 'lucide-react';

export const FloorPlan: React.FC = () => {
  const { tables, seatTable, fireTable, closeTable } = useStore();
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [seatingTable, setSeatingTable] = useState<RestaurantTable | null>(null);
  const [tableToClose, setTableToClose] = useState<RestaurantTable | null>(null);
  const [covers, setCovers] = useState(2);
  const [serverName, setServerName] = useState('Sarah J.');
  const [isSeating, setIsSeating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const sections = ['ALL', 'Main Floor', 'Private Dining', 'Bar', 'Patio'];

  const filteredTables = selectedSection === 'ALL'
    ? tables
    : tables.filter((t) => t.section === selectedSection);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSeating) setSeatingTable(null);
        if (!isClosing) setTableToClose(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSeating, isClosing]);

  const handleSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatingTable) return;
    setIsSeating(true);
    try {
      await seatTable(seatingTable.tableId, covers, serverName);
      setSeatingTable(null);
    } finally {
      setIsSeating(false);
    }
  };

  const handleFireTable = async (tableId: string) => {
    setActionInProgressId(tableId);
    try {
      await fireTable(tableId, 'Entrees');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleConfirmClose = async () => {
    if (!tableToClose) return;
    setIsClosing(true);
    try {
      await closeTable(tableToClose.tableId);
      setTableToClose(null);
    } finally {
      setIsClosing(false);
    }
  };

  const getStatusColor = (status: RestaurantTable['status']) => {
    switch (status) {
      case 'VACANT': return 'status-vacant';
      case 'SEATED': return 'status-seated';
      case 'ORDERING': return 'status-ordering';
      case 'SERVED': return 'status-served';
    }
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Table Floor Plan</h2>
          <p className="workspace-subtitle">Live table status, server allocation & course firing</p>
        </div>

        {/* Section Filters */}
        <div className="section-pills">
          {sections.map((sec) => (
            <button
              key={sec}
              className={`pill-btn ${selectedSection === sec ? 'active' : ''}`}
              onClick={() => setSelectedSection(sec)}
            >
              {sec === 'ALL' ? 'All Sections' : sec}
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="tables-grid">
        {filteredTables.length === 0 ? (
          <div className="empty-table-cell" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-table-content">
              <Users size={36} className="empty-table-icon" />
              <div className="empty-table-text">No Tables in This Section</div>
              <div className="empty-table-sub">There are no dining tables assigned to the "{selectedSection}" section filter.</div>
            </div>
          </div>
        ) : (
          filteredTables.map((table) => {
            const isFiring = actionInProgressId === table.tableId;
            return (
              <div key={table.tableId} className={`table-card ${getStatusColor(table.status)}`}>
                <div className="table-card-header">
                  <div>
                    <span className="table-label">{table.label}</span>
                    <span className="table-section">{table.section}</span>
                  </div>
                  <span className={`table-badge ${getStatusColor(table.status)}`}>
                    {table.status}
                  </span>
                </div>

                <div className="table-card-body">
                  <div className="table-info-row">
                    <Users size={14} />
                    <span>Seats {table.seats} ({table.covers ? `${table.covers} seated` : 'Vacant'})</span>
                  </div>
                  {table.serverName && (
                    <div className="table-meta-text">
                      Server: <strong>{table.serverName}</strong> &bull; {table.seatedAt || 'Recently'}
                    </div>
                  )}
                </div>

                <div className="table-card-footer">
                  {table.status === 'VACANT' && (
                    <button
                      className="btn-table-action btn-seat"
                      onClick={() => {
                        setSeatingTable(table);
                        setCovers(table.seats);
                      }}
                    >
                      <UserPlus size={14} />
                      <span>Seat Table</span>
                    </button>
                  )}

                  {table.status === 'SEATED' && (
                    <button
                      className={`btn-table-action btn-fire ${isFiring ? 'btn-loading' : ''}`}
                      disabled={isFiring}
                      onClick={() => handleFireTable(table.tableId)}
                    >
                      {isFiring ? <span className="spin-loader" /> : <Flame size={14} />}
                      <span>{isFiring ? 'Firing...' : 'Fire Entrees'}</span>
                    </button>
                  )}

                  {(table.status === 'ORDERING' || table.status === 'SERVED') && (
                    <button
                      className="btn-table-action btn-close-table"
                      onClick={() => setTableToClose(table)}
                    >
                      <CheckCircle2 size={14} />
                      <span>Close & Clear</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Seat Table Modal */}
      {seatingTable && (
        <div className="modal-overlay" onClick={() => !isSeating && setSeatingTable(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Seat {seatingTable.label}</h3>
                <span className="modal-subtitle">Assign party size and table server</span>
              </div>
              <button className="btn-close" disabled={isSeating} onClick={() => setSeatingTable(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSeatSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Number of Guests (Covers)</label>
                  <input
                    type="number"
                    min="1"
                    max={seatingTable.seats + 4}
                    className="form-input"
                    value={covers}
                    onChange={(e) => setCovers(parseInt(e.target.value) || 1)}
                    required
                    autoFocus
                    disabled={isSeating}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Server</label>
                  <input
                    type="text"
                    className="form-input"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    required
                    disabled={isSeating}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSeating}
                  onClick={() => setSeatingTable(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-primary ${isSeating ? 'btn-loading' : ''}`}
                  disabled={isSeating}
                >
                  {isSeating ? <span className="spin-loader" /> : 'Confirm Seating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Destructive Action Confirmation Modal for Table Close */}
      {tableToClose && (
        <div className="modal-overlay" onClick={() => !isClosing && setTableToClose(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Close & Clear {tableToClose.label}</h3>
                <span className="modal-subtitle">Confirm table turnover and session completion</span>
              </div>
              <button className="btn-close" disabled={isClosing} onClick={() => setTableToClose(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="confirm-dialog-content">
                <div className="confirm-dialog-warning">
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Permanent Table Action:</strong> This will complete the dining ticket for{' '}
                    <strong>{tableToClose.label}</strong> ({tableToClose.covers || tableToClose.seats} covers), vacate
                    the table, and reset its status to <strong>VACANT</strong> for next guest party.
                  </div>
                </div>
                <p className="confirm-dialog-desc">
                  Ensure the guest has completed payment and the table has been cleared and sanitized by bus staff.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={isClosing}
                onClick={() => setTableToClose(null)}
              >
                Keep Table Open
              </button>
              <button
                type="button"
                className={`btn-table-action btn-close-table ${isClosing ? 'btn-loading' : ''}`}
                style={{ padding: '0.65rem 1.25rem' }}
                disabled={isClosing}
                onClick={handleConfirmClose}
              >
                {isClosing ? <span className="spin-loader" /> : <CheckCircle2 size={16} />}
                <span>{isClosing ? 'Closing...' : 'Confirm Close & Clear'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
