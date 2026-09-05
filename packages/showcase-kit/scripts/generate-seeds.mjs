/**
 * Bakes the dock's accent presets.
 *
 * Runs `@awc-ui/theme`'s own `computeTheme` + `generateCss` at authoring time and
 * writes the resulting CSS into `src/dock/seeds.generated.ts`. Doing it here
 * rather than at runtime keeps the dock free of `@material/material-color-utilities`
 * (~50 kB) and guarantees every framework build gets byte-identical palettes.
 *
 * Run: pnpm --filter @awc-ui/showcase-kit generate:seeds
 * (requires `pnpm --filter @awc-ui/theme build` to have run first)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'dock', 'seeds.generated.ts');
const THEME = pathToFileURL(resolve(here, '..', '..', 'theme', 'dist', 'index.mjs')).href;

const { computeTheme, generateCss } = await import(THEME);

/**
 * id → seed hex.
 *
 * `default` EMITS NO CSS, and what it means changed when each vertical got an
 * accent of its own: it used to be the library's violet, and it is now "this
 * app as shipped" — removing the dock's adopted sheet falls back to whatever
 * the vertical's `app.css` baked in. Its swatch is painted per app from
 * `brands.generated.ts` rather than from the seed here, which is only the
 * fallback for a page outside the six.
 *
 * THE OTHER THREE ARE ALTERNATES, and they were chosen again once the six
 * brands existed. The old set — a muted blue, a muted green and a bronze — sat
 * close enough to several brands that switching accent barely showed, which is
 * the one thing an accent picker has to do. These are brighter, and spread far
 * enough apart (about 215, 175 and 20 degrees) that any of them reads as a
 * clear change against any of the six.
 */
const PRESETS = [
  { id: 'default', seed: '#6750A4', labelKey: 'dock.accent.default' },
  { id: 'azure', seed: '#1A56DB', labelKey: 'dock.accent.azure' },
  { id: 'evergreen', seed: '#00796B', labelKey: 'dock.accent.evergreen' },
  { id: 'bronze', seed: '#C2410C', labelKey: 'dock.accent.bronze' },
];

/** Squeeze the generated sheet: no comments, no runs of whitespace. */
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

const entries = PRESETS.map((p) => {
  if (p.id === 'default') {
    return { ...p, css: '' };
  }
  const theme = computeTheme({ primaryHex: p.seed });
  return { ...p, css: minifyCss(generateCss(theme)) };
});

const file = `/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by \`scripts/generate-seeds.mjs\` from \`@awc-ui/theme\`'s computeTheme.
 * Each preset is a complete pair of :root / [data-theme="dark"] --md-sys-color-*
 * overrides. The \`default\` preset carries no CSS: it is the token sheet as shipped.
 */

export interface SeedPreset {
  /** Stable id — the value written to the \`seed\` URL param and localStorage. */
  id: string;
  /** Seed colour, for the dock's swatch. */
  seed: string;
  /** i18n key for the preset's name. */
  labelKey: string;
  /** Complete override sheet, or '' for the default palette. */
  css: string;
}

export const SEED_PRESETS: readonly SeedPreset[] = ${JSON.stringify(entries, null, 2)};

export const DEFAULT_SEED_PRESET = 'default';
`;

writeFileSync(OUT, file, 'utf8');
console.log(`wrote ${OUT}`);
for (const e of entries) {
  console.log(`  ${e.id.padEnd(10)} ${e.seed}  css=${e.css.length}B`);
}
