/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across all six framework builds. The only local fact is WHICH
 * framework this build is, and that has to agree with `paths.base` in
 * `svelte.config.js` — so it is declared once, here, and everything else is
 * derived.
 *
 * Use `route.*` with SvelteKit's `base`: write `href="{base}{route.sector(id)}"`,
 * because `base` is what SvelteKit's own asset URLs already carry and passing an
 * already-prefixed path would double the segment. Use `withBase()` for raw
 * `href` attributes on custom elements (`md-breadcrumb-item`, `md-button`) and
 * for `goto`, where nothing prefixes anything for us.
 */

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('svelte');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
