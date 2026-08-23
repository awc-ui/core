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
 * 3. THE STYLESHEETS — the library's tokens and the shared page furniture, both
 *    copied into `dist/` by the build. No bundler is involved anywhere in this
 *    app, so they are plain `<link>`s at absolute URLs.
 *
 * 4. THE COMPONENT RUNTIME and this build's own client script, as module
 *    scripts at absolute URLs. Stencil's lazy build resolves its sibling chunks
 *    relative to its OWN location, which is exactly why it is served as a
 *    static file rather than bundled; `scripts/sync-runtime.mjs` carries the
 *    full post-mortem.
 */

import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';
import { REPORTING_DATE } from '@awc-ui/showcase-kit/data';
import { attrs, escape, html, raw } from '../lib/html.mjs';
import { BASE_PATH, DEFAULT_LOCALE, LOCALE_CODES, dirFor, switchLocaleHref, useT } from '../lib/i18n.mjs';

const RUNTIME_URL = `${BASE_PATH}/awc-runtime/md3/md3.esm.js`;
const CLIENT_URL = `${BASE_PATH}/client.js`;

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
    <script>${raw(PREBOOT_SCRIPT)}</script>
    <title>${t('app.brand')} — ${t('app.title')}</title>
    <meta name="description"${attrs({ content: t('app.subtitle') })} />
    <meta name="awc-reporting-date"${attrs({ content: REPORTING_DATE })} />
    ${alternates.map(
      ({ code, href }) => html`<link rel="alternate"${attrs({ hreflang: code, href })} />`,
    )}
    <link rel="alternate" hreflang="x-default"${attrs({ href: switchLocaleHref(DEFAULT_LOCALE, path) })} />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap" />
    <link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/tokens.css` })} />
    <link rel="stylesheet"${attrs({ href: `${BASE_PATH}/styles/app.css` })} />
    <script type="module">${raw(
      `import(${JSON.stringify(RUNTIME_URL)}).catch((e)=>console.error('[awc-ui] component registration failed',e));`,
    )}</script>
  </head>
  <body>
    ${body}
    <script type="module"${attrs({ src: CLIENT_URL })}></script>
  </body>
</html>
`;
}
