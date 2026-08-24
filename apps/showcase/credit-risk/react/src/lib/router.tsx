/**
 * The router. Sixty lines of `history.pushState`, and that is the whole of it.
 *
 * WHY NOT A ROUTER LIBRARY. This app has six route patterns, three of which are
 * one segment deep, and it already intercepts its own link clicks — the section
 * nav and the breadcrumb trail are custom elements whose `href` is a real
 * anchor, so they need a `mdClick`/`mdSelect` veto that no `<Link>` component
 * can supply. A library would arrive after those two are written and replace
 * the remaining twenty lines. It would also be a new workspace dependency
 * (nothing in the store today), for a build whose entire premise is "no
 * meta-framework".
 *
 * WHY THE API IS NEXT'S. Every screen in this app was ported verbatim from the
 * Next build next door, and the parity check compares the two trees element by
 * element. `usePathname()`, `useRouter().push()` and `<Link href>` keep the
 * three call sites in `Shell.tsx` and `OverviewScreen.tsx` byte-identical to
 * their originals, so a divergence in the rendered DOM can only come from this
 * file — not from a rewritten screen.
 *
 * TWO PATH FLAVOURS, exactly as before (see `@awc-ui/showcase-kit/credit-risk`):
 * everything crossing this module's surface — `push()`, `<Link href>`, the
 * value `usePathname()` returns — is UNPREFIXED (`/sectors/energy/`). The mount
 * is added on the way out to the DOM and stripped on the way in from
 * `location`. That is what Next's `basePath` did, and it is why `SectionNav`
 * can go on calling `href.replace(withBase(''), '')` unchanged.
 *
 * NO WRAPPER ELEMENT. `RouterProvider` renders a context provider and nothing
 * else; the matched screen is returned directly. `scripts/verify-showcase-parity.mjs`
 * measures the vertical gaps between `.shell`'s children, and a real `<div>`
 * around the route output becomes one of them — the exact bug its header
 * records against the html and astro builds.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { BASE_PATH, withBase } from '@/lib/routes';

/* ------------------------------------------------------------ path shapes */

/**
 * A `location.pathname` in this build's mount → the shape `route.*` produces.
 *
 * Both ends are normalised: a leading slash always, a trailing slash always.
 * The kit's paths all end in `/` because a static host cannot issue the
 * missing-slash redirect, and `SectionNav` marks the current section with
 * `pathname.startsWith(route.watchlist())` — which is only ever true if both
 * sides agree about that slash.
 */
export function toAppPath(pathname: string): string {
  let path = pathname;
  if (path === BASE_PATH) path = '/';
  else if (path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length);
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return path;
}

/* ---------------------------------------------------------------- context */

export interface Router {
  /** UNPREFIXED, e.g. `/sectors/energy/`. Next's `usePathname()` under `basePath`. */
  pathname: string;
  /** Navigate, adding a history entry. Takes an unprefixed path. */
  push(href: string): void;
  /** Navigate, replacing the current history entry. */
  replace(href: string): void;
}

const RouterContext = createContext<Router>({
  pathname: '/',
  push: () => {},
  replace: () => {},
});

const currentPath = () => toAppPath(typeof location === 'undefined' ? '/' : location.pathname);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(currentPath);

  // Back and forward. `pushState` does not fire `popstate`, so this only ever
  // sees a real history traversal — no need to guard against our own writes.
  useEffect(() => {
    const onPop = () => setPathname(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((href: string, replace: boolean) => {
    const next = toAppPath(href);
    /*
     * THE QUERY STRING SURVIVES THE NAVIGATION, and this is a deliberate
     * departure from the build that came before.
     *
     * Next's `router.push('/watchlist/')` dropped it. The dock keeps theme,
     * locale, dir, density and accent in the URL (`URL_PARAMS` in the kit's
     * dock state) precisely so state can travel — including across the
     * framework switcher, which lands on another origin in dev where
     * localStorage does not follow. Dropping the params on every in-app
     * navigation makes the address bar stop describing the page you are
     * looking at, and makes a copied link revert to defaults. localStorage
     * covered it up in the export because the same browser was reloading;
     * a link sent to someone else was never covered.
     */
    const url = `${withBase(next)}${location.search}${location.hash}`;
    if (replace) history.replaceState(history.state, '', url);
    else if (url !== location.pathname + location.search + location.hash) {
      history.pushState(null, '', url);
    }
    setPathname(next);
    // Next scrolls to the top of a pushed route; a drill into a facility from
    // row 18 of a table otherwise opens halfway down the new screen.
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo<Router>(
    () => ({
      pathname,
      push: (href: string) => navigate(href, false),
      replace: (href: string) => navigate(href, true),
    }),
    [pathname, navigate],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): Router {
  return useContext(RouterContext);
}

/** The current route, unprefixed. Next's `usePathname()`, same contract. */
export function usePathname(): string {
  return useContext(RouterContext).pathname;
}

/* ------------------------------------------------------------------- Link */

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** Root-relative and UNPREFIXED — a `route.*` value. */
  href: string;
  children: ReactNode;
};

/**
 * An anchor that routes in place.
 *
 * It carries a REAL, fully-prefixed `href`, which is the entire reason this is
 * an `<a>` and not a button: ⌘-click opens a tab, middle-click opens a tab,
 * "copy link address" copies something that resolves, and the deep link works
 * on a cold load because the build fans `index.html` out across every route.
 * The click handler only vetoes the plain left-click.
 *
 * `className` before `href` so the emitted attribute order matches what
 * `next/link` produced: `<a class="drill" href="…">`.
 */
export function Link({ href, className, children, onClick, ...rest }: LinkProps) {
  const { push } = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Anything but a plain primary click is the browser's to handle: modifier
    // clicks open tabs and windows, and a link that looks like a link and then
    // refuses to behave like one is worse than no link.
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    push(href);
  };

  return (
    <a className={className} href={withBase(href)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
