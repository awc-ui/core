/**
 * Route construction for a base-path'd static export.
 *
 * Two audiences, two helpers:
 *
 * - `<Link href={route.sector('energy')}>` — Next prefixes `basePath` itself,
 *   so these paths are ROOT-RELATIVE WITHOUT the prefix.
 * - `withBase(...)` — for anything that ends up in a raw `href` on a custom
 *   element (`md-breadcrumb-item`) or in `location.assign`, where nothing
 *   prefixes anything for us.
 *
 * Every path ends in `/` because `trailingSlash: true` exports each route as a
 * directory with an `index.html`; a link without the slash costs a redirect the
 * static server cannot perform.
 */

/** Must match `basePath` / `assetPrefix` in next.config.mjs. */
export const BASE_PATH = '/showcase/credit-risk/react';

/** This build's framework id — the path segment the dock swaps. */
export const FRAMEWORK = 'react';

/** Prefix that precedes the framework segment. */
export const SHOWCASE_BASE = '/showcase/credit-risk';

/**
 * Every framework this vertical is built for, in dock display order. Six
 * builds of the same screens; the dock hides its switcher below two.
 */
export const FRAMEWORKS = ['html', 'astro', 'react', 'vue', 'angular', 'svelte'] as const;

export const route = {
  overview: () => '/',
  sector: (id: string) => `/sectors/${id}/`,
  counterparty: (id: string) => `/counterparties/${id}/`,
  facility: (id: string) => `/facilities/${id}/`,
  watchlist: () => '/watchlist/',
  stress: () => '/stress/',
};

/** Absolute, deployable URL for a route the framework will not prefix for us. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
