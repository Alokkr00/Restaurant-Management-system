import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Clock, CheckCircle, AlertOctagon, Flame } from 'lucide-react';

export const KitchenDisplay: React.FC = () => {
  const { kdsTickets, activeKdsStation, setActiveKdsStation, bumpKDSTicket } = useStore();

  const stations = ['ALL', 'HOTLINE_1', 'EXPO'];

  const filteredTickets = activeKdsStation === 'ALL'
    ? kdsTickets
    : kdsTickets.filter((t) => t.station === activeKdsStation);

  const getTimerClass = (minutes: number, status: string) => {
    if (status === 'LATE' || minutes >= 10) return 'timer-late';
    if (minutes >= 5) return 'timer-warning';
    return 'timer-normal';
  };

  return (
    <div className="workspace-container">
      {/* KDS Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Kitchen Display System (KDS)</h2>
          <p className="workspace-subtitle">Real-time order line-dispatch & kitchen bump bar</p>
        </div>

        {/* Station Filter Pills */}
        <div className="section-pills">
          {stations.map((st) => (
            <button
              key={st}
              className={`pill-btn ${activeKdsStation === st ? 'active' : ''}`}
              onClick={() => setActiveKdsStation(st)}
            >
              {st === 'ALL' ? 'All Stations' : st}
            </button>
          ))}
        </div>
      </div>

      {/* KDS Tickets Grid */}
      <div className="kds-grid">
        {filteredTickets.length === 0 ? (
          <div className="kds-empty-state">
            <CheckCircle size={40} className="kds-empty-icon" />
            <h3>All Kitchen Orders Cleared</h3>
            <p>New orders placed on the POS or delivery channels will appear here automatically.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const timerClass = getTimerClass(ticket.elapsedMinutes, ticket.status);
            const isLate = ticket.status === 'LATE' || ticket.elapsedMinutes >= 10;

            return (
              <div key={ticket.id} className={`kds-card ${isLate ? 'kds-card-late' : ''}`}>
                {/* Header */}
                <div className="kds-card-header">
                  <div>
                    <div className="kds-ticket-id">{ticket.id}</div>
                    <div className="kds-source-tag">{ticket.source}</div>
                  </div>
                  <div className={`kds-timer-badge ${timerClass}`}>
                    <Clock size={13} />
                    <span>
                      {ticket.elapsedMinutes}:{ticket.elapsedSeconds < 10 ? `0${ticket.elapsedSeconds}` : ticket.elapsedSeconds}
                    </span>
                    {isLate && <span className="late-tag">LATE</span>}
                  </div>
                </div>

                {/* Subtitle / Dining Type */}
                <div className="kds-card-sub">
                  <span className="station-badge">{ticket.station}</span>
                  <span className="dining-type-badge">{ticket.diningType}</span>
                </div>

                {/* Items List */}
                <div className="kds-items-list">
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="kds-item-row">
                      <div className="kds-item-title-row">
                        <span className="kds-qty-pill">{item.qty}x</span>
                        <span className="kds-item-name">{item.name}</span>
                      </div>

                      {/* Modifiers */}
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="kds-modifiers-box">
                          {item.modifiers.map((mod, mi) => (
                            <span key={mi} className="kds-mod-tag">&bull; {mod}</span>
                          ))}
                        </div>
                      )}

                      {/* Allergens */}
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="kds-allergens-box">
                          <AlertOctagon size={12} />
                          <span>ALLERGENS: {item.allergens.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Full-width Bump Button */}
                <button
                  className="btn-bump-ticket"
                  onClick={() => bumpKDSTicket(ticket.id)}
                >
                  <Flame size={15} />
                  <span>Bump & Complete</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
