/**
 * The router. `history.pushState` and a module-level ref, and that is the whole
 * of it.
 *
 * WHY NOT VUE ROUTER. This app has six route patterns, three of which are one
 * segment deep, and it already intercepts its own link clicks — the section nav
 * and the breadcrumb trail are custom elements whose `href` is a real anchor, so
 * they need an `mdClick`/`mdSelect` veto that no `<RouterLink>` can supply.
 * A library would arrive after those two are written and replace the twenty
 * lines that remain. It would also be a new workspace dependency for a build
 * whose entire premise is "no meta-framework". The SPA reference next door
 * (`apps/showcase/credit-risk/react/src/lib/router.tsx`) makes the same call for
 * the same reasons, and this file is its Vue counterpart line for line.
 *
 * WHY THE API IS NUXT'S. Every screen in this app was copied verbatim from the
 * Nuxt build in the same pair, and the parity check compares the two trees
 * element by element. `useRouter().push()` keeps the two call sites in
 * `Shell.vue` and `OverviewScreen.vue` byte-identical to their originals — so a
 * divergence in the rendered DOM can only come from this file, not from a
 * rewritten screen. `usePathname()` replaces `useRoute().path`, which is the one
 * place the shape had to change: Vue Router hands back a reactive route OBJECT,
 * and there is no object here to hand back.
 *
 * TWO PATH FLAVOURS, exactly as before (see `@awc-ui/showcase-kit/credit-risk`):
 * everything crossing this module's surface — `push()`, the value `usePathname()`
 * returns — is UNPREFIXED (`/sectors/energy/`). The mount is added on the way out
 * to the DOM and stripped on the way in from `location`. That is what Nuxt's
 * `app.baseURL` did, and it is why `Shell.vue` can go on slicing `BASE_PATH` off
 * the hrefs it intercepts.
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
 * missing-slash redirect, and `Shell.vue` marks the current section with
 * `here.startsWith(route.watchlist())` — which is only ever true if both sides
 * agree about that slash.
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
  /** UNPREFIXED, e.g. `/sectors/energy/`. Nuxt's `useRoute().path` under `baseURL`. */
  pathname: ComputedRef<string>;
  /** Navigate, adding a history entry. Takes an unprefixed path. */
  push(href: string): void;
  /** Navigate, replacing the current history entry. */
  replace(href: string): void;
}

function navigate(href: string, replace: boolean): void {
  const next = toAppPath(href);
  /*
   * THE QUERY STRING SURVIVES THE NAVIGATION, and this is a deliberate
   * departure from the build these screens were copied from.
   *
   * Nuxt's `router.push('/watchlist/')` dropped it. The dock keeps theme,
   * locale, dir, density and accent in the URL (`URL_PARAMS` in the kit's dock
   * state) precisely so state can travel — including across the framework
   * switcher, which lands on another origin in dev where localStorage does not
   * follow. Dropping the params on every in-app navigation makes the address
   * bar stop describing the page you are looking at, and makes a copied link
   * revert to defaults. localStorage covered it up in the twin because the same
   * browser was reloading; a link sent to someone else was never covered.
   */
  const url = `${withBase(next)}${location.search}${location.hash}`;
  if (replace) history.replaceState(history.state, '', url);
  else if (url !== location.pathname + location.search + location.hash) {
    history.pushState(null, '', url);
  }
  pathname.value = next;
  // Nuxt scrolls to the top of a pushed route; a drill into a facility from row
  // 18 of a table otherwise opens halfway down the new screen.
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

/** Nuxt's `useRouter()`, same two methods, same unprefixed paths. */
export function useRouter(): Router {
  return router;
}

/**
 * The current route, unprefixed — what `useRoute().path` returned in the twin.
 *
 * A `ComputedRef`, so a call site reads `here.value` exactly as it read
 * `currentRoute.path` through a `computed` before, and cannot write to it.
 */
export function usePathname(): ComputedRef<string> {
  return router.pathname;
}
