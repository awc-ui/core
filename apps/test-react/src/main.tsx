import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@awc-ui/core/loader';
import { activateDeferredFontStylesheet } from '../../shared/deferred-fonts';
import App from './App';

activateDeferredFontStylesheet();
defineCustomElements(window);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
