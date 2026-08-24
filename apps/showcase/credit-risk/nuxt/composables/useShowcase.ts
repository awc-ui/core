/**
 * The bridge between `<awc-showcase-dock>` and Vue.
 *
 * `subscribeShowcaseState` fires immediately with the current state and returns
 * an unsubscribe, which is exactly what a `ref` plus an `onScopeDispose` wants.
 * We deliberately do NOT also listen for the `awc-showcase-change` event — the
 * dock dispatches it on `window` AND on the element, and listening to both
 * would update twice per change.
 *
 * HYDRATION: the first client render must produce the same markup the SERVER
 * produced, so the initial state is `DEFAULT_STATE` (en / ltr) on both sides.
 * The subscription starts in `onMounted`, after hydration, and the re-render
 * with the real locale from the URL or localStorage happens immediately after.
 * The server has no authoritative locale for a request either way — the dock
 * keeps it in a query param and in localStorage, and only client JavaScript
 * reads those — so this is not a choice the server render could improve on.
 *
 * ONE SUBSCRIPTION FOR THE WHOLE APP. The state lives in a module-level ref
 * rather than per-component, so twenty components calling `useT()` on one
 * screen share one listener instead of twenty.
 */

import { computed, onMounted, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue';
import { DEFAULT_STATE, subscribeShowcaseState, type ShowcaseState } from '@awc-ui/showcase-kit/dock';
import {
  createTranslator,
  type TranslateParams,
  type Translator,
} from '@awc-ui/showcase-kit/i18n';

/**
 * The kit's `Translator` is an object with a `t` METHOD, which reads as
 * `t.t('table.ead')` at every call site. Screens call it hundreds of times, so
 * it is flattened into a callable that still carries the locale-bound `format*`
 * methods: `t('table.ead')` and `t.formatCurrency(x)` on one value.
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

const state = ref<ShowcaseState>(DEFAULT_STATE);
let subscribers = 0;
let unsubscribe: (() => void) | undefined;

/** The raw dock state. `DEFAULT_STATE` on the server and until the dock publishes. */
export function useShowcaseState(): Ref<ShowcaseState> {
  if (import.meta.client) {
    onMounted(() => {
      subscribers += 1;
      if (!unsubscribe) {
        unsubscribe = subscribeShowcaseState((detail) => {
          state.value = detail.state;
        });
      }
    });
    onScopeDispose(() => {
      subscribers -= 1;
      if (subscribers <= 0) {
        unsubscribe?.();
        unsubscribe = undefined;
      }
    });
  }
  return state;
}

/** Locale-bound translator + Intl formatters. Every visible string goes through it. */
export function useT(): ComputedRef<T> {
  const current = useShowcaseState();
  return computed(() => callable(createTranslator(current.value.locale)));
}
