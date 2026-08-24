/**
 * Root layout — a Server Component. Three things have to be in `<head>`, in
 * this order, and only one of them is a Next concern.
 *
 * 1. THE PREBOOT SCRIPT, first. 791 bytes of synchronous IIFE that reads the
 *    showcase state from the URL (or localStorage) and stamps `lang`, `dir`,
 *    `data-theme` and `data-density` onto <html> before the first paint. Put
 *    after a stylesheet it still runs before paint, but the browser blocks it on
 *    the CSS download first — so it goes first. It does NOT apply the accent
 *    preset; that is ~2.8 kB of palette per seed and would blow the preboot
 *    budget, so `import '@awc-ui/showcase-kit/dock'` injects it a moment later.
 *    A non-default accent therefore has a brief default-violet frame on a cold
 *    load. Documented trade, made in the kit.
 *
 * 2. THE FONTS. The components render Material Symbols glyphs inside their own
 *    shadow roots. Font registration crosses shadow boundaries; class rules do
 *    not — so the faces must be registered at document level or every `icon=`
 *    prop renders its ligature text.
 *
 * 3. THE COMPONENT RUNTIME, as a module script pointing at an absolute URL
 *    under `public/`. This is the only approach that works: Stencil's lazy build
 *    resolves its sibling chunks relative to its OWN location, so putting it
 *    through a bundler makes it hunt for entry chunks in `/_next/static/`, where
 *    nothing was ever written. `scripts/sync-runtime.mjs` has the full
 *    post-mortem. `md3.esm.js` self-registers on import and needs no
 *    `defineCustomElements` call. It still matters on a server-rendered build:
 *    `server.mjs` paints the components' Declarative Shadow DOM into the
 *    response, but the runtime is what makes them INTERACTIVE — it adopts the
 *    server's shadow roots rather than rebuilding them.
 *
 * The two stylesheets are the one thing that DOES go through the bundler.
 * They are custom properties and page furniture with no runtime, and letting
 * Next emit them as `<link>`s in head is exactly what we want. The app sheet
 * lives in the kit because every framework build shares the same grid —
 * see `@awc-ui/showcase-kit/credit-risk/app.css`.
 */

import type { ReactNode } from 'react';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/data';
import { en } from '@awc-ui/showcase-kit/i18n';
import { ShowcaseProvider } from '@/lib/showcase';
import { BASE_PATH } from '@/lib/routes';
import '@awc-ui/core/css/tokens.css';
import '@awc-ui/showcase-kit/credit-risk/app.css';

const RUNTIME_URL = `${BASE_PATH}/awc-runtime/md3/md3.esm.js`;

/**
 * `<title>` and `lang` are English and stay English, server render or not.
 * Locale lives in a query param that only client JS reads (`URL_PARAMS` in the
 * kit's dock state), so the server has no authoritative language for the
 * request — moving this to `generateMetadata()` would not change that. The
 * preboot script swaps `lang`/`dir` on <html> and every visible string
 * re-renders through the translator; the document metadata cannot follow.
 */
export const metadata = {
  title: `${en['app.brand']} — ${en['app.title']}`,
  description: en['app.subtitle'],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  /**
   * The render stamp — evidence, not decoration.
   *
   * The fixture is frozen at `REPORTING_DATE` with no clock and no randomness
   * anywhere, which is exactly what makes a static export and a live render
   * produce byte-identical screens. That is good for parity and useless as
   * proof: you cannot tell which one served you. This one value is read at
   * render time, so two requests to the same URL disagree — and they can only
   * disagree if the HTML was built for each of them.
   *
   * `scripts/verify-ssr.mjs` is the consumer: it fetches a page twice and fails
   * the build if the two markers match, and fails it just as hard if there is
   * no marker at all, on the grounds that silence is not evidence. The names
   * are the harness's, not ours.
   *
   * Both are `<meta>` on purpose. Nothing in `.shell` sees them, so the visible
   * text, the `md-*` fingerprint, the row counts and every measured gap are
   * untouched; they sit beside `awc-reporting-date`, which is already read the
   * same way.
   */
  const renderedAt = new Date().toISOString();

  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREBOOT_SCRIPT }} />
        <meta name="awc-reporting-date" content={REPORTING_DATE} />
        <meta name="awc-render-mode" content="ssr" />
        <meta name="awc-rendered-at" content={renderedAt} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap"
        />
        <script
          type="module"
          dangerouslySetInnerHTML={{
            __html: `import(${JSON.stringify(RUNTIME_URL)}).catch((e)=>console.error('[awc-ui] component registration failed',e));`,
          }}
        />
      </head>
      <body>
        <ShowcaseProvider>{children}</ShowcaseProvider>
      </body>
    </html>
  );
}
