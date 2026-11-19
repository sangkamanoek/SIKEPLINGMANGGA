import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

if (typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((reg) => {
          reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  }
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((k) => {
          if (k.startsWith('si-mangga-cache-') && k !== 'si-mangga-cache-v8') {
            caches.delete(k).catch(() => {});
          }
        });
      })
      .catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
