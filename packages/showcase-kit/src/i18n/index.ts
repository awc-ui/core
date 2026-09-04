/**
 * `@awc-ui/showcase-kit/i18n`
 *
 * Dictionaries for en/ro/ar, a placeholder-interpolating translator, and Intl
 * formatters that are always given an explicit locale and `timeZone: 'UTC'`.
 */
export { en } from './en';
export { ro } from './ro';
export { ar } from './ar';
export type { Dictionary, MessageKey, RequiredMessageKey } from './en';

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_CODES,
  getDirection,
  getLocaleMeta,
  isLocaleCode,
} from './locales';
export type { Direction, LocaleCode, LocaleMeta } from './locales';

export { DICTIONARIES, createTranslator, interpolate, translate } from './translator';
export type { TranslateParams, Translator } from './translator';

export {
  clearFormatterCache,
  formatBps,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatRatio,
  formatRelativeTime,
  intlTag,
} from './format';
export type {
  CurrencyOptions,
  DateStyle,
  NumberOptions,
  PercentOptions,
  RelativeTimeOptions,
} from './format';
