import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Trash2, Plus, Minus, CreditCard, Banknote, Utensils, AlertCircle } from 'lucide-react';

export const CartSidebar: React.FC = () => {
  const {
    cart,
    updateCartQty,
    clearCart,
    checkoutCart,
    quickCashCheckout,
    menuItems,
    addToCart,
    setActiveModule
  } = useStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastChangeDue, setLastChangeDue] = useState<number | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Clear the change due banner when a new item is added to cart
  useEffect(() => {
    if (cart.length > 0 && lastChangeDue !== null) {
      setLastChangeDue(null);
    }
  }, [cart.length]);

  const subtotal = cart.reduce(
    (sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty,
    0
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const nextDollar = Math.ceil(total);

  const handleQuickAddFirst = () => {
    if (menuItems.length > 0) {
      addToCart(menuItems[0]);
    }
  };

  const handleQuickCash = async (tendered: number) => {
    if (tendered < total) return;
    setIsCheckingOut(true);
    const change = Math.max(0, tendered - total);
    try {
      await quickCashCheckout(tendered);
      setLastChangeDue(change);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCheckout = async (method: 'CARD' | 'CASH') => {
    setIsCheckingOut(true);
    try {
      await checkoutCart(method);
      if (method === 'CASH') {
        setLastChangeDue(0);
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <aside className="cart-sidebar-docked">
      {/* Fixed Ticket Header */}
      <div className="cart-header-fixed">
        <div>
          <h3 className="cart-header-title">Current Ticket</h3>
          <span className="cart-header-subtitle">Dine In &bull; Terminal 01</span>
        </div>
        {!showClearConfirm ? (
          <button
            className="btn-clear-cart"
            disabled={cart.length === 0}
            onClick={() => setShowClearConfirm(true)}
            title="Clear Ticket"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        ) : (
          <div className="confirm-clear-box">
            <span className="confirm-clear-text">Clear {cart.length} item{cart.length > 1 ? 's' : ''}?</span>
            <div className="confirm-clear-actions">
              <button
                className="btn-confirm-yes"
                onClick={() => {
                  clearCart();
                  setShowClearConfirm(false);
                }}
              >
                Yes
              </button>
              <button
                className="btn-confirm-no"
                onClick={() => setShowClearConfirm(false)}
              >
                No
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Ticket Items */}
      <div className="cart-items-scroll">
        {cart.length === 0 ? (
          <div className="empty-cart-view">
            <div className="empty-cart-icon">
              <Utensils size={28} />
            </div>
            <div className="empty-cart-title">Ticket is empty</div>
            <div className="empty-cart-desc">Tap any dish on the left to add items to this order.</div>
            <div className="empty-cart-actions">
              <button
                className="btn-empty-quick"
                onClick={() => setActiveModule('table_floor_plan')}
              >
                Table Floor Plan
              </button>
              <button
                className="btn-empty-quick highlight"
                onClick={handleQuickAddFirst}
              >
                + Quick Item
              </button>
            </div>
          </div>
        ) : (
          cart.map((item, index) => {
            const lineItemPrice = (item.basePrice + (item.modifiersCost || 0)) * item.qty;
            return (
              <div key={`${item.id}-${index}`} className="cart-item-row">
                <div className="cart-item-main">
                  <span className="cart-item-title">{item.name}</span>
                  <span className="cart-item-price">${lineItemPrice.toFixed(2)}</span>
                </div>

                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="cart-item-modifiers">
                    {item.modifiers.join(', ')}
                  </div>
                )}

                <div className="cart-item-controls">
                  <div className="qty-control">
                    <button
                      className="qty-btn"
                      onClick={() => updateCartQty(index, -1)}
                      title="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="qty-val">{item.qty}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateCartQty(index, 1)}
                      title="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="unit-price-tag">
                    ${(item.basePrice + (item.modifiersCost || 0)).toFixed(2)} ea
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pinned Bottom Controls (Always Visible on Any Screen Height) */}
      <div className="cart-footer-pinned">
        {/* Persistent Change Due Banner */}
        {lastChangeDue !== null && (
          <div className="change-due-banner">
            <div>
              <div className="change-due-label">Cash Tendered &bull; Change Due</div>
              <div className="change-due-amount">${lastChangeDue.toFixed(2)}</div>
            </div>
            <button
              className="btn-clear-cart"
              onClick={() => setLastChangeDue(null)}
              title="Dismiss change due notice"
            >
              <span>Dismiss</span>
            </button>
          </div>
        )}

        {/* Quick Cash Tender Bar */}
        <div className="quick-cash-bar">
          <div className="quick-cash-title">Quick Cash Tender</div>
          <div className="quick-cash-buttons">
            <button
              className="btn-cash-quick exact"
              disabled={cart.length === 0 || isCheckingOut}
              onClick={() => handleQuickCash(total)}
            >
              Exact
            </button>
            {nextDollar > total && (
              <button
                className="btn-cash-quick"
                disabled={cart.length === 0 || isCheckingOut}
                onClick={() => handleQuickCash(nextDollar)}
              >
                ${nextDollar}
              </button>
            )}
            <button
              className="btn-cash-quick"
              disabled={cart.length === 0 || total > 20 || isCheckingOut}
              onClick={() => handleQuickCash(20)}
            >
              $20
            </button>
            <button
              className="btn-cash-quick"
              disabled={cart.length === 0 || total > 50 || isCheckingOut}
              onClick={() => handleQuickCash(50)}
            >
              $50
            </button>
            <button
              className="btn-cash-quick"
              disabled={cart.length === 0 || total > 100 || isCheckingOut}
              onClick={() => handleQuickCash(100)}
            >
              $100
            </button>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="cart-totals-summary">
          <div className="totals-row">
            <span>Subtotal</span>
            <span className="totals-val">${subtotal.toFixed(2)}</span>
          </div>
          <div className="totals-row">
            <span>Sales Tax (8%)</span>
            <span className="totals-val">${tax.toFixed(2)}</span>
          </div>
          <div className="totals-row total-due">
            <span>Total Due</span>
            <span className="totals-highlight">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Checkout Actions */}
        <div className="checkout-actions-grid">
          <button
            className={`btn-checkout btn-charge ${isCheckingOut ? 'btn-loading' : ''}`}
            disabled={cart.length === 0 || isCheckingOut}
            onClick={() => handleCheckout('CARD')}
          >
            {isCheckingOut ? <span className="spin-loader" /> : <CreditCard size={18} />}
            <span>{isCheckingOut ? 'Authorizing...' : 'Charge Card'}</span>
          </button>
          <button
            className={`btn-checkout btn-cash ${isCheckingOut ? 'btn-loading' : ''}`}
            disabled={cart.length === 0 || isCheckingOut}
            onClick={() => handleCheckout('CASH')}
          >
            {isCheckingOut ? <span className="spin-loader" /> : <Banknote size={18} />}
            <span>{isCheckingOut ? 'Tendering...' : 'Cash Tender'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
