/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across all six framework builds. The only local fact is WHICH
 * framework this build is, and that has to agree with `app.baseURL` in
 * `nuxt.config.ts` — so it is declared once, in the config, and read back here
 * from the same helper.
 *
 * Use `route.*` with `<NuxtLink>`: Nuxt prefixes `baseURL` itself, and passing
 * an already-prefixed path would double the segment. Use `withBase()` for raw
 * `href` attributes on custom elements (`md-breadcrumb-item`, `md-button`) and
 * for `navigateTo`, where nothing prefixes anything for us.
 */

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('vue');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
