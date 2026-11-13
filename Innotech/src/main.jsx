import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL })
    .catch((error) => {
      console.error('AHMS offline app shell could not be registered:', error);
      window.dispatchEvent(new CustomEvent('ahms:offline-error', {
        detail: 'Não foi possível preparar a aplicação para utilização offline.',
      }));
    });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
