import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Pizza, Drumstick, UtensilsCrossed, Wine, LayoutGrid } from 'lucide-react';

export const CategoryChips: React.FC = () => {
  const { activeCategory, setActiveCategory } = useStore();

  const categories = [
    { id: 'ALL', label: 'All Items', icon: <LayoutGrid size={14} /> },
    { id: 'Pizzas', label: 'Pizzas', icon: <Pizza size={14} /> },
    { id: 'Appetizers', label: 'Appetizers', icon: <Drumstick size={14} /> },
    { id: 'Entrees', label: 'Entrees', icon: <UtensilsCrossed size={14} /> },
    { id: 'Beverages', label: 'Beverages', icon: <Wine size={14} /> },
  ];

  return (
    <div className="category-chips-rail">
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`category-chip ${activeCategory === cat.id ? 'active' : ''}`}
          onClick={() => setActiveCategory(cat.id)}
        >
          {cat.icon}
          <span>{cat.label}</span>
        </button>
      ))}
    </div>
  );
};
