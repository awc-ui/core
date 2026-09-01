/**
 * The bridge between `<awc-showcase-dock>` and Vue.
 *
 * `subscribeShowcaseState` fires immediately with the current state and returns
 * an unsubscribe, which is exactly what a `ref` plus an `onScopeDispose` wants.
 * We deliberately do NOT also listen for the `awc-showcase-change` event — the
 * dock dispatches it on `window` AND on the element, and listening to both
 * would update twice per change.
 *
 * WHY THE FIRST RENDER IS STILL `DEFAULT_STATE` (en / ltr) EVEN THOUGH THERE IS
 * NO HYDRATION LEFT TO MATCH.
 *
 * In the Nuxt twin these screens were copied from, the first client render had
 * to reproduce the markup the server had already sent or Vue would tear the tree
 * down and rebuild it. Nothing is pre-rendered here, so that reason is gone —
 * and the two-step render is kept anyway, for a different one.
 *
 * `scripts/verify-showcase-parity.mjs` compares the sibling builds against each
 * other, screen by screen, on the visible text of `.shell`. It loads a bare URL
 * with no query and no localStorage, so every build must settle on English;
 * reading the real state synchronously before the first paint would not change
 * where this build settles, but it WOULD make its first frame differ from
 * theirs on any machine where storage survives between runs. The subscription
 * lands in `onMounted`, fires immediately with the state read from the URL and
 * from localStorage, and re-renders. On a bare load the two frames are
 * identical, so nothing is visible; with `?lang=ro` in the URL there is one
 * English frame, exactly as there was before.
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

/**
 * Has anything actually changed? `ShowcaseState` is five primitives, so this is
 * the whole comparison.
 *
 * WHY IT IS WORTH THE SIX LINES. `subscribeShowcaseState` fires immediately on
 * subscribe with a FRESH object, and on a bare load its contents are
 * `DEFAULT_STATE` — the same five values the app already rendered with.
 * Assigning it anyway changes the ref's identity, which re-renders every screen
 * for no visible difference, on every single cold load.
 *
 * That re-render is not merely wasted, it is VISIBLE IN THE SHIPPED DOM, and
 * this is the non-obvious part. Vue picks property-versus-attribute for a custom
 * element by testing `key in el`, so the FIRST render writes `href`/`variant` as
 * attributes (Stencil has not upgraded `md-button` yet) and any LATER render
 * writes them as properties, dropping the now-stale attributes. Whether the
 * second render lands before or after the upgrade is a race, so the same build
 * served the same bytes produced `<md-button href="…">` on some loads and
 * `<md-button>` on others — measured at 2 of 12 loads keeping the attribute
 * before this guard, and 12 of 12 after.
 *
 * Nothing about the rendering depended on it either way — Stencil reads the
 * property, and the class and `aria-current` were always correct — but a DOM
 * that differs run to run is a bad thing to hand to a parity check that compares
 * this build against its siblings.
 */
const same = (a: ShowcaseState, b: ShowcaseState): boolean =>
  a.theme === b.theme &&
  a.locale === b.locale &&
  a.dir === b.dir &&
  a.density === b.density &&
  a.seed === b.seed;

/**
 * The raw dock state. `DEFAULT_STATE` until the dock publishes.
 *
 * The twin wrapped both hooks in `if (import.meta.client)`, because on the
 * server `onMounted` never fires and the subscription would have leaked a
 * listener into a request-scoped render. Every render here is a client render,
 * so the guard is gone rather than left in as an always-true branch.
 */
export function useShowcaseState(): Ref<ShowcaseState> {
  onMounted(() => {
    subscribers += 1;
    if (!unsubscribe) {
      unsubscribe = subscribeShowcaseState((detail) => {
        if (same(state.value, detail.state)) return;
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
  return state;
}

/** Locale-bound translator + Intl formatters. Every visible string goes through it. */
export function useT(): ComputedRef<T> {
  const current = useShowcaseState();
  return computed(() => callable(createTranslator(current.value.locale)));
}
