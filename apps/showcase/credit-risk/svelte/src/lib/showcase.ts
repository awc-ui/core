/**
 * The bridge between `<awc-showcase-dock>` and Svelte.
 *
 * `subscribeShowcaseState` is exactly the shape a readable store's start
 * function wants: it fires immediately with the current state and returns an
 * unsubscribe. We deliberately do NOT also listen for the
 * `awc-showcase-change` event — the dock dispatches it on `window` AND on the
 * element, and listening to both would update the store twice per change.
 *
 * HYDRATION: the first client render must produce the same markup the prerender
 * produced, so the store's initial value is `DEFAULT_STATE` (en / ltr) on both
 * sides. The subscription only starts in the browser, and the re-render with
 * the real locale from the URL or localStorage happens after hydration.
 */

import { derived, readable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import { DEFAULT_STATE, subscribeShowcaseState, type ShowcaseState } from '@awc-ui/showcase-kit/dock';
import {
  createTranslator,
  type TranslateParams,
  type Translator,
} from '@awc-ui/showcase-kit/i18n';

/**
 * The kit's `Translator` is an object with a `t` METHOD, which reads as
 * `$t.t('table.ead')` at every call site. Screens call it hundreds of times, so
 * it is flattened into a callable that still carries the locale-bound
 * `format*` methods: `$t('table.ead')` and `$t.formatCurrency(x)` on one value.
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

/** The raw dock state. `DEFAULT_STATE` until the dock publishes, and on the server. */
export const state: Readable<ShowcaseState> = readable(DEFAULT_STATE, (set) => {
  if (!browser) return;
  return subscribeShowcaseState((detail) => set(detail.state));
});

/** Locale-bound translator + Intl formatters. Every visible string goes through it. */
export const t: Readable<T> = derived(state, ($state) => callable(createTranslator($state.locale)));
