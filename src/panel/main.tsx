import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './panel.css';
import { registerServiceWorker } from '../shared/offline';
import { App } from './App';

registerServiceWorker();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
