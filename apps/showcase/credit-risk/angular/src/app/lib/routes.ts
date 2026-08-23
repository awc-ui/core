/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across all six framework builds. The only local fact is WHICH
 * framework this build is, and that has to agree with `baseHref` in
 * `angular.json` and the `<base>` tag in `src/index.html` — so it is declared
 * once, here, and everything else is derived.
 *
 * TRAILING SLASHES ARE THE WRINKLE. Every other build links to `/watchlist/`,
 * and every build EMITS `watchlist/index.html`. Angular's router, though,
 * treats `/watchlist/` as a different path from `/watchlist` and matches
 * neither to the other — so `routerLink` gets the un-slashed form while the
 * emitted files keep the directory shape a static host needs. `appPath()` does
 * that one conversion, in one place.
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
