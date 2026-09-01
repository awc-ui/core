/**
 * Locale routing and the callable translator, for a build with no client-side
 * rendering to re-run.
 *
 * This build writes HTML files at build time; the strings inside them are
 * already in a language. So — exactly like the credit-risk HTML build, and for
 * exactly the same reason — the language is part of the URL and switching it is
 * a navigation:
 *
 *   /showcase/wealth/html/           en   (default, unprefixed)
 *   /showcase/wealth/html/ro/        ro
 *   /showcase/wealth/html/ar/        ar   (dir="rtl")
 *
 * The default locale stays unprefixed so the app's entry URL matches every
 * other framework build. `<awc-showcase-dock locale-route="en">` tells the dock
 * this, and the preboot script's `data-locale-route` guard stops a stale locale
 * in localStorage from stamping the wrong `lang` over a page that is written in
 * another language.
 */

import { createTranslator, LOCALES } from '@awc-ui/showcase-kit/i18n';
import { createRoutes } from '@awc-ui/showcase-kit/wealth';

const routes = createRoutes('html');

export const { basePath: BASE_PATH, route, withBase } = routes;
export const FRAMEWORK = routes.framework;

/** Served without a locale segment. */
export const DEFAULT_LOCALE = 'en';

export const LOCALE_CODES = LOCALES.map((l) => l.code);

/** The non-default locales, i.e. the ones that own a URL segment. */
export const PREFIXED_LOCALES = LOCALE_CODES.filter((c) => c !== DEFAULT_LOCALE);

export function dirFor(locale) {
  return LOCALES.find((l) => l.code === locale)?.dir ?? 'ltr';
}

/**
 * A callable translator: `t('wealth.table.drift')` rather than
 * `t.t('wealth.table.drift')`, with the locale-bound `Intl` formatters hanging
 * off the same value.
 *
 * The screens call this hundreds of times, and keeping the shape identical to
 * the React build is what lets a screen be read side by side with its twin in
 * another framework and differ only where the framework differs.
 */
const cache = new Map();

export function useT(locale) {
  const hit = cache.get(locale);
  if (hit) return hit;

  const tr = createTranslator(locale);
  const fn = (key, params) => tr.t(key, params);
  const callable = Object.assign(fn, {
    has: (key) => tr.has(key),
    formatCurrency: tr.formatCurrency.bind(tr),
    formatNumber: tr.formatNumber.bind(tr),
    formatPercent: tr.formatPercent.bind(tr),
    formatDate: tr.formatDate.bind(tr),
    locale,
    dir: dirFor(locale),
  });

  cache.set(locale, callable);
  return callable;
}

/**
 * An in-app URL in one locale. Every link on every screen goes through this, so
 * a reader in Romanian stays in Romanian as they drill down — which is the
 * whole point of putting the language in the URL, and forgetting it on one link
 * is how a locale-routed site quietly drops people back into English three
 * clicks in.
 */
export function localeHref(locale, path) {
  const segment = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${BASE_PATH}${segment}${path}`;
}

/** The same screen in another language, for `<link rel="alternate">`. */
export function switchLocaleHref(to, path) {
  return localeHref(to, path);
}

/** Where a route's `index.html` is written, relative to `dist/`. */
export function outputPath(locale, path) {
  const segment = locale === DEFAULT_LOCALE ? '' : `${locale}/`;
  const rest = path.replace(/^\//, '');
  return `${segment}${rest}index.html`;
}
