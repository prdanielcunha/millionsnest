import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.js';
import './index.css';

// Emergency Service Worker unregistration to prevent caching loops and stale PWA assets
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch((err) => {
    console.error('SW Unregistration error:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
