/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only local fact is WHICH
 * framework this build is, and that has to agree with `base` in
 * `vite.config.ts` — so it is declared once, here, and everything else is
 * derived. `vite.config.ts` cannot import this module (the `$lib` alias it
 * declares does not exist yet while the config is being loaded), so it derives
 * the same string from `SHOWCASE_BASE` and the same framework id. One source,
 * two short derivations.
 *
 * Use `route.*` with `navigate()` from `$lib/router` and with `<Drill href>`:
 * both prefix `BASE_PATH` themselves, exactly as SvelteKit's `base` did in the
 * build these screens were copied from. Passing an already-prefixed path there
 * would double the segment. Use `withBase()` for raw `href` attributes on
 * custom elements (`md-button`, `md-breadcrumb-item`), where nothing prefixes
 * anything for us.
 */

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('svelte');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
