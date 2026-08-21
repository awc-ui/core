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
  <!-- Google Material Symbols Outlined — "architecture" (drafting compass),
       the same glyph and geometry as the canonical mark in
       apps/docs/public/favicon.svg. Native viewBox is 0 -960 960 960; the
       glyph fills 2/3 of the tile like the docs mark (24/36), so for the
       28px tile: scale 18.667/960 = 0.019444, padding (28 - 18.667)/2. -->
  <g transform="translate(4.667 23.333) scale(0.019444)" fill="${brand.mark}">
    <path d="m270-120-10-88 114-314q15 14 32.5 23.5T444-484L334-182l-64 62Zm420 0-64-62-110-302q20-5 37.5-14.5T586-522l114 314-10 88ZM480-520q-50 0-85-35t-35-85q0-39 22.5-69.5T440-752v-88h80v88q35 12 57.5 42.5T600-640q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Z"/>
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
