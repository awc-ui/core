/** The tiny translator. No engine, no async loading, no plural rules. */
import { ar } from './ar';
import { en, type Dictionary, type MessageKey } from './en';
import { ro } from './ro';
import {
  DEFAULT_LOCALE,
  getDirection,
  getLocaleMeta,
  isLocaleCode,
  type Direction,
  type LocaleCode,
  type LocaleMeta,
} from './locales';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  type CurrencyOptions,
  type DateStyle,
  type NumberOptions,
  type PercentOptions,
  type RelativeTimeOptions,
} from './format';

/** All three dictionaries, keyed by locale code. */
export const DICTIONARIES: Record<LocaleCode, Dictionary> = {
  en: en as unknown as Dictionary,
  ro,
  ar,
};

/** Values a `{placeholder}` may be given. Numbers are stringified verbatim. */
export type TranslateParams = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** Substitute `{name}` tokens. An unmatched token is left in place, visibly. */
export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const v = params[name];
    return v === undefined || v === null ? whole : String(v);
  });
}

/**
 * The object `createTranslator` hands back.
 *
 * `t` is the workhorse; the `format*` methods are the locale already bound, so a
 * component never has to thread the locale through by hand.
 */
export interface Translator {
  /** The locale this translator was built for. */
  readonly locale: LocaleCode;
  /** Full locale metadata: native name, direction, Intl tag. */
  readonly meta: LocaleMeta;
  /** The locale's natural direction, ignoring any dock override. */
  readonly dir: Direction;
  /**
   * Translate a key, interpolating `{placeholders}`.
   * An unknown key falls back to English, then to the key itself — a missing
   * string shows up as `covenant.dscr` on screen rather than as blank space.
   */
  t(key: MessageKey | (string & {}), params?: TranslateParams): string;
  /** `true` when the key exists in this locale's dictionary. */
  has(key: string): boolean;
  formatCurrency(value: number, options?: CurrencyOptions): string;
  formatNumber(value: number, options?: NumberOptions): string;
  formatPercent(value: number, options?: PercentOptions): string;
  formatDate(value: string | Date, style?: DateStyle): string;
  /**
   * How long before `now` an instant was, in words.
   *
   * `now` IS AN ARGUMENT and has no default. A feed timestamp that read the
   * clock would make every screenshot, every parity comparison and every test
   * disagree with itself a minute later — so the caller passes its vertical's
   * frozen reporting instant, and the answer is the same forever.
   */
  formatRelativeTime(
    value: string | Date,
    now: string | Date,
    options?: RelativeTimeOptions,
  ): string;
}

const cache = new Map<LocaleCode, Translator>();

/**
 * Build a translator for one locale.
 *
 * Translators are cached per locale and are immutable, so calling this in a
 * render function is free.
 */
export function createTranslator(locale: string): Translator {
  const code: LocaleCode = isLocaleCode(locale) ? locale : DEFAULT_LOCALE;
  const hit = cache.get(code);
  if (hit) return hit;

  const dict = DICTIONARIES[code];
  const fallback = DICTIONARIES[DEFAULT_LOCALE];

  const translator: Translator = {
    locale: code,
    meta: getLocaleMeta(code),
    dir: getDirection(code),
    t(key, params) {
      const template = dict[key as MessageKey] ?? fallback[key as MessageKey] ?? key;
      return interpolate(template, params);
    },
    has(key) {
      return key in dict;
    },
    formatCurrency(value, options) {
      return formatCurrency(value, code, options);
    },
    formatNumber(value, options) {
      return formatNumber(value, code, options);
    },
    formatPercent(value, options) {
      return formatPercent(value, code, options);
    },
    formatDate(value, style) {
      return formatDate(value, code, style);
    },
    formatRelativeTime(value, now, options) {
      return formatRelativeTime(value, now, code, options);
    },
  };

  cache.set(code, translator);
  return translator;
}

/** Look up one string without building a translator. */
export function translate(
  locale: string,
  key: MessageKey | (string & {}),
  params?: TranslateParams,
): string {
  return createTranslator(locale).t(key, params);
}
