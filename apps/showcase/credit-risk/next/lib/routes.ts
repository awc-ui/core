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
 * `FRAMEWORKS` is re-exported straight from the kit and never restated. It was
 * briefly spelled out here, while this build's id was newer than the kit knew
 * about — and that copy was the exact hazard it looks like: the dock renders
 * whatever this file says, while the verification asserts against the kit, so
 * the two agreed only until the next build was added. Six more have been since.
 */

import { createRoutes, FRAMEWORKS, route, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('next');

/** The path segment the dock swaps when you pick another framework. */
export const FRAMEWORK = routes.framework;

/** e.g. `/showcase/credit-risk/next`. No trailing slash. */
export const BASE_PATH = routes.basePath;

/** Prefix a route with this build's base path. */
export const withBase = routes.withBase;

export { FRAMEWORKS, route, SHOWCASE_BASE };
