import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { RestaurantTable } from '../../types/ui-types';
import { Users, Flame, CheckCircle2, UserPlus, X } from 'lucide-react';

export const FloorPlan: React.FC = () => {
  const { tables, seatTable, fireTable, closeTable } = useStore();
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [seatingTable, setSeatingTable] = useState<RestaurantTable | null>(null);
  const [covers, setCovers] = useState(2);
  const [serverName, setServerName] = useState('Sarah J.');

  const sections = ['ALL', 'Main Floor', 'Private Dining', 'Bar', 'Patio'];

  const filteredTables = selectedSection === 'ALL'
    ? tables
    : tables.filter((t) => t.section === selectedSection);

  const handleSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seatingTable) return;
    await seatTable(seatingTable.tableId, covers, serverName);
    setSeatingTable(null);
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
        {filteredTables.map((table) => (
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
                  className="btn-table-action btn-fire"
                  onClick={() => fireTable(table.tableId, 'Entrees')}
                >
                  <Flame size={14} />
                  <span>Fire Entrees</span>
                </button>
              )}

              {(table.status === 'ORDERING' || table.status === 'SERVED') && (
                <button
                  className="btn-table-action btn-close-table"
                  onClick={() => closeTable(table.tableId)}
                >
                  <CheckCircle2 size={14} />
                  <span>Close & Clear</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Seat Table Modal */}
      {seatingTable && (
        <div className="modal-overlay" onClick={() => setSeatingTable(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Seat {seatingTable.label}</h3>
                <span className="modal-subtitle">Assign party size and table server</span>
              </div>
              <button className="btn-close" onClick={() => setSeatingTable(null)}>
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
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSeatingTable(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Seating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
