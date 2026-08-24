/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only local fact is WHICH
 * framework this build is, and that has to agree with `paths.base` in
 * `svelte.config.js` — so it is declared once, here, and everything else is
 * derived.
 *
 * Use `route.*` with SvelteKit's `base`: write `href="{base}{route.sector(id)}"`,
 * because `base` is what SvelteKit's own asset URLs already carry and passing an
 * already-prefixed path would double the segment. Use `withBase()` for raw
 * `href` attributes on custom elements (`md-breadcrumb-item`, `md-button`) and
 * for `goto`, where nothing prefixes anything for us.
 *
 * WHY THIS DOES NOT CALL `createRoutes()`
 *
 * The kit's `Framework` type is the union of its own `FRAMEWORKS` constant,
 * which still reads `html | astro | react | next | vue | angular | svelte` — so
 * `createRoutes('sveltekit')` is a type error and `lint` (svelte-check) fails on
 * it. Widening that constant is central registration, not part of this slice, so
 * the binding is spelled out locally instead. It is byte-identical to what
 * `createRoutes` returns (`${SHOWCASE_BASE}/${framework}` plus a `withBase`
 * closure), and `SHOWCASE_BASE` and `route` still come from the kit, so the
 * screen map cannot drift. `apps/showcase/credit-risk/next/lib/routes.ts`
 * carries the same workaround for the same reason.
 *
 * ONCE THE KIT IS WIDENED this file collapses back to
 * `const routes = createRoutes('sveltekit')` and `FRAMEWORKS` to a re-export.
 * `server.mjs` and `scripts/verify-browser.mjs` still call `createRoutes()` and
 * need no change — they are `.mjs`, so the union never reaches them.
 */

import { FRAMEWORKS as KIT_FRAMEWORKS, SHOWCASE_BASE, route } from '@awc-ui/showcase-kit/credit-risk';

/** The path segment the dock swaps when you pick another framework. */
export const FRAMEWORK = 'sveltekit';

/** e.g. `/showcase/credit-risk/sveltekit`. No trailing slash. */
export const BASE_PATH = `${SHOWCASE_BASE}/${FRAMEWORK}`;

/** Prefix a route with this build's base path. */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;

/**
 * Every build the dock offers, in display order.
 *
 * Still the kit's list — it is not restated here, because a second copy of it
 * would drift the moment a framework is added. The only addition is this build
 * itself, and only while the kit does not yet know about it: a dock whose
 * `framework` attribute names an id absent from its `frameworks` list renders a
 * `<select>` with nothing selected, so the browser falls back to the first
 * option and the bar cheerfully reports that you are looking at the HTML build.
 *
 * Appending is also the right position today — `svelte` is last in the kit's
 * list, and the SSR build belongs directly after the SPA it mirrors. When the
 * kit gains `sveltekit` this reduces to the kit's own list, order included.
 */
export const FRAMEWORKS: readonly string[] = (KIT_FRAMEWORKS as readonly string[]).includes(FRAMEWORK)
  ? KIT_FRAMEWORKS
  : [...KIT_FRAMEWORKS, FRAMEWORK];

export { route, SHOWCASE_BASE };
