import type { Preview, Decorator } from '@storybook/web-components';
import { action } from 'storybook/actions';
import { awcUiTheme } from './theme.ts';
import '@awc-ui/core/define';
import '@awc-ui/tokens/tokens.css';
import 'material-icons/iconfont/material-icons.css';
import 'material-symbols/outlined.css';
import 'material-symbols/rounded.css';
import {
  computeTheme,
  applyThemeStylesheet,
  clearThemeRoles,
  applyFontFamily,
  loadGoogleFont,
  DEFAULT_SEED_COLORS,
  DEFAULT_FONT_FAMILY,
  type ThemeComputeResult,
} from '@awc-ui/theme';
import { toFramework, type Framework } from '../src/framework-source.ts';

const COLOR_DEBOUNCE_MS = 150;
const STORYBOOK_THEME_STYLE_ID = 'awc-ui-storybook-theme';

let cachedColors = '';
let cachedTheme: ThemeComputeResult | null = null;
let cachedIsDark: boolean | null = null;
let cachedFontFamily = '';
let colorDebounceTimer: ReturnType<typeof setTimeout> | undefined;

function normalizeHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`;
  }
  return fallback;
}

function updateCanvasStyles(): void {
  const bg = 'var(--md-sys-color-background)';
  const fg = 'var(--md-sys-color-on-background)';

  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.color = fg;
  document.body.style.backgroundColor = bg;
  document.body.style.color = fg;

  requestAnimationFrame(() => {
    const root = document.getElementById('storybook-root');
    if (root) {
      root.style.backgroundColor = bg;
      // NB: no min-height here. 100vh + the padded layout's 2x16px body
      // padding made EVERY story page exactly 32px taller than the viewport —
      // permanently (barely) scrollable — so macOS flashed its overlay
      // scrollbar on any layout change (visible as "a scrollbar appears and
      // disappears" when e.g. a table grows on rows-per-page changes). The
      // full-height background is already painted on <html> and <body> above.
      root.style.color = fg;
    }
    document.querySelectorAll('.sb-show-main, .docs-story').forEach((el) => {
      const node = el as HTMLElement;
      node.style.backgroundColor = bg;
      node.style.color = fg;
    });
  });
}

function syncThemeMode(isDark: boolean): void {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  updateCanvasStyles();
}

function applyGeneratedTheme(
  theme: ThemeComputeResult,
  isDark: boolean,
  fontFamily: string,
): void {
  applyThemeStylesheet(theme, STORYBOOK_THEME_STYLE_ID);
  clearThemeRoles(document.documentElement);
  syncThemeMode(isDark);

  if (fontFamily !== cachedFontFamily) {
    applyFontFamily(document.documentElement, fontFamily);
    loadGoogleFont(fontFamily);
    cachedFontFamily = fontFamily;
  }
}

const withDynamicTheme: Decorator = (story, context) => {
  const globals = context.globals ?? {};
  const primary = normalizeHex(globals.primaryColor, DEFAULT_SEED_COLORS.primary);
  const secondary = normalizeHex(globals.secondaryColor, DEFAULT_SEED_COLORS.secondary);
  const tertiary = normalizeHex(globals.tertiaryColor, DEFAULT_SEED_COLORS.tertiary);
  const fontFamily = (globals.fontFamily as string | undefined)?.trim() || DEFAULT_FONT_FAMILY;
  const isDark = globals.theme === 'dark';
  const colorKey = `${primary}|${secondary}|${tertiary}`;

  const themeInputsChanged = colorKey !== cachedColors || isDark !== cachedIsDark || fontFamily !== cachedFontFamily;

  if (themeInputsChanged) {
    const applyNow = (theme: ThemeComputeResult) => {
      applyGeneratedTheme(theme, isDark, fontFamily);
      cachedIsDark = isDark;
    };

    if (colorKey !== cachedColors) {
      clearTimeout(colorDebounceTimer);
      colorDebounceTimer = setTimeout(() => {
        cachedTheme = computeTheme({
          primaryHex: primary,
          secondaryHex: secondary,
          tertiaryHex: tertiary,
        });
        cachedColors = colorKey;
        applyNow(cachedTheme);
      }, COLOR_DEBOUNCE_MS);

      if (!cachedTheme) {
        // fresh load: applied synchronously — the armed debounce timer would
        // re-apply 150ms later with global (light) theme state OVER a story
        // decorator's dark theme; cancel it (it exists for picker churn only)
        clearTimeout(colorDebounceTimer);
        cachedTheme = computeTheme({
          primaryHex: primary,
          secondaryHex: secondary,
          tertiaryHex: tertiary,
        });
        cachedColors = colorKey;
        applyNow(cachedTheme);
      } else {
        applyNow(cachedTheme);
      }
    } else if (cachedTheme) {
      applyNow(cachedTheme);
    } else {
      cachedTheme = computeTheme({
        primaryHex: primary,
        secondaryHex: secondary,
        tertiaryHex: tertiary,
      });
      cachedColors = colorKey;
      applyNow(cachedTheme);
    }
  }

  return story();
};

// Every custom event emitted by @awc-ui/core components (grep `@Event` in
// packages/core). `parameters.actions.handles` is inert in Storybook 8 without
// the `withActions` decorator — with both applied globally here, the Actions
// panel logs component events on every story with zero per-story wiring.
// Deliberately excluded: continuous pointer/scroll streams (mdDragMove, mdMove,
// mdScroll, mdVisibleRangeChange) — logging one action per frame floods the
// panel and makes drags/scrolls feel sluggish (each entry is serialized onto
// the manager channel).
const CORE_EVENTS = [
  'mdAction', 'mdActivate', 'mdAreaClick', 'mdAxisClick',
  'mdBack', 'mdBarClick', 'mdBeforeChange', 'mdCancel',
  'mdChange', 'mdClear', 'mdClick', 'mdClose', 'mdCollapse',
  'mdColumnVisibilityChange', 'mdComplete', 'mdDragEnd', 'mdDragStart', 'mdError',
  'mdExpand', 'mdFocus', 'mdBlur', 'mdHover', 'mdInput', 'mdInvalidInput', 'mdItemClick',
  'mdItemRequestReorder', 'mdItemSelect', 'mdItemToggle', 'mdLeadingClick',
  'mdLeadingIconClick', 'mdLegendClick', 'mdLineClick', 'mdLoad', 'mdLoadError',
  'mdMarkerClick',
  'mdMenuOpen', 'mdMenuSelect', 'mdModeChange', 'mdOpen', 'mdOpenChange',
  'mdPageChange', 'mdPasswordToggle', 'mdPinChange', 'mdReady', 'mdRemove',
  'mdReorder', 'mdRequestActivation', 'mdRowClick', 'mdRowExpandedChange',
  'mdRowSelectionChange', 'mdRowsPerPageChange', 'mdScrollEdgeChange', 'mdSearch',
  'mdSearchActivate', 'mdSearchInput', 'mdSegmentClick', 'mdSelect', 'mdSelected',
  'mdSelectionChange', 'mdSliceClick', 'mdSortChange', 'mdSortRequest',
  'mdSparkClick', 'mdSpeechResult', 'mdStepBack', 'mdStepChange', 'mdStepClick',
  'mdStepNext', 'mdSubmit', 'mdTabChange', 'mdTabClick', 'mdToggle',
  'mdTrailingClick', 'mdTrailingIconClick', 'mdViewChange', 'mdVoice',
];

/*
 * Storybook's own `withActions` logs the CustomEvent OBJECT. The manager
 * channel cannot serialize a CustomEvent, so the panel shows
 *   mdClick: {__isClassInstance__: true, __className__: "CustomEvent"}
 * and the payload — the only part anyone wants — is invisible.
 *
 * This logs `event.detail` instead, so a click on a button group reads
 *   mdSelectionChange: { values: ["b"], added: ["b"], removed: ["a"] }
 *
 * Listeners are attached once, in the capture phase on `document`: every
 * component event is `composed`, so it reaches the document regardless of how
 * deep in shadow DOM it originated, and one story renders at a time.
 */
const actionFor = new Map<string, ReturnType<typeof action>>();
let actionsWired = false;

const withEventDetails: Decorator = (story) => {
  if (!actionsWired && typeof document !== 'undefined') {
    actionsWired = true;
    for (const name of CORE_EVENTS) {
      actionFor.set(name, action(name));
      document.addEventListener(
        name,
        (e) => {
          const detail = (e as CustomEvent).detail;
          actionFor.get(name)!(detail === undefined ? '(no detail)' : detail);
        },
        true,
      );
    }
  }
  return story();
};

// ── Direction + locale toolbar ──────────────────────────────────────────────
// Two toolbar globals flip ANY story to RTL / another language without a
// per-story wrapper. Direction defaults to `auto` (derives from the locale, so
// picking Arabic/Hebrew turns the whole canvas RTL); LTR / RTL force it. Locale
// sets document `lang`, driving Intl-based formatting (date/time pickers),
// `:lang()` CSS, and font selection. Applied to the iframe's documentElement,
// so per-story `dir="rtl"` demos still compose (nearest ancestor wins).
const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

// ── Pseudo-states in shadow DOM ─────────────────────────────────────────────
// storybook-addon-pseudo-states forces states by adding `.pseudo-<state>-all`
// classes to the host + rewriting stylesheets — but it CANNOT rewrite Stencil's
// constructable (adoptedStyleSheets) shadow CSS, so the components' state layers
// (`:host(.foo:hover) …`) never trigger. Bridge: append to each shadow root a
// copy of its own CSS with the state pseudo-classes mapped to those exact
// classes, so when the toolbar toggles a state (→ class on the host) the mapped
// rule matches. Real hover/focus keep working (originals are untouched).
const PSEUDO_MAP: [RegExp, string][] = [
  [/:focus-visible\b/g, '.pseudo-focus-visible-all'],
  [/:focus-within\b/g, '.pseudo-focus-within-all'],
  [/:focus\b/g, '.pseudo-focus-all'],
  [/:hover\b/g, '.pseudo-hover-all'],
  [/:active\b/g, '.pseudo-active-all'],
  [/:visited\b/g, '.pseudo-visited-all'],
  [/:target\b/g, '.pseudo-target-all'],
];
const rewritePseudos = (css: string) =>
  PSEUDO_MAP.reduce((out, [re, cls]) => out.replace(re, cls), css);

const pseudoProcessed = new WeakSet<ShadowRoot>();

function bridgeShadowPseudoStates(root: ParentNode): void {
  root.querySelectorAll('*').forEach((el) => {
    const sr = (el as HTMLElement).shadowRoot;
    if (!sr) return;
    if (!pseudoProcessed.has(sr)) {
      pseudoProcessed.add(sr);
      const extra: CSSStyleSheet[] = [];
      for (const ss of sr.adoptedStyleSheets) {
        let css = '';
        try {
          css = Array.from(ss.cssRules)
            .map((r) => r.cssText)
            .join('\n');
        } catch {
          continue; // cross-origin / opaque sheet
        }
        if (!/:hover|:focus|:active|:visited|:target/.test(css)) continue;
        const rewritten = rewritePseudos(css);
        if (rewritten === css) continue;
        try {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(rewritten);
          extra.push(sheet);
        } catch {
          /* a rule that can't be reparsed in isolation — skip it */
        }
      }
      if (extra.length) sr.adoptedStyleSheets = [...sr.adoptedStyleSheets, ...extra];
    }
    bridgeShadowPseudoStates(sr); // nested components (list-item in list, …)
  });
}

// Components whose OUTPUT depends on locale (Intl month/weekday names, date
// formatting, localized aria labels). Everything else renders author-provided
// text, so locale correctly has no visible effect there. Setting document
// `lang` alone can't reach these — Intl(undefined) uses the JS runtime locale,
// not `lang` — so we forward the global locale onto their `locale` prop.
const LOCALE_AWARE =
  'md-date-picker, md-dialog, md-line-chart, md-area-chart, md-bar-chart, md-meter, md-number-field';

const withDirectionLocale: Decorator = (story, context) => {
  const locale = (context.globals.locale as string) || 'en-US';
  const dirGlobal = (context.globals.direction as string) || 'auto';
  const lang = locale.split('-')[0];
  const dir = dirGlobal === 'auto' ? (RTL_LANGS.has(lang) ? 'rtl' : 'ltr') : dirGlobal;
  const el = document.documentElement;
  el.setAttribute('dir', dir);
  el.setAttribute('lang', locale);

  // Drive locale-aware components after the story mounts. A story that pins its
  // own `locale=""` attribute (the Localization demos) keeps it — the toolbar
  // only fills in the ones the author left to the default.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const root = document.getElementById('storybook-root');
      root?.querySelectorAll(LOCALE_AWARE).forEach((node) => {
        const c = node as HTMLElement & { locale?: string; dataset: DOMStringMap };
        if (c.hasAttribute('locale') && c.dataset.sbLocaleDriven !== '1') return; // author-pinned
        c.locale = locale;
        c.dataset.sbLocaleDriven = '1';
      });
    }),
  );

  return story();
};

// ── Density toolbar ─────────────────────────────────────────────────────────
// Sets `data-density` on the preview <html> so EVERY story inherits the global
// density (the tokens cross shadow boundaries, same as `data-theme`). A story
// that pins its own `data-density` on an inner element still wins locally —
// nearest ancestor wins, just like `dir`. Density 0 clears the attribute so the
// default (comfortable) tokens apply.
const withDensity: Decorator = (story, context) => {
  const density = (context.globals.density as string) || '0';
  const el = document.documentElement;
  if (density === '0') el.removeAttribute('data-density');
  else el.setAttribute('data-density', density);
  return story();
};

const preview: Preview = {
  globalTypes: {
    framework: {
      name: 'Framework',
      description: 'Language for the "Show code" snippet (Docs / Canvas source)',
      defaultValue: 'html',
      toolbar: {
        icon: 'code',
        items: [
          { value: 'html', title: 'HTML / Web Component' },
          { value: 'react', title: 'React' },
          { value: 'vue', title: 'Vue' },
          { value: 'angular', title: 'Angular' },
          { value: 'svelte', title: 'Svelte' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    direction: {
      name: 'Direction',
      description: 'Text direction (Auto follows the locale)',
      defaultValue: 'auto',
      toolbar: {
        icon: 'transfer',
        items: [
          { value: 'auto', title: 'Dir: Auto' },
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    locale: {
      name: 'Locale',
      description: 'Document language — drives Intl formatting, :lang(), and Auto direction',
      defaultValue: 'en-US',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en-US', title: 'English (en-US)' },
          { value: 'ar-SA', title: 'العربية (ar-SA)' },
          { value: 'he-IL', title: 'עברית (he-IL)' },
          { value: 'ja-JP', title: '日本語 (ja-JP)' },
          { value: 'de-DE', title: 'Deutsch (de-DE)' },
          { value: 'fr-FR', title: 'Français (fr-FR)' },
          { value: 'zh-CN', title: '中文 (zh-CN)' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    theme: {
      name: 'Theme',
      description: 'Light or dark color scheme',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: ['light', 'dark'],
        showName: true,
        dynamicTitle: true,
      },
    },
    density: {
      name: 'Density',
      description:
        'Global data-density — tightens spacing/heights library-wide (0 = comfortable … -4 = ultra-compact for BI / data grids)',
      defaultValue: '0',
      toolbar: {
        icon: 'menu',
        items: [
          { value: '0', title: 'Density: 0 · Default' },
          { value: '-1', title: '-1 · Cozy' },
          { value: '-2', title: '-2 · Compact' },
          { value: '-3', title: '-3 · Dense' },
          { value: '-4', title: '-4 · Ultra' },
        ],
        showName: true,
        dynamicTitle: true,
      },
    },
    primaryColor: {
      name: 'Primary',
      description: 'Primary seed color (hex, e.g. #6750A4). Edit in the Theme panel.',
      defaultValue: DEFAULT_SEED_COLORS.primary,
    },
    secondaryColor: {
      name: 'Secondary',
      description: 'Secondary seed color (hex). Edit in the Theme panel.',
      defaultValue: DEFAULT_SEED_COLORS.secondary,
    },
    tertiaryColor: {
      name: 'Tertiary',
      description: 'Tertiary seed color (hex). Edit in the Theme panel.',
      defaultValue: DEFAULT_SEED_COLORS.tertiary,
    },
    fontFamily: {
      name: 'Font',
      description: 'Typescale font family. Edit in the Theme panel.',
      defaultValue: DEFAULT_FONT_FAMILY,
    },
  },
  decorators: [withDirectionLocale, withDensity, withDynamicTheme, withEventDetails],
  // Global Stencil-hydration gate for addon-a11y. The addon runs axe in its own
  // afterEach, but Stencil hydrates asynchronously AFTER Storybook's
  // render event — if axe scans the un-hydrated custom-element tags it caches a
  // wrong/partial result that only a page reload clears ("stale a11y panel when
  // switching stories"). afterEach hooks run in REVERSE composition order
  // (story → meta → preview.ts → addons), so this project-level hook is awaited
  // BEFORE the addon's axe hook on every story — no per-story play() needed.
  //
  // Traps encoded here (learned the hard way on md-multi-select):
  // - generous cap (6s), not a short deadline: under load hydration can take
  //   seconds; an expired deadline means axe scans a half-built shadow DOM.
  // - abort-aware: on fast story switching Storybook aborts the abandoned
  //   render; bail so we don't hold the queue and blank the landed story.
  // - setTimeout, never requestAnimationFrame: rAF stalls in a rapidly
  //   swapped/throttled iframe, which would hang this hook forever.
  afterEach: async ({ canvasElement, abortSignal }) => {
    const root = (canvasElement as HTMLElement | undefined) ?? document.getElementById('storybook-root');
    if (!root) return;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const aborted = () => abortSignal?.aborted === true;
    const notHydrated = () =>
      Array.from(root.querySelectorAll('*')).some(
        (el) => el.tagName.includes('-') && !el.classList.contains('hydrated'),
      );
    const deadline = Date.now() + 6000;
    while (notHydrated() && !aborted() && Date.now() < deadline) {
      await sleep(50);
    }
    if (aborted()) return;
    await sleep(250);
    // Now that shadow roots have hydrated, bridge their pseudo-state CSS so the
    // pseudo-states toolbar can force :hover/:focus/etc. on Stencil components.
    try {
      bridgeShadowPseudoStates(root);
    } catch {
      /* non-fatal: pseudo-state forcing is a docs aid, never block the story */
    }
  },
  parameters: {
    // Sidebar order (MD3-aligned category groups). Anything not listed falls
    // after these, alphabetically.
    options: {
      storySort: {
        order: [
          'Foundations',
          'Actions',
          'Text Inputs',
          'Selection',
          'Navigation',
          'Containment',
          'Communication',
          'Data Display',
          'Charts',
        ],
      },
    },
    actions: { handles: CORE_EVENTS },
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Match the enforced WCAG-AA gate (test-runner.ts checkA11y runs the same
    // tags). Stories are isolated component demos, not full pages, so axe's
    // best-practice landmark/region rules (region, landmark-unique,
    // landmark-no-duplicate-banner…) are expected noise here — restricting the
    // addon to the WCAG tags excludes them, so a passing gate no longer *looks*
    // red in the a11y panel/console.
    a11y: {
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      },
    },
    layout: 'centered',
    docs: {
      theme: awcUiTheme, // brand the autodocs pages to match the manager
      source: {
        // 'dynamic' feeds the transform the story's *rendered* HTML (clean
        // markup), not the authored lit render fn. The transform is fully
        // defensive: it runs for every story on an autodocs page, so any
        // throw would blank the entire Docs tab — hence the try/catch + a
        // bulletproof toFramework that falls back to the original code.
        type: 'dynamic',
        language: 'html',
        transform: (code: string, ctx: { globals?: Record<string, unknown> }) => {
          try {
            const fw = (ctx?.globals?.framework as Framework) ?? 'html';
            return toFramework(code, fw);
          } catch {
            return code;
          }
        },
      },
    },
  },
};

export default preview;
