/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/social` and is identical
 * across every framework build. The only thing that is local is WHICH framework
 * this build is, and that single fact has to agree with `base` in
 * `vite.config.ts` — so it is declared once, here, and everything else is
 * derived.
 *
 * Use `route.*` with this app's `<Link>` and `useRouter().push()`: they prefix
 * `BASE_PATH` themselves. Passing an already-prefixed path would double the
 * segment. Use `withBase()` for raw `href`s on custom elements
 * (`md-breadcrumb-item`, `md-navigation-rail-tab`, `md-button`), where nothing
 * prefixes anything for us.
 *
 * `FRAMEWORKS`, `DESTINATIONS` and `crumbsFor` are re-exported straight from
 * the kit and never restated. The credit-risk build learned why: a local copy
 * of the framework list agreed with the kit's copy only until the next port
 * landed, and by then the dock and the verifier were reading different arrays.
 */

import {
  createRoutes,
  crumbsFor,
  DESTINATIONS,
  destinationFor,
  destinationIndex,
  FRAMEWORKS,
  route,
  SHOWCASE_BASE,
} from '@awc-ui/showcase-kit/social';

const routes = createRoutes('react');

/** The path segment the dock swaps when you pick another framework. */
export const FRAMEWORK = routes.framework;

/** e.g. `/showcase/social/react`. No trailing slash. */
export const BASE_PATH = routes.basePath;

/** Prefix a route with this build's base path. */
export const withBase = routes.withBase;

export { crumbsFor, DESTINATIONS, destinationFor, destinationIndex, FRAMEWORKS, route, SHOWCASE_BASE };
