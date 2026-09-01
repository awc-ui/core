/**
 * `<awc-showcase-dock>` — the showcase control bar.
 *
 * BUILT FROM `@awc-ui/core` COMPONENTS. The showcase exists to demonstrate the
 * library, and the dock is the most-looked-at surface in it, so it is built
 * from `md-select`, `md-segmented-button-set`, `md-switch`, `md-button` and
 * `md-icon-button` rather than from plain `<select>`/`<button>`. It is a real
 * integration test as well as a demonstration: a `position: fixed` bar at the
 * bottom of the viewport, inside a shadow root, under a `backdrop-filter`, is
 * the hardest anchor `md-menu` has to position against.
 *
 * This replaces an earlier decision to use plain DOM, whose stated reason was
 * that the dock must boot inside six framework runtimes (two of which
 * server-render) without racing the library. That constraint has not gone away;
 * it is now HANDLED rather than avoided:
 *
 *   - Still no `import` of `@awc-ui/core`. Custom elements resolve by TAG NAME,
 *     so `md-select` here is the same element the page registers, and this
 *     package keeps its empty dependency list. The runtime requirement is real
 *     and is documented in the README.
 *   - Still client-only. `<awc-showcase-dock>` renders nothing until it
 *     upgrades, exactly as before, so no server-rendered markup changes.
 *   - The new gap is between THIS element upgrading and the md-* runtime
 *     registering. An un-upgraded `md-select` has zero size, and the dock
 *     publishes its own height as `--awc-dock-height` for the page to reserve
 *     room from — so a dock that started short and grew would shift the whole
 *     page. `DOCK_STYLES` therefore reserves the row geometry in CSS
 *     (`--_row`, and an explicit `inline-size` on each control) so the bar is
 *     already its final size while the controls are still empty. See the
 *     "reserving space before upgrade" section of `styles.ts`.
 *
 * Every control is pinned to the dock's own density (`DOCK_DENSITY`) rather
 * than inheriting the page's, for the same reason the labels are pinned to
 * English and `dir` to `ltr`: the dock is the evaluator's remote control, not
 * part of the demo, and a control that shrinks as you demonstrate compactness
 * is working against the person holding it. (`styles.ts` pins the row gap for
 * the same reason — `--md-sys-spacing-gap-sm` is density-responsive too, and
 * left live it cost the bar 4px at rung -4.) The bar's height is therefore a
 * function of the viewport alone.
 *
 * The one exception is deliberate: the density set renders at the rung it
 * SELECTS, so it previews its own effect — 40px at rung 0 down to 24px at -4.
 * That range sits under the 48px row the pinned select and switch already
 * establish, so previewing never changes the bar's height.
 */
import { LOCALES } from '../i18n/locales';
import { createTranslator, type Translator } from '../i18n/translator';

/**
 * The dock's own labels are FROZEN to English, whatever language the app is
 * showing.
 *
 * It is the evaluator's remote control, not part of the demo. Translating it
 * with the app actively works against the person using it: switch the app to
 * Arabic and the control that switches it back becomes Arabic too, so someone
 * who does not read Arabic has just locked themselves out of their own
 * controls. The language names in the picker stay endonyms — English,
 * Română, العربية — because a language should name itself.
 */
const DOCK_LOCALE = 'en' as const;
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
  // Angular is the only pair whose two halves share a name — Next.js, Nuxt and
  // SvelteKit are already distinct from React, Vue and Svelte — so it is the
  // only one that needs the rendering strategy said out loud.
  'angular-ssr': 'Angular (SSR)',
  svelte: 'Svelte',
  sveltekit: 'SvelteKit',
};

const frameworkLabel = (id: string) =>
  FRAMEWORK_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

/**
 * The density every dock control is pinned to. See the file header: the dock
 * does not densify with the page it densifies.
 *
 * -2 is the rung where the two tallest controls agree — `md-select` comes down
 * to 48px and `md-switch` is already floored at 48px by its touch target — so
 * the row has one height instead of two.
 */
const DOCK_DENSITY = -2;

/**
 * Black or white, whichever is readable on `hex`.
 *
 * The accent swatches paint themselves the preset's seed colour, and the
 * checkmark that marks the active one has to be legible on all four. WCAG
 * relative luminance, 0.5 threshold — enough for a 24px glyph, and it means a
 * future preset lighter than today's four gets a dark tick automatically rather
 * than a white one nobody can see.
 */
function onColorFor(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const channel = (i: number) => {
    const srgb = parseInt(full.slice(i, i + 2), 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

type AttrValue = string | number | boolean | undefined;

/**
 * Create an element and set everything as an ATTRIBUTE, never a property.
 *
 * This is what makes the dock safe to build before `@awc-ui/core` has
 * registered: attributes survive on an un-upgraded element and Stencil reads
 * them when it upgrades, whereas an own property assigned to an un-upgraded
 * element can be shadowed by the class accessor that arrives later. Every prop
 * the dock sets is checked to have an attribute in the built runtime.
 */
function make<T extends HTMLElement = HTMLElement>(
  tag: string,
  attrs: Record<string, AttrValue> = {},
  children: (Node | string)[] = [],
): T {
  const el = document.createElement(tag) as T;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

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
  #settleFrame: number | null = null;
  #published = false;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#state = getShowcaseState();
    this.#t = createTranslator(DOCK_LOCALE);
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
    // The labels are frozen to English (see DOCK_LOCALE), so the direction has
    // to be pinned with them. `dir` inherits from <html>, which the dock itself
    // flips to rtl for the Arabic preview — leaving English controls laid out
    // right-to-left, with the reset button and the pickers in mirrored order.
    // The app under it still mirrors; that is the thing being demonstrated.
    this.setAttribute('dir', 'ltr');

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
    this.#cancelSettle();
    this.#published = false;
    document.documentElement.style.removeProperty('--awc-dock-height');
  }

  attributeChangedCallback(): void {
    if (this.#built) this.#render();
  }

  /* ----------------------------------------------------------- render */

  #build(): void {
    /*
     * A CONSTRUCTABLE STYLESHEET, not a `<style>` element.
     *
     * An enterprise Content-Security-Policy with `style-src 'self'` refuses an
     * inline `<style>` — including one inside a shadow root, which is where this
     * one lived. Measured on the wealth builds under such a policy: the dock's
     * sheet was blocked on every screen and the whole control rendered unstyled.
     *
     * CSSOM is exempt from CSP by design: a sheet built with `new CSSStyleSheet()`
     * and adopted carries the same rules with no inline content for a policy to
     * refuse. Verified rather than assumed — `replaceSync` + `adoptedStyleSheets`
     * applies under `style-src 'self'` where a `<style>` element does not.
     *
     * The `<style>` path is kept for engines without constructable sheets, where
     * there is no CSP-safe alternative anyway and unstyled is the worse outcome.
     */
    const div = document.createElement('div');
    if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(DOCK_STYLES);
      this.#root.adoptedStyleSheets = [sheet];
      this.#root.append(div);
    } else {
      const style = document.createElement('style');
      style.textContent = DOCK_STYLES;
      this.#root.append(style, div);
    }
    this.#render();
  }

  #onStateChange(detail: ShowcaseChangeDetail): void {
    this.#state = detail.state;
    // Deliberately NOT re-created for the new locale — see DOCK_LOCALE.
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
    const collapsed = this.hasAttribute('collapsed');

    // Every state change rebuilds the bar from scratch, which destroys whatever
    // the keyboard was on. That was survivable when each control was an isolated
    // button; it is not now that theme and density are radio groups, where the
    // expected interaction is to arrow along the group and press Space — losing
    // focus to <body> after the first press makes the next arrow key do nothing.
    // `data-focus` names each control stably across rebuilds so it can be handed
    // back. Null when focus is elsewhere, so the dock never steals it.
    const focusKey = this.#root.activeElement?.getAttribute('data-focus') ?? null;

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

    // The chevron is appended BEFORE the panel it controls, for two reasons.
    // Layout: the panel takes a whole row (see `.panel` in styles.ts), so
    // anything after it is pushed onto a row of its own. Semantics: this is the
    // disclosure pattern — the control comes before the region, `aria-controls`
    // points forward, and Tab reaches "hide these controls" before wading
    // through the controls it hides.
    //
    // The glyph swaps rather than being rotated in CSS: md-icon-button owns the
    // inside of its shadow root, and asking it for the other icon is simpler
    // and more honest than reaching through ::part to spin the first. Host-level
    // aria-expanded is valid here — md-icon-button renders role="button" on its
    // host, which supports it.
    const toggle = make('md-icon-button', {
      class: 'toggle',
      'data-focus': 'toggle',
      variant: 'standard',
      size: 'sm',
      density: DOCK_DENSITY,
      icon: collapsed ? 'keyboard_arrow_up' : 'keyboard_arrow_down',
      'aria-expanded': String(!collapsed),
      'aria-controls': panel.id,
      'aria-label': t.t(collapsed ? 'dock.expand' : 'dock.collapse'),
    });
    toggle.addEventListener('mdClick', () => this.toggleAttribute('collapsed'));
    host.append(toggle, panel);

    for (const control of this.#controls) {
      const group = this.#renderControl(control);
      if (group) panel.append(group);
    }

    if (focusKey !== null) this.#restoreFocus(focusKey);
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

  /**
   * Hand focus back to the control named by `key` after a rebuild.
   *
   * Two things make this more than a `focus()` call.
   *
   * The element may not be focusable YET. A freshly created `md-segmented-button`
   * upgrades synchronously but renders on Stencil's own schedule, and until it
   * has rendered there is no `tabindex` on its host for focus to land on — so
   * the first attempt silently does nothing. Hence the bounded retry across
   * animation frames.
   *
   * And the focusable element is not always the one carrying the key.
   * `md-select`'s is an `<input>` two shadow roots down, reachable only through
   * its `focusTrigger()` method; `md-switch` exposes `setFocus()`. Rather than
   * keeping a table of which component needs which call, try all three and let
   * the ones that do not apply be undefined.
   *
   * The guard is what keeps this from being rude: focus is only reclaimed while
   * it is still sitting where our own rebuild dropped it. If the reader has
   * moved on in the meantime, they keep it.
   */
  #restoreFocus(key: string): void {
    const attempt = (remaining: number): void => {
      if (this.#root.activeElement?.getAttribute('data-focus') === key) return;
      const active = document.activeElement;
      if (active && active !== document.body && active !== this) return;

      const el = this.#root.querySelector(`[data-focus="${key}"]`) as
        | (HTMLElement & { focusTrigger?: () => Promise<void>; setFocus?: () => Promise<void> })
        | null;
      if (!el) return;
      el.focus();
      void el.focusTrigger?.();
      void el.setFocus?.();

      if (remaining > 0 && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => attempt(remaining - 1));
      }
    };
    attempt(2);
  }

  /**
   * A cluster with a small-caps caption beside it, for the controls that have
   * no label of their own.
   *
   * `asGroup` puts `role="group"` on the WRAPPER, which is only right for the
   * accent swatches: four independent toggle buttons that need something to
   * hold them together. The segmented sets do not use it — they render
   * `role="radiogroup"` themselves and are pointed at this caption directly, so
   * the name lands on the element carrying the role instead of on a div beside
   * it, and there is no redundant group wrapping a radiogroup.
   */
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

  /**
   * Which way an `md-select`'s menu should prefer to open.
   *
   * The dock is `position: fixed` against one edge of the viewport, so the
   * preferred side is always "into the page". `md-menu` re-checks and flips if
   * the preferred side does not fit, but asking for the right side up front
   * means it never renders a frame in the wrong place first.
   */
  get #menuPlacement(): 'top-start' | 'bottom-start' {
    return this.getAttribute('position') === 'top' ? 'bottom-start' : 'top-start';
  }

  /**
   * A dock `md-select`, named by the component's own floating `label`.
   *
   * The five clusters below keep the small-caps caption beside them because
   * they have no label of their own; a select does, and an external caption
   * plus `aria-labelledby` would be working around a feature the component
   * already ships. It is also what the space is for: the caption and the field
   * are two boxes on a bar whose scarce axis is width, and folding the name
   * into the field is the difference between the controls fitting on one row
   * and taking two — about 57px of every page, permanently.
   *
   * `label` also becomes the name of the popup listbox (md-select uses it for
   * both), so the name reaches assistive tech once, from one place.
   */
  #picker(
    id: string,
    labelKey: string,
    value: string,
    options: { value: string; label: string }[],
  ): HTMLElement {
    return make(
      'md-select',
      {
        id,
        class: 'picker',
        'data-focus': id,
        variant: 'outlined',
        density: DOCK_DENSITY,
        placement: this.#menuPlacement,
        label: this.#t.t(labelKey),
        value,
      },
      options.map((o) => make('md-select-option', { value: o.value, label: o.label })),
    );
  }

  /** A cluster holding a control that names itself — no caption beside it. */
  #selfLabelledGroup(): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'group';
    return div;
  }

  #renderFrameworks(): HTMLElement {
    const wrap = this.#selfLabelledGroup();
    const select = this.#picker(
      'awc-dock-framework',
      'dock.framework',
      this.#currentFramework,
      this.#frameworks.map((id) => ({ value: id, label: frameworkLabel(id) })),
    );
    select.addEventListener('mdChange', (event) => {
      const target = (event as CustomEvent<string>).detail;
      if (!target || target === this.#currentFramework) return;
      const href = this.urlForFramework(target);
      // A full navigation is the point: each framework is a separate build.
      if (typeof location !== 'undefined') location.assign(href);
    });

    wrap.append(select);
    return wrap;
  }

  #renderLanguages(): HTMLElement {
    const wrap = this.#selfLabelledGroup();
    const select = this.#picker(
      'awc-dock-locale',
      'dock.language',
      this.#displayLocale,
      // Endonyms: a language picker names each language in that language.
      //
      // The old `<option lang="ar">` marking each row's language does not
      // survive: md-select reads its options as DATA and renders its own
      // md-menu-item rows, so a `lang` on the source option is dropped. That is
      // md-select's to fix, not the dock's — the dock is not going to reach into
      // another component's shadow root to re-stamp it. Recorded as a known gap.
      LOCALES.map((locale) => ({ value: locale.code, label: locale.nativeName })),
    );
    select.addEventListener('mdChange', (event) => {
      // Direction is intentionally left unset so it re-derives from the locale.
      const locale = (event as CustomEvent<string>).detail as ShowcaseState['locale'];
      if (!locale) return;
      setShowcaseState({ locale, dir: undefined });
      // A locale-routed build has no client-side rendering to re-run: its
      // strings are baked into the HTML. Writing the state above still keeps
      // the choice sticky for the other five builds; the navigation is what
      // actually changes the language here.
      if (this.#localeRoute !== null && typeof location !== 'undefined') {
        location.assign(this.#localeHref(locale));
      }
    });

    wrap.append(select);
    return wrap;
  }

  /**
   * A single-select `md-segmented-button-set`.
   *
   * The set renders `role="radiogroup"` and each segment `role="radio"` +
   * `aria-checked`, which is a better fit than the `aria-pressed` toggles this
   * replaced: these clusters really are one-of-N, and a radiogroup says so.
   * The group is named by pointing the SET at the caption, so the name lands on
   * the element that carries the role rather than on a wrapper beside it.
   *
   * `mdChange` reports the whole selection as an array; single-select means it
   * is always one entry, and an empty array is ignored rather than pushed into
   * the store as an undefined value.
   */
  #segmented(
    variant: 'theme' | 'density',
    labelId: string,
    density: number,
    segments: { value: string; label: string; name?: string }[],
    selected: string,
    onPick: (value: string) => void,
  ): HTMLElement {
    const set = make(
      'md-segmented-button-set',
      { class: `segmented segmented-${variant}`, density, 'aria-labelledby': labelId },
      segments.map((seg) =>
        make('md-segmented-button', {
          value: seg.value,
          label: seg.label,
          'data-focus': `${variant}:${seg.value}`,
          selected: seg.value === selected,
          // The checkmark is off because in a control bar its cost is width,
          // and width is what the bar is short of: a text segment reserves the
          // checkmark's box whether or not it is showing one, which is ~40px
          // per set. The filled container still shows the selection, and
          // `aria-checked` — which the component sets itself — is what actually
          // carries it to assistive tech.
          'no-checkmark': true,
          // Only when the visible label is not a usable name on its own — see
          // the density rungs, where the label is the bare number "-3".
          'aria-label': seg.name,
        }),
      ),
    );
    set.addEventListener('mdChange', (event) => {
      const [value] = (event as CustomEvent<string[]>).detail ?? [];
      if (value !== undefined) onPick(value);
    });
    return set;
  }

  #renderTheme(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.theme', 'awc-dock-theme-label', false);
    wrap.append(
      this.#segmented(
        'theme',
        'awc-dock-theme-label',
        DOCK_DENSITY,
        THEME_MODES.map((mode) => ({ value: mode, label: t.t(`dock.theme.${mode}`) })),
        this.#state.theme,
        (value) => setShowcaseState({ theme: value as ThemeMode }),
      ),
    );
    return wrap;
  }

  #renderDensity(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.density', 'awc-dock-density-label', false);
    wrap.append(
      this.#segmented(
        'density',
        'awc-dock-density-label',
        // The one control that does NOT take the dock's pinned density: it
        // renders at the rung it is selecting, so the set is a live sample of
        // what you are about to do to the page. Its range (40px..24px) stays
        // under the pinned 48px row, so previewing never moves the bar.
        this.#state.density,
        DENSITY_RUNGS.map((rung) => ({
          value: String(rung),
          label: String(rung),
          // "-3" is a legible thing to look at and a useless thing to hear, so
          // the segment keeps the number as its visible label and takes a real
          // name from the dictionary.
          name: rung === 0 ? t.t('dock.density.default') : t.t('dock.density.rung', { value: rung }),
        })),
        String(this.#state.density),
        (value) => setShowcaseState({ density: Number(value) as DensityRung }),
      ),
    );
    return wrap;
  }

  /**
   * The accent swatches: `md-icon-button` in toggle mode, one per preset.
   *
   * The swatch IS the label — the button's container is painted the preset's
   * seed colour through `--md-icon-button-container-color`, which the component
   * documents as a customisation point, so nothing here reaches past the shadow
   * boundary. Selection shows as a checkmark inside the swatch (`selectedIcon`,
   * which only renders in toggle mode) as well as through `aria-pressed`, which
   * md-icon-button emits for the same states the old buttons declared by hand.
   *
   * Toggling is one-way on purpose. Clicking the active swatch would flip its
   * `selected` off, but the state write that follows re-renders the cluster from
   * `#state.seed` and puts it back — a group of four toggles that behaves like
   * four radios, which is what an accent picker is.
   *
   * `shape-morph` is the one piece of the component's own expression turned off
   * here. It is on by default and it is right for a toggle whose shape is free
   * to carry meaning, but these four discs are SAMPLES of a colour: the shape is
   * part of what they are showing, so a selected swatch quietly becoming a 12px
   * squircle (`--_morph-to` in md-icon-button.css) leaves a row reading as three
   * circles and a rounded square, which looks like a rendering fault rather than
   * a selection. The checkmark already says which one is on.
   */
  #renderAccent(): HTMLElement {
    const t = this.#t;
    const wrap = this.#group('dock.accent', 'awc-dock-accent-label', true);
    for (const preset of SEED_PRESETS) {
      const selected = this.#state.seed === preset.id;
      const swatch = make('md-icon-button', {
        class: 'swatch',
        'data-focus': `accent:${preset.id}`,
        variant: 'filled',
        size: 'sm',
        shape: 'round',
        // A string, not `false`: `make()` drops a `false` attribute entirely,
        // which would leave the default (`true`) in place.
        'shape-morph': 'false',
        density: DOCK_DENSITY,
        toggle: true,
        selected,
        'selected-icon': 'check',
        'aria-label': t.t(preset.labelKey),
      });
      swatch.style.setProperty('--md-icon-button-container-color', preset.seed);
      // The four seeds are all mid-to-dark, but the checkmark is picked against
      // the actual colour rather than assumed, so a lighter preset added later
      // does not silently ship a white tick on a pale disc.
      swatch.style.setProperty('--md-icon-button-icon-color', onColorFor(preset.seed));
      swatch.style.setProperty('--md-icon-button-state-layer-color', onColorFor(preset.seed));
      swatch.addEventListener('mdClick', () => setShowcaseState({ seed: preset.id }));
      wrap.append(swatch);
    }
    return wrap;
  }

  /**
   * The direction switch.
   *
   * `md-switch` renders `role="switch"` + `aria-checked` on its own host, so
   * the ARIA the old button declared by hand now comes from the component. The
   * name is the visible "RTL" text, via `aria-labelledby`: a switch called
   * "Left to right" that reads as "off" is a riddle, and the old aria-label also
   * failed WCAG 2.5.3, since the visible label said "RTL" and the accessible
   * name said something else entirely. "RTL, switch, off" is unambiguous, and
   * the visible and accessible names are now the same string.
   */
  #renderDirection(): HTMLElement {
    const wrap = this.#group('dock.direction', 'awc-dock-dir-label', false);
    const rtl = this.#state.dir === 'rtl';

    const name = document.createElement('span');
    name.className = 'switch-label';
    name.id = 'awc-dock-dir-name';
    name.textContent = 'RTL';

    const control = make('md-switch', {
      class: 'switch',
      'data-focus': 'direction',
      density: DOCK_DENSITY,
      selected: rtl,
      icons: true,
      'aria-labelledby': 'awc-dock-dir-name',
    });
    control.addEventListener('mdChange', (event) => {
      const next = (event as CustomEvent<{ selected: boolean }>).detail?.selected;
      setShowcaseState({ dir: next ? 'rtl' : 'ltr' });
    });

    wrap.append(name, control);
    return wrap;
  }

  #renderReset(): HTMLElement {
    const t = this.#t;
    const wrap = document.createElement('div');
    wrap.className = 'group';
    const button = make(
      'md-button',
      {
        class: 'reset',
        'data-focus': 'reset',
        variant: 'outlined',
        size: 'sm',
        density: DOCK_DENSITY,
        // Visible "Reset", accessible "Reset controls" — the name contains the
        // visible label, so 2.5.3 holds and the bare verb gains its object.
        'aria-label': t.t('dock.reset'),
      },
      [t.t('action.reset')],
    );
    button.addEventListener('mdClick', () => this.reset());
    wrap.append(button);
    return wrap;
  }

  /* ------------------------------------------------------------ height */

  /**
   * Publish the bar's height as `--awc-dock-height` on `<html>` so the host page
   * can reserve room for it. This is a CSS custom property, not one of the four
   * documented global attributes — the attribute contract stays untouched.
   *
   * MEASURED AFTER THE REBUILD SETTLES, not during it, and neither the delay nor
   * the ResizeObserver alone is enough.
   *
   * `#render()` throws the whole bar away and rebuilds it. The replacement
   * `md-*` elements exist the instant they are created, but Stencil writes their
   * contents on its own animation frame, so anything measured before that write
   * lands is a bar caught mid-rebuild — and wrong in both directions. Measured
   * synchronously it is 12px short at 1280px and 124px short at 390px, where the
   * empty controls fit on fewer rows than the finished ones will. Measured one
   * frame later, but ahead of Stencil's write in the same frame, the segmented
   * sets are briefly 13px too wide, the row wraps, and it is 56px too TALL.
   *
   * The ResizeObserver cannot clean up after either, because it reports the box
   * as it stands when the frame's layout is FINAL — by which point the bar is
   * back to the height it started at, so there is no change to report and it
   * never fires. Whichever wrong number was published is the last word: the page
   * reserves the wrong amount of room from the reader's first click on any
   * control, permanently. Reserving too little is the same failure the CSS
   * reservations exist to prevent, arriving one interaction later instead of on
   * load.
   *
   * So the measurement waits two frames. The second frame begins after the first
   * one's layout is final, which is the earliest moment the bar is honestly its
   * own size, and it still runs before that frame is painted, so no intermediate
   * value is ever seen. The ResizeObserver stays for what it is actually good at
   * — viewport changes, and any rebuild slow enough to change the box ACROSS
   * frames rather than within one.
   */
  #publishHeight(): void {
    if (typeof requestAnimationFrame !== 'function') {
      this.#measureHeight();
      return;
    }
    // Except on the very first publish, where the page has no reservation at all
    // yet: a value now is worth more than a better value two frames later, and
    // while the runtime is still landing the CSS reservations make this one
    // right anyway. That is the case `--awc-dock-height` exists for.
    if (!this.#published) this.#measureHeight();
    this.#cancelSettle();
    this.#settleFrame = requestAnimationFrame(() => {
      this.#settleFrame = requestAnimationFrame(() => {
        this.#settleFrame = null;
        this.#measureHeight();
      });
    });
  }

  #cancelSettle(): void {
    if (this.#settleFrame !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.#settleFrame);
    }
    this.#settleFrame = null;
  }

  #measureHeight(): void {
    const dock = this.#root.lastElementChild as HTMLElement | null;
    if (!dock) return;
    const h = dock.getBoundingClientRect().height;
    if (h > 0) {
      this.#published = true;
      document.documentElement.style.setProperty('--awc-dock-height', `${Math.round(h)}px`);
    }
  }

  /**
   * Republish when the bar reflows for a reason `#render()` did not cause —
   * the viewport changing width and the controls wrapping onto another row.
   *
   * This one measures STRAIGHT AWAY, unlike `#publishHeight`. A ResizeObserver
   * callback runs with the frame's layout already final, so there is nothing to
   * wait for, and deferring here would be actively wrong: during a drag-resize
   * the observer fires every frame, and each one would cancel the last one's
   * pending measurement, so the page would keep the height it had when the drag
   * started until the reader let go.
   */
  #observeHeight(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const dock = this.#root.lastElementChild as HTMLElement | null;
    if (!dock) return;
    this.#resizeObserver = new ResizeObserver(() => this.#measureHeight());
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
