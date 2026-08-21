#!/usr/bin/env node
/**
 * fix-module-types — silence Node's MODULE_TYPELESS_PACKAGE_JSON warning.
 *
 * Stencil's `dist` output emits ESM as `.js` files (dist/esm, dist/components)
 * and CJS as `.cjs.js` files (dist/cjs) inside a package whose package.json has
 * no top-level "type". Node then has to sniff module syntax on every load and
 * prints:
 *
 *   [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of .../dist/esm/loader.js
 *   is not specified and it doesn't parse as CommonJS. Reparsing as ES module ...
 *
 * We cannot set "type": "module" on @awc-ui/core itself (dist/cjs/*.cjs.js
 * ends in `.js`, so it would be re-interpreted as ESM and break `require()`).
 * Instead we stamp a one-line package.json into each generated format-pure
 * directory so the format is explicit and Node never guesses.
 *
 * dist/ is regenerated on every `stencil build`, so this script is chained into
 * the @awc-ui/core "build" script (`stencil build && node .../fix-module-types.mjs`)
 * — regeneration keeps the stamps stable. dist/loader is intentionally NOT
 * stamped: it mixes ESM (.js) and CJS (.cjs.js) in one directory and is not
 * reachable through the "exports" map (the hand-written /loader shims with
 * explicit .mjs/.cjs extensions are used instead).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const coreDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'core');

/** @type {Array<[string, 'module' | 'commonjs']>} */
const stamps = [
  ['dist/esm', 'module'],
  ['dist/components', 'module'],
  ['dist/components-csr', 'module'],
  ['dist/cjs', 'commonjs'],
];

let failed = false;
for (const [dir, type] of stamps) {
  const abs = join(coreDir, dir);
  if (!existsSync(abs)) {
    console.warn(`[fix-module-types] SKIP ${dir} (directory missing — build incomplete?)`);
    failed = true;
    continue;
  }
  writeFileSync(join(abs, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
  console.log(`[fix-module-types] packages/core/${dir}/package.json -> { "type": "${type}" }`);
}

process.exitCode = failed ? 1 : 0;
