/**
 * Emits `dist/preboot.js` from the single source of truth in
 * `src/preboot/index.ts`, and enforces the size budget.
 *
 * The file exists so a static host (Astro, plain HTML) can copy it, or reference
 * it as `@awc-ui/showcase-kit/preboot.js` from a build step. Inlining the string
 * is still the recommended path — an external <head> script reintroduces a
 * render-blocking round trip.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
const { PREBOOT_SCRIPT } = await import(pathToFileURL(join(dist, 'preboot', 'index.mjs')).href);

const BUDGET = 1024;
const bytes = Buffer.byteLength(PREBOOT_SCRIPT, 'utf8');
if (bytes > BUDGET) {
  console.error(`preboot script is ${bytes}B, over the ${BUDGET}B budget`);
  process.exit(1);
}

writeFileSync(join(dist, 'preboot.js'), `${PREBOOT_SCRIPT}\n`, 'utf8');
console.log(`preboot ${bytes}B / ${BUDGET}B → dist/preboot.js`);
