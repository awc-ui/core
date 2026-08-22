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
 *    the export never wrote them. `scripts/sync-runtime.mjs` has the full
 *    post-mortem. `md3.esm.js` self-registers on import and needs no
 *    `defineCustomElements` call.
 *
 * The token sheet is the one thing that DOES go through the bundler — it is
 * 14 kB of custom properties with no runtime, and letting Next emit it as a
 * `<link>` in head is exactly what we want.
 */

import type { ReactNode } from 'react';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/data';
import { en } from '@awc-ui/showcase-kit/i18n';
import { ShowcaseProvider } from '@/lib/showcase';
import { BASE_PATH } from '@/lib/routes';
import '@awc-ui/core/css/tokens.css';
import './globals.css';

const RUNTIME_URL = `${BASE_PATH}/awc-runtime/md3/md3.esm.js`;

/**
 * The export is a static file: it has one `<title>` and one `lang`, and both
 * are English. The client swaps `lang`/`dir` on <html> through the preboot
 * script, and every visible string re-renders through the translator — but the
 * document metadata cannot follow, so it stays in the default locale.
 */
export const metadata = {
  title: `${en['app.brand']} — ${en['app.title']}`,
  description: en['app.subtitle'],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREBOOT_SCRIPT }} />
        <meta name="awc-reporting-date" content={REPORTING_DATE} />
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
