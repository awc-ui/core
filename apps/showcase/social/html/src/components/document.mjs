/**
 * The document. Everything in `<head>` is ordered deliberately.
 *
 * 1. THE PREBOOT SCRIPT, first — a synchronous IIFE that stamps theme, density
 *    and accent onto <html> before the first paint. Placed after a stylesheet
 *    it would still run before paint, but the browser blocks it on the CSS
 *    download first, so it goes first. On this build it does NOT touch `lang`
 *    or `dir`: `data-locale-route` tells it the server already settled those,
 *    and a stale locale in localStorage must not overwrite the language the
 *    page is actually written in.
 *
 * 2. THE FONTS. The components render Material Symbols glyphs inside their own
 *    shadow roots. Font registration crosses shadow boundaries; class rules do
 *    not — so the faces must be registered at document level or every `icon=`
 *    prop renders as its ligature text.
 *
 *    THE AXES ARE NOT OPTIONAL. Requested without an axis list, Google Fonts
 *    serves the STATIC instance of Material Symbols pinned at its defaults —
 *    FILL 0 among them. Every component that fills a glyph does so through
 *    `font-variation-settings: 'FILL' 1`, and against a static face that
 *    declaration is inert: a clicked rating star stays hollow. Both faces are
 *    requested WITH `opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`, same
 *    as the React build. ROUNDED is the face this console actually renders
 *    (`--md-sys-icon-font-family` in the kit's app.css); Outlined stays loaded
 *    as the fallback in that stack.
 *
 * 3. THE STYLESHEETS — the library's tokens, its pre-upgrade size floors (each
 *    rule self-retires on `.hydrated`), the shared page furniture, and the one
 *    per-screen sheet the React build imports from a screen (snackbar —
 *    framework-free, linked on every page here because Vite would have bundled
 *    it into one sheet anyway). All copied into `dist/styles/` by the build. No
 *    bundler is involved anywhere in this app, so they are plain `<link>`s at
 *    absolute URLs.
 *
 * 4. THE COMPONENT RUNTIME and this build's own client script, as module
 *    scripts at absolute URLs. Stencil's lazy build resolves its sibling chunks
 *    relative to its OWN location, which is exactly why it is served as a
 *    static file rather than bundled; `scripts/sync-runtime.mjs` carries the
 *    full post-mortem.
 */

import { REPORTING_DATE } from '@awc-ui/showcase-kit/social';
import { attrs, html, raw } from '../lib/html.mjs';
import { BASE_PATH, DEFAULT_LOCALE, LOCALE_CODES, dirFor, switchLocaleHref, useT } from '../lib/i18n.mjs';

const RUNTIME_URL = `${BASE_PATH}/awc-runtime/md3/md3.esm.js`;
const CLIENT_URL = `${BASE_PATH}/client.js`;

const SYMBOL_AXES = 'opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';

const STYLESHEETS = ['tokens.css', 'pre-upgrade.css', 'app.css', 'snackbar.css'];

export function document_({ locale, path, body }) {
  const t = useT(locale);
  const dir = dirFor(locale);

  /**
   * The same screen in the other two languages. Without these a crawler treats
   * the three locale trees as unrelated documents — or worse, as duplicates of
   * each other — rather than as translations of one page.
   */
  const alternates = LOCALE_CODES.map((code) => ({ code, href: switchLocaleHref(code, path) }));

  return html`<!doctype html>
<html${attrs({ lang: locale, dir, 'data-locale-route': true })}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- An EXTERNAL file, not an inline IIFE: script-src 'self' refuses inline
         scripts, and this one stamps theme/density/dir before first paint. Still
         a blocking classic script, so the parser still waits for it. -->
    <script${attrs({ src: `${BASE_PATH}/preboot.js` })}></script>
    <title>${t('social.app.brand')} — ${t('social.app.title')}</title>
    <meta name="description"${attrs({ content: t('social.app.title') })} />
    <meta name="awc-reporting-date"${attrs({ content: REPORTING_DATE })} />
    ${alternates.map(
      ({ code, href }) => html`<link rel="alternate"${attrs({ hreflang: code, href })} />`,
    )}
    <link rel="alternate" hreflang="x-default"${attrs({ href: switchLocaleHref(DEFAULT_LOCALE, path) })} />
    <!-- THE FONTS ARE SELF-HOSTED. Links to fonts.googleapis.com used to sit
         here; style-src 'self' refuses them, and a blocked font sheet is not
         cosmetic — every icon degrades to its ligature text. scripts/build.mjs
         copies the npm packages' CSS and woff2 into styles/, so the relative
         url() in each sheet resolves beside it. -->
    <link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/roboto-400.css` })} />
    <link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/roboto-500.css` })} />
    <link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/roboto-700.css` })} />
    <link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/material-symbols-outlined.css` })} />
    ${STYLESHEETS.map(
      (sheet) => html`<link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/${sheet}` })} />`,
    )}
    <!-- The component runtime as a plain module tag. It was an inline
         import() so no bundler would rewrite it; this build has no bundler for
         the document, and an inline module is refused by script-src 'self' —
         which left every component un-upgraded under an enterprise policy. -->
    <script type="module"${attrs({ src: RUNTIME_URL })}></script>
  </head>
  <body>
    ${body}
    <script type="module"${attrs({ src: CLIENT_URL })}></script>
  </body>
</html>
`;
}
