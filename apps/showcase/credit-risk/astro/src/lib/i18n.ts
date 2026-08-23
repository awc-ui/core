/**
 * Locale routing — the one place this build genuinely differs from the React one.
 *
 * The React build re-renders every string in the browser when the dock's
 * language changes. This build has no client-side rendering to re-run: the
 * pages are HTML files written at build time, and the strings inside them are
 * already in a language. So the language becomes part of the URL, and switching
 * it is a navigation:
 *
 *   /showcase/credit-risk/astro/           en   (default, unprefixed)
 *   /showcase/credit-risk/astro/ro/        ro
 *   /showcase/credit-risk/astro/ar/        ar   (dir="rtl")
 *
 * That is the standard static-site answer, and it is a better one than it looks
 * like a compromise for. Each page is served in its language with `lang` and
 * `dir` already correct in the markup, so it is indexable, translatable by the
 * browser's own tooling, and readable with JavaScript switched off. The cost is
 * that the URL changes when the language does — which is the honest thing for a
 * document to do.
 *
 * The default locale is UNPREFIXED so the app's entry URL stays
 * `/showcase/credit-risk/astro/`, matching every other framework build. Only
 * the non-default locales carry a segment.
 */

import { createTranslator, LOCALES, type LocaleCode, type Translator } from '@awc-ui/showcase-kit/i18n';
import { createRoutes } from '@awc-ui/showcase-kit/credit-risk';

const routes = createRoutes('astro');

export const { basePath: BASE_PATH, route, withBase } = routes;
export const FRAMEWORK = routes.framework;

/** Served without a locale segment. */
export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALE_CODES = LOCALES.map((l) => l.code);

/** The non-default locales, i.e. the ones that own a URL segment. */
export const PREFIXED_LOCALES = LOCALE_CODES.filter((c) => c !== DEFAULT_LOCALE);

/**
 * `getStaticPaths` params for every locale, including the default one as
 * `undefined` — Astro's rest-parameter convention for "no segment here".
 */
export function localeParams(): { params: { locale: string | undefined } }[] {
  return [
    { params: { locale: undefined } },
    ...PREFIXED_LOCALES.map((locale) => ({ params: { locale } })),
  ];
}

/** Narrow a route param back to a real locale, defaulting rather than throwing. */
export function resolveLocale(param: string | undefined): LocaleCode {
  return LOCALE_CODES.includes(param as LocaleCode) ? (param as LocaleCode) : DEFAULT_LOCALE;
}

export function dirFor(locale: LocaleCode): 'ltr' | 'rtl' {
  return LOCALES.find((l) => l.code === locale)?.dir ?? 'ltr';
}

/**
 * A callable translator, matching the React build's ergonomics exactly.
 *
 * The kit's `Translator` exposes `t` as a METHOD, which reads as
 * `t.t('table.ead')` at every call site — and the screens call it hundreds of
 * times. Flattening it to a callable that still carries the locale-bound `Intl`
 * formatters means a screen ported from React needs no edits to its `t(...)`
 * calls, which is exactly what makes the two builds comparable.
 */
export type T = ((key: string, params?: Record<string, string | number>) => string) &
  Pick<Translator, 'has' | 'formatCurrency' | 'formatNumber' | 'formatPercent' | 'formatDate'> & {
    readonly locale: LocaleCode;
    readonly dir: 'ltr' | 'rtl';
  };

const cache = new Map<LocaleCode, T>();

export function useT(locale: LocaleCode): T {
  const hit = cache.get(locale);
  if (hit) return hit;

  const tr = createTranslator(locale);
  const fn = ((key: string, params?: Record<string, string | number>) => tr.t(key, params)) as T;
  const callable = Object.assign(fn, {
    has: (key: string) => tr.has(key),
    formatCurrency: tr.formatCurrency.bind(tr),
    formatNumber: tr.formatNumber.bind(tr),
    formatPercent: tr.formatPercent.bind(tr),
    formatDate: tr.formatDate.bind(tr),
    locale,
    dir: dirFor(locale),
  }) as T;

  cache.set(locale, callable);
  return callable;
}

/**
 * Build an in-app URL for a locale. Screens link with `localeHref(locale, path)`
 * so a reader in Romanian keeps their language as they drill down — the whole
 * point of putting it in the URL.
 */
export function localeHref(locale: LocaleCode, path: string): string {
  const segment = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${BASE_PATH}${segment}${path}`;
}

/** The same path in another language, for the dock's language switcher. */
export function switchLocaleHref(to: LocaleCode, currentPath: string): string {
  const withoutBase = currentPath.startsWith(BASE_PATH)
    ? currentPath.slice(BASE_PATH.length)
    : currentPath;
  const stripped = PREFIXED_LOCALES.reduce(
    (p, code) => (p === `/${code}` || p.startsWith(`/${code}/`) ? p.slice(code.length + 1) || '/' : p),
    withoutBase || '/',
  );
  return localeHref(to, stripped);
}
