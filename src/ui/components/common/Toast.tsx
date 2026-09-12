import React from 'react';
import { useStore } from '../../context/StoreContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle2 size={16} className="toast-icon" />}
          {toast.type === 'error' && <AlertCircle size={16} className="toast-icon" />}
          {toast.type === 'info' && <Info size={16} className="toast-icon" />}
          <span className="toast-text">{toast.text}</span>
        </div>
      ))}
    </div>
  );
};
