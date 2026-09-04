/**
 * The router. `history.pushState` and a module-level ref, and that is the whole
 * of it.
 *
 * WHY NOT VUE ROUTER. This app has six route patterns, one of which takes a
 * parameter, and it already intercepts its own link clicks — the rail, the
 * navigation bar and the breadcrumb trail are custom elements whose `href` is a
 * real anchor, so they need a click veto that no `<RouterLink>` can supply.
 * A library would arrive after those three are written and replace the twenty
 * lines that remain. It would also be a new workspace dependency for a build
 * whose entire premise is "no meta-framework". The credit-risk Vue build makes
 * the same call for the same reasons, and this file is its wealth counterpart
 * line for line.
 *
 * TWO PATH FLAVOURS, exactly as in `@awc-ui/showcase-kit/social`: everything
 * crossing this module's surface — `push()`, the value `usePathname()` returns —
 * is UNPREFIXED (`/holdings/`). The mount is added on the way out to the DOM and
 * stripped on the way in from `location`.
 *
 * MODULE-LEVEL STATE, NOT PROVIDE/INJECT. There is exactly one router per
 * document and it outlives every component, so a `ref` in module scope is the
 * whole store — the same shape `composables/useShowcase.ts` uses for the dock
 * state. The React port needed a context provider because React has no reactive
 * value that survives outside a tree; Vue does, and a provider component here
 * would only add a wrapper for the renderer to walk.
 */

import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { BASE_PATH, withBase } from '~/lib/routes';

/* ------------------------------------------------------------ path shapes */

/**
 * A `location.pathname` in this build's mount → the shape `route.*` produces.
 *
 * Both ends are normalised: a leading slash always, a trailing slash always.
 * The kit's paths all end in `/` because a static host cannot issue the
 * missing-slash redirect, and `destinationFor()` prefix-matches on those paths —
 * which is only ever right if both sides agree about that slash.
 */
export function toAppPath(pathname: string): string {
  let path = pathname;
  if (path === BASE_PATH) path = '/';
  else if (path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length);
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return path;
}

/* -------------------------------------------------------------- the store */

const currentPath = (): string =>
  toAppPath(typeof location === 'undefined' ? '/' : location.pathname);

const pathname: Ref<string> = ref(currentPath());

export interface Router {
  /** UNPREFIXED, e.g. `/holdings/`. */
  pathname: ComputedRef<string>;
  /** Navigate, adding a history entry. Takes an unprefixed path. */
  push(href: string): void;
  /** Navigate, replacing the current history entry. */
  replace(href: string): void;
}

function navigate(href: string, replace: boolean): void {
  const next = toAppPath(href);
  /*
   * THE QUERY STRING SURVIVES THE NAVIGATION.
   *
   * The dock keeps theme, locale, dir, density and accent in the URL
   * (`URL_PARAMS` in the kit's dock state) precisely so state can travel —
   * including across the framework switcher, which lands on another origin in
   * dev where localStorage does not follow. Dropping the params on every
   * in-app navigation makes the address bar stop describing the page you are
   * looking at, and makes a copied link revert to defaults.
   */
  const url = `${withBase(next)}${location.search}${location.hash}`;
  if (replace) history.replaceState(history.state, '', url);
  else if (url !== location.pathname + location.search + location.hash) {
    history.pushState(null, '', url);
  }
  pathname.value = next;
  // A drill into a household from row 6 of a table otherwise opens halfway
  // down the new screen.
  window.scrollTo(0, 0);
}

/**
 * Start listening for history traversal. Called once from `main.ts`, before the
 * app mounts.
 *
 * `pushState` does not fire `popstate`, so this only ever sees a real back or
 * forward — no need to guard against our own writes. It is a separate call
 * rather than module top-level work so that importing this module stays free of
 * side effects, and so `pathname` is re-read at mount rather than at whatever
 * point in the import graph this file happened to be evaluated.
 */
export function startRouter(): void {
  pathname.value = currentPath();
  window.addEventListener('popstate', () => {
    pathname.value = currentPath();
  });
}

/* --------------------------------------------------------------- the hooks */

const router: Router = {
  pathname: computed(() => pathname.value),
  push: (href: string) => navigate(href, false),
  replace: (href: string) => navigate(href, true),
};

/** The router — `push()` and `replace()`, unprefixed paths. */
export function useRouter(): Router {
  return router;
}

/**
 * The current route, unprefixed.
 *
 * A `ComputedRef`, so a call site reads `here.value` and cannot write to it.
 */
export function usePathname(): ComputedRef<string> {
  return router.pathname;
}

/**
 * Should this activation be handled in place, or left to the browser?
 *
 * Shared by every custom element in the shell that carries an `href` — the rail
 * tabs, the navigation-bar tabs, the breadcrumbs — and by `<Drill>`. Each of
 * those is a different component with a different event, but the QUESTION is
 * the same one, and getting it wrong in one of them is how a ⌘-click ends up
 * routing in place instead of opening a tab.
 */
export function isPlainActivation(
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'button'> | undefined,
): boolean {
  if (!event) return true;
  if (event.button !== undefined && event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
