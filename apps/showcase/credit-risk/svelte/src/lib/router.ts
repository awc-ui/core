/**
 * The router. A store, `history.pushState`, and that is the whole of it.
 *
 * WHY NOT A ROUTER LIBRARY. This app has six route patterns, three of them one
 * segment deep, and it already intercepts its own link clicks — the section nav
 * and the breadcrumb trail are custom elements whose `href` is a real anchor
 * inside a shadow root, so they need an `mdClick`/`mdSelect` veto that no
 * `<Link>` component can supply. A library would arrive after those two are
 * written and replace the twenty lines that are left. It would also be a new
 * workspace dependency, for a build whose entire premise is "no meta-framework".
 *
 * WHY THE API IS SVELTEKIT'S. Every screen in this app was copied from the
 * SvelteKit build in the same pair, and `scripts/verify-showcase-parity.mjs`
 * compares the two trees element by element. `$pathname` stands in for
 * `$page.url.pathname` (already stripped of the mount, which is what
 * `Shell.svelte` did by hand) and `navigate()` stands in for `goto()`, so the
 * three call sites in `Shell.svelte`, `Drill.svelte` and `OverviewScreen.svelte`
 * stay a line-for-line swap. A divergence in the rendered DOM can then only
 * come from this file, not from a rewritten screen.
 *
 * TWO PATH FLAVOURS, exactly as in `@awc-ui/showcase-kit/credit-risk`:
 * everything crossing this module's surface — the value `$pathname` holds, the
 * argument to `navigate()` — is UNPREFIXED (`/sectors/energy/`). The mount is
 * added on the way out to the DOM and stripped on the way in from `location`.
 * That is what SvelteKit's `paths.base` did, and it is why `Shell.svelte` can
 * go on comparing `here` against a bare `route.watchlist()`.
 *
 * `navigate()` tolerates a PREFIXED path too, because two of its three callers
 * hand it one: the `mdClick`/`mdSelect` detail carries the anchor's real href,
 * which has to be prefixed to work with JavaScript off. `toAppPath()` normalises
 * either shape, so a caller cannot double or drop the segment — the single most
 * common bug in this vertical.
 */

import { writable, type Readable } from 'svelte/store';
import { BASE_PATH, withBase } from '$lib/routes';

/* ------------------------------------------------------------ path shapes */

/**
 * A `location.pathname` in this build's mount → the shape `route.*` produces.
 *
 * Both ends are normalised: a leading slash always, a trailing slash always.
 * The kit's paths all end in `/` because a static host cannot issue the
 * missing-slash redirect, and the section nav marks the current section with
 * `here.startsWith(route.watchlist())` — only ever true if both sides agree
 * about that slash.
 */
export function toAppPath(pathname: string): string {
  let path = pathname;
  if (path === BASE_PATH) path = '/';
  else if (path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length);
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return path;
}

/* ---------------------------------------------------------------- the store */

const currentPath = () => toAppPath(location.pathname);

/*
 * `location` is read at module scope, with no `typeof window` guard, and that
 * is deliberate. Every importer of this module — `App.svelte`, `Shell.svelte`,
 * `Drill.svelte`, `OverviewScreen.svelte` — is a component, and components run
 * in one place. The SvelteKit twin needed such guards because its equivalents
 * were also evaluated during the server render; there is no server here, so a
 * guard would be an unreachable branch inviting a reader to work out what
 * triggers it.
 */
const path = writable(currentPath());

/**
 * The current route, UNPREFIXED. SvelteKit's `$page.url.pathname` minus `base`,
 * which is the only part of `$page` any screen in this app ever read.
 */
export const pathname: Readable<string> = { subscribe: path.subscribe };

// Back and forward. `pushState` does not fire `popstate`, so this only ever
// sees a real history traversal — no need to guard against our own writes.
window.addEventListener('popstate', () => path.set(currentPath()));

/* ------------------------------------------------------------- navigation */

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

/**
 * Go to a route. Takes either flavour of path; see the note at the top.
 *
 * THE QUERY STRING SURVIVES THE NAVIGATION. The dock keeps theme, locale, dir,
 * density and accent in the URL (`URL_PARAMS` in the kit's dock state)
 * precisely so state can travel — including across the framework switcher,
 * which in dev lands on another origin where localStorage does not follow.
 * Dropping the params on every in-app navigation would make the address bar
 * stop describing the page you are looking at, and make a copied link revert to
 * defaults for whoever you sent it to.
 */
export function navigate(href: string, { replace = false }: NavigateOptions = {}): void {
  const next = toAppPath(href);
  const url = `${withBase(next)}${location.search}${location.hash}`;
  if (replace) history.replaceState(history.state, '', url);
  else if (url !== location.pathname + location.search + location.hash) {
    history.pushState(null, '', url);
  }
  path.set(next);
  // A pushed route starts at the top. Drilling into a facility from row 18 of a
  // table otherwise opens the new screen halfway down.
  window.scrollTo(0, 0);
}

/**
 * Is this a click the router should take over?
 *
 * Anything but a plain primary click is the browser's: modifier clicks open
 * tabs and windows, and a link that looks like a link and then refuses to
 * behave like one is worse than no link. A `keyboardEvent` from the custom
 * elements' `originalEvent` goes through the same check, which is why the
 * `button` test is guarded rather than assumed.
 */
export function isPlainClick(event: MouseEvent | KeyboardEvent | undefined): boolean {
  if (!event) return true;
  if ('button' in event && event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
