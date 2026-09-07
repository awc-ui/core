/**
 * The screen map, shared by every framework build.
 *
 * Every build serves the same seven screens under its own path segment
 * (`/showcase/design/react/`, `/…/vue/`, …), so the route SHAPES are identical
 * and only the prefix moves. A link written once here cannot drift between
 * ports, and the dock's framework switcher can rewrite the segment without
 * knowing which build it is inside.
 *
 * Two flavours of path, because the frameworks disagree about who prefixes:
 *
 * - `route.file('fl-01')` → `/f/fl-01/`, root-relative and UNPREFIXED. Feed
 *   these to a router that already knows its own base.
 * - `withBase(route.file('fl-01'))` → `/showcase/design/react/f/fl-01/`. For
 *   anywhere nothing prefixes for us: a raw `href`, an `<a>` in a static page,
 *   `location.assign`.
 *
 * Every path ends in `/`. The static builds export directories with an
 * `index.html`, and a static host cannot issue the redirect a missing slash
 * would need.
 */

/** Path that precedes the framework segment, on every deployment. */
export const SHOWCASE_BASE = '/showcase/design';

/**
 * Every framework this vertical is built for, in dock display order.
 *
 * Five builds, no server-rendered siblings — the standing decision for every
 * vertical after credit-risk. It holds here for a reason none of the others
 * had: the editor's whole state is a document being mutated by a pointer, and
 * a server has nothing to contribute to the first paint of a canvas whose
 * contents the reader is about to drag.
 */
export const FRAMEWORKS = ['html', 'react', 'vue', 'angular', 'svelte'] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/**
 * Screen paths, root-relative and without the base prefix.
 *
 * A PROJECT AND AN ASSET GET SLUGS; A FILE KEEPS ITS ID. Project names are
 * distinctive and stable, so `/p/meridian-rebrand/` reads well. File names are
 * not: "Cover" and "Hero" recur in every project, so a slug would collide and
 * disambiguating it would produce exactly the opaque URL a slug avoids. The id
 * is honest about being an id.
 */
export const route = {
  projects: () => '/',
  editor: () => '/editor/',
  assets: () => '/assets/',
  profile: () => '/profile/',
  project: (slug: string) => `/p/${slug}/`,
  file: (id: string) => `/f/${id}/`,
  asset: (id: string) => `/a/${id}/`,
} as const;

export type RouteName = keyof typeof route;

/* ---------------------------------------------------------- destinations */

/**
 * The top-level destinations, in navigation order.
 *
 * FOUR DESTINATIONS FOR SEVEN ROUTES, and four rather than five on purpose.
 * This vertical is editor-dominant: the Editor screen carries a toolbar, a
 * layer tree, a canvas and an inspector, and padding the navigation out to five
 * would mean inventing a destination to sit beside it. `md-navigation-bar` is
 * specified for 3–5 and the rail for 3–7, so four works in both and the two
 * surfaces render the SAME array.
 *
 * THE ORDER IS BROWSE, EDIT, REUSE, YOU. Projects is where a session starts,
 * Editor is where it is spent, Assets is what it draws from, Profile belongs to
 * the reader.
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
  { value: 'projects', path: route.projects(), icon: 'folder', activeIcon: 'folder_open', labelKey: 'design.nav.projects' },
  { value: 'editor', path: route.editor(), icon: 'draw', activeIcon: 'draw', labelKey: 'design.nav.editor' },
  { value: 'assets', path: route.assets(), icon: 'palette', activeIcon: 'palette', labelKey: 'design.nav.assets' },
  { value: 'profile', path: route.profile(), icon: 'account_circle', activeIcon: 'account_circle', labelKey: 'design.nav.profile' },
] as const;

/**
 * Which destination a path belongs to, or `null` when none does.
 *
 * A FILE DRILL BELONGS TO THE EDITOR, not to Projects — opening a file IS
 * editing it, and the drill is the editor pointed at a different document. A
 * project drill belongs to Projects because it is a folder listing. An asset
 * drill belongs to Assets for the same reason.
 *
 * `projects` owns `/` and is matched exactly, or it would prefix-match
 * everything.
 */
export function destinationFor(pathname: string): Destination | null {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  if (path === '/') return DESTINATIONS[0];
  if (path.startsWith('/p/')) return DESTINATIONS[0];
  if (path.startsWith('/f/')) return DESTINATIONS[1];
  if (path.startsWith('/a/')) return DESTINATIONS[2];
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
 * `label` carries a proper noun — a project's name, a file's name, an asset's
 * name. Every drill here has one, because everything this app addresses is a
 * named thing the reader created. So no crumb in this file falls back to a
 * translated placeholder.
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
      { labelKey: 'design.nav.projects', label: null, href: route.projects() },
      { labelKey: null, label, href: null },
    ];
  }
  if (path.startsWith('/f/')) {
    return [
      { labelKey: 'design.nav.editor', label: null, href: route.editor() },
      { labelKey: null, label, href: null },
    ];
  }
  if (path.startsWith('/a/')) {
    return [
      { labelKey: 'design.nav.assets', label: null, href: route.assets() },
      { labelKey: null, label, href: null },
    ];
  }
  return [];
}

/* --------------------------------------------------------------- binding */

export interface DesignRoutes {
  /** This build's framework id — the segment the dock swaps. */
  framework: Framework;
  /** e.g. `/showcase/design/react`. No trailing slash. */
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
export function createRoutes(framework: Framework): DesignRoutes {
  const basePath = `${SHOWCASE_BASE}/${framework}`;
  return { framework, basePath, route, withBase: (path: string) => `${basePath}${path}` };
}
