import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { BookOpen, Plus, Lock, Check, Ban, X } from 'lucide-react';
import { StoreAPI } from '../../services/api';

export const MenuCatalog: React.FC = () => {
  const { menuItems, showToast, refreshData } = useStore();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Pizzas');
  const [basePrice, setBasePrice] = useState('14.99');

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(basePrice);
    try {
      await StoreAPI.addMenuItem({
        id: `item-${Date.now().toString().slice(-4)}`,
        sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
        name,
        category,
        basePrice: isNaN(price) ? 12.99 : price,
        image: '/pepperoni_pizza.jpg',
        allergens: []
      });
      showToast(`Added ${name} to store menu catalog`, 'success');
      setAddModalOpen(false);
      setName('');
      setSku('');
      refreshData();
    } catch {
      showToast('Failed to add menu item', 'error');
    }
  };

  return (
    <div className="workspace-container">
      {/* Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Master Menu Catalog & 86 Item Management</h2>
          <p className="workspace-subtitle">Corporate brand standards, local pricing & real-time 86 stock status</p>
        </div>

        <button className="btn-primary" onClick={() => setAddModalOpen(true)}>
          <Plus size={14} />
          <span>Add Menu Item</span>
        </button>
      </div>

      {/* Menu Table */}
      <div className="table-wrapper-card">
        <div className="table-header-title">
          <BookOpen size={16} />
          <span>Store Menu Items & 86 Toggle Rail</span>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item SKU</th>
                <th>Dish Name</th>
                <th>Category</th>
                <th>Base Price</th>
                <th>Brand Lock</th>
                <th>Allergens</th>
                <th>86 Status (Click to Toggle)</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item) => {
                const isAvailable = item.isAvailable !== false;
                return (
                  <tr key={item.id}>
                    <td className="font-mono font-bold">{item.sku}</td>
                    <td>
                      <div className="font-bold">{item.name}</div>
                    </td>
                    <td>{item.category}</td>
                    <td className="font-mono font-bold">${item.basePrice.toFixed(2)}</td>
                    <td>
                      {item.isBrandLocked ? (
                        <span className="badge badge-locked">
                          <Lock size={11} />
                          <span>HQ LOCKED</span>
                        </span>
                      ) : (
                        <span className="badge badge-offline">STORE EDITABLE</span>
                      )}
                    </td>
                    <td>
                      {item.allergens && item.allergens.length > 0 ? (
                        <div className="flex gap-1">
                          {item.allergens.map((a, ai) => (
                            <span key={ai} className="badge badge-warning text-xs">{a}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted text-xs">None</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`btn-table-action ${isAvailable ? 'btn-available' : 'btn-86ed'}`}
                        onClick={() => {
                          item.isAvailable = !isAvailable;
                          showToast(`${item.name} marked as ${!isAvailable ? 'AVAILABLE' : '86 OUT OF STOCK'}`, 'info');
                          refreshData();
                        }}
                      >
                        {isAvailable ? (
                          <>
                            <Check size={13} />
                            <span>AVAILABLE</span>
                          </>
                        ) : (
                          <>
                            <Ban size={13} />
                            <span>86 OUT OF STOCK</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Add Menu Item</h3>
                <span className="modal-subtitle">Register a new dish in the local store catalog</span>
              </div>
              <button className="btn-close" onClick={() => setAddModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Dish Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Artisanal Garlic Bread"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input
                    type="text"
                    className="form-input"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. APP-GAR-01"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Pizzas">Pizzas</option>
                    <option value="Appetizers">Appetizers</option>
                    <option value="Entrees">Entrees</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Base Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
