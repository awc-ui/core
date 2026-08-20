// AWC UI — Storybook manager theme (Material Design 3).
// The chrome is dressed in MD3 baseline tokens so the workbench matches the
// components it documents. The brand logo is inlined as an SVG data URI (built at
// runtime) so it needs no asset-loader in the manager build.
import { create } from 'storybook/theming';

// MD3 baseline reference palette (light scheme).
const md = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  surface: '#FEF7FF',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  onSurface: '#1D1B20',
  onSurfaceVariant: '#49454F',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
};

// Brand gradient, sampled from the supplied artwork: it runs between two MD3
// dark-scheme roles — primary (#D0BCFF) at the top-left corner to tertiary
// (#EFB8C8) at the bottom-right — so the tile stays inside the design system
// rather than introducing a colour the tokens don't know about.
const brand = {
  gradientStart: '#D0BCFF', // md.sys.color.primary (dark)
  gradientEnd: '#EFB8C8', // md.sys.color.tertiary (dark)
  mark: '#1D1B20', // md.sys.color.on-surface (light) — the compass
  wordmarkOnDark: '#D0BCFF',
  wordmarkOnLight: md.primary,
};

// Horizontal wordmark: gradient tile + drafting compass, then "AWC UI".
//
// The wordmark colour is media-queried rather than fixed. The supplied artwork
// sets it in dark-scheme primary (#D0BCFF), which lands at roughly 1.5:1 against
// this manager's light chrome (#F3EDF7) — legible only on the dark background it
// was drawn against. The light-scheme primary carries the same hue at a contrast
// that survives. A data-URI SVG resolves prefers-color-scheme against the
// browser/OS setting, not Storybook's own toggle, so this tracks the environment
// the chrome itself follows.
//
// The tile keeps its gradient in both schemes: a pastel fill reads on white and
// on near-black alike, and it is what makes the mark recognisable.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="118" height="28" viewBox="0 0 118 28" fill="none" role="img" aria-label="AWC UI">
  <defs>
    <linearGradient id="awc-tile" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${brand.gradientStart}"/>
      <stop offset="1" stop-color="${brand.gradientEnd}"/>
    </linearGradient>
    <style>
      .awc-wordmark { fill: ${brand.wordmarkOnLight}; }
      @media (prefers-color-scheme: dark) {
        .awc-wordmark { fill: ${brand.wordmarkOnDark}; }
      }
    </style>
  </defs>
  <rect width="28" height="28" rx="8" fill="url(#awc-tile)"/>
  <g stroke="${brand.mark}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <circle cx="14" cy="8.1" r="2.2"/>
    <path d="M14 5.9V4.4"/>
    <path d="M12.7 10.1 9.1 20.4"/>
    <path d="M15.3 10.1 18.9 20.4"/>
    <path d="M11.9 15.2h4.2"/>
  </g>
  <text class="awc-wordmark" x="38" y="19.6" font-family="Roboto, 'Segoe UI', system-ui, sans-serif" font-size="17" font-weight="700" letter-spacing="-0.2">AWC UI</text>
</svg>`;

export const awcUiTheme = create({
  base: 'light',

  brandTitle: 'AWC UI',
  brandUrl: 'https://github.com/awc-ui/core',
  brandImage: `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`,
  brandTarget: '_self',

  // Brand
  colorPrimary: md.primary,
  colorSecondary: md.primary, // selected nav item / interactive accent

  // App surfaces
  appBg: md.surfaceContainer,
  appContentBg: md.surface,
  appPreviewBg: '#FFFFFF',
  appBorderColor: md.outlineVariant,
  appBorderRadius: 12, // MD3 medium corner

  // Text
  textColor: md.onSurface,
  textInverseColor: md.onPrimary,
  textMutedColor: md.onSurfaceVariant,

  // Toolbar
  barTextColor: md.onSurfaceVariant,
  barSelectedColor: md.primary,
  barHoverColor: md.primary,
  barBg: md.surface,

  // Inputs
  inputBg: '#FFFFFF',
  inputBorder: md.outline,
  inputTextColor: md.onSurface,
  inputBorderRadius: 8,

  fontBase: '"Roboto", "Segoe UI", system-ui, -apple-system, sans-serif',
  fontCode: 'ui-monospace, "Roboto Mono", "SF Mono", Menlo, monospace',
});
