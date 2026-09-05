/**
 * Bakes each vertical's own accent into its `app.css`.
 *
 * WHY EACH APP HAS A COLOUR AT ALL. Six applications shipped from one component
 * library will look like one application if they all open in the library's
 * violet — which is exactly the wrong lesson for a showcase whose whole claim is
 * that the components adapt. A credit workbench and a photo app should not be
 * the same colour, and the difference should be visible before a reader has
 * pressed anything.
 *
 * WHY IT IS BAKED INTO `app.css` AND NOT APPLIED AT RUNTIME. The dock's accent
 * presets are injected as an adopted stylesheet when the dock's chunk arrives,
 * which is right for a preference the reader chose and wrong for the app's own
 * identity: the page would paint violet and then flip. `app.css` ships with the
 * document and loads after `tokens.css`, so the brand is there in the first
 * paint and costs no runtime at all.
 *
 * THE DOCK STILL WINS. `document.adoptedStyleSheets` cascade after the
 * document's own stylesheets, so picking Azure still overrides this, and
 * picking Default removes the adopted sheet and falls back to it. What the
 * dock's first swatch means changes from "the library's violet" to "this app as
 * shipped", which is the more useful thing for it to mean.
 *
 * Run: pnpm --filter @awc-ui/showcase-kit generate:brands
 * (requires `pnpm --filter @awc-ui/theme build` to have run first)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const THEME = pathToFileURL(resolve(here, '..', '..', 'theme', 'dist', 'index.mjs')).href;
const { computeTheme, generateCss } = await import(THEME);

/**
 * One seed per vertical, spread around the hue wheel so no two apps read as the
 * same product, and each chosen for what the app actually is.
 *
 * The hues are deliberately far apart — roughly 220, 195, 150, 35, 330 and 280
 * degrees — because the point is that six apps look like six apps. Every one is
 * a SEED, not a palette: `computeTheme` derives the full tonal set from it, so
 * contrast pairings, container colours and the dark scheme are all the theme
 * package's work rather than a hand-picked guess.
 */
const BRANDS = [
  {
    id: 'credit-risk',
    seed: '#2F4E86',
    why: 'Institutional navy. A wholesale credit workbench is the most sober thing in the set, and it is the colour that reads as a bank rather than as a product.',
  },
  {
    id: 'wealth',
    seed: '#1B6B45',
    why: 'Forest green. Private-client wealth management, where the convention is growth and discretion rather than energy.',
  },
  {
    id: 'banking',
    seed: '#00677D',
    why: 'Cyan-teal. A consumer banking and investing app — the same industry as credit-risk and deliberately not the same colour, because the reader is a person rather than a desk.',
  },
  {
    id: 'social',
    seed: '#B3216B',
    why: 'Rose-magenta. Lyra is pictures and people; the one app in the set whose content is expressive, and the only one warm enough to carry it.',
  },
  {
    id: 'community',
    seed: '#9A5B18',
    why: 'Amber. Corvus is conversation — groups, events, replies — and amber is the warm end of the wheel without competing with Lyra\'s rose.',
  },
  {
    id: 'music',
    seed: '#7A3FB5',
    why: 'Violet. Cygnus is a studio, and violet is where audio software has lived for years — pushed more saturated than the library default so it reads as a choice rather than as an app nobody themed.',
  },
];

const BEGIN = '/* === GENERATED: brand accent — do not edit by hand === */';
const END = '/* === END GENERATED brand accent === */';

function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * The brand seeds are ALSO written to a small module the dock imports, so its
 * first swatch can paint the app it is sitting in. The stylesheet and the
 * swatch therefore come from one table and cannot drift — a swatch showing
 * violet on an amber app is a picker lying about what "Default" does.
 */
const MAP = join(here, '..', 'src', 'dock', 'brands.generated.ts');
writeFileSync(
  MAP,
  `/* eslint-disable */
/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by \`scripts/generate-brands.mjs\` beside the per-vertical accent it
 * bakes into each \`app.css\`. The dock reads this to paint its first swatch the
 * colour of the application it is in, so the picker's "Default" shows what that
 * app actually shipped rather than the library's own violet.
 */

/** Vertical id → the seed its \`app.css\` was generated from. */
export const BRAND_SEEDS: Readonly<Record<string, string>> = {
${BRANDS.map((b) => `  '${b.id}': '${b.seed}',`).join('\n')}
};

/** The library's own violet, for a page that is not one of the six. */
export const LIBRARY_SEED = '#6750A4';
`,
);

let written = 0;
for (const brand of BRANDS) {
  const path = join(here, '..', 'src', brand.id, 'app.css');
  const css = minify(generateCss(computeTheme({ primaryHex: brand.seed })));

  const block = [
    BEGIN,
    '/*',
    ` * ${brand.why}`,
    ' *',
    ` * Seed ${brand.seed}, expanded by \`@awc-ui/theme\`'s computeTheme into the full`,
    ' * tonal set. Regenerate with `pnpm --filter @awc-ui/showcase-kit generate:brands`;',
    ' * editing the declarations below by hand breaks the contrast pairings the',
    ' * theme package guarantees.',
    ' */',
    css,
    END,
  ].join('\n');

  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(BEGIN);
  const finish = source.indexOf(END);

  let next;
  if (start !== -1 && finish !== -1) {
    next = source.slice(0, start) + block + source.slice(finish + END.length);
  } else {
    /*
     * FIRST, so every rule in the file can still override a token — and after
     * nothing, because `tokens.css` is a separate sheet loaded before this one.
     */
    next = `${block}\n\n${source}`;
  }

  if (next !== source) {
    writeFileSync(path, next);
    written += 1;
  }
  console.log(`  ${brand.id.padEnd(12)} ${brand.seed}  ${Math.round(css.length / 1024)} kB`);
}

console.log(`[generate:brands] ${written} of ${BRANDS.length} stylesheets updated`);
