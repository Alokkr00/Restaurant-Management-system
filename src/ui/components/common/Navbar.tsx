import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { ModuleType } from '../../types/ui-types';
import {
  ShoppingCart,
  LayoutGrid,
  Utensils,
  CircleDollarSign,
  Truck,
  Boxes,
  Users,
  BookOpen,
  TrendingUp,
  RefreshCw,
  GraduationCap,
  Download,
  Wifi,
  WifiOff,
  ChevronDown
} from 'lucide-react';
import { StoreAPI } from '../../services/api';

export const Navbar: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    apiConnected,
    wsConnected,
    refreshData,
    showToast,
    kdsTickets
  } = useStore();

  const [backOfficeOpen, setBackOfficeOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
    showToast('Store data refreshed from edge node', 'success');
  };

  const handleToggleTraining = async () => {
    const next = !trainingMode;
    setTrainingMode(next);
    try {
      await StoreAPI.toggleTrainingMode(next);
      showToast(`Training mode ${next ? 'ACTIVATED' : 'DEACTIVATED'}`, 'info');
    } catch {}
  };

  const handleDownloadSupportBundle = async () => {
    try {
      const data = await StoreAPI.getSupportBundle();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `support-bundle-store-104-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Sanitized support bundle downloaded', 'success');
    } catch {
      showToast('Failed to download support bundle', 'error');
    }
  };

  const navTabs: { id: ModuleType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'pos_register', label: 'POS Register', icon: <ShoppingCart size={15} /> },
    { id: 'table_floor_plan', label: 'Table Floor', icon: <LayoutGrid size={15} /> },
    { id: 'kds', label: 'Kitchen KDS', icon: <Utensils size={15} />, badge: kdsTickets.length },
    { id: 'cash_management', label: 'Cash & Drawers', icon: <CircleDollarSign size={15} /> },
    { id: 'po_receiving', label: 'PO Receiving', icon: <Truck size={15} /> },
  ];

  const backOfficeItems: { id: ModuleType; label: string; icon: React.ReactNode }[] = [
    { id: 'inventory_prep', label: 'Inventory & Prep', icon: <Boxes size={14} /> },
    { id: 'labor_shifts', label: 'Labor & Shifts', icon: <Users size={14} /> },
    { id: 'menu_catalog', label: 'Menu Catalog', icon: <BookOpen size={14} /> },
    { id: 'franchise_financials', label: 'Financials & GL', icon: <TrendingUp size={14} /> },
  ];

  const isBackOfficeActive = backOfficeItems.some((item) => item.id === activeModule);

  return (
    <header className="navbar">
      {/* Brand Section */}
      <div className="brand-section">
        <img src="/brand_logo.jpg" alt="Logo" className="logo-img" />
        <div>
          <div className="brand-title">RMS Store Console</div>
          <div className="brand-subtitle">STORE #104 CHICAGO WEST &bull; EDGE WAL</div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <nav className="module-nav">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeModule === tab.id ? 'active' : ''}`}
            onClick={() => setActiveModule(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="nav-badge">{tab.badge}</span>
            )}
          </button>
        ))}

        {/* Back Office Dropdown */}
        <div className="dropdown-container">
          <button
            className={`nav-tab ${isBackOfficeActive ? 'active' : ''}`}
            onClick={() => setBackOfficeOpen(!backOfficeOpen)}
          >
            <Boxes size={15} />
            <span>Back Office</span>
            <ChevronDown size={13} style={{ transform: backOfficeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {backOfficeOpen && (
            <div className="dropdown-menu">
              {backOfficeItems.map((item) => (
                <button
                  key={item.id}
                  className={`dropdown-item ${activeModule === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveModule(item.id);
                    setBackOfficeOpen(false);
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Right Controls & Telemetry */}
      <div className="navbar-right">
        <button
          className={`btn-utility ${trainingMode ? 'active' : ''}`}
          onClick={handleToggleTraining}
          title="Toggle Safe Training Mode"
        >
          <GraduationCap size={15} />
          <span>{trainingMode ? 'Training ON' : 'Training'}</span>
        </button>

        <button
          className="btn-utility"
          onClick={handleDownloadSupportBundle}
          title="Download Sanitized Support Bundle"
        >
          <Download size={14} />
          <span>Bundle</span>
        </button>

        <button
          className="btn-utility"
          onClick={handleRefresh}
          title="Refresh All Store Edge Data"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
        </button>

        {/* Telemetry Indicator */}
        <div className={`status-pill ${apiConnected ? 'online' : 'offline'}`}>
          {apiConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>{apiConnected ? 'EDGE ONLINE' : 'OFFLINE'}</span>
          {wsConnected && <span className="ws-dot" title="LAN WebSocket Connected" />}
        </div>
      </div>
    </header>
  );
};
