import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ModuleType,
  MenuItem,
  CartItem,
  RestaurantTable,
  KDSTicket,
  DrawerSession,
  PurchaseOrder,
  Supplier,
  StockLevel,
  SpoilageLog,
  Recipe,
  Employee,
  JournalEntry,
  StoreKPIs
} from '../types/ui-types';
import { StoreAPI } from '../services/api';

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextType {
  activeModule: ModuleType;
  setActiveModule: (mod: ModuleType) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  activeKdsStation: string;
  setActiveKdsStation: (station: string) => void;
  apiConnected: boolean;
  wsConnected: boolean;
  storeOffline: boolean;
  setStoreOffline: (offline: boolean) => void;

  menuItems: MenuItem[];
  cart: CartItem[];
  tables: RestaurantTable[];
  kdsTickets: KDSTicket[];
  drawerSession: DrawerSession;
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  stockLevels: StockLevel[];
  spoilageLogs: SpoilageLog[];
  recipes: Recipe[];
  employees: Employee[];
  journalEntries: JournalEntry[];
  kpis: StoreKPIs;
  tipPoolTotal: number;

  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;

  addToCart: (item: MenuItem, modifiers?: string[], modifiersCost?: number) => void;
  updateCartQty: (index: number, delta: number) => void;
  clearCart: () => void;
  checkoutCart: (paymentMethod: 'CASH' | 'CARD') => Promise<void>;
  quickCashCheckout: (amount: number) => Promise<void>;

  refreshData: () => Promise<void>;
  bumpKDSTicket: (id: string) => Promise<void>;
  seatTable: (tableId: string, covers: number, serverName: string) => Promise<void>;
  fireTable: (tableId: string, course: string) => Promise<void>;
  closeTable: (tableId: string) => Promise<void>;
  toggleClock: (employeeId: string, clockIn: boolean) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const initialMenuItems: MenuItem[] = [
  { id: 'item-101', sku: 'PIZ-PEP-LG', name: 'Large Pepperoni Pizza', category: 'Pizzas', basePrice: 18.99, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 3 },
  { id: 'item-102', sku: 'PIZ-MAR-LG', name: 'Margherita Artisanal', category: 'Pizzas', basePrice: 16.50, image: '/pepperoni_pizza.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: true, version: 2 },
  { id: 'item-103', sku: 'APP-WNG-10', name: 'Spicy Buffalo Wings (10pc)', category: 'Appetizers', basePrice: 14.99, image: '/buffalo_wings.jpg', allergens: [], isBrandLocked: false, version: 1 },
  { id: 'item-104', sku: 'APP-KNOT-6', name: 'Craft Garlic Knots (6pc)', category: 'Appetizers', basePrice: 6.99, image: '/garlic_knots.jpg', allergens: ['GLUTEN'], isBrandLocked: true, version: 4 },
  { id: 'item-105', sku: 'ENT-TRF-01', name: 'Gourmet Truffle Tagliatelle', category: 'Entrees', basePrice: 21.50, image: '/truffle_pasta_1786666085717.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: false, version: 1 },
  { id: 'item-106', sku: 'ENT-BGR-01', name: 'Smash Angus Cheeseburger', category: 'Entrees', basePrice: 14.99, image: '/cheeseburger_dish_1786666150656.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: false, version: 1 },
  { id: 'item-107', sku: 'BEV-COL-01', name: 'Artisanal Craft Cola 330ml', category: 'Beverages', basePrice: 3.50, image: '/pepperoni_pizza.jpg', allergens: [], isBrandLocked: false, version: 1 },
  { id: 'item-108', sku: 'ENT-TRF-02', name: 'Smash Truffle Burger', category: 'Entrees', basePrice: 16.99, image: '/truffle_pasta_1786666085717.jpg', allergens: ['DAIRY', 'GLUTEN'], isBrandLocked: false, version: 1 },
];

const initialTables: RestaurantTable[] = [
  { tableId: 'tbl-1', label: 'Table 1', seats: 2, section: 'Main Floor', status: 'VACANT' },
  { tableId: 'tbl-2', label: 'Table 2', seats: 4, section: 'Main Floor', status: 'SEATED', openTicketId: 'TKT-TBL-2-001', covers: 3, serverName: 'Sarah J.', seatedAt: '12:30 PM' },
  { tableId: 'tbl-3', label: 'Table 3', seats: 4, section: 'Main Floor', status: 'ORDERING', openTicketId: 'TKT-TBL-3-002', covers: 4, serverName: 'John D.', seatedAt: '12:45 PM' },
  { tableId: 'tbl-4', label: 'Table 4', seats: 6, section: 'Main Floor', status: 'SERVED', openTicketId: 'TKT-TBL-4-003', covers: 5, serverName: 'Michael S.', seatedAt: '12:15 PM' },
  { tableId: 'tbl-5', label: 'Table 5', seats: 2, section: 'Main Floor', status: 'VACANT' },
  { tableId: 'tbl-6', label: 'Table 6', seats: 8, section: 'Private Dining', status: 'VACANT' },
  { tableId: 'bar-1', label: 'Bar 1', seats: 1, section: 'Bar', status: 'VACANT' },
  { tableId: 'bar-2', label: 'Bar 2', seats: 1, section: 'Bar', status: 'VACANT' },
  { tableId: 'pat-1', label: 'Patio 1', seats: 4, section: 'Patio', status: 'VACANT' },
  { tableId: 'pat-2', label: 'Patio 2', seats: 4, section: 'Patio', status: 'VACANT' },
];

const initialKdsTickets: KDSTicket[] = [
  {
    id: 'tx-1001',
    source: 'POS Register 01',
    station: 'HOTLINE_1',
    elapsedMinutes: 3,
    elapsedSeconds: 24,
    diningType: 'DINE IN (Table 4)',
    items: [{ qty: 1, name: 'Large Pepperoni Pizza', modifiers: ['+ Extra Cheese', 'Well Done'], allergens: ['DAIRY', 'GLUTEN'] }],
    status: 'IN_PREP'
  },
  {
    id: 'deliv-dd-9812',
    source: 'DoorDash Aggregator',
    station: 'EXPO',
    elapsedMinutes: 8,
    elapsedSeconds: 45,
    diningType: 'DOORDASH DELIVERY',
    items: [{ qty: 2, name: 'Spicy Buffalo Wings (10pc)', modifiers: ['Ranch on Side', 'Extra Crispy'] }],
    status: 'READY'
  }
];

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<ModuleType>('pos_register');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [activeKdsStation, setActiveKdsStation] = useState<string>('ALL');
  const [apiConnected, setApiConnected] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [storeOffline, setStoreOffline] = useState<boolean>(false);

  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>(initialTables);
  const [kdsTickets, setKdsTickets] = useState<KDSTicket[]>(initialKdsTickets);
  const [drawerSession, setDrawerSession] = useState<DrawerSession>({
    sessionId: 'drawer-pos1-001',
    startingBankUSD: 200.0,
    cashSalesUSD: 350.0,
    cashDropsUSD: 100.0,
    payOutsUSD: 20.0,
    expectedCashUSD: 430.0,
    status: 'OPEN',
    activityLedger: [
      { timestamp: '11:00 AM', activityType: 'OPENING', amount: 200.0, witness: 'Manager Jane', notes: 'Standard opening shift float' },
      { timestamp: '01:30 PM', activityType: 'SAFE DROP', amount: 100.0, witness: 'Head Cashier Tom', notes: 'Surplus cash drop' },
      { timestamp: '03:15 PM', activityType: 'PAYOUT', amount: 20.0, witness: 'Manager Jane', notes: 'Emergency ice purchase' },
    ]
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([
    { poId: 'PO-STORE-104-001', supplierId: 'sup-001', supplierName: 'Mumbai Dairy Wholesalers Pvt. Ltd.', totalCostINR: 13000, status: 'SENT', createdAt: '2026-08-14', expectedDeliveryDate: '2026-08-18' },
    { poId: 'PO-STORE-104-002', supplierId: 'sup-002', supplierName: 'Delhi Grain & Flour Mills', totalCostINR: 2250, status: 'RECEIVED', createdAt: '2026-08-12', expectedDeliveryDate: '2026-08-13' },
  ]);

  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { supplierId: 'sup-001', name: 'Mumbai Dairy Wholesalers Pvt. Ltd.', phone: '+91-98201-11223', leadTimeDays: 2, paymentTermsDays: 30 },
    { supplierId: 'sup-002', name: 'Delhi Grain & Flour Mills', phone: '+91-99100-44556', leadTimeDays: 1, paymentTermsDays: 15 },
  ]);

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([
    { ingredientId: 'ing-cheese', name: 'Mozzarella Cheese (Shredded)', balance: 15.8, unit: 'kg' },
    { ingredientId: 'ing-pep', name: 'Pepperoni Slices (Beef/Pork)', balance: 8.6, unit: 'kg' },
    { ingredientId: 'ing-flour', name: 'High-Gluten Flour Batch', balance: 48.2, unit: 'kg' },
    { ingredientId: 'ing-sauce', name: 'Tomato Pizza Sauce', balance: 12.0, unit: 'kg' },
  ]);

  const [spoilageLogs, setSpoilageLogs] = useState<SpoilageLog[]>([
    { id: 'sp-1', date: '2026-08-14', item: 'Mozzarella Cheese', qty: '1.2 kg', reason: 'Dropped / Contaminated', costUSD: 14.40 },
    { id: 'sp-2', date: '2026-08-13', item: 'Pizza Dough Balls', qty: '5 units', reason: 'Overproofed / Dried', costUSD: 4.50 },
  ]);

  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: 'rcp-pep-lg',
      name: 'Large Pepperoni Pizza',
      targetYield: 1,
      ingredients: [
        { name: 'Flour Batch', qty: 0.35, unit: 'kg', cost: 0.45 },
        { name: 'Tomato Pizza Sauce', qty: 0.15, unit: 'kg', cost: 0.30 },
        { name: 'Mozzarella Cheese', qty: 0.25, unit: 'kg', cost: 2.10 },
        { name: 'Pepperoni Slices', qty: 0.12, unit: 'kg', cost: 1.50 },
      ]
    }
  ]);

  const [employees, setEmployees] = useState<Employee[]>([
    { id: 'emp-01', name: 'Alex Johnson', role: 'Head Chef', status: 'CLOCKED_IN', hourlyRateUSD: 24.50, shiftStart: '08:00 AM', hoursThisWeek: 32.5 },
    { id: 'emp-02', name: 'Maria Gomez', role: 'Line Cook', status: 'CLOCKED_IN', hourlyRateUSD: 18.00, shiftStart: '10:30 AM', hoursThisWeek: 28.0 },
    { id: 'emp-03', name: 'Sarah Jenkins', role: 'Lead Server', status: 'CLOCKED_IN', hourlyRateUSD: 14.00, shiftStart: '11:00 AM', hoursThisWeek: 22.5 },
    { id: 'emp-04', name: 'David Kim', role: 'Cashier / Host', status: 'CLOCKED_OUT', hourlyRateUSD: 15.50, hoursThisWeek: 16.0 },
  ]);

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([
    { id: 'gl-101', date: '2026-08-15', account: '4010 - Food & Beverage Revenue', debit: 0, credit: 5222.15, memo: 'Daily Sales Batch Close' },
    { id: 'gl-102', date: '2026-08-15', account: '2100 - Sales Tax Payable', debit: 0, credit: 274.85, memo: 'Daily Sales Tax' },
    { id: 'gl-103', date: '2026-08-15', account: '1010 - Operating Cash Drawer', debit: 5497.00, credit: 0, memo: 'Cash & Card Receipts' },
  ]);

  const [kpis, setKpis] = useState<StoreKPIs>({
    grossSalesUSD: 5497.0,
    netSalesUSD: 5222.15,
    taxCollectedUSD: 274.85,
    foodCostPct: 28.7,
    laborCostPct: 24.2,
    primeCostPct: 52.9
  });

  const [tipPoolTotal] = useState<number>(450.0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      await StoreAPI.checkHealth();
      setApiConnected(true);
    } catch {
      setApiConnected(false);
    }

    try {
      const menuData = await StoreAPI.getMenu();
      if (menuData?.success && menuData.menuItems?.length) setMenuItems(menuData.menuItems);
    } catch {}

    try {
      const tblData = await StoreAPI.getTables();
      if (tblData?.success && tblData.tables?.length) setTables(tblData.tables);
    } catch {}

    try {
      const kdsData = await StoreAPI.getKDSTickets();
      if (kdsData?.success && kdsData.tickets) setKdsTickets(kdsData.tickets);
    } catch {}

    try {
      const drawerData = await StoreAPI.getDrawer();
      if (drawerData?.success && drawerData.drawerSession) {
        setDrawerSession({
          sessionId: drawerData.drawerSession.sessionId,
          startingBankUSD: (drawerData.drawerSession.startingBankINR || 20000) / 100,
          cashSalesUSD: (drawerData.drawerSession.cashSalesINR || 35000) / 100,
          cashDropsUSD: (drawerData.drawerSession.cashDropsINR || 10000) / 100,
          payOutsUSD: (drawerData.drawerSession.payOutsINR || 2000) / 100,
          expectedCashUSD: (drawerData.drawerSession.expectedCashINR || 43000) / 100,
          status: drawerData.drawerSession.status || 'OPEN',
          activityLedger: drawerData.drawerSession.activityLedger || [],
        });
      }
    } catch {}

    try {
      const poData = await StoreAPI.getPurchaseOrders();
      if (poData?.success && poData.purchaseOrders) setPurchaseOrders(poData.purchaseOrders);

      const supData = await StoreAPI.getSuppliers();
      if (supData?.success && supData.suppliers) setSuppliers(supData.suppliers);

      const stkData = await StoreAPI.getStock();
      if (stkData?.success && stkData.stockLevels) setStockLevels(stkData.stockLevels);

      const wstData = await StoreAPI.getWasteLogs();
      if (wstData?.success && wstData.spoilageLogs) setSpoilageLogs(wstData.spoilageLogs);

      const rcpData = await StoreAPI.getRecipes();
      if (rcpData?.success && rcpData.recipes) setRecipes(rcpData.recipes);
    } catch {}

    try {
      const lbrData = await StoreAPI.getLabor();
      if (lbrData?.success && lbrData.employees) setEmployees(lbrData.employees);
    } catch {}

    try {
      const finData = await StoreAPI.getFinancials();
      if (finData?.success) {
        if (finData.journalEntries) setJournalEntries(finData.journalEntries);
        if (finData.kpis) setKpis(finData.kpis);
      }
    } catch {}
  }, []);

  // Initial fetch and WebSocket listener
  useEffect(() => {
    refreshData();

    let ws: WebSocket | null = null;
    try {
      const wsHost = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? window.location.hostname
        : '127.0.0.1';
      ws = new WebSocket(`ws://${wsHost}:3001`);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => setWsConnected(false);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'KDS_NEW_TICKET' && data.ticket) {
            setKdsTickets((prev) => [data.ticket, ...prev]);
            showToast(`New ticket: ${data.ticket.id}`, 'info');
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [refreshData, showToast]);

  // Local 1-second ticker for active KDS tickets
  useEffect(() => {
    const timer = setInterval(() => {
      setKdsTickets((prev) =>
        prev.map((t) => {
          let s = (t.elapsedSeconds || 0) + 1;
          let m = t.elapsedMinutes || 0;
          let status = t.status;
          if (s >= 60) {
            s = 0;
            m += 1;
          }
          if (m >= 10 && status === 'IN_PREP') {
            status = 'LATE';
          }
          return { ...t, elapsedSeconds: s, elapsedMinutes: m, status };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cart operations
  const addToCart = useCallback((item: MenuItem, modifiers: string[] = [], modifiersCost = 0) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (ci) => ci.id === item.id && (ci.modifiers || []).join(',') === modifiers.join(',')
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: updated[existingIdx].qty + 1
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          basePrice: item.basePrice,
          category: item.category,
          qty: 1,
          modifiers,
          modifiersCost
        }
      ];
    });
    showToast(`Added ${item.name}`, 'info');
  }, [showToast]);

  const updateCartQty = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const item = prev[index];
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const updated = [...prev];
      updated[index] = { ...item, qty: newQty };
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const checkoutCart = useCallback(async (paymentMethod: 'CASH' | 'CARD') => {
    if (cart.length === 0) return;
    const subtotal = cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    try {
      const res = await StoreAPI.checkout({
        items: cart,
        subtotalUSD: subtotal,
        taxUSD: tax,
        totalUSD: total,
        paymentMethod
      });
      if (res?.success) {
        showToast(`Order #${res.orderId || 'SUCCESS'} paid via ${paymentMethod}!`, 'success');
        setCart([]);
        refreshData();
      } else {
        showToast('Checkout failed. Check edge node logs.', 'error');
      }
    } catch {
      showToast(`Processed offline ${paymentMethod} transaction ($${total.toFixed(2)})`, 'success');
      setCart([]);
    }
  }, [cart, showToast, refreshData]);

  const quickCashCheckout = useCallback(async (amount: number) => {
    const subtotal = cart.reduce((sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty, 0);
    const total = subtotal * 1.08;
    const change = Math.max(0, amount - total);
    await checkoutCart('CASH');
    if (change > 0) {
      showToast(`Change Due: $${change.toFixed(2)}`, 'info');
    }
  }, [cart, checkoutCart, showToast]);

  const bumpKDSTicket = useCallback(async (id: string) => {
    try {
      await StoreAPI.bumpTicket(id);
    } catch {}
    setKdsTickets((prev) => prev.filter((t) => t.id !== id));
    showToast(`Bumped ticket #${id}`, 'success');
  }, [showToast]);

  const seatTable = useCallback(async (tableId: string, covers: number, serverName: string) => {
    try {
      await StoreAPI.seatTable({ tableId, covers, serverName });
    } catch {}
    setTables((prev) =>
      prev.map((t) => (t.tableId === tableId ? { ...t, status: 'SEATED', covers, serverName } : t))
    );
    showToast(`Table ${tableId} seated`, 'success');
  }, [showToast]);

  const fireTable = useCallback(async (tableId: string, course: string) => {
    try {
      await StoreAPI.fireTable({ tableId, course });
    } catch {}
    setTables((prev) =>
      prev.map((t) => (t.tableId === tableId ? { ...t, status: 'ORDERING' } : t))
    );
    showToast(`Fired ${course} for table ${tableId}`, 'info');
  }, [showToast]);

  const closeTable = useCallback(async (tableId: string) => {
    try {
      await StoreAPI.closeTable({ tableId });
    } catch {}
    setTables((prev) =>
      prev.map((t) => (t.tableId === tableId ? { ...t, status: 'VACANT', openTicketId: undefined, covers: undefined } : t))
    );
    showToast(`Closed table ${tableId}`, 'success');
  }, [showToast]);

  const toggleClock = useCallback(async (employeeId: string, clockIn: boolean) => {
    try {
      await StoreAPI.toggleClock(employeeId, clockIn);
    } catch {}
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === employeeId ? { ...e, status: clockIn ? 'CLOCKED_IN' : 'CLOCKED_OUT' } : e
      )
    );
    showToast(`${clockIn ? 'Clocked in' : 'Clocked out'} successfully`, 'success');
  }, [showToast]);

  return (
    <StoreContext.Provider
      value={{
        activeModule,
        setActiveModule,
        activeCategory,
        setActiveCategory,
        activeKdsStation,
        setActiveKdsStation,
        apiConnected,
        wsConnected,
        storeOffline,
        setStoreOffline,
        menuItems,
        cart,
        tables,
        kdsTickets,
        drawerSession,
        purchaseOrders,
        suppliers,
        stockLevels,
        spoilageLogs,
        recipes,
        employees,
        journalEntries,
        kpis,
        tipPoolTotal,
        toasts,
        showToast,
        addToCart,
        updateCartQty,
        clearCart,
        checkoutCart,
        quickCashCheckout,
        refreshData,
        bumpKDSTicket,
        seatTable,
        fireTable,
        closeTable,
        toggleClock
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
