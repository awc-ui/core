/**
 * This build's binding of the shared route table.
 *
 * The screen map itself lives in `@awc-ui/showcase-kit/credit-risk` and is
 * identical across all six framework builds. The only thing that is local is
 * WHICH framework this build is, and that single fact has to agree with
 * `basePath` / `assetPrefix` in `next.config.mjs` — so it is declared once,
 * here, and everything else is derived.
 *
 * Use `route.*` with Next's `<Link>`: it prefixes `basePath` itself, and
 * passing an already-prefixed path would double the segment. Use `withBase()`
 * for raw `href`s on custom elements (`md-breadcrumb-item`) and for
 * `location.assign`, where nothing prefixes anything for us.
 */

import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('react');

export const { framework: FRAMEWORK, basePath: BASE_PATH, route, withBase } = routes;

export { FRAMEWORKS, SHOWCASE_BASE } from '@awc-ui/showcase-kit/credit-risk';
