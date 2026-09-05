/**
 * The bridge between `<awc-showcase-dock>` and Svelte.
 *
 * `subscribeShowcaseState` is exactly the shape a readable store's start
 * function wants: it fires immediately with the current state and returns an
 * unsubscribe. We deliberately do NOT also listen for the
 * `awc-showcase-change` event — the dock dispatches it on `window` AND on the
 * element, and listening to both would update the store twice per change.
 *
 * THE INITIAL VALUE IS `DEFAULT_STATE` (en / ltr) and is replaced within the
 * same tick. There is no server render in this build, so nothing has to match
 * across a hydration boundary — but the dock module is imported lazily (see
 * `components/Dock.svelte`), so the first frame is drawn before it has
 * published, and the store needs a value that is not `undefined`. What keeps
 * that frame from being visibly English on a Romanian page is the preboot
 * script, which stamps lang / dir / theme onto `<html>` before the first paint;
 * the strings follow a moment later, through this store. Same bargain as every
 * other build in the vertical.
 */

import { derived, readable, type Readable } from 'svelte/store';
import { DEFAULT_STATE, subscribeShowcaseState, type ShowcaseState } from '@awc-ui/showcase-kit/dock';
import {
  createTranslator,
  type TranslateParams,
  type Translator,
} from '@awc-ui/showcase-kit/i18n';

/**
 * The kit's `Translator` is an object with a `t` METHOD, which reads as
 * `$t.t('community.table.aum')` at every call site. Screens call it hundreds of
 * times, so it is flattened into a callable that still carries the locale-bound
 * `format*` methods: `$t('community.table.aum')` and `$t.formatCurrency(x)` on one
 * value.
 */
export type T = ((key: string, params?: TranslateParams) => string) &
  Pick<
    Translator,
    | 'has'
    | 'formatCurrency'
    | 'formatNumber'
    | 'formatPercent'
    | 'formatDate'
    /* This vertical's headline formatter: every timestamp on every screen is a
       relative one, measured against the fixture's frozen reporting instant
       rather than the clock. */
    | 'formatRelativeTime'
  > & {
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
    formatRelativeTime: translator.formatRelativeTime.bind(translator),
    locale: translator.locale,
    dir: translator.dir,
  });
}

/** The raw dock state. `DEFAULT_STATE` until the dock publishes. */
export const state: Readable<ShowcaseState> = readable(DEFAULT_STATE, (set) =>
  subscribeShowcaseState((detail) => set(detail.state)),
);

/** Locale-bound translator + Intl formatters. Every visible string goes through it. */
export const t: Readable<T> = derived(state, ($state) => callable(createTranslator($state.locale)));
