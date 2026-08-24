/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only thing that is local is WHICH
 * framework this build is, and that single fact has to agree with `base` in
 * `vite.config.ts` — so it is declared once, here, and everything else is
 * derived.
 *
 * Use `route.*` with this app's `<Link>` and `useRouter().push()`: they prefix
 * `BASE_PATH` themselves, exactly as Next's `<Link>` prefixed `basePath`.
 * Passing an already-prefixed path would double the segment. Use `withBase()`
 * for raw `href`s on custom elements (`md-breadcrumb-item`, `md-button`), where
 * nothing prefixes anything for us.
 *
 * WHY THIS DOES NOT CALL `createRoutes()`
 *
 * It could — `createRoutes('react')` type-checks, because `react` is still a
 * member of the kit's `Framework` union. But `FRAMEWORKS` is not usable: the
 * kit constant lists SIX ids and this vertical now ships seven, and the dock's
 * `frameworks` attribute has to carry all of them or the new `next` build is
 * unreachable from the switcher. Rather than take `basePath` from one source
 * and the framework list from another, both are spelled out here, next to each
 * other, so they cannot disagree. `SHOWCASE_BASE` and `route` still come from
 * the kit, so the screen map itself cannot drift.
 *
 * ONCE THE KIT'S `FRAMEWORKS` IS WIDENED to seven ids, this file collapses back
 * to `const routes = createRoutes('react')` and a re-export of `FRAMEWORKS`.
 * `apps/showcase/credit-risk/next/lib/routes.ts` carries the same note.
 */

import { SHOWCASE_BASE, route } from '@awc-ui/showcase-kit/credit-risk';

/** The path segment the dock swaps when you pick another framework. */
export const FRAMEWORK = 'react';

/** e.g. `/showcase/credit-risk/react`. No trailing slash. */
export const BASE_PATH = `${SHOWCASE_BASE}/${FRAMEWORK}`;

/** Prefix a route with this build's base path. */
export const withBase = (path: string): string => `${BASE_PATH}${path}`;

/**
 * Every build the dock offers, in display order.
 *
 * `react` is this one — a genuine client-routed SPA with no meta-framework.
 * `next` is the runtime server-rendered build that used to occupy this segment.
 * The dock already carries a display label for `next` (`FRAMEWORK_LABELS` in
 * `packages/showcase-kit/src/dock/element.ts`) and rewrites whichever segment
 * it finds in `location.pathname`, so nothing else has to know about the split.
 */
export const FRAMEWORKS = ['html', 'astro', 'react', 'next', 'vue', 'angular', 'svelte'] as const;

export { route, SHOWCASE_BASE };
