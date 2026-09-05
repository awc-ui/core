/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same nine screens under its own path segment
 * (`/showcase/community/react/`, `/…/vue/`, …), so the route SHAPES are
 * identical and only the prefix moves. A link written once here cannot drift
 * between ports, and the dock's framework switcher can rewrite the segment
 * without knowing which build it is inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.person('ada.lind')` → `/people/ada.lind/`, root-relative and
 *   UNPREFIXED. Feed these to a router that already knows its own base.
 * - `withBase(route.person('ada.lind'))` →
 *   `/showcase/community/react/people/ada.lind/`. For anywhere nothing
 *   prefixes for us: a raw `href`, an `<a>` in a static page,
 *   `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect a missing slash
 * would need.
 */

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/community';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Five builds, no server-rendered siblings — the standing decision for every
 * vertical after credit-risk, and it holds here for the same reason it held for
 * Lyra: the app is a personal feed behind a login, so there is no anonymous
 * first paint a server render would improve.
 */
export const FRAMEWORKS = ['html', 'react', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/**
 * Screen paths, root-relative and without the base prefix.
 *
 * THREE OF THE FOUR DRILLS ARE ADDRESSED BY A NAME, not by an opaque id: a
 * person by handle, a group and an event by slug. Each of those has a public
 * name that IS its address in the thing being modelled, and URLs reading
 * `/groups/grp-04/` would be the one part of the app that felt unlike it. A
 * post is the exception and keeps its id, because a post has no name.
 */
export const route = {
  feed: () => '/',
  friends: () => '/friends/',
  groups: () => '/groups/',
  events: () => '/events/',
  profile: () => '/profile/',
  post: (id: string) => `/p/${id}/`,
  person: (handle: string) => `/people/${handle}/`,
  group: (slug: string) => `/g/${slug}/`,
  event: (slug: string) => `/e/${slug}/`,
} as const;

export type RouteName = keyof typeof route;

/* ---------------------------------------------------------- destinations */

/**
 * The top-level destinations, in navigation order.
 *
 * FIVE DESTINATIONS FOR NINE ROUTES. The four drills have no index to send
 * anyone to and are reached by choosing something on the screen above; listing
 * one would put a destination in the navigation surface with no address.
 *
 * `md-navigation-bar` is specified for 3–5 and its manual says so twice; the
 * rail takes 3–7. Five works in both, so the rail and the bar render the SAME
 * array and the two surfaces cannot disagree about what the app contains.
 *
 * NO "CREATE" DESTINATION, unlike Lyra. Posting here happens from a composer at
 * the top of the feed — which is where this kind of app has always put it, and
 * which is a better demonstration anyway: an inline composer that expands in
 * place is a harder layout than a screen of its own, because it has to grow
 * without moving the feed under it.
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
    labelKey: 'community.nav.feed',
  },
  {
    value: 'friends',
    path: route.friends(),
    icon: 'group',
    activeIcon: 'group',
    labelKey: 'community.nav.friends',
  },
  {
    value: 'groups',
    path: route.groups(),
    icon: 'groups',
    activeIcon: 'groups',
    labelKey: 'community.nav.groups',
  },
  {
    value: 'events',
    path: route.events(),
    icon: 'event',
    activeIcon: 'event',
    labelKey: 'community.nav.events',
  },
  {
    value: 'profile',
    path: route.profile(),
    icon: 'account_circle',
    activeIcon: 'account_circle',
    labelKey: 'community.nav.profile',
  },
] as const;

/**
 * Which destination a path belongs to, or `null` when none does.
 *
 * EACH DRILL HAS AN UNAMBIGUOUS PARENT HERE, which is the one navigational
 * thing this vertical has easier than Lyra. A group drill belongs to Groups and
 * an event drill to Events — those screens are literally the index of the thing
 * being drilled into. Only the post drill is a guess, and it goes to the feed,
 * which is the screen that actually holds a list of posts.
 *
 * `feed` owns `/` and is matched exactly, or it would prefix-match everything.
 */
export function destinationFor(pathname: string): Destination | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === '/' || path.startsWith('/p/')) return DESTINATIONS[0];
  if (path.startsWith('/people/')) return DESTINATIONS[1];
  if (path.startsWith('/g/')) return DESTINATIONS[2];
  if (path.startsWith('/e/')) return DESTINATIONS[3];
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
 * THE TRAILS HERE ARE TRUE RATHER THAN GUESSED, which is the difference from
 * Lyra and is worth stating because Lyra's own note argues at length about
 * having to guess. Three of the four drills have a real parent: a group is
 * genuinely under Groups, an event under Events, a person under Friends. Only a
 * post is reachable from several places, and it points at the feed.
 *
 * `label` carries a proper noun — a person's display name, a group's or an
 * event's name. A post has no name of its own, so its crumb is a translated
 * label instead.
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
      { labelKey: 'community.nav.feed', label: null, href: route.feed() },
      { labelKey: 'community.screen.post.title', label: null, href: null },
    ];
  }
  if (path.startsWith('/people/')) {
    return [
      { labelKey: 'community.nav.friends', label: null, href: route.friends() },
      { labelKey: null, label, href: null },
    ];
  }
  if (path.startsWith('/g/')) {
    return [
      { labelKey: 'community.nav.groups', label: null, href: route.groups() },
      { labelKey: null, label, href: null },
    ];
  }
  if (path.startsWith('/e/')) {
    return [
      { labelKey: 'community.nav.events', label: null, href: route.events() },
      { labelKey: null, label, href: null },
    ];
  }
  return [];
}

/* --------------------------------------------------------------- binding */

export interface CommunityRoutes {
  /** This build's framework id — the segment the dock swaps. */
  framework: Framework;
  /** e.g. `/showcase/community/react`. No trailing slash. */
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
export function createRoutes(framework: Framework): CommunityRoutes {
  const basePath = `${SHOWCASE_BASE}/${framework}`;
  return {
    framework,
    basePath,
    route,
    withBase: (path: string) => `${basePath}${path}`,
  };
}
