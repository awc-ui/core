/**
 * The router. A store, `history.pushState`, and that is the whole of it.
 *
 * WHY NOT A ROUTER LIBRARY. This app has six route patterns, one of them one
 * segment deep, and it already intercepts its own link clicks — the navigation
 * rail, the compact navigation bar and the breadcrumb trail are custom elements
 * whose `href` is a real anchor inside a shadow root, so they need a native
 * click / `mdSelect` veto that no `<Link>` component can supply. A library
 * would arrive after those are written and replace the twenty lines that are
 * left. It would also be a new workspace dependency, for a build whose entire
 * premise is "no meta-framework".
 *
 * WHY THE API MATCHES THE CREDIT-RISK SVELTE BUILD. Both Svelte apps in this
 * repo carry the same router so a reader can diff them and see only the
 * vertical change. `$pathname` is the current route as a store and `navigate()`
 * is the one way to move; the call sites in the shell components and
 * `Drill.svelte` stay a line-for-line match with the sibling build.
 *
 * TWO PATH FLAVOURS, exactly as in `@awc-ui/showcase-kit/community`: everything
 * crossing this module's surface — the value `$pathname` holds, the argument to
 * `navigate()` — is UNPREFIXED (`/households/hh-01/`). The mount is added on
 * the way out to the DOM and stripped on the way in from `location`.
 *
 * `navigate()` tolerates a PREFIXED path too, because several of its callers
 * hand it one: the `mdSelect` detail and the rail tab's `href` carry the
 * anchor's real href, which has to be prefixed to work with JavaScript off.
 * `toAppPath()` normalises either shape, so a caller cannot double or drop the
 * segment — the single most common bug in this vertical.
 */

import { writable, type Readable } from 'svelte/store';
import { BASE_PATH, withBase } from '$lib/routes';

/* ------------------------------------------------------------ path shapes */

/**
 * A `location.pathname` in this build's mount → the shape `route.*` produces.
 *
 * Both ends are normalised: a leading slash always, a trailing slash always.
 * The kit's paths all end in `/` because a static host cannot issue the
 * missing-slash redirect, and `destinationFor()` prefix-matches — only ever
 * right if both sides agree about that slash.
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
 * is deliberate. Every importer of this module is a component, and components
 * run in one place. There is no server here, so a guard would be an
 * unreachable branch inviting a reader to work out what triggers it.
 */
const path = writable(currentPath());

/** The current route, UNPREFIXED. */
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
  // A pushed route starts at the top. Drilling into a household from row 18 of
  // the book otherwise opens the new screen halfway down.
  window.scrollTo(0, 0);
}

/**
 * Is this a click the router should take over?
 *
 * Anything but a plain primary click is the browser's: modifier clicks open
 * tabs and windows, and a link that looks like a link and then refuses to
 * behave like one is worse than no link. A `KeyboardEvent` from the custom
 * elements' `originalEvent` goes through the same check, which is why the
 * `button` test is guarded rather than assumed.
 */
export function isPlainClick(event: MouseEvent | KeyboardEvent | undefined): boolean {
  if (!event) return true;
  if ('button' in event && event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
