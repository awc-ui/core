/**
 * The two `<head>` entries `app.html` cannot hold as literals — and the reason
 * the whole head is ordered the way it is.
 *
 * `app.html` is a template, not a source file: whatever is written in it ships
 * to every visitor, comments included. So the explanation lives here.
 *
 * 1. THE PREBOOT SCRIPT, first (`%awc.preboot%`). A synchronous IIFE that reads
 *    the showcase state from the URL, or localStorage, and stamps `lang`, `dir`,
 *    `data-theme` and `data-density` onto <html> before the first paint. Placed
 *    after a stylesheet it would still run before paint, but the browser blocks
 *    it on the CSS download first — so it goes first. It is transformed in
 *    rather than pasted because the one copy lives in the kit and is shared by
 *    all six builds; pasting it would fork it on the first edit. It does NOT
 *    apply the accent preset — that is ~2.8 kB of palette per seed and would
 *    blow the preboot budget — so a non-default accent has a brief
 *    default-violet frame on a cold load. Documented trade, made in the kit.
 *
 * 2. THE FONTS, in `app.html`. The components render Material Symbols glyphs
 *    inside their own shadow roots. Font registration crosses shadow
 *    boundaries; class rules do not — so the faces must be registered at
 *    document level or every `icon=` prop renders its ligature text.
 *
 * 3. THE COMPONENT RUNTIME (`%awc.runtime%`), as a module script pointing at an
 *    absolute URL under `static/`. This is the only approach that works:
 *    Stencil's lazy build resolves its sibling chunks relative to its OWN
 *    location, so putting it through Vite makes it hunt for entry chunks under
 *    `_app/`, where the build never wrote them. It needs `base`, which
 *    `app.html` has no access to — the second reason this file exists.
 *    `scripts/sync-runtime.mjs` carries the full post-mortem.
 *
 * `transformPageChunk` runs during prerendering, so both land in every emitted
 * HTML file and nothing is deferred to the client.
 */
import type { Handle } from '@sveltejs/kit';
import { base } from '$app/paths';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';

const preboot = `<script>${PREBOOT_SCRIPT}</script>`;
const runtime =
  `<script type="module">import(${JSON.stringify(`${base}/awc-runtime/md3/md3.esm.js`)})` +
  `.catch((e)=>console.error('[awc-ui] component registration failed',e));</script>`;

export const handle: Handle = async ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%awc.preboot%', preboot).replace('%awc.runtime%', runtime),
  });
