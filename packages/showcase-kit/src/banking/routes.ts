/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same six screens under its own path segment
 * (`/showcase/banking/react/`, `/…/vue/`, …), so the route SHAPES are identical
 * and only the prefix moves. That is the whole reason this lives in the kit: a
 * link written once here cannot drift between ports, and the dock's framework
 * switcher can rewrite the segment without knowing which build it is inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.account('acc-eur')` → `/accounts/acc-eur/`, root-relative and
 *   UNPREFIXED. Feed these to a router that already knows its own base.
 * - `withBase(route.account('acc-eur'))` → `/showcase/banking/react/accounts/acc-eur/`.
 *   For anywhere nothing prefixes for us: a raw `href` on `md-breadcrumb-item`,
 *   an `<a>` in a static page, `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect a missing slash
 * would need.
 */

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/banking';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Five builds, no server-rendered siblings — the same decision the wealth
 * console took, and for a stronger reason here: this is a personal-finance app
 * behind a login. There is no anonymous first paint to server-render for.
 */
export const FRAMEWORKS = ['html', 'react', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/** Screen paths, root-relative and without the base prefix. */
export const route = {
  home: () => '/',
  transactions: () => '/transactions/',
  account: (id: string) => `/accounts/${id}/`,
  exchange: () => '/exchange/',
  invest: () => '/invest/',
  instrument: (id: string) => `/invest/${id}/`,
  analytics: () => '/analytics/',
  cards: () => '/cards/',
} as const;

export type RouteName = keyof typeof route;

/* ---------------------------------------------------------- destinations */

/**
 * The top-level destinations, in navigation order.
 *
 * FIVE DESTINATIONS FOR EIGHT ROUTES. `/accounts/<id>/` and `/invest/<id>/` are
 * DRILLS, not destinations: neither has an index to send anyone to, and both
 * are only reachable by choosing a row on the screen above. Listing them in the
 * rail would put a destination in the navigation surface with no address.
 *
 * The count also has to hold for the compact layout. `md-navigation-bar` is
 * specified for 3–5 destinations and its manual says so twice; six would make
 * the bar an M3 violation at every phone width. Five works in both surfaces —
 * the rail takes 3–7 — so the rail and the bar render the SAME array and the
 * two navigation surfaces cannot disagree about what the app contains.
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
    value: 'home',
    path: route.home(),
    icon: 'account_balance_wallet',
    activeIcon: 'account_balance_wallet',
    labelKey: 'banking.nav.home',
  },
  {
    value: 'transactions',
    path: route.transactions(),
    icon: 'receipt_long',
    activeIcon: 'receipt_long',
    labelKey: 'banking.nav.transactions',
  },
  {
    value: 'exchange',
    path: route.exchange(),
    icon: 'currency_exchange',
    activeIcon: 'currency_exchange',
    labelKey: 'banking.nav.exchange',
  },
  {
    value: 'invest',
    path: route.invest(),
    icon: 'trending_up',
    activeIcon: 'trending_up',
    labelKey: 'banking.nav.invest',
  },
  {
    value: 'analytics',
    path: route.analytics(),
    icon: 'donut_small',
    activeIcon: 'donut_small',
    labelKey: 'banking.nav.analytics',
  },
] as const;

/**
 * Which destination a path belongs to, or `null` when none does.
 *
 * An account drill resolves to `home`, because the account list IS the home
 * screen; an instrument drill resolves to `invest`. Marking the section a
 * sub-page belongs to is the ordinary reading of an active indicator.
 *
 * `/cards/` is a real screen with no rail tab — it is reached from the home
 * screen's card tile and from the app bar. It resolves to `home` for the same
 * reason an account does.
 *
 * `home` owns `/` and is matched exactly, or it would prefix-match everything.
 */
export function destinationFor(pathname: string): Destination | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === '/' || path.startsWith('/accounts/') || path.startsWith('/cards/')) {
    return DESTINATIONS[0];
  }
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
  /** The proper noun, when `labelKey` is null. */
  label: string | null;
  /** Unprefixed path, or `null` for the current page. */
  path: string | null;
}

/**
 * The trail for a path.
 *
 * Only the two drill screens have one — a top-level destination is already
 * named by the rail and an `md-breadcrumb` above it would say the same word
 * twice. `label` carries a proper noun (an account nickname, an instrument
 * name) because those are fixture values and are deliberately not translated.
 */
export function crumbsFor(pathname: string, label: string | null): CrumbSpec[] {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;

  if (path.startsWith('/accounts/')) {
    return [
      { labelKey: 'banking.nav.home', label: null, path: route.home() },
      { labelKey: null, label, path: null },
    ];
  }
  if (path.startsWith('/invest/') && path !== route.invest()) {
    return [
      { labelKey: 'banking.nav.invest', label: null, path: route.invest() },
      { labelKey: null, label, path: null },
    ];
  }
  return [];
}
