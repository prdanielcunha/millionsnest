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
    <App />
);

window.onerror = function(message, source, lineno, colno, error) {
  console.error("GLOBAL_ERROR_TRAP:", { message, source, lineno, colno, error });
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  // Aprimorando o log para capturar o stack trace se for um Error object
  const reason = event.reason;
  console.error("GLOBAL_PROMISE_REJECTION (detalhes):", {
    reason,
    message: reason instanceof Error ? reason.message : 'Sem mensagem',
    stack: reason instanceof Error ? reason.stack : 'Sem stack trace'
  });
});
