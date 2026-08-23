/**
 * `<awc-showcase-dock>` — the showcase control bar.
 *
 * Deliberately plain DOM inside a shadow root rather than `@awc-ui/core`
 * components: the dock has to boot identically inside six different framework
 * runtimes (two of which server-render), before the app's own component
 * registration has necessarily run, and it must never race the library it is
 * demonstrating. It still styles itself entirely from the library's tokens, so
 * it themes, densifies and mirrors exactly like the page around it.
 */
import { LOCALES } from '../i18n/locales';
import { createTranslator, type Translator } from '../i18n/translator';
import { DOCK_STYLES } from './styles';
import {
  DENSITY_RUNGS,
  SEED_PRESETS,
  SHOWCASE_EVENT,
  buildFrameworkUrl,
  buildLocaleUrl,
  getShowcaseState,
  resetShowcaseState,
  setShowcaseState,
  splitLocalePath,
  subscribeShowcaseState,
  THEME_MODES,
  type DensityRung,
  type ShowcaseChangeDetail,
  type ShowcaseState,
  type ThemeMode,
} from './state';

/** The control clusters the dock can render, in render order. */
export const DOCK_CONTROLS = [
  'framework',
  'language',
  'theme',
  'density',
  'accent',
  'direction',
  'reset',
] as const;

export type DockControl = (typeof DOCK_CONTROLS)[number];

/** Display names for the framework ids the apps use. Proper nouns — not translated. */
const FRAMEWORK_LABELS: Record<string, string> = {
  html: 'HTML',
  astro: 'Astro',
  react: 'React',
  next: 'Next.js',
  vue: 'Vue',
  nuxt: 'Nuxt',
  angular: 'Angular',
  svelte: 'Svelte',
  sveltekit: 'SvelteKit',
};

const frameworkLabel = (id: string) =>
  FRAMEWORK_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

const CHEVRON = /* html */ `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z"/></svg>`;

/**
 * `HTMLElement` does not exist in a Node/SSR graph, and `class X extends
 * HTMLElement` is evaluated the moment the module is parsed. Four of the six
 * host frameworks server-render, so the base class is resolved defensively —
 * the stub is never instantiated, it only keeps the module importable.
 */
const ElementBase: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

export class AwcShowcaseDock extends ElementBase {
  static get observedAttributes(): string[] {
    return [
      'frameworks',
      'framework',
      'base-path',
      'label',
      'controls',
      'collapsed',
      'position',
      'locale-route',
    ];
  }

  #root: ShadowRoot;
  #unsubscribe: (() => void) | null = null;
  #state: ShowcaseState;
  #t: Translator;
  #built = false;
  #resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#state = getShowcaseState();
    this.#t = createTranslator(this.#state.locale);
  }

  /* --------------------------------------------------------- public API */

  /** The current showcase state. Read-only snapshot. */
  get state(): ShowcaseState {
    return { ...this.#state };
  }

  /** Apply a partial state change, exactly as if the user had clicked a control. */
  setState(patch: Partial<ShowcaseState>): ShowcaseState {
    return setShowcaseState(patch);
  }

  /** Restore every control to its default. */
  reset(): ShowcaseState {
    return resetShowcaseState();
  }

  /**
   * Build the URL this dock would navigate to for a given framework.
   *
   * A locale-routed build carries its language as a PATH segment, and no other
   * build has a route for it — leaving it in place would send someone from
   * `/astro/ro/watchlist/` to `/react/ro/watchlist/`, which is a 404. The
   * segment is therefore stripped here, and the language travels as the
   * `?lang=` param that every build reads instead, so switching framework does
   * not silently switch the reader back to English.
   */
  urlForFramework(framework: string): string {
    const basePath = this.getAttribute('base-path') ?? '';

    if (this.#localeRoute === null || typeof location === 'undefined') {
      return buildFrameworkUrl(framework, {
        current: this.#currentFramework,
        basePath,
        state: this.#state,
      });
    }

    const { locale, rest } = splitLocalePath(location.pathname, {
      appBase: this.#appBase,
      defaultLocale: this.#localeRoute ?? 'en',
    });
    return buildFrameworkUrl(framework, {
      current: this.#currentFramework,
      basePath,
      pathname: `${this.#appBase}${rest}`,
      state: { ...this.#state, locale: locale as ShowcaseState['locale'] },
    });
  }

  /* -------------------------------------------------------- attributes */

  get #frameworks(): string[] {
    return (this.getAttribute('frameworks') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get #currentFramework(): string {
    return this.getAttribute('framework') ?? this.#frameworks[0] ?? '';
  }

  /**
   * Set by a build whose language lives in the URL rather than in client state.
   *
   * The value is the DEFAULT locale — the one served without a path segment.
   * Presence of the attribute is what switches the behaviour; the value only
   * says which locale owns the bare path. See `#localeHref`.
   */
  get #localeRoute(): string | null {
    return this.getAttribute('locale-route');
  }

  /**
   * On a locale-routed page the document's own `lang` is authoritative — the
   * strings around it were rendered in that language at build time — so the
   * picker must show it, not whatever locale is left in localStorage.
   */
  get #displayLocale(): string {
    if (this.#localeRoute === null) return this.#state.locale;
    const lang = typeof document === 'undefined' ? '' : document.documentElement.lang;
    return LOCALES.some((l) => l.code === lang) ? lang : this.#state.locale;
  }

  /**
   * The path this build is served under, INCLUDING its framework segment.
   *
   * `base-path` deliberately stops before the framework, because the framework
   * switcher's whole job is to replace that segment. The locale segment sits
   * one level deeper — `/showcase/credit-risk/astro/ro/` — so locale routing
   * needs the longer prefix, and getting these two mixed up produces
   * `/showcase/credit-risk/ro/astro/…`, which exists in no build.
   */
  get #appBase(): string {
    const base = (this.getAttribute('base-path') ?? '').replace(/\/+$/, '');
    const framework = this.#currentFramework;
    return framework ? `${base}/${framework}` : base;
  }

  /**
   * The current URL with its locale segment swapped for `target`.
   *
   * The default locale is served unprefixed, so switching to it removes the
   * segment and switching away inserts one. Everything after the locale — the
   * screen path, the query, the hash — is preserved, so changing language keeps
   * the reader on the facility they were reading rather than dropping them back
   * at the overview.
   */
  #localeHref(target: string): string {
    return buildLocaleUrl(target, {
      appBase: this.#appBase,
      defaultLocale: this.#localeRoute ?? 'en',
    });
  }

  get #controls(): DockControl[] {
    const raw = this.getAttribute('controls');
    if (!raw) return [...DOCK_CONTROLS];
    const wanted = new Set(raw.split(',').map((s) => s.trim()));
    return DOCK_CONTROLS.filter((c) => wanted.has(c));
  }

  /* ------------------------------------------------------- lifecycle */

  connectedCallback(): void {
    if (!this.#built) {
      this.#build();
      this.#built = true;
    }
    this.#unsubscribe = subscribeShowcaseState((detail) => this.#onStateChange(detail));
    this.#observeHeight();
  }

  disconnectedCallback(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    document.documentElement.style.removeProperty('--awc-dock-height');
  }

  attributeChangedCallback(): void {
    if (this.#built) this.#render();
  }

  /* ----------------------------------------------------------- render */

  #build(): void {
    const style = document.createElement('style');
    style.textContent = DOCK_STYLES;
    this.#root.append(style, document.createElement('div'));
    this.#render();
  }

  #onStateChange(detail: ShowcaseChangeDetail): void {
    this.#state = detail.state;
    this.#t = createTranslator(detail.state.locale);
    this.#render();
    if (detail.reason !== 'init') {
      // Element-scoped and non-bubbling on purpose: the state module already
      // fires the same event on `window`, and a bubbling copy would reach a
      // window listener a second time.
      this.dispatchEvent(
        new CustomEvent<ShowcaseChangeDetail>(SHOWCASE_EVENT, {
          detail,
          bubbles: false,
          composed: false,
        }),
      );
    }
  }

  #render(): void {
    const host = this.#root.lastElementChild as HTMLDivElement;
    const t = this.#t;
    const s = this.#state;
    const collapsed = this.hasAttribute('collapsed');

    host.className = 'dock';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', t.t('dock.title'));
    host.replaceChildren();

    const brandText = this.getAttribute('label') ?? t.t('app.title');
    const brand = document.createElement('span');
    brand.className = 'brand';
    brand.textContent = brandText;
    host.append(brand);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.id = 'awc-dock-panel';
    panel.hidden = collapsed;
    host.append(panel);

    for (const control of this.#controls) {
      const group = this.#renderControl(control);
      if (group) panel.append(group);
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-controls', panel.id);
    toggle.setAttribute('aria-label', t.t(collapsed ? 'dock.expand' : 'dock.collapse'));
    toggle.innerHTML = CHEVRON;
    toggle.addEventListener('click', () => this.toggleAttribute('collapsed'));
    host.append(toggle);

    this.#publishHeight();
  }

  #renderControl(control: DockControl): HTMLElement | null {
    switch (control) {
      case 'framework':
        return this.#frameworks.length > 1 ? this.#renderFrameworks() : null;
      case 'language':
        return this.#renderLanguages();
      case 'theme':
        return this.#renderTheme();
      case 'density':
        return this.#renderDensity();
      case 'accent':
        return this.#renderAccent();
      case 'direction':
        return this.#renderDirection();
      case 'reset':
        return this.#renderReset();
      default:
        return null;
    }
  }

  /** A labelled cluster. `labelledBy` groups radio-like buttons under one name. */
  #group(captionKey: string, id: string, asGroup: boolean): HTMLDivElement {
    const t = this.#t;
    const div = document.createElement('div');
    div.className = 'group';
    const caption = document.createElement('span');
    caption.className = 'caption';
    caption.id = id;
    caption.textContent = t.t(captionKey);
    div.append(caption);
    if (asGroup) {
      div.setAttribute('role', 'group');
      div.setAttribute('aria-labelledby', id);
    }
    return div;
  }

  #renderFrameworks(): HTMLElement {
    const t = this.#t;
    const wrap = document.createElement('div');
    wrap.className = 'group';

    const label = document.createElement('label');
    label.className = 'caption';
    label.htmlFor = 'awc-dock-framework';
    label.textContent = t.t('dock.framework');

    const select = document.createElement('select');
    select.id = 'awc-dock-framework';
    for (const id of this.#frameworks) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = frameworkLabel(id);
      option.selected = id === this.#currentFramework;
      select.append(option);
    }
    select.addEventListener('change', () => {
      const target = select.value;
      if (target === this.#currentFramework) return;
      const href = this.urlForFramework(target);
      // A full navigation is the point: each framework is a separate build.
      if (typeof location !== 'undefined') location.assign(href);
    });

    wrap.append(label, select);
    return wrap;
  }

  #renderLanguages(): HTMLElement {
    const t = this.#t;
    const wrap = document.createElement('div');
    wrap.className = 'group';

    const label = document.createElement('label');
    label.className = 'caption';
    label.htmlFor = 'awc-dock-locale';
    label.textContent = t.t('dock.language');

    const select = document.createElement('select');
    select.id = 'awc-dock-locale';
    for (const locale of LOCALES) {
      const option = document.createElement('option');
      option.value = locale.code;
      // Endonyms: a language picker names each language in that language.
      option.textContent = locale.nativeName;
      option.lang = locale.code;
      option.selected = locale.code === this.#displayLocale;
      select.append(option);
    }
    select.addEventListener('change', () => {
      // Direction is intentionally left unset so it re-derives from the locale.
      const locale = select.value as ShowcaseState['locale'];
      setShowcaseState({ locale, dir: undefined });
      // A locale-routed build has no client-side rendering to re-run: its
      // strings are baked into the HTML. Writing the state above still keeps
      // the choice sticky for the other five builds; the navigation is what
      // actually changes the language here.
      if (this.#localeRoute !== null && typeof location !== 'undefined') {
        location.assign(this.#localeHref(locale));
      }
    });

    wrap.append(label, select);
    return wrap;
  }

  #renderTheme(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.theme', 'awc-dock-theme-label', true);
    const seg = document.createElement('div');
    seg.className = 'segmented';
    for (const mode of THEME_MODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = t.t(`dock.theme.${mode}`);
      button.setAttribute('aria-pressed', String(this.#state.theme === mode));
      button.addEventListener('click', () => setShowcaseState({ theme: mode as ThemeMode }));
      seg.append(button);
    }
    wrap.append(seg);
    return wrap;
  }

  #renderDensity(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.density', 'awc-dock-density-label', true);
    const seg = document.createElement('div');
    seg.className = 'segmented';
    for (const rung of DENSITY_RUNGS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(rung);
      button.setAttribute(
        'aria-label',
        rung === 0 ? t.t('dock.density.default') : t.t('dock.density.rung', { value: rung }),
      );
      button.setAttribute('aria-pressed', String(this.#state.density === rung));
      button.addEventListener('click', () => setShowcaseState({ density: rung as DensityRung }));
      seg.append(button);
    }
    wrap.append(seg);
    return wrap;
  }

  #renderAccent(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.accent', 'awc-dock-accent-label', true);
    for (const preset of SEED_PRESETS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'swatch';
      button.style.setProperty('--_swatch', preset.seed);
      button.style.background = preset.seed;
      button.setAttribute('aria-label', t.t(preset.labelKey));
      button.setAttribute('aria-pressed', String(this.#state.seed === preset.id));
      button.addEventListener('click', () => setShowcaseState({ seed: preset.id }));
      wrap.append(button);
    }
    return wrap;
  }

  #renderDirection(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.direction', 'awc-dock-dir-label', false);
    const rtl = this.#state.dir === 'rtl';
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(rtl));
    button.textContent = 'RTL';
    button.setAttribute('aria-label', t.t(rtl ? 'dock.rtl' : 'dock.ltr'));
    button.addEventListener('click', () => setShowcaseState({ dir: rtl ? 'ltr' : 'rtl' }));
    wrap.append(button);
    return wrap;
  }

  #renderReset(): HTMLElement {
    const t = this.#t;
    const wrap = document.createElement('div');
    wrap.className = 'group';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t.t('action.reset');
    button.setAttribute('aria-label', t.t('dock.reset'));
    button.addEventListener('click', () => this.reset());
    wrap.append(button);
    return wrap;
  }

  /* ------------------------------------------------------------ height */

  /**
   * Publish the bar's height as `--awc-dock-height` on `<html>` so the host page
   * can reserve room for it. This is a CSS custom property, not one of the four
   * documented global attributes — the attribute contract stays untouched.
   */
  #publishHeight(): void {
    const dock = this.#root.lastElementChild as HTMLElement | null;
    if (!dock) return;
    const h = dock.getBoundingClientRect().height;
    if (h > 0) {
      document.documentElement.style.setProperty('--awc-dock-height', `${Math.round(h)}px`);
    }
  }

  #observeHeight(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const dock = this.#root.lastElementChild as HTMLElement | null;
    if (!dock) return;
    this.#resizeObserver = new ResizeObserver(() => this.#publishHeight());
    this.#resizeObserver.observe(dock);
  }
}

/** Tag name the element registers under. */
export const DOCK_TAG = 'awc-showcase-dock';

/**
 * Register `<awc-showcase-dock>`. Safe to call more than once, and a no-op on the
 * server. Importing `@awc-ui/showcase-kit/dock` calls this for you.
 */
export function defineShowcaseDock(tag: string = DOCK_TAG): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get(tag)) return;
  customElements.define(tag, AwcShowcaseDock);
}

declare global {
  interface HTMLElementTagNameMap {
    'awc-showcase-dock': AwcShowcaseDock;
  }
}
