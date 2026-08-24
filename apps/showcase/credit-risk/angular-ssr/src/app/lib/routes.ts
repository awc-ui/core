/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only local fact is WHICH
 * framework this build is, and that has to agree with `baseHref`/`deployUrl` in
 * `angular.json`, the `<base>` tag in `src/index.html`, and the `APP_BASE_HREF`
 * `src/server.ts` provides per request — so it is declared once, here, and
 * everything else is derived from it, including the server's own base.
 *
 * TRAILING SLASHES ARE THE WRINKLE. Every other build links to `/watchlist/`.
 * Angular's router treats `/watchlist/` as a different path from `/watchlist`
 * and matches neither to the other — so `routerLink` gets the un-slashed form
 * while every href stays slashed, which is the shape the dock's framework
 * switcher rewrites and the shape the static builds emit. `appPath()` does that
 * one conversion, in one place.
 *
 * On the server the conversion is not needed: `Location.normalize()` strips the
 * base href and then the trailing slash before the router ever sees the path,
 * so a request for `/showcase/credit-risk/angular-ssr/watchlist/` matches the
 * `watchlist` route as it stands.
 *
 * Use `appPath(route.sector(id))` with `routerLink`: Angular prefixes the base
 * href itself, and passing an already-prefixed path would double the segment.
 * Use `withBase()` for raw `href` attributes on custom elements
 * (`md-breadcrumb-item`, `md-button`), where nothing prefixes anything for us.
 *
 * `FRAMEWORKS` is re-exported straight from the kit and never restated. It was
 * briefly spelled out here, while this build's id was newer than the kit knew
 * about — and that copy was the exact hazard it looks like: the dock renders
 * whatever this file says, while the verification asserts against the kit, so
 * the two agreed only until the next build was added.
 */

import { createRoutes, FRAMEWORKS, route, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('angular-ssr');

/** The path segment the dock swaps when you pick another build. */
export const FRAMEWORK = routes.framework;

/** e.g. `/showcase/credit-risk/angular-ssr`. No trailing slash. */
export const BASE_PATH = routes.basePath;

/** Prefix a route with this build's base path. */
export const withBase = routes.withBase;

export { FRAMEWORKS, route, SHOWCASE_BASE };

/** A kit path (`/watchlist/`) as Angular's router wants it (`/watchlist`). */
export function appPath(path: string): string {
  return path === '/' ? '/' : path.replace(/\/$/, '');
}
