import React from 'react';
import ReactDOM from 'react-dom/client';
import { StoreProvider } from './context/StoreContext';
import { AppContent } from './App';
import './index.css';

const rootElement = document.getElementById('app');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <StoreProvider>
        <AppContent />
      </StoreProvider>
    </React.StrictMode>
  );
}
