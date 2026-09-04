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

/* ------------------------------------------------------- relative time */

/**
 * Cached like the other two, and keyed the same way.
 *
 * `Intl.RelativeTimeFormat` takes no `timeZone` — it formats a DIFFERENCE, and
 * a difference has no zone. What has to be deterministic is the pair of
 * instants it is given, which is why `formatRelativeTime` refuses to read the
 * clock and takes the reference instant as an argument.
 */
const relativeCache = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormatter(
  locale: string,
  options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  const tag = intlTag(locale);
  const key = `${tag}|${JSON.stringify(options)}`;
  let formatter = relativeCache.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(tag, options);
    relativeCache.set(key, formatter);
  }
  return formatter;
}

/**
 * The thresholds, largest unit first. A difference is reported in the largest
 * unit that fits, which is what "3 weeks ago" rather than "21 days ago" means.
 *
 * WEEKS ARE IN THE LADDER AND MONTHS ARE APPROXIMATE, deliberately. A feed
 * timestamp is a reading aid, not an accounting figure: nobody checks whether
 * "2 months ago" is 61 days or 59. Anything that needs the exact day has the
 * ISO instant beside it — every timestamp this renders is inside a `<time>`
 * whose `datetime` carries it.
 */
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

export interface RelativeTimeOptions {
  /**
   * `'narrow'` gives the feed form — "3h ago" in English, and whatever the
   * locale's own narrow form is elsewhere. It is NOT an abbreviation rule this
   * code applies: Arabic has no "3h", and `Intl` knows that and Romanian's
   * "acum 3 ore" too. Defaults to `'narrow'`.
   */
  style?: Intl.RelativeTimeFormatStyle;
  /**
   * `'auto'` lets the locale say "yesterday" instead of "1 day ago", which is
   * what a reader expects and what every locale in this showcase has a word
   * for. Defaults to `'auto'`.
   */
  numeric?: Intl.RelativeTimeFormatNumeric;
}

/**
 * How long before `now` an instant was, in words.
 *
 * BOTH INSTANTS ARE ARGUMENTS. There is no `Date.now()` here and there must not
 * be: the showcase is a frozen fixture measured from a frozen reporting
 * instant, and a formatter that read the clock would make every screenshot,
 * every parity comparison and every test disagree with itself a minute later.
 *
 * A future instant formats as a future — `Intl` handles the sign — but nothing
 * in the fixtures is dated after the reporting instant, so that path exists for
 * correctness rather than for use.
 */
export function formatRelativeTime(
  value: string | Date,
  now: string | Date,
  locale: string,
  options: RelativeTimeOptions = {},
): string {
  const then = typeof value === 'string' ? Date.parse(value) : value.getTime();
  const reference = typeof now === 'string' ? Date.parse(now) : now.getTime();
  if (Number.isNaN(then) || Number.isNaN(reference)) {
    return typeof value === 'string' ? value : value.toISOString();
  }

  const seconds = Math.round((then - reference) / 1000);
  const magnitude = Math.abs(seconds);
  const formatter = relativeFormatter(locale, {
    numeric: options.numeric ?? 'auto',
    style: options.style ?? 'narrow',
  });

  for (const [unit, size] of RELATIVE_UNITS) {
    if (magnitude >= size) {
      // Truncate rather than round: 89 minutes is "1h ago", not "2h ago". A
      // rounded-up timestamp claims a post is older than it is, and on a feed
      // sorted by recency that reads as the order being wrong.
      return formatter.format(Math.trunc(seconds / size), unit);
    }
  }
  return formatter.format(0, 'second');
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
  relativeCache.clear();
}
