/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across every framework build. The only local fact is WHICH framework
 * this build is, and that single fact has to agree with `base` in
 * `vite.config.ts` — so it is declared once, here, and everything else is
 * derived.
 *
 * Use `route.*` with this app's `<Drill>` and `useRouter().push()`: they prefix
 * `BASE_PATH` themselves, exactly as Nuxt's `<NuxtLink>` prefixed `app.baseURL`
 * in the twin next door. Passing an already-prefixed path would double the
 * segment. Use `withBase()` for raw `href` attributes on custom elements
 * (`md-button`, `md-breadcrumb-item`), where nothing prefixes anything for us.
 *
 * WHY THIS CALLS `createRoutes()` AND RE-EXPORTS `FRAMEWORKS` rather than
 * spelling either out: `vue` is already a member of the kit's `Framework` union
 * and already in its `FRAMEWORKS` list, so nothing here has to be widened, cast
 * or restated. (`apps/showcase/credit-risk/react/src/lib/routes.ts` writes the
 * list out by hand and `apps/showcase/credit-risk/nuxt/lib/routes.ts` casts its
 * id — both because the kit did not yet know about the build in question. This
 * one needs neither, and the day the kit learns about `nuxt` that file collapses
 * to this shape.)
 */

import { createRoutes, FRAMEWORKS } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('vue');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS };
export { SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
