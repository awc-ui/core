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
/*
 * THE FONTS, SELF-HOSTED.
 *
 * They used to be three `<link>` elements pointing at fonts.googleapis.com, which
 * an enterprise Content-Security-Policy refuses under `style-src 'self'` — a
 * blocked stylesheet means no `@font-face` at all, so every icon renders as its
 * ligature text ("chevron_right" spelled out) and the whole console falls back to
 * a system sans. Measured under the policy: three `style-src-elem` violations,
 * one per sheet.
 *
 * `material-symbols` ships the SAME variable font Google serves, axes intact —
 * verified rather than assumed, because the icons here depend on the FILL axis:
 * rendering `star` at `FILL 0` and `FILL 1` from this package changes the glyph's
 * ink from 13.1% to 20.4%, and `wght 100` to `wght 700` from 4.2% to 20.8%.
 *
 * ONLY THE OUTLINED CUT IS SELF-HOSTED, and that is a decision worth recording.
 * The kit's `app.css` asks for Rounded first, but never gets it: `tokens.css`
 * sets the same custom property on `:root` (0,1,0) and `app.css` sets it on
 * `html` (0,0,1), so the token wins on specificity no matter the load order.
 * Measured against the CDN, the Rounded sheet's woff2 was never fetched. Adding
 * it here would emit 4.9 MB of font nobody renders. If Rounded is wanted, the
 * fix is the selector in `app.css`, and this import follows it.
 */
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'material-symbols/outlined.css';
import '@awc-ui/core/css/tokens.css';
// The library's pre-upgrade size floors: every layout-critical `md-*` holds its
// settled box from the FIRST frame, before its lazy chunk arrives, and each
// rule self-retires on `.hydrated`. This replaces the hand-copied reservations
// app.css used to carry — the expressions now come from the components' own
// source at the library's build time, so they cannot drift.
import '@awc-ui/core/css/pre-upgrade.css';
import '@awc-ui/showcase-kit/social/app.css';
import { ShowcaseProvider } from '@/lib/showcase';
import { EngagementProvider } from '@/lib/engagement';
import { RouterProvider } from '@/lib/router';
import { AppFrame, ShellProvider } from '@/components/Shell';
import { App } from '@/App';

const container = document.getElementById('root');
if (!container) throw new Error('[showcase] #root is missing from index.html');

/*
 * `ShellProvider`, `EngagementProvider` AND `AppFrame` are all ABOVE the
 * router, for the same reason: `App` returns a different component per route,
 * so anything it renders is unmounted on every navigation. The shell provider
 * holds what the chrome remembers, the engagement provider holds what the
 * READER has done — a like has to survive opening the post you just liked —
 * and the frame holds the app bar and the rail themselves, which have to be
 * the SAME elements across a navigation or their transitions have nothing to
 * animate from.
 */
createRoot(container).render(
  <StrictMode>
    <ShowcaseProvider>
      <ShellProvider>
        <EngagementProvider>
          <RouterProvider>
            <AppFrame>
              <App />
            </AppFrame>
          </RouterProvider>
        </EngagementProvider>
      </ShellProvider>
    </ShowcaseProvider>
  </StrictMode>,
);
