import React from 'react';
import { useStore } from './context/StoreContext';
import { Navbar } from './components/common/Navbar';
import { ToastContainer } from './components/common/Toast';
import { PosRegister } from './components/pos/PosRegister';
import { FloorPlan } from './components/floor/FloorPlan';
import { KitchenDisplay } from './components/kds/KitchenDisplay';
import { CashDrawer } from './components/cash/CashDrawer';
import { PoReceiving } from './components/inventory/PoReceiving';
import { InventoryView } from './components/inventory/InventoryView';
import { LaborShifts } from './components/labor/LaborShifts';
import { MenuCatalog } from './components/menu/MenuCatalog';
import { FinancialsView } from './components/financials/FinancialsView';

export const AppContent: React.FC = () => {
  const { activeModule } = useStore();

  const renderActiveWorkspace = () => {
    switch (activeModule) {
      case 'pos_register':
        return <PosRegister />;
      case 'table_floor_plan':
        return <FloorPlan />;
      case 'kds':
        return <KitchenDisplay />;
      case 'cash_management':
        return <CashDrawer />;
      case 'po_receiving':
        return <PoReceiving />;
      case 'inventory_prep':
        return <InventoryView />;
      case 'labor_shifts':
        return <LaborShifts />;
      case 'menu_catalog':
        return <MenuCatalog />;
      case 'franchise_financials':
        return <FinancialsView />;
      default:
        return <PosRegister />;
    }
  };

  return (
    <div className="app-shell">
      {/* 48px Header */}
      <Navbar />

      {/* Main Viewport */}
      <main className="main-viewport">
        {renderActiveWorkspace()}
      </main>

      {/* Non-blocking Toasts */}
      <ToastContainer />
    </div>
  );
};
