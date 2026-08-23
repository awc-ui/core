/*
 * MD3 → chart theme bridge
 * ===========================================================
 * Reads the MD3 design tokens out of the host element's
 * computed style and shapes them into a small "MdChartTheme"
 * object that every chart component uses to colour series,
 * size text, choose easing curves, and pick gridline colours.
 *
 * Tokens are resolved per-host (so each chart reacts to its own
 * CSS variables / theme) and handed to the in-house engine's
 * EngineTheme, which the Canvas renderer draws from.
 * That lets the same `<md-line-chart>` use different colours
 * inside a `[data-theme="dark"]` subtree vs. the default scope
 * without any consumer wiring.
 *
 * Token reads are batched in `readMdChartTheme()` so we only
 * touch `getComputedStyle()` once per re-theme; ECharts then
 * re-uses the cached object across animation frames.
 * ===========================================================
 */

import type { MdChartAxisBand, MdChartColorRole } from './types';
import type { AxisBandSpec } from './engine/layout';
import { withAlpha, mixColor } from './engine/color';

export interface MdChartTheme {
  /** Background of the plot surface. Usually `transparent` so the
   *  host's own background bleeds through (cards, panels, etc.). */
  background: string;
  /** Default text colour for tick labels, legend, tooltip body. */
  textColor: string;
  /** Secondary text colour (axis names, tooltip captions). */
  textColorMuted: string;
  /** Major gridline colour. */
  gridColor: string;
  /** Axis line colour. */
  axisLineColor: string;
  /** Surface colour — the interior fill for hollow (open) markers. */
  surface: string;
  /** Tooltip surface colour. */
  tooltipSurface: string;
  /** Tooltip text colour (contrasts with `tooltipSurface`). */
  tooltipTextColor: string;
  /** Tooltip border colour. */
  tooltipBorderColor: string;
  /** Tooltip shadow (CSS box-shadow string). */
  tooltipShadow: string;
  /** Tooltip corner radius (px). */
  tooltipRadius: number;
  /** Default series palette (resolved CSS colour strings). */
  palette: string[];
  /** Font-family stack to use for all chart text. */
  fontFamily: string;
  /** Label-small font-size (px) — tick labels, legend. */
  labelSize: number;
  /** Title-small font-size (px) — axis names, tooltip header. */
  titleSize: number;
  /** Motion duration (ms) for entry / data-update animations. */
  motionDuration: number;
  /** Motion easing — ECharts-compatible name. */
  motionEasing: string;
  /** Whether the user prefers reduced motion. */
  reducedMotion: boolean;
  /** Whether the host is in a high-contrast / forced-colors mode. */
  forcedColors: boolean;
}

/** Default MD3 palette cycle order — primary leads, then the
 *  expressive accents so a 2-series chart reads as a primary
 *  vs. an accent rather than two siblings of equal weight. */
const DEFAULT_ROLE_CYCLE: MdChartColorRole[] = [
  'primary',
  'tertiary',
  'secondary',
  'error',
  'primary-container',
  'tertiary-container',
  'secondary-container',
  'error-container',
];

const TOKEN_PROP: Record<MdChartColorRole, string> = {
  primary: '--md-sys-color-primary',
  secondary: '--md-sys-color-secondary',
  tertiary: '--md-sys-color-tertiary',
  error: '--md-sys-color-error',
  'primary-container': '--md-sys-color-primary-container',
  'secondary-container': '--md-sys-color-secondary-container',
  'tertiary-container': '--md-sys-color-tertiary-container',
  'error-container': '--md-sys-color-error-container',
  'surface-variant': '--md-sys-color-surface-variant',
  success: '--md-sys-color-success',
  warning: '--md-sys-color-warning',
  info: '--md-sys-color-info',
  'success-container': '--md-sys-color-success-container',
  'warning-container': '--md-sys-color-warning-container',
  'info-container': '--md-sys-color-info-container',
};

const FALLBACKS: Record<MdChartColorRole, string> = {
  primary: '#6750A4',
  secondary: '#625B71',
  tertiary: '#7D5260',
  error: '#B3261E',
  'primary-container': '#EADDFF',
  'secondary-container': '#E8DEF8',
  'tertiary-container': '#FFD8E4',
  'error-container': '#F9DEDC',
  'surface-variant': '#E7E0EC',
  success: '#2E6B4F',
  warning: '#7A5900',
  info: '#38608F',
  'success-container': '#B8F0CE',
  'warning-container': '#FFDF9B',
  'info-container': '#D3E4FF',
};

/**
 * Resolve a single colour role to a CSS colour string by reading
 * the matching `--md-sys-color-*` variable off the host.
 * Falls back to the M3 baseline if the token is unset.
 */
export function resolveMdColor(
  host: HTMLElement,
  role: MdChartColorRole,
  computed?: CSSStyleDeclaration,
): string {
  const cs = computed ?? getComputedStyle(host);
  const val = cs.getPropertyValue(TOKEN_PROP[role]).trim();
  return val || FALLBACKS[role];
}

/**
 * A harmonious categorical palette of `n` colours drawn from the scheme's
 * non-semantic accents.
 *
 * The default role cycle reaches for `error` as its fourth colour, which is the
 * only other saturated hue in an MD3 scheme — but red is the scheme's signal
 * for something being wrong, so a five-category pie ends up implying one of its
 * categories is a fault. This walks primary → tertiary → secondary instead and
 * blends between them for the extra steps, so more categories means finer
 * gradations of the SAME scheme rather than borrowing a semantic colour.
 */
export function harmonicPalette(
  anchors: string[],
  n: number,
  /** Light / dark ends of the scheme, used to separate adjacent entries. */
  contrast?: { light: string; dark: string },
): string[] {
  const usable = anchors.filter(Boolean);
  if (n <= 0 || usable.length === 0) return [];
  if (usable.length === 1) return Array.from({ length: n }, () => usable[0]);
  const ramp: string[] = [];
  for (let i = 0; i < n; i++) {
    if (n === 1) {
      ramp.push(usable[0]);
      continue;
    }
    // Spread across the WHOLE ramp rather than taking the first n anchors: two
    // categories should get the two most separated accents, not two adjacent
    // ones. Land exactly on an anchor and it is returned untouched, so an
    // unblended entry keeps the caller's own colour notation.
    const t = (i / (n - 1)) * (usable.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(usable.length - 1, lo + 1);
    const f = t - lo;
    ramp.push(f === 0 ? usable[lo] : f === 1 ? usable[hi] : mixColor(usable[lo], usable[hi], f));
  }
  if (!contrast || n <= usable.length) return ramp;
  // Hue alone runs out: an MD3 scheme's three accents are tonally close, so
  // five steps between them leave neighbours nearly identical. Alternating a
  // small lightness shift separates each entry from the one beside it while
  // keeping every colour inside the scheme.
  return ramp.map((c, i) => (i % 2 === 0 ? c : mixColor(c, i % 4 === 1 ? contrast.dark : contrast.light, 0.22)));
}

/**
 * Resolve a series colour spec to a concrete CSS colour string.
 * Accepts either an MD3 role (auto-themed) or a raw colour string
 * (hex / rgb / hsl / named colours / `currentColor`).
 */
export function resolveSeriesColor(
  host: HTMLElement,
  color: string | MdChartColorRole | undefined,
  fallback: string,
  computed?: CSSStyleDeclaration,
): string {
  if (!color) return fallback;
  if (color in TOKEN_PROP) {
    return resolveMdColor(host, color as MdChartColorRole, computed);
  }
  // Anything else is treated as a raw CSS colour — but it has to actually BE
  // one. Canvas does not throw on `fillStyle = 'info'`; it ignores the
  // assignment and keeps whatever colour the context last used, so a bad role
  // name or a typo renders as a black (or arbitrarily-coloured) series with
  // nothing in the console. Validate here so it degrades to the palette
  // fallback instead, and say why.
  if (!isCssColor(color)) {
    console.warn(
      `[md-chart] "${color}" is not a colour role or a valid CSS colour — falling back. ` +
        `Roles: ${Object.keys(TOKEN_PROP).join(', ')}.`,
    );
    return fallback;
  }
  return color;
}

/** `CSS.supports` is the cheapest parser available and is safe in every
 *  browser we target; SSR/jsdom lacks it, where the value is passed through
 *  unchanged because nothing paints there anyway. */
function isCssColor(value: string): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return true;
  return CSS.supports('color', value);
}

/**
 * Resolve a CSS colour that references custom properties.
 *
 * Canvas cannot: assigning `color-mix(in srgb, var(--md-sys-color-error) 6%,
 * transparent)` to `fillStyle` is REJECTED outright, and the context then keeps
 * whatever colour it last used — so an axis band painted itself in the previous
 * series' fill and changed appearance whenever unrelated colours changed. It
 * has no custom-property scope of its own, so the value has to be computed
 * against a real element first.
 *
 * The probe goes in the shadow root rather than the light DOM: custom
 * properties inherit through the boundary, and adding a child to the host would
 * disturb slot assignment.
 */
function resolveComputedColor(host: HTMLElement, value: string): string {
  if (!/var\(|color-mix\(/i.test(value)) return value;
  const doc = host.ownerDocument;
  const parent: Node | null = host.shadowRoot ?? host;
  if (!doc || typeof getComputedStyle !== 'function') return value;
  const probe = doc.createElement('span');
  probe.style.cssText = 'position:absolute;inline-size:0;block-size:0;visibility:hidden';
  probe.style.color = value;
  parent.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out || value;
}

/**
 * Resolve an axis' shaded bands into engine specs, mapping MD3 colour roles to
 * live token values. Colours left unset stay undefined so the engine can fall
 * back to a themed tint that works on light and dark.
 */
export function resolveAxisBands(
  host: HTMLElement,
  bands: MdChartAxisBand[] | undefined,
): AxisBandSpec[] | undefined {
  if (!bands?.length) return undefined;
  return bands.map((b) => ({
    from: b.from,
    to: b.to,
    color: b.color != null ? resolveComputedColor(host, resolveSeriesColor(host, b.color, b.color)) : undefined,
    label: b.label,
    labelAlign: b.labelAlign,
    labelColor:
      b.labelColor != null ? resolveComputedColor(host, resolveSeriesColor(host, b.labelColor, b.labelColor)) : undefined,
  }));
}

/**
 * Read a single chart-level CSS custom property with a fallback.
 * Public chart vars look like `--md-{chart}-{prop}`, while
 * shared chart vars use the `--md-chart-{prop}` namespace; both
 * are resolved with the same helper for consistency.
 */
/**
 * The MD3 typescale `*-font` tokens are full CSS `font` SHORTHANDS
 * (e.g. `"400 14px/20px Roboto, sans-serif"`), not a bare family. The
 * chart engine needs just the family list (it composes its own
 * `font: <weight> <size>px <family>`), so extract everything after the
 * `<size>[/<line-height>]` token. A value with no size is assumed to
 * already be a family list and passed through.
 */
export function fontFamilyOf(font: string): string {
  const m = font.match(/\d*\.?\d+(?:px|rem|em|pt|%)(?:\s*\/\s*\S+)?\s+(.+)$/);
  return (m ? m[1] : font).trim();
}

function readVar(cs: CSSStyleDeclaration, name: string, fallback: string): string {
  const v = cs.getPropertyValue(name).trim();
  return v || fallback;
}

function readNumberVar(cs: CSSStyleDeclaration, name: string, fallback: number): number {
  const raw = cs.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Map an MD3 motion-easing token (`cubic-bezier(...)`) into an
 * ECharts easing identifier. ECharts only ships a fixed set of
 * named easings (no raw cubic-bezier support), so we approximate
 * the M3 standard / emphasized / decelerated / accelerated
 * families with the closest built-in.
 *
 * Reference:
 *   • M3 standard       ≈ cubic-bezier(0.2, 0, 0, 1)         → cubicInOut
 *   • M3 emphasized     ≈ cubic-bezier(0.2, 0, 0, 1) (anticipating overshoot) → cubicOut
 *   • M3 decelerated    ≈ cubic-bezier(0, 0, 0, 1)            → cubicOut
 *   • M3 accelerated    ≈ cubic-bezier(0.3, 0, 1, 1)          → cubicIn
 *
 * Pickers / panels / charts share the "emphasized" family by
 * default — it conveys "this responded to me" without feeling
 * mechanical, matching MUI X's spring-loaded enter feel.
 */
function pickEasing(rawCubicBezier: string): string {
  if (!rawCubicBezier) return 'cubicOut';
  const m = rawCubicBezier.match(/cubic-bezier\(([^)]+)\)/);
  if (!m) return 'cubicOut';
  const [a, b, c, d] = m[1].split(',').map(s => parseFloat(s.trim()));
  // Roughly: x1 near 0 + y2 near 1 → decelerated/standard family.
  if (a < 0.25 && d > 0.95) return 'cubicOut';
  // x1 ≥ 0.3 + y1 ≈ 0 → accelerated.
  if (a >= 0.3 && b < 0.1) return 'cubicIn';
  // Default to in-out for symmetric easings.
  if (Math.abs(a - (1 - d)) < 0.15 && Math.abs(b - (1 - c)) < 0.15) return 'cubicInOut';
  return 'cubicOut';
}

/**
 * Build the per-render theme object by reading the host's tokens.
 * Cheap enough to call on every `componentDidLoad` and on the
 * `themechange` event that the global theme switcher dispatches.
 */
export function readMdChartTheme(host: HTMLElement): MdChartTheme {
  const cs = getComputedStyle(host);

  const palette = DEFAULT_ROLE_CYCLE.map(r => resolveMdColor(host, r, cs));

  const motionDuration = readNumberVar(cs, '--md-sys-motion-duration-medium2', 300);
  const easingRaw = readVar(cs, '--md-sys-motion-easing-emphasized', 'cubic-bezier(0.2, 0, 0, 1)');

  // Reduced-motion + forced-colors are environment-level, not
  // tokens — query them via window.matchMedia at theme-read
  // time so chart respects OS-level preferences without an
  // explicit prop.
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const forcedColors =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(forced-colors: active)').matches;

  return {
    background: 'transparent',
    textColor: readVar(cs, '--md-sys-color-on-surface', '#1C1B1F'),
    textColorMuted: readVar(cs, '--md-sys-color-on-surface-variant', '#49454F'),
    // `--md-chart-grid-color` / `--md-chart-axis-color` let a consumer override
    // the gridline / axis-line colour per chart. MD3 data-viz keeps these light:
    // both default to `outline-variant`, and the gridlines sit at a lower opacity
    // so they read as faint guides beneath a slightly more present axis line —
    // no heavy chart frame. A consumer override is used verbatim (not dimmed).
    gridColor: (() => {
      const override = readVar(cs, '--md-chart-grid-color', '');
      return override || withAlpha(readVar(cs, '--md-sys-color-outline-variant', '#CAC4D0'), 0.5);
    })(),
    axisLineColor: readVar(cs, '--md-chart-axis-color', readVar(cs, '--md-sys-color-outline-variant', '#CAC4D0')),
    surface: readVar(cs, '--md-sys-color-surface', '#FFFBFE'),
    tooltipSurface: readVar(cs, '--md-sys-color-inverse-surface', readVar(cs, '--md-sys-color-on-surface', '#322F35')),
    tooltipTextColor: readVar(cs, '--md-sys-color-inverse-on-surface', readVar(cs, '--md-sys-color-surface', '#F5EFF7')),
    tooltipBorderColor: 'transparent',
    tooltipShadow: readVar(cs, '--md-sys-elevation-2', '0px 1px 2px rgba(0,0,0,0.3), 0px 2px 6px 2px rgba(0,0,0,0.15)'),
    tooltipRadius: readNumberVar(cs, '--md-sys-shape-corner-small', 8),
    palette,
    fontFamily: fontFamilyOf(readVar(cs, '--md-sys-typescale-label-medium-font', '"Roboto", system-ui, sans-serif')),
    labelSize: Math.max(9, readNumberVar(cs, '--md-sys-typescale-label-small-size', 11) + readNumberVar(cs, '--md-sys-density-scale', 0) * 0.5),
    titleSize: Math.max(11, readNumberVar(cs, '--md-sys-typescale-title-small-size', 14) + readNumberVar(cs, '--md-sys-density-scale', 0) * 0.5),
    motionDuration: reducedMotion ? 0 : motionDuration,
    motionEasing: pickEasing(easingRaw),
    reducedMotion,
    forcedColors,
  };
}

/**
 * Build a tooltip formatter that produces MD3-styled HTML.
 * Used by every chart so the surface/typography/contrast match.
 *
 * The `inverse-surface` tokens give us the MD3 "tooltip" scheme
 * out of the box — dark surface on light theme, light surface
 * on dark theme — so the formatter doesn't need a separate
 * dark-mode branch.
 */
export function buildTooltipStyle(theme: MdChartTheme): {
  backgroundColor: string;
  borderColor: string;
  borderRadius: number;
  extraCssText: string;
  textStyle: { color: string; fontFamily: string; fontSize: number };
} {
  return {
    backgroundColor: theme.tooltipSurface,
    borderColor: theme.tooltipBorderColor,
    borderRadius: theme.tooltipRadius,
    extraCssText: `box-shadow: ${theme.tooltipShadow}; padding: 8px 12px; max-inline-size: 280px;`,
    textStyle: {
      color: theme.tooltipTextColor,
      fontFamily: theme.fontFamily,
      fontSize: theme.labelSize,
    },
  };
}

/* ===========================================================
 * Theme-change watching
 * ===========================================================
 * `readMdChartTheme` resolves tokens from the host's computed
 * style, so a chart is correct at paint time — but a canvas is
 * pixels, not CSS: it does not retint itself when the tokens
 * change underneath it. Charts used to watch only
 * `prefers-color-scheme`, which catches an OS dark-mode flip
 * and nothing else. Every in-page theme change — `data-theme`
 * toggled on a wrapper, a seed/accent palette written as
 * `--md-sys-color-*` overrides by @awc-ui/theme, a class swap —
 * left the canvas painted in the previous palette while the DOM
 * around it retinted.
 *
 * `watchMdChartTheme` closes that: it listens to the media
 * query AND to attribute mutations on the host's ancestor chain
 * (which is where `data-theme`, `class` and inline custom
 * properties actually land), then re-reads a cheap fingerprint
 * of the tokens that matter and only calls back when one really
 * changed. That guard matters — pages toggle classes constantly,
 * and a chart repaint rebuilds the engine.
 * =========================================================== */

/** Tokens whose change must repaint a chart. Deliberately short:
 *  this runs on every candidate mutation, unlike the full read. */
const THEME_FINGERPRINT_VARS = [
  '--md-sys-color-primary',
  '--md-sys-color-secondary',
  '--md-sys-color-tertiary',
  '--md-sys-color-surface',
  '--md-sys-color-on-surface',
  '--md-sys-color-on-surface-variant',
  '--md-sys-color-outline-variant',
  '--md-sys-color-error',
] as const;

/** Cheap signature of the host's resolved chart-relevant tokens. */
export function mdChartThemeFingerprint(host: HTMLElement): string {
  if (typeof getComputedStyle !== 'function') return '';
  const cs = getComputedStyle(host);
  let out = '';
  for (const v of THEME_FINGERPRINT_VARS) out += cs.getPropertyValue(v).trim() + '|';
  // Font family shifts metrics, not just colour, so it belongs in the signature.
  return out + cs.getPropertyValue('--md-sys-typescale-body-small-font-family').trim();
}

/**
 * Call `onChange` whenever the tokens this host resolves actually change.
 *
 * Watches the `prefers-color-scheme` media query plus `data-theme` / `class` /
 * `style` attribute mutations on the host and each of its ancestors — the
 * places a theme is switched in practice. The fingerprint check means a
 * mutation that does not move a token costs one `getComputedStyle` and
 * nothing more.
 *
 * @returns a dispose function; call it from `disconnectedCallback`.
 */
export function watchMdChartTheme(host: HTMLElement, onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  let last = mdChartThemeFingerprint(host);
  const check = () => {
    const next = mdChartThemeFingerprint(host);
    if (next === last) return;
    last = next;
    onChange();
  };

  // Every trigger below is coalesced onto one frame. Two reasons: a media
  // query fires BEFORE styles settle in some engines, so a synchronous read
  // returns the OLD palette; and a single theme switch typically produces a
  // burst of mutations (attribute + stylesheet + reflow), which would
  // otherwise fingerprint the host once per mutation.
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      check();
    });
  };

  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  mql?.addEventListener?.('change', schedule);

  const observer = new MutationObserver(schedule);

  // 1. The host's ancestor chain — where `data-theme`, `class` and inline
  //    custom properties land. Ancestors only; never `subtree: true` on the
  //    document, which would fire for every unrelated attribute write.
  const attrOpts: MutationObserverInit = {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style'],
  };
  for (let node: HTMLElement | null = host; node; node = node.parentElement) {
    observer.observe(node, attrOpts);
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    observer.observe(document.documentElement, attrOpts);
  }

  // 2. document.head — the STYLESHEET path, which mutates nothing on the
  //    ancestor chain and so was previously invisible. This is not an exotic
  //    case: it is exactly what @awc-ui/theme's `applyThemeStylesheet` does
  //    (it appends a <style> and rewrites its textContent), and what the theme
  //    generator page uses. Without this a seed/accent swap left every canvas
  //    on the page painted in the old palette. childList+characterData catch
  //    both the first insertion and later content rewrites; the attribute
  //    filter catches a <link> being repointed or disabled.
  //    Bursty in dev (HMR injects <style> constantly), which is precisely why
  //    the checks are frame-coalesced and fingerprint-guarded: the cost of a
  //    theme-irrelevant head mutation is one getComputedStyle per frame.
  if (typeof document !== 'undefined' && document.head) {
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'media', 'disabled'],
    });
  }

  // NOT covered: `document.adoptedStyleSheets` and CSSOM edits to an existing
  // sheet (insertRule) — neither is observable by any browser API. That is
  // what the charts' public `refreshTheme()` is for.

  return () => {
    mql?.removeEventListener?.('change', schedule);
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
