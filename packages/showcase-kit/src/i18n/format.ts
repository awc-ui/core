/**
 * Deterministic Intl wrappers.
 *
 * Every formatter is constructed with an explicit locale AND `timeZone: 'UTC'`,
 * so the same value renders identically on every machine, in every framework,
 * in every CI region. Never call `Intl` directly in a showcase app — go through
 * these, or a build in Bucharest and a build in Dubai will disagree.
 */
import type { LocaleCode } from './locales';

/** BCP 47 tags used for `Intl`. Kept separate from our short locale codes. */
const INTL_TAG: Record<LocaleCode, string> = {
  en: 'en-GB',
  ro: 'ro-RO',
  ar: 'ar-AE',
};

/** Resolve a short locale code (or any BCP 47 tag) to the tag Intl should use. */
export function intlTag(locale: string): string {
  return (INTL_TAG as Record<string, string>)[locale] ?? locale;
}

/* Formatters are cached by their full option signature — constructing an
   Intl.NumberFormat is the expensive part, and a showcase table calls these
   thousands of times per render. */
const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const tag = intlTag(locale);
  const key = `${tag}|${JSON.stringify(options)}`;
  let f = numberCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, options);
    numberCache.set(key, f);
  }
  return f;
}

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = intlTag(locale);
  const key = `${tag}|${JSON.stringify(options)}`;
  let f = dateCache.get(key);
  if (!f) {
    // timeZone is forced to UTC: the fixture's dates are calendar dates, and a
    // local time zone would shift 2026-03-31 to the 30th west of Greenwich.
    f = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', ...options });
    dateCache.set(key, f);
  }
  return f;
}

/* ---------------------------------------------------------------- currency */

export interface CurrencyOptions {
  /** ISO 4217 code. Default `'EUR'`. */
  currency?: string;
  /** Default 0 for whole amounts. */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /**
   * `'compact'` renders €3.2bn style short forms — the right choice for KPI
   * tiles and chart axes. `'standard'` is the right choice for tables.
   */
  notation?: 'standard' | 'compact';
  /** `'symbol'` (default), `'code'`, `'name'` or `'narrowSymbol'`. */
  display?: Intl.NumberFormatOptions['currencyDisplay'];
}

/** Format a money amount. Always pass the locale explicitly. */
export function formatCurrency(
  value: number,
  locale: string,
  options: CurrencyOptions = {},
): string {
  const { currency = 'EUR', notation = 'standard', display = 'symbol' } = options;
  const minimumFractionDigits = options.minimumFractionDigits ?? 0;
  // Compact notation defaults to one decimal (€3.2bn); an explicit minimum still wins.
  const maximumFractionDigits =
    options.maximumFractionDigits ??
    Math.max(minimumFractionDigits, notation === 'compact' ? 1 : minimumFractionDigits);
  return numberFormatter(locale, {
    style: 'currency',
    currency,
    currencyDisplay: display,
    notation,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/* ------------------------------------------------------------------ number */

export interface NumberOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  notation?: 'standard' | 'compact';
  /** `true` inserts the locale's grouping separators. Default `true`. */
  grouping?: boolean;
  /** `'always'` prefixes a `+` on positives — useful for deltas. */
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
}

export function formatNumber(value: number, locale: string, options: NumberOptions = {}): string {
  const { notation = 'standard', grouping = true, signDisplay } = options;
  const maximumFractionDigits =
    options.maximumFractionDigits ?? Math.max(options.minimumFractionDigits ?? 0, 2);
  const minimumFractionDigits =
    options.minimumFractionDigits ?? Math.min(0, maximumFractionDigits);
  return numberFormatter(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    notation,
    useGrouping: grouping,
    signDisplay,
  }).format(value);
}

/* ----------------------------------------------------------------- percent */

export interface PercentOptions {
  /** Default 2. PDs need 2–3; utilisation is fine at 0–1. */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: Intl.NumberFormatOptions['signDisplay'];
}

/**
 * Format a **fraction** as a percentage: `formatPercent(0.0135, 'en')` → `1.35%`.
 * Every ratio in the fixture is stored as a fraction, so pass it straight in.
 */
export function formatPercent(value: number, locale: string, options: PercentOptions = {}): string {
  // Defaults have to stay consistent: Intl throws if min > max, so a caller who
  // passes only `maximumFractionDigits: 1` must not inherit a minimum of 2.
  const maximumFractionDigits =
    options.maximumFractionDigits ?? Math.max(options.minimumFractionDigits ?? 2, 2);
  const minimumFractionDigits =
    options.minimumFractionDigits ?? Math.min(2, maximumFractionDigits);
  const { signDisplay } = options;
  return numberFormatter(locale, {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay,
  }).format(value);
}

/* -------------------------------------------------------------------- date */

export type DateStyle = 'short' | 'medium' | 'long' | 'iso' | 'monthYear';

/**
 * Format an ISO `YYYY-MM-DD` calendar date (or a `Date`) in UTC.
 * `'iso'` returns the input unchanged — the right choice for `<time datetime>`.
 */
export function formatDate(
  value: string | Date,
  locale: string,
  style: DateStyle = 'medium',
): string {
  const isoValue =
    typeof value === 'string' ? value : value.toISOString().slice(0, 10);
  if (style === 'iso') return isoValue;

  // Parse as UTC midnight; a bare `new Date('2026-03-31')` is already UTC, but
  // being explicit keeps a `Date` input on the same footing.
  const ms = Date.parse(`${isoValue}T00:00:00Z`);
  if (Number.isNaN(ms)) return isoValue;

  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { year: 'numeric', month: '2-digit', day: '2-digit' }
      : style === 'long'
        ? { year: 'numeric', month: 'long', day: 'numeric' }
        : style === 'monthYear'
          ? { year: 'numeric', month: 'short' }
          : { year: 'numeric', month: 'short', day: 'numeric' };

  return dateFormatter(locale, options).format(new Date(ms));
}

/* ------------------------------------------------------------ convenience */

/** Format basis points: `formatBps(275, 'en')` → `275`. Pair with `unit.bps`. */
export function formatBps(value: number, locale: string): string {
  return formatNumber(value, locale, { maximumFractionDigits: 0 });
}

/** Format a covenant ratio: `formatRatio(1.42, 'en')` → `1.42`. */
export function formatRatio(value: number, locale: string, digits = 2): string {
  return formatNumber(value, locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Clear the formatter caches. Only useful in tests. */
export function clearFormatterCache(): void {
  numberCache.clear();
  dateCache.clear();
}
