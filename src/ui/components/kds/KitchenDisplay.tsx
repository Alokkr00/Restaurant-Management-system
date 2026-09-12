import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Clock, CheckCircle, AlertOctagon, Flame } from 'lucide-react';

export const KitchenDisplay: React.FC = () => {
  const { kdsTickets, activeKdsStation, setActiveKdsStation, bumpKDSTicket } = useStore();
  const [bumpingId, setBumpingId] = useState<string | null>(null);

  const stations = ['ALL', 'HOTLINE_1', 'EXPO'];

  const filteredTickets = activeKdsStation === 'ALL'
    ? kdsTickets
    : kdsTickets.filter((t) => t.station === activeKdsStation);

  // Hardware Bump Bar Integration (Keys 1-9 & Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space' && filteredTickets.length > 0) {
        e.preventDefault();
        handleBump(filteredTickets[0].id);
      } else {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= 9) {
          const target = filteredTickets[num - 1];
          if (target) {
            e.preventDefault();
            handleBump(target.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredTickets]);

  const handleBump = async (ticketId: string) => {
    setBumpingId(ticketId);
    try {
      await bumpKDSTicket(ticketId);
    } finally {
      setBumpingId(null);
    }
  };

  const getTimerClass = (minutes: number, status: string) => {
    if (status === 'LATE' || minutes >= 10) return 'timer-late';
    if (minutes >= 5) return 'timer-warning';
    return 'timer-normal';
  };

  const getHeaderClass = (minutes: number, status: string) => {
    if (status === 'LATE' || minutes >= 10) return 'header-late';
    if (minutes >= 5) return 'header-warning';
    return 'header-normal';
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
          filteredTickets.map((ticket, index) => {
            const timerClass = getTimerClass(ticket.elapsedMinutes, ticket.status);
            const headerClass = getHeaderClass(ticket.elapsedMinutes, ticket.status);
            const isLate = ticket.status === 'LATE' || ticket.elapsedMinutes >= 10;
            const isBumping = bumpingId === ticket.id;

            return (
              <div key={ticket.id} className={`kds-card ${isLate ? 'kds-card-late' : ''}`}>
                {/* Header with Solid Urgency Flood */}
                <div className={`kds-card-header ${headerClass}`}>
                  <div>
                    <div className="kds-ticket-id">#{index + 1} &bull; {ticket.id}</div>
                    <div className="kds-source-tag">{ticket.source}</div>
                  </div>
                  <div className={`kds-timer-badge ${timerClass}`}>
                    <Clock size={14} />
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

                      {/* Prominent High-Contrast Allergen Warning */}
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="kds-allergens-box">
                          <AlertOctagon size={14} />
                          <span>⚠️ ALLERGEN ALERT: {item.allergens.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Full-width Bump Button with Tactile Slot Key Hint */}
                <button
                  className={`btn-bump-ticket ${isBumping ? 'btn-loading' : ''}`}
                  disabled={isBumping}
                  onClick={() => handleBump(ticket.id)}
                  title={`Press [${index + 1}] or Spacebar to bump`}
                >
                  {isBumping ? (
                    <span className="spin-loader" />
                  ) : (
                    <>
                      <Flame size={16} />
                      <span>[{index + 1}] Bump & Complete</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
