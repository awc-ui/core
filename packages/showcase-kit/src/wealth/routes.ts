/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same six screens under its own path segment
 * (`/showcase/wealth/react/`, `/…/vue/`, …), so the route SHAPES are identical
 * and only the prefix moves. That is the whole reason this lives in the kit: a
 * link written once here cannot drift between ports, and the dock's framework
 * switcher can rewrite the segment without knowing which build it is currently
 * inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.household('hh-01')` → `/households/hh-01/`, root-relative and
 *   UNPREFIXED. Feed these to a router that already knows its own base —
 *   SvelteKit's `base`, Angular's `APP_BASE_HREF`, this build's own `<Link>`.
 *   Prefixing here as well would double the segment.
 * - `withBase(route.household('hh-01'))` → `/showcase/wealth/react/households/hh-01/`.
 *   For anywhere nothing prefixes for us: a raw `href` on `md-breadcrumb-item`
 *   or `md-navigation-rail-tab`, an `<a>` in a static page, `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect that a missing
 * slash would need.
 */

import type { Household } from './types';

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/wealth';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Five single-page applications and one static export. Unlike the credit-risk
 * vertical there are no server-rendered siblings here: this console is an
 * authenticated internal tool, which is the case where an SPA is the honest
 * shape rather than a compromise.
 *
 * All five are built. The route table stays the one place that knows the
 * roster — the dock's switcher renders this array — because the credit-risk
 * build learned that the hard way when a local copy of the list and the kit's
 * copy agreed only until the next port landed.
 */
export const FRAMEWORKS = ['html', 'react', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/** Screen paths, root-relative and without the base prefix. */
export const route = {
  overview: () => '/',
  holdings: () => '/holdings/',
  household: (id: string) => `/households/${id}/`,
  proposals: () => '/proposals/',
  trade: () => '/trade/',
  planning: () => '/planning/',
} as const;

export type RouteName = keyof typeof route;

/* ---------------------------------------------------------- destinations */

/**
 * The top-level destinations, in navigation order.
 *
 * FIVE DESTINATIONS FOR SIX ROUTES, and the difference is deliberate.
 * `/households/<id>/` is a DRILL, not a destination: there is no
 * `/households/` index to send anyone to, and the screen is only reachable by
 * choosing a household from the overview's book. Listing it in the rail would
 * put a destination in the navigation surface that has no address.
 *
 * The count also has to hold for the compact layout. `md-navigation-bar` is
 * specified for 3–5 destinations and its manual says so twice ("Avoid more than
 * five items"); six would have made the bar an M3 violation on every phone-width
 * viewport. Five works in both surfaces — the rail takes 3–7 — so the rail and
 * the bar render the SAME array, and the two navigation surfaces cannot
 * disagree about what the app contains.
 *
 * `icon` is a Material Symbols ligature and `labelKey` a dictionary key: both
 * are component vocabulary, which is why they live beside the paths rather than
 * in each port's shell. Six copies of this table would drift; one cannot.
 */
export interface Destination {
  /** Stable routing key. Also the `value` prop on the rail/bar tab. */
  value: RouteName;
  /** Unprefixed path, from `route`. */
  path: string;
  /** Material Symbols ligature for the inactive state. */
  icon: string;
  /** Material Symbols ligature when the destination is current. */
  activeIcon: string;
  /** Dictionary key. Never a pre-translated string. */
  labelKey: string;
}

export const DESTINATIONS: readonly Destination[] = [
  {
    value: 'overview',
    path: route.overview(),
    icon: 'dashboard',
    activeIcon: 'dashboard',
    labelKey: 'wealth.nav.overview',
  },
  {
    value: 'holdings',
    path: route.holdings(),
    icon: 'donut_small',
    activeIcon: 'donut_small',
    labelKey: 'wealth.nav.holdings',
  },
  {
    value: 'proposals',
    path: route.proposals(),
    icon: 'description',
    activeIcon: 'description',
    labelKey: 'wealth.nav.proposals',
  },
  {
    value: 'trade',
    path: route.trade(),
    icon: 'swap_horiz',
    activeIcon: 'swap_horiz',
    labelKey: 'wealth.nav.trade',
  },
  {
    value: 'planning',
    path: route.planning(),
    icon: 'flag',
    activeIcon: 'flag',
    labelKey: 'wealth.nav.planning',
  },
] as const;

/**
 * Which destination a path belongs to, or `null` when none does.
 *
 * The household drill resolves to `overview`, because that is the screen it is
 * reached from — the book of households IS the overview. Marking the section a
 * sub-page belongs to is the ordinary reading of an active indicator; leaving
 * the rail blank on a drill would make the navigation stop describing where you
 * are the moment you go one level down.
 *
 * `overview` owns `/` and is matched exactly, or it would prefix-match
 * everything.
 */
export function destinationFor(pathname: string): Destination | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === '/' || path.startsWith('/households/')) return DESTINATIONS[0];
  return DESTINATIONS.find((d) => d.path !== '/' && path.startsWith(d.path)) ?? null;
}

/** The rail's / bar's `active-index` for a path. `0` when nothing matches. */
export function destinationIndex(pathname: string): number {
  const destination = destinationFor(pathname);
  return destination ? DESTINATIONS.indexOf(destination) : 0;
}

/* ------------------------------------------------------------ breadcrumbs */

export interface CrumbSpec {
  /** Dictionary key, or `null` when the label is a proper noun. */
  labelKey: string | null;
  /** A proper noun to render as-is — a household name. `null` otherwise. */
  label: string | null;
  /** Unprefixed path, or `null` on the final crumb. */
  href: string | null;
}

/**
 * The trail for a path.
 *
 * Returned as SPECS rather than strings because the kit has no translator bound
 * to a locale — the app resolves `labelKey` through its own `t()` and renders
 * `label` verbatim. One crumb means the heading already says it, so the shells
 * drop a trail of length 1.
 */
export function crumbsFor(pathname: string, household?: Household | null): CrumbSpec[] {
  const root: CrumbSpec = { labelKey: 'wealth.nav.overview', label: null, href: route.overview() };
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;

  if (path.startsWith('/households/')) {
    return [
      root,
      household
        ? { labelKey: null, label: household.name, href: null }
        : { labelKey: 'wealth.nav.household', label: null, href: null },
    ];
  }

  const destination = destinationFor(path);
  if (!destination || destination.value === 'overview') return [root];
  return [root, { labelKey: destination.labelKey, label: null, href: null }];
}

/* --------------------------------------------------------------- binding */

export interface WealthRoutes {
  /** This build's framework id — the segment the dock swaps. */
  framework: Framework;
  /** e.g. `/showcase/wealth/react`. No trailing slash. */
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
 * bundler config.
 */
export function createRoutes(framework: Framework): WealthRoutes {
  const basePath = `${SHOWCASE_BASE}/${framework}`;
  return {
    framework,
    basePath,
    route,
    withBase: (path: string) => `${basePath}${path}`,
  };
}
