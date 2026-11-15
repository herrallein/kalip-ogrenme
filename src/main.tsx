import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

try {
  void navigator.storage?.persist?.();
} catch {
  /* yoksay */
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Yeni servis çalışanı devralınca sayfayı bir kez yenile (ilk kurulumda yenileme yok).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* çevrimdışı olmadan da çalışır */ });
  });
}
