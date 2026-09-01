/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/wealth` and is identical
 * across every framework build. The only local fact is WHICH framework this
 * build is, and that has to agree with `baseHref` in `angular.json`, the
 * `<base>` tag in `src/index.html`, and the `APP_BASE_HREF` `app.config.ts`
 * provides — so it is declared once, here, and everything else is derived from
 * it.
 *
 * The three `.mjs` scripts call `createRoutes('angular')` themselves rather than
 * importing this module, because a Node script cannot read TypeScript. They call
 * the same function with the same id, so there is still one derivation of the
 * mount and no second copy of the path.
 *
 * TRAILING SLASHES ARE THE WRINKLE. Every other build links to `/holdings/`.
 * Angular's router treats `/holdings/` as a different path from `/holdings`
 * and matches neither to the other — so `routerLink` and `navigateByUrl` get
 * the un-slashed form while every href stays slashed, which is the shape the
 * dock's framework switcher rewrites and the shape the static builds emit.
 * `appPath()` does that one conversion, in one place.
 *
 * A COLD DEEP LINK NEEDS NO CONVERSION, which is what makes the fan-out work.
 * `Location.normalize()` strips the base href and then the trailing slash before
 * the router ever sees the path, so the shell served at
 * `/showcase/wealth/angular/holdings/index.html` boots straight into the
 * `holdings` route. (Verified against `@angular/common` 17.3 by the credit-risk
 * sibling this file is ported from — see its copy for the reading.)
 *
 * Use `appPath(route.household(id))` with `routerLink`: Angular prefixes the
 * base href itself, and passing an already-prefixed path would double the
 * segment. Use `withBase()` for raw `href` attributes on custom elements
 * (`md-breadcrumb-item`, `md-navigation-rail-tab`, `md-button`), where nothing
 * prefixes anything for us.
 *
 * `FRAMEWORKS`, `DESTINATIONS` and `crumbsFor` are re-exported straight from
 * the kit and never restated. The credit-risk build learned why: a local copy
 * of the framework list agreed with the kit's copy only until the next port
 * landed, and by then the dock and the verifier were reading different arrays.
 */

import { createRoutes } from '@awc-ui/showcase-kit/wealth';

const routes = createRoutes('angular');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export {
  crumbsFor,
  DESTINATIONS,
  destinationFor,
  destinationIndex,
  FRAMEWORKS,
  SHOWCASE_BASE,
} from '@awc-ui/showcase-kit/wealth';

export type { CrumbSpec, Destination } from '@awc-ui/showcase-kit/wealth';

/** A kit path (`/holdings/`) as Angular's router wants it (`/holdings`). */
export function appPath(path: string): string {
  return path === '/' ? '/' : path.replace(/\/$/, '');
}
