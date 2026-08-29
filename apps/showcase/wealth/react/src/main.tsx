/**
 * The single entry point. One HTML document, one JS graph, routing in the
 * browser — that is the whole claim this build makes.
 *
 * Everything that had to be in `<head>` is literal markup in `index.html`,
 * because there is no server to compose it: the preboot IIFE, the reporting-date
 * meta, the fonts, and the script that loads Stencil's lazy runtime from an
 * absolute URL. `vite.config.ts` interpolates the values that come from the kit
 * so `index.html` stays a template and not a second copy of the dictionary. The
 * ordering rationale is in `index.html` itself.
 *
 * The two stylesheets stay in the module graph — they are the one thing that
 * SHOULD go through the bundler. Vite emits them as a `<link>` in `<head>` at
 * build time, so they are still render-blocking stylesheets rather than a flash
 * of unstyled content injected by JS.
 *
 * STRICT MODE is on. The double-invoked effects are development-only and every
 * effect here is idempotent: `useElementProps` assigns the same object twice,
 * `useCustomEvent` and `useDomEvent` remove their listener before re-adding it,
 * and `subscribeShowcaseState` returns its own unsubscribe.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@awc-ui/core/css/tokens.css';
// The library's pre-upgrade size floors: every layout-critical `md-*` holds its
// settled box from the FIRST frame, before its lazy chunk arrives, and each
// rule self-retires on `.hydrated`. This replaces the hand-copied reservations
// app.css used to carry — the expressions now come from the components' own
// source at the library's build time, so they cannot drift.
import '@awc-ui/core/css/pre-upgrade.css';
import '@awc-ui/showcase-kit/wealth/app.css';
import { ShowcaseProvider } from '@/lib/showcase';
import { RouterProvider } from '@/lib/router';
import { AppFrame, ShellProvider } from '@/components/Shell';
import { App } from '@/App';

const container = document.getElementById('root');
if (!container) throw new Error('[showcase] #root is missing from index.html');

/*
 * `ShellProvider` AND `AppFrame` are both ABOVE the router, for the same
 * reason: `App` returns a different component per route, so anything it renders
 * is unmounted on every navigation. The provider holds what the shell
 * remembers; the frame holds the app bar and the rail themselves, which have to
 * be the SAME elements across a navigation or their transitions have nothing to
 * animate from.
 */
createRoot(container).render(
  <StrictMode>
    <ShowcaseProvider>
      <ShellProvider>
        <RouterProvider>
          <AppFrame>
            <App />
          </AppFrame>
        </RouterProvider>
      </ShellProvider>
    </ShowcaseProvider>
  </StrictMode>,
);
