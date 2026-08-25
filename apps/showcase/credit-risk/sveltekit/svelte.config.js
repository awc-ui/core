import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * A RUNTIME server, mounted under a sub-path.
 *
 * This build used to be `@sveltejs/adapter-static` with `prerender = true` on
 * the root layout: 95 HTML files written once, at build time, and served by
 * anything that can read a directory. It is now a Node server that renders
 * every one of those 95 routes on demand, so the two things `scripts/verify-ssr.mjs`
 * asks can both be answered yes:
 *
 *   1. the markup is in the response before any JavaScript runs
 *      (`src/hooks.server.ts` injects declarative shadow DOM per request), and
 *   2. the document was built FOR that request (the render stamp in
 *      `src/app.html`, filled in by the same hook).
 *
 * A prerender satisfies the first and fails the second, which is the whole
 * point of the distinction — so there is deliberately NO prerendering here.
 * Not on the layout, not on a page, not as a fallback. `adapter-node` writes
 * `build/index.js` (a standalone server) and `build/handler.js` (the same thing
 * as a middleware); `server.mjs` uses the latter, because the mount path needs
 * a front door and the harness probes `/`.
 *
 * `paths.base` must agree with `createRoutes('sveltekit').basePath` in the kit —
 * that is the single fact this build declares about itself, and every link is
 * derived from it. SvelteKit prefixes `base` onto its own asset URLs and onto
 * anything written as `{base}/…`, which is why `lib/routes.ts` exports the
 * UNPREFIXED paths for use with `<a href="{base}{path}">` and a prefixed
 * `withBase()` for raw attributes on custom elements.
 *
 * `trailingSlash: 'always'` (on the root layout) matches every other build in
 * the vertical: a path is spelled one way everywhere, so the dock's framework
 * switcher can swap the segment without knowing which kind of build it landed
 * on.
 */
const BASE_PATH = '/showcase/credit-risk/sveltekit';

/**
 * TWO TARGETS, ONE CONFIG.
 *
 * `AWC_TARGET=netlify` swaps `adapter-node` for `adapter-netlify`. Nothing else
 * changes — same routes, same `paths.base`, same `src/hooks.server.ts`, same
 * `vite.config.js`, same Vite server output in `.svelte-kit/output/`. The
 * adapter is the LAST step of the build: it takes that output and packages it
 * for a host. Which is exactly why the switch belongs here and not in a second
 * config file — a fork would let the base path, the DSD injection or the
 * per-request meta tags drift between what is verified locally and what is
 * deployed, and all three are the product claim.
 *
 * WHY BOTH EXIST. `adapter-node` writes a PERSISTENT server: `build/index.js`
 * standalone, `build/handler.js` as middleware, and `server.mjs` runs the
 * latter. That is what `scripts/verify-ssr.mjs` and
 * `scripts/verify-ssr-adoption.mjs` start with `pnpm --filter … start`, and it
 * is the thing being demonstrated — a process that renders per request. Netlify
 * has no long-lived process to hold a port, so the deployed copy is a
 * serverless function instead. Deleting the Node target to get the deploy would
 * leave the harnesses nothing to run and the claim unproven, so it is ADDED
 * alongside, never in place of.
 *
 * WHAT THE HOOK DOES NOT CARE ABOUT. `transformPageChunk` is called by
 * SvelteKit while it renders the page, long before the adapter's runtime sees a
 * response — so the render stamp and the `renderToString` pass happen
 * identically on both targets, and neither is reachable from adapter config.
 * That is the point of using this seam.
 *
 * THE IMPORTS ARE DYNAMIC so that neither adapter is required to be installed
 * for the other target to build. It also keeps `@sveltejs/adapter-netlify` — an
 * esbuild-carrying dependency — out of every `svelte-check`, `vite dev` and
 * `vite build` that is not deploying.
 *
 * `edge: false` IS DELIBERATE, not a default being restated. An edge function
 * is Deno, bundled by esbuild for the browser platform; `hooks.server.ts`
 * imports `@awc-ui/core/hydrate`, which is a 3.8 MB single-file NODE build of
 * the whole component library. That is the one import the shadow DOM depends
 * on, so an edge target would have to bundle it for a runtime it was not built
 * for. The Node serverless function runs it as-is. Setting the adapter's own
 * `NETLIFY_SVELTEKIT_USE_EDGE` env var cannot override this, which is the
 * reason it is written out rather than left off.
 *
 * `split: false` IS LOAD-BEARING AND WOULD BE A SILENT 404 IF FLIPPED. With
 * `split: true` the adapter emits one function per route and derives each
 * function's URL pattern from the route's own segments — `/counterparties/:id`,
 * not `/showcase/credit-risk/sveltekit/counterparties/:id`. `paths.base` is not
 * in those patterns, so every prefixed request (which is every request that
 * arrives through the proxy) would match no function at all. One function on
 * `/*` receives the whole path and lets SvelteKit strip the base itself, which
 * is how the base path survives the deploy.
 *
 * THE PUBLISH DIRECTORY IS `build-netlify`, set in `netlify.toml` next to this
 * file, and it is NOT `build` on purpose: that is where `adapter-node` writes,
 * and the Netlify adapter empties its publish directory before writing to it.
 * Sharing one would mean each target destroys the other's output and `pnpm
 * start` fails after a Netlify build. See `netlify.toml` for the rest of the
 * output layout.
 */
const NETLIFY = process.env.AWC_TARGET === 'netlify';

const adapter = NETLIFY
  ? (await import('@sveltejs/adapter-netlify')).default({ edge: false, split: false })
  : (await import('@sveltejs/adapter-node')).default({ out: 'build' });

/**
 * Silence three a11y warnings, and ONLY on the library's own elements.
 *
 * Svelte's a11y linter reasons about the tag it can see. It cannot see into a
 * custom element's shadow root, so it is wrong about all three of these in the
 * same way:
 *
 * - `a11y-misplaced-scope` on `<md-table-cell head scope="col">`. The component
 *   renders a real `<th>` and forwards `scope` onto it — which is exactly why
 *   the prop exists, and dropping it would cost every table its column
 *   associations. 26 of these, one per header cell in the app.
 * - the two click-handler warnings on `<md-button on:click>`. It renders a real
 *   `<button>`; adding a `role` or a keyboard handler on the host would give
 *   the accessibility tree a second, competing control.
 *
 * The frame check is what keeps this honest: the same warning on a real `<td>`
 * or a real `<div on:click>` still fails the build, because those would be
 * genuine. Nothing is suppressed globally.
 */
const SHADOWED = new Set([
  'a11y-misplaced-scope',
  'a11y-click-events-have-key-events',
  'a11y-no-noninteractive-element-interactions',
  'a11y-no-static-element-interactions',
]);

export default {
  preprocess: vitePreprocess(),
  onwarn(warning, handler) {
    if (SHADOWED.has(warning.code) && /<(md|awc)-/.test(warning.frame ?? '')) return;
    handler(warning);
  },
  kit: {
    adapter,
    paths: { base: BASE_PATH, relative: false },
  },
};
