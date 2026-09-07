import { pictorText, hasPictorArabic } from "@awc-ui/pictor-model";
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  type ComputedRef,
  type Ref,
} from "vue";
import {
  DEFAULT_STATE,
  subscribeShowcaseState,
  type ShowcaseState,
} from "@awc-ui/showcase-kit/dock";
import {
  createTranslator,
  type TranslateParams,
  type Translator,
} from "@awc-ui/showcase-kit/i18n";

export type T = ((key: string, params?: TranslateParams) => string) &
  Pick<
    Translator,
    | "has"
    | "formatCurrency"
    | "formatNumber"
    | "formatPercent"
    | "formatDate"
    | "formatRelativeTime"
  > & {
    readonly locale: Translator["locale"];
    readonly dir: Translator["dir"];
  };

function callable(translator: Translator): T {
  const fn = ((key: string, params?: TranslateParams) =>
    translator.has(key)
      ? translator.t(key, params)
      : pictorText(translator.locale, key, params)) as T;
  return Object.assign(fn, {
    has: (key: string) => translator.has(key) || hasPictorArabic(key),
    formatCurrency: translator.formatCurrency.bind(translator),
    formatNumber: translator.formatNumber.bind(translator),
    formatPercent: translator.formatPercent.bind(translator),
    formatDate: translator.formatDate.bind(translator),
    formatRelativeTime: translator.formatRelativeTime.bind(translator),
    locale: translator.locale,
    dir: translator.dir,
  });
}

const state = ref<ShowcaseState>(DEFAULT_STATE);
let subscribers = 0;
let unsubscribe: (() => void) | undefined;

const same = (a: ShowcaseState, b: ShowcaseState): boolean =>
  a.theme === b.theme &&
  a.locale === b.locale &&
  a.dir === b.dir &&
  a.density === b.density &&
  a.seed === b.seed;

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

export function useT(): T {
  const current = useShowcaseState();
  const translator = computed(() =>
    callable(createTranslator(current.value.locale)),
  );
  return new Proxy(
    ((key: string, params?: TranslateParams) =>
      translator.value(key, params)) as T,
    { get: (_target, key) => Reflect.get(translator.value, key) },
  );
}
