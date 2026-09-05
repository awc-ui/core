/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same nine screens under its own path segment
 * (`/showcase/music/react/`, `/…/vue/`, …), so the route SHAPES are identical
 * and only the prefix moves. A link written once here cannot drift between
 * ports, and the dock's framework switcher can rewrite the segment without
 * knowing which build it is inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.album('drift-season')` → `/album/drift-season/`, root-relative and
 *   UNPREFIXED. Feed these to a router that already knows its own base.
 * - `withBase(route.album('drift-season'))` →
 *   `/showcase/music/react/album/drift-season/`. For anywhere nothing prefixes
 *   for us: a raw `href`, an `<a>` in a static page, `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect a missing slash
 * would need.
 */

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/music';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Five builds, no server-rendered siblings — the standing decision for every
 * vertical after credit-risk. It holds here for a reason the others did not
 * have: the transport is client state by definition, so a server render would
 * have nothing to say about the one thing that makes this app what it is.
 */
export const FRAMEWORKS = ['html', 'react', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/**
 * Screen paths, root-relative and without the base prefix.
 *
 * THREE OF THE FOUR DRILLS ARE ADDRESSED BY A SLUG, not an opaque id: an album,
 * a project and an artist all have a title or a name that is how a person would
 * refer to them, and a URL reading `/project/prj-04/` would be the one part of
 * this app that felt unlike a music app. A TRACK keeps its id, and that is not
 * an oversight — track titles collide constantly, both across albums and
 * within a discography, so a slug would not be unique and disambiguating it
 * would produce exactly the opaque URL the slug was avoiding.
 */
export const route = {
  home: () => '/',
  library: () => '/library/',
  studio: () => '/studio/',
  mixer: () => '/mixer/',
  profile: () => '/profile/',
  album: (slug: string) => `/album/${slug}/`,
  artist: (handle: string) => `/artist/${handle}/`,
  track: (id: string) => `/t/${id}/`,
  project: (slug: string) => `/project/${slug}/`,
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
 * THE ORDER IS LISTENING THEN EDITING, and the two halves are deliberately not
 * interleaved: Home and Library are what a listener opens, Studio and Mixer are
 * what a maker opens, and Profile belongs to both. Alternating them would make
 * the navigation a list of features rather than a description of two jobs.
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
    icon: 'home',
    activeIcon: 'home',
    labelKey: 'music.nav.home',
  },
  {
    value: 'library',
    path: route.library(),
    icon: 'library_music',
    activeIcon: 'library_music',
    labelKey: 'music.nav.library',
  },
  {
    value: 'studio',
    path: route.studio(),
    icon: 'graphic_eq',
    activeIcon: 'graphic_eq',
    labelKey: 'music.nav.studio',
  },
  {
    value: 'mixer',
    path: route.mixer(),
    icon: 'tune',
    activeIcon: 'tune',
    labelKey: 'music.nav.mixer',
  },
  {
    value: 'profile',
    path: route.profile(),
    icon: 'account_circle',
    activeIcon: 'account_circle',
    labelKey: 'music.nav.profile',
  },
] as const;

/**
 * Which destination a path belongs to, or `null` when none does.
 *
 * A PROJECT DRILL BELONGS TO STUDIO, NOT TO A PROJECTS INDEX, because there is
 * no projects index — Studio IS the list of projects with one of them open.
 * That is the one place this app's navigation is less obvious than Corvus's,
 * and it is a consequence of the even split: five destinations across two
 * halves leaves no room for an index screen per noun.
 *
 * `home` owns `/` and is matched exactly, or it would prefix-match everything.
 */
export function destinationFor(pathname: string): Destination | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === '/') return DESTINATIONS[0];
  if (path.startsWith('/album/') || path.startsWith('/artist/') || path.startsWith('/t/')) {
    return DESTINATIONS[1];
  }
  if (path.startsWith('/project/')) return DESTINATIONS[2];
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
 * `label` carries a proper noun — an album's title, an artist's name, a track's
 * title, a project's title. Unlike Corvus, every drill here has one, because
 * everything this app addresses is a named work. So no crumb in this file ever
 * falls back to a translated placeholder.
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

  if (path.startsWith('/project/')) {
    return [
      { labelKey: 'music.nav.studio', label: null, href: route.studio() },
      { labelKey: null, label, href: null },
    ];
  }
  if (
    path.startsWith('/album/') ||
    path.startsWith('/artist/') ||
    path.startsWith('/t/')
  ) {
    return [
      { labelKey: 'music.nav.library', label: null, href: route.library() },
      { labelKey: null, label, href: null },
    ];
  }
  return [];
}

/* --------------------------------------------------------------- binding */

export interface MusicRoutes {
  /** This build's framework id — the segment the dock swaps. */
  framework: Framework;
  /** e.g. `/showcase/music/react`. No trailing slash. */
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
export function createRoutes(framework: Framework): MusicRoutes {
  const basePath = `${SHOWCASE_BASE}/${framework}`;
  return {
    framework,
    basePath,
    route,
    withBase: (path: string) => `${basePath}${path}`,
  };
}
