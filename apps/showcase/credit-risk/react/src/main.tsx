/**
 * The single entry point. One HTML document, one JS graph, routing in the
 * browser — that is the whole claim this build exists to make.
 *
 * WHAT `app/layout.tsx` USED TO DO, AND WHERE IT WENT
 *
 * Everything that had to be in `<head>` is now literal markup in `index.html`,
 * because there is no server to compose it: the preboot IIFE, the reporting-date
 * meta, the fonts, and the `<script type="module">` that loads Stencil's lazy
 * runtime from an absolute URL. `vite.config.ts` interpolates the values that
 * come from the kit so `index.html` stays a template and not a second copy of
 * the dictionary. The ordering rationale is in `index.html` itself.
 *
 * The two stylesheets stayed in the module graph — they are the one thing that
 * SHOULD go through the bundler, exactly as before. Vite emits them as a
 * `<link>` in `<head>` at build time, so they are still render-blocking
 * stylesheets rather than a flash of unstyled content injected by JS.
 *
 * STRICT MODE matches `reactStrictMode: true` in the build it was ported from.
 * The double-invoked effects are development-only and every effect here is
 * idempotent: `useElementProps` assigns the same object twice, `useCustomEvent`
 * removes its listener before re-adding it, and `subscribeShowcaseState`
 * returns its own unsubscribe.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@awc-ui/core/css/tokens.css';
import '@awc-ui/showcase-kit/credit-risk/app.css';
import { ShowcaseProvider } from '@/lib/showcase';
import { RouterProvider } from '@/lib/router';
import { App } from '@/App';

const container = document.getElementById('root');
if (!container) throw new Error('[showcase] #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ShowcaseProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </ShowcaseProvider>
  </StrictMode>,
);
