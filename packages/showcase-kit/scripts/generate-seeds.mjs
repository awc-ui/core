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

/** id → seed hex. `default` is the library's own violet and emits no CSS. */
const PRESETS = [
  { id: 'default', seed: '#6750A4', labelKey: 'dock.accent.default' },
  { id: 'azure', seed: '#00629E', labelKey: 'dock.accent.azure' },
  { id: 'evergreen', seed: '#216E39', labelKey: 'dock.accent.evergreen' },
  { id: 'bronze', seed: '#8B5000', labelKey: 'dock.accent.bronze' },
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
