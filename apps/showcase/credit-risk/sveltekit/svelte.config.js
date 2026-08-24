import adapter from '@sveltejs/adapter-node';
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
    adapter: adapter({ out: 'build' }),
    paths: { base: BASE_PATH, relative: false },
  },
};
