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
 * `FRAMEWORKS` is re-exported straight from the kit and never restated. It was
 * briefly spelled out here, while this build was the only one whose id the kit
 * did not yet know — and that copy was the exact hazard it looks like: the dock
 * renders whatever this file says, while `scripts/verify-browser.mjs` asserts
 * against the kit, so the two agreed only until the next build was added. Six
 * more have been since.
 */

import { createRoutes, FRAMEWORKS, route, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('react');

/** The path segment the dock swaps when you pick another framework. */
export const FRAMEWORK = routes.framework;

/** e.g. `/showcase/credit-risk/react`. No trailing slash. */
export const BASE_PATH = routes.basePath;

/** Prefix a route with this build's base path. */
export const withBase = routes.withBase;

export { FRAMEWORKS, route, SHOWCASE_BASE };
