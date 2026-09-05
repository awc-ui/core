/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/music` and is identical
 * across every framework build. The only thing that is local is WHICH framework
 * this build is, and that single fact has to agree with `base` in
 * `vite.config.ts` — so it is declared once, here, and everything else is
 * derived. `vite.config.ts` cannot import this module (the `$lib` alias it
 * declares does not exist yet while the config is being loaded), so it derives
 * the same string from `SHOWCASE_BASE` and the same framework id. One source,
 * two short derivations.
 *
 * Use `route.*` with `navigate()` from `$lib/router` and with `<Drill href>`:
 * both prefix `BASE_PATH` themselves. Passing an already-prefixed path there
 * would double the segment. Use `withBase()` for raw `href` attributes on
 * custom elements (`md-breadcrumb-item`, `md-navigation-rail-tab`,
 * `md-button`), where nothing prefixes anything for us.
 *
 * `FRAMEWORKS`, `DESTINATIONS` and `crumbsFor` are re-exported straight from
 * the kit and never restated. The credit-risk build learned why: a local copy
 * of the framework list agreed with the kit's copy only until the next port
 * landed, and by then the dock and the verifier were reading different arrays.
 */

import { createRoutes } from '@awc-ui/showcase-kit/music';

const routes = createRoutes('svelte');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export {
  crumbsFor,
  DESTINATIONS,
  destinationFor,
  destinationIndex,
  FRAMEWORKS,
  SHOWCASE_BASE,
} from '@awc-ui/showcase-kit/music';
