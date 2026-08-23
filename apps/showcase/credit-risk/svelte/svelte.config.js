import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Static export, mounted under a sub-path.
 *
 * `paths.base` must agree with `createRoutes('svelte').basePath` in the kit —
 * that is the single fact this build declares about itself, and every link is
 * derived from it. SvelteKit prefixes `base` onto its own asset URLs and onto
 * anything written as `{base}/…`, which is why `lib/routes.ts` exports the
 * UNPREFIXED paths for use with `<a href="{base}{path}">` and a prefixed
 * `withBase()` for raw attributes on custom elements.
 *
 * `trailingSlash: 'always'` matches the other five builds: every route becomes
 * a directory with an `index.html`, which is the only shape a static host can
 * serve without a redirect it cannot perform.
 *
 * `fallback` is deliberately UNSET. A fallback page is for a host that can
 * route unknown paths back to the app; this build prerenders all 95 routes, so
 * an unknown path should be a real 404, not a shell that renders the overview
 * under the wrong URL.
 */
const BASE_PATH = '/showcase/credit-risk/svelte';

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
    adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
    paths: { base: BASE_PATH, relative: false },
    prerender: { handleHttpError: 'fail' },
  },
};
