import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@awc-ui/core/loader';
import '@awc-ui/tokens/tokens.css';
import 'material-icons/iconfont/material-icons.css';
import 'material-symbols/outlined.css';
import App from './App';

defineCustomElements(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
