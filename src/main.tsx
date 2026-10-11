import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const container = document.getElementById('root')!;

// Prevent React error #426 (createRoot called multiple times on the same container during HMR/reloads)
if (!(container as any).__react_root) {
  (container as any).__react_root = createRoot(container);
}

(container as any).__react_root.render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Terjadi Kesalahan Sistem SI-KEPLING">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
