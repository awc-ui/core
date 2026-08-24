/**
 * The bridge between `<awc-showcase-dock>` and React.
 *
 * `subscribeShowcaseState` is exactly the shape an effect hook wants: it fires
 * immediately with the current state and returns an unsubscribe. We deliberately
 * do NOT listen for the `awc-showcase-change` event as well — the dock dispatches
 * it on `window` AND on the element, and listening on both double-renders.
 *
 * WHY THE FIRST RENDER IS STILL `DEFAULT_STATE` (en / ltr) EVEN THOUGH THERE IS
 * NO HYDRATION LEFT TO MATCH.
 *
 * In the build this was ported from, the first client render had to reproduce
 * the markup the server had already sent or React would throw a hydration
 * mismatch. Nothing is pre-rendered here, so that reason is gone — and the
 * two-step render is kept anyway, for a different one.
 *
 * `scripts/verify-showcase-parity.mjs` compares the five other builds against
 * THIS one, screen by screen, on the visible text of `.shell`. It loads a bare
 * URL with no query and no localStorage, so every build must settle on English;
 * reading the real state synchronously before the first paint would not change
 * where this build settles, but it WOULD make the reference's first frame
 * differ from theirs on any machine where storage survives between runs. The
 * subscription lands in an effect, fires immediately with the state read from
 * the URL and localStorage, and re-renders. On a bare load the two frames are
 * identical, so nothing is visible; with `?lang=ro` in the URL there is one
 * English frame, exactly as there was before.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_STATE, subscribeShowcaseState, type ShowcaseState } from '@awc-ui/showcase-kit/dock';
import {
  createTranslator,
  type TranslateParams,
  type Translator,
} from '@awc-ui/showcase-kit/i18n';

/**
 * The kit's `Translator` is an object with a `t` METHOD, which reads as
 * `t.t('table.ead')` at every call site. Screens call `t()` hundreds of times, so
 * the object is flattened into a callable that still carries the locale-bound
 * `format*` methods: `t('table.ead')` and `t.formatCurrency(x)` on one value.
 */
export type T = ((key: string, params?: TranslateParams) => string) &
  Pick<Translator, 'has' | 'formatCurrency' | 'formatNumber' | 'formatPercent' | 'formatDate'> & {
    readonly locale: Translator['locale'];
    readonly dir: Translator['dir'];
  };

function callable(translator: Translator): T {
  const fn = ((key: string, params?: TranslateParams) => translator.t(key, params)) as T;
  return Object.assign(fn, {
    has: (key: string) => translator.has(key),
    formatCurrency: translator.formatCurrency.bind(translator),
    formatNumber: translator.formatNumber.bind(translator),
    formatPercent: translator.formatPercent.bind(translator),
    formatDate: translator.formatDate.bind(translator),
    locale: translator.locale,
    dir: translator.dir,
  });
}

interface ShowcaseContextValue {
  state: ShowcaseState;
  /** Locale-bound translator + Intl formatters. Cached per locale by the kit. */
  t: T;
  /** `true` once the subscription has replaced the default first render. */
  ready: boolean;
}

const ShowcaseContext = createContext<ShowcaseContextValue>({
  state: DEFAULT_STATE,
  t: callable(createTranslator(DEFAULT_STATE.locale)),
  ready: false,
});

export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShowcaseState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeShowcaseState((detail) => {
      setState(detail.state);
      setReady(true);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<ShowcaseContextValue>(
    () => ({ state, t: callable(createTranslator(state.locale)), ready }),
    [state, ready],
  );

  return <ShowcaseContext.Provider value={value}>{children}</ShowcaseContext.Provider>;
}

/** The translator plus the raw dock state. Every visible string goes through `t`. */
export function useShowcase(): ShowcaseContextValue {
  return useContext(ShowcaseContext);
}

/** Shorthand for the common case. */
export function useT(): T {
  return useContext(ShowcaseContext).t;
}
