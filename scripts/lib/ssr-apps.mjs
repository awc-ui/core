/**
 * The server-rendered showcase builds, in one place.
 *
 * Two scripts need this list — `verify-ssr.mjs`, which proves each build renders
 * on the server, and `verify-ssr-adoption.mjs`, which proves the browser then
 * KEEPS that render. A second copy of a list like this is not a theoretical
 * hazard: three of these builds each kept a private copy of the framework list
 * while their ids were new, and every one of them drifted the moment another
 * build was added.
 *
 * `start` must run a REAL server. A static file server would pass the first
 * script's "did it arrive without a browser" question and correctly fail its
 * "was it rendered for this request" one.
 */
export const SSR_APPS = [
  { id: 'next', dir: 'apps/showcase/credit-risk/next', port: 4610, start: ['start', '--', '-p', '4610'] },
  { id: 'nuxt', dir: 'apps/showcase/credit-risk/nuxt', port: 4611, start: ['start'] },
  { id: 'sveltekit', dir: 'apps/showcase/credit-risk/sveltekit', port: 4612, start: ['start'] },
  { id: 'angular-ssr', dir: 'apps/showcase/credit-risk/angular-ssr', port: 4613, start: ['start'] },
];

/** The build whose hydration behaviour the others are measured against. */
export const REFERENCE = 'next';

/** Every screen, so a defect confined to one of them cannot hide. */
export const SCREENS = [
  '',
  'watchlist/',
  'stress/',
  'sectors/energy/',
  'counterparties/cp-01/',
  'facilities/fac-001/',
];

export const packageFor = (id) => `@awc-ui/showcase-credit-risk-${id}`;
export const basePathFor = (id) => `/showcase/credit-risk/${id}`;
