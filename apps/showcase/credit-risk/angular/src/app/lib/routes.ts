/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only local fact is WHICH
 * framework this build is, and that has to agree with `baseHref` in
 * `angular.json`, the `<base>` tag in `src/index.html`, and the `APP_BASE_HREF`
 * `app.config.ts` provides — so it is declared once, here, and everything else
 * is derived from it.
 *
 * The three `.mjs` scripts call `createRoutes('angular')` themselves rather than
 * importing this module, because a Node script cannot read TypeScript. They call
 * the same function with the same id, so there is still one derivation of the
 * mount and no second copy of the path.
 *
 * TRAILING SLASHES ARE THE WRINKLE. Every other build links to `/watchlist/`.
 * Angular's router treats `/watchlist/` as a different path from `/watchlist`
 * and matches neither to the other — so `routerLink` gets the un-slashed form
 * while every href stays slashed, which is the shape the dock's framework
 * switcher rewrites and the shape the static builds emit. `appPath()` does that
 * one conversion, in one place.
 *
 * A COLD DEEP LINK NEEDS NO CONVERSION, which is what makes the fan-out work.
 * `Location.normalize()` strips the base href and then the trailing slash before
 * the router ever sees the path, so the shell served at
 * `/showcase/credit-risk/angular/watchlist/index.html` boots straight into the
 * `watchlist` route with the table below unchanged. Verified by reading
 * `@angular/common` 17.3.12: `Location._basePath` is
 * `_stripOrigin(stripTrailingSlash(_stripIndexHtml(baseHref)))` and
 * `normalize()` is `stripTrailingSlash(_stripBasePath(basePath, …))`, so
 * `/showcase/credit-risk/angular/watchlist/` arrives as `/watchlist` and
 * `/showcase/credit-risk/angular/` as `''`.
 *
 * Use `appPath(route.sector(id))` with `routerLink`: Angular prefixes the base
 * href itself, and passing an already-prefixed path would double the segment.
 * Use `withBase()` for raw `href` attributes on custom elements
 * (`md-breadcrumb-item`, `md-button`), where nothing prefixes anything for us.
 */

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('angular');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';

/** A kit path (`/watchlist/`) as Angular's router wants it (`/watchlist`). */
export function appPath(path: string): string {
  return path === '/' ? '/' : path.replace(/\/$/, '');
}
