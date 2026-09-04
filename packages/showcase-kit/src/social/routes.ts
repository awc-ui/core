/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same seven screens under its own path segment
 * (`/showcase/social/react/`, `/…/vue/`, …), so the route SHAPES are identical
 * and only the prefix moves. A link written once here cannot drift between
 * ports, and the dock's framework switcher can rewrite the segment without
 * knowing which build it is inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.person('ada.lind')` → `/people/ada.lind/`, root-relative and
 *   UNPREFIXED. Feed these to a router that already knows its own base.
 * - `withBase(route.person('ada.lind'))` → `/showcase/social/react/people/ada.lind/`.
 *   For anywhere nothing prefixes for us: a raw `href`, an `<a>` in a static
 *   page, `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect a missing slash
 * would need.
 */

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/social';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Five builds, no server-rendered siblings — the standing decision for every
 * vertical after credit-risk. It holds especially easily here: the app is a
 * personal feed behind a login, so there is no anonymous first paint a server
 * render would improve.
 */
export const FRAMEWORKS = ['html', 'react', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/**
 * Screen paths, root-relative and without the base prefix.
 *
 * A PERSON IS ADDRESSED BY HANDLE, not by id. Every other vertical drills by
 * opaque id — `/accounts/acc-eur/`, `/counterparties/cp-01/` — because those
 * records have no public name. A person does: the handle IS their address, it
 * is what appears beside every post they make, and a social app whose URLs said
 * `/people/per-07/` would be the one thing about it that felt unlike the thing
 * it is modelling.
 */
export const route = {
  feed: () => '/',
  explore: () => '/explore/',
  create: () => '/create/',
  activity: () => '/activity/',
  profile: () => '/profile/',
  post: (id: string) => `/p/${id}/`,
  person: (handle: string) => `/people/${handle}/`,
} as const;

export type RouteName = keyof typeof route;

/* ---------------------------------------------------------- destinations */

/**
 * The top-level destinations, in navigation order.
 *
 * FIVE DESTINATIONS FOR SEVEN ROUTES. `/p/<id>/` and `/people/<handle>/` are
 * DRILLS: neither has an index to send anyone to, and both are reached by
 * choosing something on the screen above. Listing them would put a destination
 * in the navigation surface with no address.
 *
 * `md-navigation-bar` is specified for 3–5 and its manual says so twice; the
 * rail takes 3–7. Five works in both, so the rail and the bar render the SAME
 * array and the two surfaces cannot disagree about what the app contains.
 *
 * CREATE SITS IN THE MIDDLE, which is where every app of this shape puts it and
 * is not an accident: it is the only destination that is an ACTION rather than
 * a place, and centring it in a five-slot bar puts it under the thumb.
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
    value: 'feed',
    path: route.feed(),
    icon: 'home',
    activeIcon: 'home',
    labelKey: 'social.nav.feed',
  },
  {
    value: 'explore',
    path: route.explore(),
    icon: 'search',
    activeIcon: 'search',
    labelKey: 'social.nav.explore',
  },
  {
    value: 'create',
    path: route.create(),
    icon: 'add_box',
    activeIcon: 'add_box',
    labelKey: 'social.nav.create',
  },
  {
    value: 'activity',
    path: route.activity(),
    icon: 'favorite',
    activeIcon: 'favorite',
    labelKey: 'social.nav.activity',
  },
  {
    value: 'profile',
    path: route.profile(),
    icon: 'account_circle',
    activeIcon: 'account_circle',
    labelKey: 'social.nav.profile',
  },
] as const;

/**
 * Which destination a path belongs to, or `null` when none does.
 *
 * A POST DRILL BELONGS TO THE FEED and a person drill to EXPLORE, which is a
 * guess and is marked as one. Unlike the other verticals — where an account
 * drill unambiguously belongs to the account list it was reached from — a post
 * here is reachable from the feed, the explore grid, a profile grid and an
 * activity row, and the indicator can only name one of them. The feed and
 * explore are the two that actually contain a grid of these things, so they are
 * the least surprising answers.
 *
 * `feed` owns `/` and is matched exactly, or it would prefix-match everything.
 */
export function destinationFor(pathname: string): Destination | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === '/' || path.startsWith('/p/')) return DESTINATIONS[0];
  if (path.startsWith('/people/')) return DESTINATIONS[1];
  return DESTINATIONS.find((d) => d.path !== '/' && path.startsWith(d.path)) ?? null;
}

/** The rail's / bar's `active-index` for a path. `0` when nothing matches. */
export function destinationIndex(pathname: string): number {
  const destination = destinationFor(pathname);
  return destination ? DESTINATIONS.indexOf(destination) : 0;
}

/* ------------------------------------------------------------ breadcrumbs */

/**
 * The trail for a drill screen.
 *
 * THIS VERTICAL ARGUED ITSELF OUT OF BREADCRUMBS AND WAS OVERRULED, which is
 * worth recording because the argument was not wrong — it was just outweighed.
 *
 * The case against: the other three consoles drill a hierarchy, so a trail is
 * TRUE wherever the reader came from, while a post here is reachable from the
 * feed, an explore grid, four profiles and a notification. Naming one of them
 * is a guess.
 *
 * The case for, which wins: every other screen in this showcase has a trail in
 * that row, and a reader moving between the four applications should not find
 * the fourth one navigating differently for a reason only its source code
 * knows. A single back link also read as a stray hyperlink rather than as
 * chrome. The guess is bounded — the parent named here is always a real screen
 * that really contains this thing — so the worst case is a trail that is less
 * specific than the reader's own history, not one that is false.
 *
 * `label` carries a proper noun (a person's display name); a post has no name
 * of its own, so its own crumb is a translated label instead.
 */
export interface CrumbSpec {
  /** Dictionary key, or `null` when the label is a proper noun. */
  labelKey: string | null;
  /** The proper noun, when `labelKey` is null. */
  label: string | null;
  /** Unprefixed path, or `null` for the current page. */
  href: string | null;
}

export function crumbsFor(pathname: string, label: string | null): CrumbSpec[] {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;

  if (path.startsWith('/p/')) {
    return [
      { labelKey: 'social.nav.feed', label: null, href: route.feed() },
      { labelKey: 'social.screen.post.title', label: null, href: null },
    ];
  }
  if (path.startsWith('/people/')) {
    return [
      { labelKey: 'social.nav.explore', label: null, href: route.explore() },
      { labelKey: null, label, href: null },
    ];
  }
  return [];
}

/* --------------------------------------------------------------- binding */

export interface SocialRoutes {
  /** This build's framework id — the segment the dock swaps. */
  framework: Framework;
  /** e.g. `/showcase/social/react`. No trailing slash. */
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
export function createRoutes(framework: Framework): SocialRoutes {
  const basePath = `${SHOWCASE_BASE}/${framework}`;
  return {
    framework,
    basePath,
    route,
    withBase: (path: string) => `${basePath}${path}`,
  };
}
