/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only thing that is local is WHICH
 * framework this build is, and that single fact has to agree with `basePath` in
 * `next.config.mjs` — so it is declared once, here, and everything else is
 * derived.
 *
 * Use `route.*` with Next's `<Link>`: it prefixes `basePath` itself, and
 * passing an already-prefixed path would double the segment. Use `withBase()`
 * for raw `href`s on custom elements (`md-breadcrumb-item`) and for
 * `location.assign`, where nothing prefixes anything for us.
 *
 * WHY THIS DOES NOT CALL `createRoutes()`
 *
 * The kit's `Framework` type is the union of its own `FRAMEWORKS` constant —
 * `html | astro | react | vue | angular | svelte` — so `createRoutes('next')`
 * is a type error, and this package's `lint` script is `tsc --noEmit`. The kit
 * is shared and widening it is part of central registration, not of this slice,
 * so the binding is spelled out locally instead. It is byte-identical to what
 * `createRoutes` returns (`${SHOWCASE_BASE}/${framework}` + a `withBase`
 * closure); `SHOWCASE_BASE` and `route` still come from the kit, so the screen
 * map cannot drift.
 *
 * ONCE THE KIT IS WIDENED, this file collapses back to
 * `const routes = createRoutes('next')` and `FRAMEWORKS` goes back to a
 * re-export.
 */

import { SHOWCASE_BASE, route } from '@awc-ui/showcase-kit/credit-risk';

/** The path segment the dock swaps when you pick another framework. */
export const FRAMEWORK = 'next';

/** e.g. `/showcase/credit-risk/next`. No trailing slash. */
export const BASE_PATH = `${SHOWCASE_BASE}/${FRAMEWORK}`;

/** Prefix a route with this build's base path. */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;

/**
 * Every build the dock offers, in display order.
 *
 * Local rather than the kit's `FRAMEWORKS`, for the same reason as above: the
 * kit constant still lists six ids and this vertical now ships seven. `react`
 * is the genuine SPA, `next` is this runtime-rendered server. The dock already
 * carries a display label for `next` (`FRAMEWORK_LABELS` in
 * `packages/showcase-kit/src/dock/element.ts`) and rewrites whichever segment
 * it finds in `location.pathname`, so nothing else has to know about the split.
 */
export const FRAMEWORKS = ['html', 'astro', 'react', 'next', 'vue', 'angular', 'svelte'] as const;

export { route, SHOWCASE_BASE };
