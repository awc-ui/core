/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same six screens under its own path segment
 * (`/showcase/credit-risk/react/`, `/…/svelte/`, …), so the route SHAPES are
 * identical and only the prefix moves. That is the whole reason this lives in
 * the kit: a link written once here cannot drift between ports, and the dock's
 * framework switcher can rewrite the segment without knowing which build it is
 * currently inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.sector('energy')` → `/sectors/energy/`, root-relative and UNPREFIXED.
 *   Feed these to a router that already knows its own base — Next's `<Link>`
 *   with `basePath`, SvelteKit's `base`, Nuxt's `app.baseURL`, Angular's
 *   `APP_BASE_HREF`. Prefixing here as well would double the segment.
 * - `withBase(route.sector('energy'))` → `/showcase/credit-risk/react/sectors/energy/`.
 *   For anywhere nothing prefixes for us: a raw `href` on `md-breadcrumb-item`,
 *   an `<a>` in an Astro page, `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect that a missing
 * slash would need. The server builds keep the same trailing slash even though
 * they could redirect, so that a path is spelled one way everywhere and the
 * dock can swap the framework segment without knowing which kind it landed on.
 */

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/credit-risk';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Three kinds, and the difference is WHEN the HTML is produced:
 *
 * - `html`, `astro` — rendered once, at build time, and shipped as files.
 * - `react` — a single-page application. The server sends an empty shell and
 *   the browser renders everything.
 * - `next` — rendered on the server, per request, by a process that is running
 *   while you read the page.
 *
 * The SSR build sits directly after the SPA it mirrors, because that adjacency
 * is the point: the same screens, the same components, the same kit, differing
 * only in where the first render happened. `vue`, `angular` and `svelte` are
 * still prerendered and will each grow the same pair.
 */
export const FRAMEWORKS = ['html', 'astro', 'react', 'next', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/** Screen paths, root-relative and without the base prefix. */
export const route = {
  overview: () => '/',
  sector: (id: string) => `/sectors/${id}/`,
  counterparty: (id: string) => `/counterparties/${id}/`,
  facility: (id: string) => `/facilities/${id}/`,
  watchlist: () => '/watchlist/',
  stress: () => '/stress/',
} as const;

export type RouteName = keyof typeof route;

export interface CreditRiskRoutes {
  /** This build's framework id — the segment the dock swaps. */
  framework: Framework;
  /** e.g. `/showcase/credit-risk/react`. No trailing slash. */
  basePath: string;
  route: typeof route;
  /** Prefix a route with this build's base path. */
  withBase(path: string): string;
}

/**
 * Bind the shared route table to one framework's base path.
 *
 * Each port calls this once and exports the result, so the base path is written
 * in exactly one place per build and always agrees with that build's own
 * bundler config (`basePath`, `paths.base`, `app.baseURL`, `--base-href`).
 */
export function createRoutes(framework: Framework): CreditRiskRoutes {
  const basePath = `${SHOWCASE_BASE}/${framework}`;
  return {
    framework,
    basePath,
    route,
    withBase: (path: string) => `${basePath}${path}`,
  };
}
