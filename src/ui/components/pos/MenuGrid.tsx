import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { MenuItem } from '../../types/ui-types';
import { Plus, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { ModifierModal } from './ModifierModal';

export const MenuGrid: React.FC = () => {
  const { menuItems, activeCategory, addToCart } = useStore();
  const [selectedItemForModifier, setSelectedItemForModifier] = useState<MenuItem | null>(null);

  const filteredItems = activeCategory === 'ALL'
    ? menuItems
    : menuItems.filter((i) => i.category === activeCategory);

  return (
    <>
      <div className="menu-grid-scroll">
        {filteredItems.map((item) => {
          const is86 = item.isAvailable === false;
          return (
            <div key={item.id} className={`pos-card ${is86 ? 'pos-card-disabled' : ''}`}>
              {/* Image Preview & Quick Tap */}
              <div
                className="pos-card-img-wrapper"
                onClick={() => !is86 && addToCart(item)}
                title={is86 ? 'Item is 86ed out of stock' : 'Tap to quick add to ticket'}
              >
                <img src={item.image} alt={item.name} className="pos-card-img" />
                {is86 && (
                  <div className="card-86-overlay">
                    <AlertTriangle size={16} />
                    <span>86 OUT OF STOCK</span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="pos-card-body">
                <div>
                  <div className="pos-card-title">{item.name}</div>
                  <div className="pos-card-meta">{item.category} &bull; {item.sku}</div>
                </div>

                {/* Footer with Price and Touch Controls */}
                <div className="pos-card-footer">
                  <span className="pos-card-price">${item.basePrice.toFixed(2)}</span>
                  <div className="tile-actions">
                    <button
                      className="btn-add-quick"
                      disabled={is86}
                      onClick={() => addToCart(item)}
                      title="Quick Add to Ticket"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                    <button
                      className="btn-customize-tile"
                      disabled={is86}
                      onClick={() => setSelectedItemForModifier(item)}
                      title="Customize Toppings & Modifiers"
                    >
                      <SlidersHorizontal size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedItemForModifier && (
        <ModifierModal
          item={selectedItemForModifier}
          onClose={() => setSelectedItemForModifier(null)}
        />
      )}
    </>
  );
};
