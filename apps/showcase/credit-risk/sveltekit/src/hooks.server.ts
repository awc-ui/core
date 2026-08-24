/**
 * Everything this build does that a static export cannot, in one hook.
 *
 * Three jobs, in this order, on every request:
 *
 *   1. fill in the three `<head>` entries `app.html` cannot hold as literals,
 *   2. stamp the render markers that prove the document was made for THIS
 *      request,
 *   3. run the finished HTML through the AWC UI hydrate module, so every
 *      `md-*` element arrives with its shadow DOM already in it.
 *
 * `app.html` is a template, not a source file: whatever is written in it ships
 * to every visitor, comments included. So the explanation lives here.
 *
 * ── 1. THE HEAD ──────────────────────────────────────────────────────────────
 *
 * THE PREBOOT SCRIPT, first (`%awc.preboot%`). A synchronous IIFE that reads
 * the showcase state from the URL, or localStorage, and stamps `lang`, `dir`,
 * `data-theme` and `data-density` onto <html> before the first paint. Placed
 * after a stylesheet it would still run before paint, but the browser blocks it
 * on the CSS download first — so it goes first. It is transformed in rather
 * than pasted because the one copy lives in the kit and is shared by every
 * build; pasting it would fork it on the first edit. It does NOT apply the
 * accent preset — that is ~2.8 kB of palette per seed and would blow the
 * preboot budget — so a non-default accent has a brief default-violet frame on
 * a cold load. Documented trade, made in the kit.
 *
 * THE FONTS, in `app.html`. The components render Material Symbols glyphs
 * inside their own shadow roots. Font registration crosses shadow boundaries;
 * class rules do not — so the faces must be registered at document level or
 * every `icon=` prop renders its ligature text.
 *
 * THE COMPONENT RUNTIME (`%awc.runtime%`), as a PRELOAD of an absolute URL
 * under `static/`. The absolute static URL is the only thing that works:
 * Stencil's lazy build resolves its sibling chunks relative to its OWN
 * location, so putting it through Vite makes it hunt for entry chunks under
 * `_app/`, where the build never wrote them. It needs `base`, which `app.html`
 * has no access to — one of the reasons this file exists.
 * `scripts/sync-runtime.mjs` carries the full post-mortem. It still matters on
 * a server-rendered build: the shadow roots below arrive in the HTML, but the
 * runtime is what makes them INTERACTIVE.
 *
 * A PRELOAD RATHER THAN AN IMPORT, and the difference is the whole fix in
 * `src/lib/adopt.ts`. `<link rel="modulepreload">` fetches and compiles the
 * module with the document but does not EXECUTE it; executing it is what calls
 * `customElements.define`, and that has to happen after Svelte has finished
 * hydrating. Svelte 4 hydrates by claiming the server's nodes, and a claimed
 * element loses every attribute its `.svelte` template does not declare —
 * including `s-id`, the marker Stencil's runtime reads in `connectedCallback`
 * to decide between adopting the server's shadow root and rendering a second
 * copy into it. When the runtime went in as `<script type="module">` here,
 * which of the two happened first was a race between two dynamic imports, and
 * the losing outcome was every component on every screen drawn twice inside its
 * own shadow root. The root layout's `onMount` runs the import now. Read
 * `src/lib/adopt.ts` for the measurements.
 *
 * ── 2. THE RENDER STAMP (`%awc.render%`) ─────────────────────────────────────
 *
 * Evidence, not decoration. The fixture is frozen at a reporting date with no
 * clock and no randomness anywhere, which is exactly what makes a prerender and
 * a live render produce byte-identical screens — good for parity, useless as
 * proof, because you cannot tell which one served you. `renderedAt` is read
 * while the response is being assembled, so two requests to the same URL
 * disagree, and they can only disagree if the HTML was built for each of them.
 * `scripts/verify-ssr.mjs` is the consumer: it fetches a page twice and fails
 * the build if the two markers match, and fails it just as hard if there is no
 * marker at all, on the grounds that silence is not evidence. The names are the
 * harness's, not ours.
 *
 * ── 3. THE SHADOW DOM ────────────────────────────────────────────────────────
 *
 * `renderToString` is framework-agnostic: it takes an HTML string containing
 * `md-*` tags and returns it with declarative shadow DOM injected. The identical
 * eight lines hang off Astro's middleware and Nuxt's Nitro hook; here the seam
 * is `transformPageChunk`.
 *
 * WITH ONE EXCEPTION, WHICH IS WORTH BEING PRECISE ABOUT. Tables, chips, meters,
 * cards, breadcrumbs and buttons server-render complete, content and all — every
 * figure on every screen is in the HTML. The CHARTS do not: they draw into a
 * `<canvas>`, and a canvas cannot be painted without a canvas context, which
 * does not exist here. What server-renders for a chart is its frame — heading,
 * subtitle, legend, and the accessible name and data-table description a screen
 * reader reads — with the plot itself appearing when the runtime draws it. So
 * with JavaScript off this page is a complete, readable credit report with blank
 * chart panels, not a finished dashboard. That is a genuine limit of canvas
 * rendering and overstating it would be the easiest thing in the world to do in
 * a file like this.
 *
 * AND ONE MORE THING WORTH KNOWING, WHICH IS SVELTE-SPECIFIC. Alongside the
 * shadow roots, the hydrate app annotates the LIGHT DOM — an `s-id` attribute
 * and an `<!--r.N-->` marker on each host — which is how its client runtime
 * recognises a server-rendered tree and adopts it instead of re-rendering it.
 * Svelte 4 hydrates by CLAIMING existing nodes, and `claim_element` removes
 * every attribute the component's own template does not declare (see
 * `claim_element_base` in svelte/internal). So on the elements this app writes
 * itself, those annotations are stripped a moment after they arrive.
 *
 * THIS COMMENT USED TO SAY THAT THE END STATE WAS IDENTICAL AND THE COST WAS
 * ONE WASTED RE-RENDER. IT WAS WRONG, AND EXPENSIVELY SO. Stripped of `s-id`
 * the runtime does not re-render the component, it renders an ADDITIONAL copy
 * into the shadow root the parser has already filled from the server's
 * `<template shadowrootmode>` — it never clears a shadow root it does not think
 * it owns. The overview carried 239 shadow-hosting elements against 207 in the
 * `next` and `nuxt` builds; every nav item drew its icon twice and the
 * watchlist badge read "77" where the figure is 7. `src/lib/adopt.ts` is the
 * fix and the write-up: the annotations are photographed before hydration,
 * restored after it, and the runtime is not started until both have happened.
 * The first paint, which is the point of all this, was never affected either
 * way: it happens before any of that JavaScript runs.
 *
 * ── WHY THE BUFFER ───────────────────────────────────────────────────────────
 *
 * `transformPageChunk` is called per CHUNK, not per page. Today SvelteKit hands
 * the whole document over in one call with `done: true` — this app returns no
 * promises from `load`, so there is nothing to stream — but that is an
 * implementation detail of the version we build against, and the failure mode
 * if it changes is nasty: `renderToString` would be handed a fragment, parse it
 * as a document, and quietly return something reshaped. So chunks are collected
 * and the transform runs once, on `done`. A partial chunk contributes to the
 * buffer and returns nothing.
 */
import type { Handle } from '@sveltejs/kit';
import type { SerializeDocumentOptions } from '@awc-ui/core/hydrate';
import { renderToString } from '@awc-ui/core/hydrate';
import { base } from '$app/paths';
import { PREBOOT_SCRIPT } from '@awc-ui/showcase-kit/preboot';

const preboot = `<script>${PREBOOT_SCRIPT}</script>`;

/**
 * Warm the runtime without running it.
 *
 * The URL is written down in two places — here and in `src/lib/adopt.ts`, which
 * is what actually imports it — and that is deliberate rather than shared
 * through a constant: this string is assembled on the SERVER and that one is
 * bundled for the BROWSER, and importing an app module into `hooks.server.ts`
 * to save a template literal would drag `$app/paths` and the client graph
 * across the seam. `scripts/sync-runtime.mjs` is what guarantees the path
 * exists; if the two ever disagree the preload simply misses and the import
 * pays for the fetch itself, which is a slow page rather than a broken one.
 */
const runtime = `<link rel="modulepreload" href="${base}/awc-runtime/md3/md3.esm.js">`;

/**
 * Options shared with the sibling SSR builds, plus two that were learned the
 * hard way.
 *
 * `removeScripts` would strip the preboot IIFE and the runtime import: the page
 * would render correctly once and then never theme, never switch language and
 * never gain a dock. `removeHtmlComments` would strip two sets of markers at
 * once — the anchors Svelte's hydration walks, which SvelteKit counts in dev
 * precisely so it can tell you this transform broke them, and the hydrate app's
 * own `<!--r.N-->` annotations.
 *
 * `maxHydrateCount` defaults to 300, and the heaviest screen in this app —
 * the watchlist — renders 297 components once the tables expand inside their
 * own shadow roots. Three away from a limit that is SILENT: anything past it is
 * left as an inert tag, so the page looks half server-rendered and nothing says
 * why. One more signal in the fixture would cross it, so the ceiling is raised
 * rather than watched.
 *
 * `removeUnusedStyles` is off because "unused" is computed against the server's
 * DOM, and this page's DOM changes the moment the dock switches locale, theme or
 * density.
 */
const HYDRATE_OPTIONS: SerializeDocumentOptions = {
  serializeShadowRoot: 'declarative-shadow-dom',
  removeScripts: false,
  removeHtmlComments: false,
  removeUnusedStyles: false,
  maxHydrateCount: 10_000,
};

/** Inject declarative shadow DOM for every `md-*` element in a rendered page. */
async function injectShadowRoots(html: string): Promise<string> {
  const { html: hydrated, diagnostics } = await renderToString(html, {
    ...HYDRATE_OPTIONS,
    fullDocument: html.includes('<html'),
  });
  const errors = (diagnostics ?? []).filter((d) => d.level === 'error');
  if (errors.length) throw new Error(errors.map((d) => d.messageText).join(' | '));
  // `html` is typed nullable because the same call can be asked for a fragment
  // or a stream. Falling back to the input keeps the page rather than the type.
  return hydrated ?? html;
}

export const handle: Handle = async ({ event, resolve }) => {
  let document = '';

  return resolve(event, {
    transformPageChunk: async ({ html, done }) => {
      document += html;
      if (!done) return '';

      const page = document;
      document = '';

      const render =
        '<meta name="awc-render-mode" content="ssr">' +
        `<meta name="awc-rendered-at" content="${new Date().toISOString()}">`;

      // Replacements are given as FUNCTIONS: a literal replacement string
      // interprets `$&`, `$1` and friends, and one of these three is minified
      // JavaScript from another package.
      const filled = page
        .replace('%awc.preboot%', () => preboot)
        .replace('%awc.render%', () => render)
        .replace('%awc.runtime%', () => runtime);

      // Nothing to hydrate: skip the parse rather than pay for it on a 404 page.
      // The markers above still go in, because a 404 is a per-request render too.
      if (!filled.includes('<md-')) return filled;

      try {
        return await injectShadowRoots(filled);
      } catch (error) {
        // A failed transform must not cost the visitor the page. The
        // untransformed HTML is still a working document — the components just
        // build their shadow roots client-side, exactly as they did when this
        // build was prerendered.
        console.error('[awc-ssr] shadow-root injection failed, serving raw HTML:', error);
        return filled;
      }
    },
  });
};
