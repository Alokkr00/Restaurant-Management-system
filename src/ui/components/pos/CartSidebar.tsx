import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Trash2, Plus, Minus, CreditCard, Banknote, Utensils } from 'lucide-react';

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

  const subtotal = cart.reduce(
    (sum, item) => sum + (item.basePrice + (item.modifiersCost || 0)) * item.qty,
    0
  );
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const handleQuickAddFirst = () => {
    if (menuItems.length > 0) {
      addToCart(menuItems[0]);
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
        <button
          className="btn-clear-cart"
          disabled={cart.length === 0}
          onClick={clearCart}
          title="Clear Ticket"
        >
          <Trash2 size={13} />
          <span>Clear</span>
        </button>
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
        {/* Quick Cash Tender Bar */}
        <div className="quick-cash-bar">
          <div className="quick-cash-title">Quick Cash Tender</div>
          <div className="quick-cash-buttons">
            <button
              className="btn-cash-quick"
              disabled={cart.length === 0 || total > 10}
              onClick={() => quickCashCheckout(10)}
            >
              $10
            </button>
            <button
              className="btn-cash-quick"
              disabled={cart.length === 0 || total > 20}
              onClick={() => quickCashCheckout(20)}
            >
              $20
            </button>
            <button
              className="btn-cash-quick"
              disabled={cart.length === 0 || total > 50}
              onClick={() => quickCashCheckout(50)}
            >
              $50
            </button>
            <button
              className="btn-cash-quick exact"
              disabled={cart.length === 0}
              onClick={() => quickCashCheckout(total)}
            >
              Exact
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
            className="btn-checkout btn-charge"
            disabled={cart.length === 0}
            onClick={() => checkoutCart('CARD')}
          >
            <CreditCard size={15} />
            <span>Charge Card</span>
          </button>
          <button
            className="btn-checkout btn-cash"
            disabled={cart.length === 0}
            onClick={() => checkoutCart('CASH')}
          >
            <Banknote size={15} />
            <span>Cash Tender</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
