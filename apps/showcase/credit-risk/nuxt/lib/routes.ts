/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only local fact is WHICH
 * framework this build is, and that has to agree with `app.baseURL` in
 * `nuxt.config.ts` — both derive it from the same helper, so the two cannot
 * drift apart silently.
 *
 * Use `route.*` with `<NuxtLink>`: Nuxt prefixes `baseURL` itself, and passing
 * an already-prefixed path would double the segment. Use `withBase()` for raw
 * `href` attributes on custom elements (`md-breadcrumb-item`, `md-button`) and
 * for `navigateTo`, where nothing prefixes anything for us.
 *
 * `FRAMEWORKS` is re-exported from the kit rather than restated here, so the
 * dock's list keeps coming from one place. Two sibling builds did briefly keep
 * a local copy, while their ids were newer than the kit knew about, and that is
 * exactly the hazard it looks like: the dock renders whatever the local copy
 * says while the verification asserts against the kit, so the two agree only
 * until the next build is added.
 */

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('nuxt');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
