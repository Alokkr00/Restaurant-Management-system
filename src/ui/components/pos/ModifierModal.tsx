import React, { useState } from 'react';
import { MenuItem } from '../../types/ui-types';
import { useStore } from '../../context/StoreContext';
import { X, Check } from 'lucide-react';

interface ModifierModalProps {
  item: MenuItem;
  onClose: () => void;
}

export const ModifierModal: React.FC<ModifierModalProps> = ({ item, onClose }) => {
  const { addToCart } = useStore();

  const availableModifiers = [
    { name: 'Extra Cheese', price: 1.50 },
    { name: 'Gluten-Free Crust', price: 2.50 },
    { name: 'Truffle Oil Drizzle', price: 2.00 },
    { name: 'Spicy Jalapeños', price: 0.75 },
    { name: 'Well Done / Crispy', price: 0.00 },
    { name: 'Sauce on Side', price: 0.00 }
  ];

  const [selectedModifiers, setSelectedModifiers] = useState<string[]>([]);

  const toggleModifier = (modName: string) => {
    setSelectedModifiers((prev) =>
      prev.includes(modName) ? prev.filter((m) => m !== modName) : [...prev, modName]
    );
  };

  const modifiersCost = selectedModifiers.reduce((sum, name) => {
    const mod = availableModifiers.find((m) => m.name === name);
    return sum + (mod ? mod.price : 0);
  }, 0);

  const totalPrice = item.basePrice + modifiersCost;

  const handleConfirm = () => {
    addToCart(item, selectedModifiers, modifiersCost);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Customize: {item.name}</h3>
            <span className="modal-subtitle">Select toppings, kitchen notes & modifiers</span>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="modifiers-grid">
            {availableModifiers.map((mod) => {
              const isSelected = selectedModifiers.includes(mod.name);
              return (
                <button
                  key={mod.name}
                  className={`modifier-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleModifier(mod.name)}
                >
                  <div className="modifier-chip-icon">
                    {isSelected && <Check size={14} />}
                  </div>
                  <div className="modifier-chip-label">
                    <span className="mod-name">{mod.name}</span>
                    <span className="mod-price">{mod.price > 0 ? `+$${mod.price.toFixed(2)}` : 'Free'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-price-tag">
            <span>Total:</span>
            <strong>${totalPrice.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleConfirm}>
              Add to Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
