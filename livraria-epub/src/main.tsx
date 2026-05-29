import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: Registra o Service Worker para suporte offline e instalabilidade
if ('serviceWorker' in navigator) {
  const isDev = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.hostname.includes('ais-dev') || 
                window.location.hostname.includes('.run.app'); // Development/Sandbox env in Cloud Run

  if (isDev) {
    // Proactively unregister any active service workers in development to clear stale cache
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('[PWA] Service Worker desregistrado preventivamente em desenvolvimento.');
          }
        });
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registrado no escopo:', registration.scope);
        })
        .catch((error) => {
          console.error('[PWA] Falha ao registrar Service Worker:', error);
        });
    });
  }
}
