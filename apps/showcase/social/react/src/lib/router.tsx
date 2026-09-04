/**
 * The router. Sixty lines of `history.pushState`, and that is the whole of it.
 *
 * WHY NOT A ROUTER LIBRARY. This app has six route patterns, one of which takes
 * a parameter, and it already intercepts its own link clicks — the rail, the
 * navigation bar and the breadcrumb trail are custom elements whose `href` is a
 * real anchor, so they need a click veto that no `<Link>` component can supply.
 * A library would arrive after those three are written and replace the
 * remaining twenty lines. It would also be a new workspace dependency for a
 * build whose entire premise is "no meta-framework".
 *
 * TWO PATH FLAVOURS, exactly as in `@awc-ui/showcase-kit/social`: everything
 * crossing this module's surface — `push()`, `<Link href>`, the value
 * `usePathname()` returns — is UNPREFIXED (`/holdings/`). The mount is added on
 * the way out to the DOM and stripped on the way in from `location`.
 *
 * NO WRAPPER ELEMENT. `RouterProvider` renders a context provider and nothing
 * else; the matched screen is returned directly, so the shell's children are
 * the same list in every port.
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
 * missing-slash redirect, and `destinationFor()` prefix-matches on those
 * paths — which is only ever right if both sides agree about that slash.
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
  /** UNPREFIXED, e.g. `/holdings/`. */
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
    setPathname(next);
    // A drill into a household from row 6 of a table otherwise opens halfway
    // down the new screen.
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

/** The current route, unprefixed. */
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
 * an `<a>` and not a button: ⌘-click opens a tab, middle-click opens a tab, and
 * "copy link address" copies something that resolves. The click handler only
 * vetoes the plain left-click.
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

/**
 * Should this activation be handled in place, or left to the browser?
 *
 * Shared by every custom element in the shell that carries an `href` — the rail
 * tabs, the navigation-bar tabs, the breadcrumbs. Each of those is a different
 * component with a different event, but the QUESTION is the same one, and
 * getting it wrong in one of the three is how a ⌘-click ends up routing in
 * place instead of opening a tab.
 */
export function isPlainActivation(
  event: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'button'> | undefined,
): boolean {
  if (!event) return true;
  if (event.button !== undefined && event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}
