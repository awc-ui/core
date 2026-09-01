/**
 * Showcase state: one localStorage key, one set of URL params, one apply step.
 *
 * The URL is authoritative on load. A framework jump crosses an origin boundary
 * in dev (each starter runs on its own port) and localStorage does not travel
 * with it, so the state has to ride in the query string. localStorage is the
 * fallback for a plain reload with a bare URL.
 *
 * Only four things are ever written to `<html>`, and they are exactly the four
 * documented in main-llm.md §2.1 / §4.3 / §4.4 / §4.5:
 *   - `lang`         — always set
 *   - `dir`          — always set ("ltr" or "rtl")
 *   - `data-theme`   — set to "dark", or REMOVED for light. Never "light".
 *   - `data-density` — set to "-1".."-4", or REMOVED at rung 0. Never "0".
 */
import {
  DEFAULT_LOCALE,
  LOCALES,
  getDirection,
  isLocaleCode,
  type Direction,
  type LocaleCode,
} from '../i18n/locales';
import { DEFAULT_SEED_PRESET, SEED_PRESETS } from './seeds.generated';

/* ------------------------------------------------------------------ types */

export type ThemeMode = 'light' | 'dark' | 'system';

/** Density rungs the dock offers. 0 is the library default and writes no attribute. */
export type DensityRung = 0 | -1 | -2 | -3 | -4;

export interface ShowcaseState {
  theme: ThemeMode;
  locale: LocaleCode;
  dir: Direction;
  density: DensityRung;
  /** Accent preset id, one of `SEED_PRESETS`. */
  seed: string;
}

/* -------------------------------------------------------------- constants */

/** The one and only localStorage key. Bump the suffix to invalidate old state. */
export const STORAGE_KEY = 'awc:showcase:v1';

/** URL query parameter names, in the order the dock writes them. */
export const URL_PARAMS = {
  theme: 'theme',
  locale: 'lang',
  dir: 'dir',
  density: 'density',
  seed: 'seed',
} as const;

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

export const DENSITY_RUNGS: readonly DensityRung[] = [0, -1, -2, -3, -4];

export { SEED_PRESETS, DEFAULT_SEED_PRESET };
export type { SeedPreset } from './seeds.generated';

export const DEFAULT_STATE: ShowcaseState = {
  theme: 'system',
  locale: DEFAULT_LOCALE,
  dir: getDirection(DEFAULT_LOCALE),
  density: 0,
  seed: DEFAULT_SEED_PRESET,
};

const SEED_IDS = SEED_PRESETS.map((p) => p.id);

/* ------------------------------------------------------------ coercion */

function coerceTheme(v: unknown): ThemeMode | undefined {
  return THEME_MODES.includes(v as ThemeMode) ? (v as ThemeMode) : undefined;
}

function coerceLocale(v: unknown): LocaleCode | undefined {
  return isLocaleCode(v) ? v : undefined;
}

function coerceDir(v: unknown): Direction | undefined {
  return v === 'ltr' || v === 'rtl' ? v : undefined;
}

function coerceDensity(v: unknown): DensityRung | undefined {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return undefined;
  const clamped = Math.min(0, Math.max(-4, Math.round(n)));
  return clamped as DensityRung;
}

function coerceSeed(v: unknown): string | undefined {
  return typeof v === 'string' && SEED_IDS.includes(v) ? v : undefined;
}

/** Fill in anything missing or invalid from `DEFAULT_STATE`. */
export function normalizeState(input: Partial<ShowcaseState> | null | undefined): ShowcaseState {
  const locale = coerceLocale(input?.locale) ?? DEFAULT_STATE.locale;
  return {
    theme: coerceTheme(input?.theme) ?? DEFAULT_STATE.theme,
    locale,
    // With no explicit direction, the locale decides — Arabic implies RTL.
    dir: coerceDir(input?.dir) ?? getDirection(locale),
    density: coerceDensity(input?.density) ?? DEFAULT_STATE.density,
    seed: coerceSeed(input?.seed) ?? DEFAULT_STATE.seed,
  };
}

/* -------------------------------------------------------------- reading */

function readStorage(): Partial<ShowcaseState> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<ShowcaseState>) : {};
  } catch {
    // Private mode, disabled storage, or corrupt JSON — fall back to defaults.
    return {};
  }
}

/** Pull whatever showcase params a query string carries. */
export function readStateFromSearch(search: string): Partial<ShowcaseState> {
  const q = new URLSearchParams(search);
  const out: Partial<ShowcaseState> = {};
  const theme = coerceTheme(q.get(URL_PARAMS.theme));
  const locale = coerceLocale(q.get(URL_PARAMS.locale));
  const dir = coerceDir(q.get(URL_PARAMS.dir));
  const density = q.has(URL_PARAMS.density) ? coerceDensity(q.get(URL_PARAMS.density)) : undefined;
  const seed = coerceSeed(q.get(URL_PARAMS.seed));
  if (theme) out.theme = theme;
  if (locale) out.locale = locale;
  if (dir) out.dir = dir;
  if (density !== undefined) out.density = density;
  if (seed) out.seed = seed;
  return out;
}

/**
 * The effective state: defaults, overlaid with localStorage, overlaid with the
 * URL. The URL always wins so a framework jump carries state across ports.
 */
export function readShowcaseState(search?: string): ShowcaseState {
  const fromUrl = readStateFromSearch(
    search ?? (typeof location === 'undefined' ? '' : location.search),
  );
  const stored = readStorage();
  // `dir` follows the locale unless it was set explicitly at the level that won.
  const merged: Partial<ShowcaseState> = { ...stored, ...fromUrl };
  if (fromUrl.locale && !fromUrl.dir && stored.dir) delete merged.dir;
  return normalizeState(merged);
}

/* -------------------------------------------------------------- writing */

function writeStorage(state: ShowcaseState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode. The URL still carries the state; nothing to do.
  }
}

/**
 * Add the showcase params to a URL, always in the same order.
 *
 * The existing params are removed first so the order does not depend on what the
 * incoming URL happened to carry — two framework builds must produce identical
 * links for identical state.
 */
export function withShowcaseParams(url: URL, state: ShowcaseState): URL {
  const next = new URL(url.href);
  for (const name of Object.values(URL_PARAMS)) next.searchParams.delete(name);
  for (const [name, value] of toSearchParams(state)) next.searchParams.append(name, value);
  return next;
}

/** Just the showcase params, for appending to a link an app builds itself. */
export function toSearchParams(state: ShowcaseState): URLSearchParams {
  const q = new URLSearchParams();
  q.set(URL_PARAMS.theme, state.theme);
  q.set(URL_PARAMS.locale, state.locale);
  q.set(URL_PARAMS.dir, state.dir);
  q.set(URL_PARAMS.density, String(state.density));
  q.set(URL_PARAMS.seed, state.seed);
  return q;
}

/** Mirror the state into the address bar without adding a history entry. */
export function syncUrl(state: ShowcaseState): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  const next = withShowcaseParams(new URL(location.href), state);
  if (next.href !== location.href) history.replaceState(history.state, '', next.href);
}

/* -------------------------------------------------------------- applying */

const SEED_STYLE_ID = 'awc-showcase-seed';

/** Inject (or clear) the accent preset's `--md-sys-color-*` overrides. */
export function applySeedPreset(seedId: string, doc?: Document): void {
  const d = doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!d) return;
  const preset = SEED_PRESETS.find((p) => p.id === seedId);
  const css = preset?.css ?? '';
  /*
   * The accent preset rides in a CONSTRUCTABLE stylesheet where the engine has
   * them, because an inline `<style>` is refused under an enterprise
   * `style-src 'self'` and this one is injected on every accent change.
   * `adoptedStyleSheets` is applied after the document's own sheets, so it still
   * beats the token sheet — the ordering main-llm.md §4.2 asks for, kept.
   */
  const constructable =
    typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype;
  if (constructable) {
    const existing = SEED_SHEETS.get(d);
    if (!css) {
      if (existing) d.adoptedStyleSheets = d.adoptedStyleSheets.filter((s) => s !== existing);
      SEED_SHEETS.delete(d);
      return;
    }
    const sheet = existing ?? new CSSStyleSheet();
    sheet.replaceSync(css);
    if (!existing) {
      SEED_SHEETS.set(d, sheet);
      d.adoptedStyleSheets = [...d.adoptedStyleSheets, sheet];
    }
    return;
  }

  let style = d.getElementById(SEED_STYLE_ID) as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = d.createElement('style');
    style.id = SEED_STYLE_ID;
    // Appended last so it beats the token sheet, per main-llm.md §4.2.
    d.head.appendChild(style);
  }
  if (style.textContent !== css) style.textContent = css;
}

/** One adopted sheet per document, so an accent change replaces rather than stacks. */
const SEED_SHEETS = new WeakMap<Document, CSSStyleSheet>();
/** `true` when the OS is asking for a dark palette. */
export function prefersDark(): boolean {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Resolve `'system'` against the OS preference. */
export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
}

/**
 * Stamp the state onto `<html>`.
 *
 * Writes `lang` and `dir` always; writes `data-theme="dark"` only in dark mode
 * and REMOVES it otherwise; writes `data-density` only for rungs -1..-4 and
 * REMOVES it at rung 0 (`data-density="0"` is inert and would pin base values
 * onto every element — main-llm.md §2.1).
 *
 * Also publishes `--awc-dock-height` so the host page can reserve room for the
 * fixed bar: `padding-block-end: var(--awc-dock-height, 0px)`.
 */
export function applyShowcaseState(state: ShowcaseState, doc?: Document): void {
  const d = doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!d) return;
  const html = d.documentElement;

  // The runtime twin of the preboot script's `data-locale-route` guard, and it
  // has to agree with it or the two fight: preboot leaves the server-rendered
  // language alone and this would immediately stamp the stored one back over
  // it, which is worse than never having guarded at all — the page would flash
  // the right language and settle on the wrong one.
  //
  // On a locale-routed build the document's own lang/dir are authoritative,
  // because the strings around them were rendered in that language at build
  // time. Theme, density and accent are pure CSS and still apply.
  if (!html.hasAttribute('data-locale-route')) {
    html.setAttribute('lang', state.locale);
    html.setAttribute('dir', state.dir);
  }

  if (resolveTheme(state.theme) === 'dark') html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');

  if (state.density === 0) html.removeAttribute('data-density');
  else html.setAttribute('data-density', String(state.density));

  applySeedPreset(state.seed, d);
}
/* ------------------------------------------------------------- the store */

export interface ShowcaseChangeDetail {
  state: ShowcaseState;
  previous: ShowcaseState | null;
  /** Which fields differ from `previous`. Empty on the initial broadcast. */
  changed: (keyof ShowcaseState)[];
  /** `'init'` on first publish, `'set'` for a dock interaction, `'system'` for an OS theme flip. */
  reason: 'init' | 'set' | 'system';
}

export type ShowcaseListener = (detail: ShowcaseChangeDetail) => void;

/** Event name dispatched on the dock element (bubbling, composed) and on `window`. */
export const SHOWCASE_EVENT = 'awc-showcase-change';

let current: ShowcaseState | null = null;
const listeners = new Set<ShowcaseListener>();
let mediaQuery: MediaQueryList | null = null;

function diff(a: ShowcaseState | null, b: ShowcaseState): (keyof ShowcaseState)[] {
  if (!a) return [];
  return (Object.keys(b) as (keyof ShowcaseState)[]).filter((k) => a[k] !== b[k]);
}

function publish(next: ShowcaseState, reason: ShowcaseChangeDetail['reason']): void {
  const previous = current;
  current = next;
  const detail: ShowcaseChangeDetail = { state: next, previous, changed: diff(previous, next), reason };
  for (const fn of Array.from(listeners)) fn(detail);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ShowcaseChangeDetail>(SHOWCASE_EVENT, { detail }));
  }
}

/** The current state, reading and applying it on first call. */
export function getShowcaseState(): ShowcaseState {
  if (!current) {
    current = readShowcaseState();
    applyShowcaseState(current);
    watchSystemTheme();
  }
  return current;
}

/**
 * Merge a partial update in, then persist, mirror to the URL, stamp `<html>`
 * and notify every listener. Returns the resulting state.
 */
export function setShowcaseState(patch: Partial<ShowcaseState>): ShowcaseState {
  const base = getShowcaseState();
  // Changing locale re-derives direction unless the caller pinned one.
  const dir =
    patch.dir ?? (patch.locale && patch.locale !== base.locale ? getDirection(patch.locale) : base.dir);
  const next = normalizeState({ ...base, ...patch, dir });
  writeStorage(next);
  syncUrl(next);
  applyShowcaseState(next);
  publish(next, 'set');
  return next;
}

/** Restore every control to its default. */
export function resetShowcaseState(): ShowcaseState {
  return setShowcaseState(DEFAULT_STATE);
}

/**
 * Subscribe to state changes. The listener fires immediately with the current
 * state (`reason: 'init'`). Returns an unsubscribe function.
 */
export function subscribeShowcaseState(listener: ShowcaseListener): () => void {
  listeners.add(listener);
  const state = getShowcaseState();
  listener({ state, previous: null, changed: [], reason: 'init' });
  return () => listeners.delete(listener);
}

/** Re-stamp the theme when the OS flips and the user is on `'system'`. */
function watchSystemTheme(): void {
  if (mediaQuery || typeof matchMedia === 'undefined') return;
  mediaQuery = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (!current || current.theme !== 'system') return;
    applyShowcaseState(current);
    publish(current, 'system');
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
  } else {
    // Safari < 14
    (mediaQuery as unknown as { addListener(cb: () => void): void }).addListener(onChange);
  }
}

/* ------------------------------------------------------- framework routing */

export interface FrameworkUrlOptions {
  /** The framework segment currently in the path, e.g. `'react'`. */
  current: string;
  /** Path prefix that precedes the framework segment, e.g. `/showcase/credit-risk`. */
  basePath?: string;
  /** Defaults to `location.pathname`. */
  pathname?: string;
  /** Defaults to `location.origin`. */
  origin?: string;
  /** State to carry across. Defaults to the current state. */
  state?: ShowcaseState;
}

/**
 * Swap the framework segment of a showcase path and carry the state in the query.
 *
 * `/showcase/credit-risk/react/counterparties?lang=ro` with target `vue` becomes
 * `/showcase/credit-risk/vue/counterparties?...`. If the current segment cannot
 * be found the target is appended to `basePath`, which is the correct landing
 * page for a dev server rooted at `/`.
 */
export function buildFrameworkUrl(target: string, options: FrameworkUrlOptions): string {
  const {
    current,
    basePath = '',
    pathname = typeof location === 'undefined' ? '/' : location.pathname,
    origin = typeof location === 'undefined' ? 'http://localhost' : location.origin,
  } = options;
  const state = options.state ?? getShowcaseState();

  const segments = pathname.split('/');
  const idx = segments.lastIndexOf(current);
  let nextPath: string;
  if (idx !== -1) {
    segments[idx] = target;
    nextPath = segments.join('/');
  } else {
    const base = basePath.replace(/\/+$/, '');
    nextPath = `${base}/${target}/`;
  }

  const url = new URL(nextPath, origin);
  return withShowcaseParams(url, state).href;
}

/* ---------------------------------------------------------- locale routing */

export interface LocalePathOptions {
  /**
   * The path this build is served under, INCLUDING its framework segment —
   * e.g. `/showcase/credit-risk/astro`. Note this is one segment LONGER than
   * `FrameworkUrlOptions.basePath`, which deliberately stops before the
   * framework because swapping that segment is its whole job. The locale sits
   * one level deeper still, and confusing the two yields
   * `/showcase/credit-risk/ro/astro/…`, a path that exists in no build.
   */
  appBase: string;
  /** The locale served WITHOUT a segment. Defaults to `en`. */
  defaultLocale?: string;
  /** Locale codes that own a segment. Defaults to every known locale. */
  locales?: readonly string[];
}

/**
 * Split a locale-routed path into the locale it carries and the screen path
 * beneath it.
 *
 * An unprefixed path is not "no locale" — it is the DEFAULT locale, which is
 * precisely what being served without a segment means. `rest` always begins
 * with `/`, so it concatenates onto a base without further guarding.
 */
export function splitLocalePath(
  pathname: string,
  options: LocalePathOptions,
): { locale: string; rest: string } {
  const fallback = options.defaultLocale ?? 'en';
  const codes = options.locales ?? LOCALES.map((l) => l.code);
  const base = options.appBase.replace(/\/+$/, '');

  let rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  let locale = fallback;

  for (const code of codes) {
    if (code === fallback) continue;
    if (rest === `/${code}` || rest.startsWith(`/${code}/`)) {
      locale = code;
      rest = rest.slice(code.length + 1) || '/';
      break;
    }
  }

  if (!rest.startsWith('/')) rest = `/${rest}`;
  return { locale, rest };
}

/**
 * The same screen in another language, on a locale-routed build.
 *
 * The default locale is served unprefixed, so switching TO it removes the
 * segment and switching away inserts one. Query and hash survive, so changing
 * language keeps the reader on the facility they were reading rather than
 * dropping them back at the overview.
 */
export function buildLocaleUrl(
  target: string,
  options: LocalePathOptions & { href?: string },
): string {
  const fallback = options.defaultLocale ?? 'en';
  const base = options.appBase.replace(/\/+$/, '');
  const url = new URL(
    options.href ?? (typeof location === 'undefined' ? 'http://localhost/' : location.href),
  );

  const { rest } = splitLocalePath(url.pathname, options);
  url.pathname = target === fallback ? `${base}${rest}` : `${base}/${target}${rest}`;
  return url.href;
}
