#!/usr/bin/env node
/**
 * build-package-docs.mjs
 *
 * Prepares the one generated file that ships inside @awc-ui/core:
 *
 *   packages/core/main-llm.md   the build director an assistant reads FIRST
 *
 * The per-component manuals are NOT copied. package.json `files[]` publishes
 * `src/components/*​/readme.md` directly, so the tarball carries the exact file
 * the repo has and there is no second rendering to drift out of sync.
 *
 * main-llm.md itself lives at the repo root, because it documents the library
 * rather than one package. Its links are repo-relative there — `../md-foo` for a
 * sibling component — and would point at nothing once published, so they are
 * rewritten here for the installed layout.
 *
 * Run:   node scripts/build-package-docs.mjs
 */

import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENTS = join(ROOT, 'packages/core/src/components');
const PKG = join(ROOT, 'packages/core');
const DIRECTOR = join(ROOT, 'main-llm.md');

/**
 * Rewrite main-llm.md's relative links for the published layout.
 *
 * In the repo, main-llm.md sits at the root and points at a component as
 * `packages/core/src/components/<tag>/readme.md`. Installed, main-llm.md is at the
 * package root and that same manual is `src/components/<tag>/readme.md`.
 */
function rewriteLinks(md) {
  return md
    // Installed, the readmes sit next to main-llm.md — no path through the
    // monorepo ever resolves, so rewrite every form (links, backticks, prose).
    .replace(/(?:\.\/)?packages\/core\/src\/components\//g, 'src/components/')
    .replace(/\]\((?:\.\.\/)+llms\.txt\)/g, '](main-llm.md)');
}

/* ---------------------------------------------------------------- */
/*  Verify the manuals that files[] publishes directly               */
/* ---------------------------------------------------------------- */

const { default: pkgJson } = await import(join(PKG, 'package.json'), {
  with: { type: 'json' },
});
const missing = [];
const { readdir } = await import('node:fs/promises');
const dirs = (await readdir(COMPONENTS, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
for (const tag of dirs) {
  if (!existsSync(join(COMPONENTS, tag, 'readme.md'))) missing.push(tag);
}
if (missing.length) {
  console.error(
    `[build-package-docs] ${missing.length} component(s) have no readme.md and would ` +
      `publish without a manual:\n  ${missing.join('\n  ')}`,
  );
  process.exitCode = 1;
}

/* ---------------------------------------------------------------- */
/*  main-llm.md                                                        */
/* ---------------------------------------------------------------- */

if (!existsSync(DIRECTOR)) {
  console.error(`[build-package-docs] main-llm.md not found at ${DIRECTOR}`);
  process.exit(1);
}
await writeFile(join(PKG, 'main-llm.md'), rewriteLinks(await readFile(DIRECTOR, 'utf8')));

// Older revisions of this script copied every manual into packages/core/docs/
// and emitted llms.txt / AGENTS.md there. files[] does not publish any of it,
// so leaving it behind is 81 duplicate files that only go stale.
for (const stale of ['docs', 'llms.txt', 'AGENTS.md']) {
  await rm(join(PKG, stale), { recursive: true, force: true });
}

console.log(`✓ ${dirs.length - missing.length} component readmes verified (published from src/components/)`);
console.log(`✓ main-llm.md -> ${join(PKG, 'main-llm.md')}`);
console.log(`  (@awc-ui/core v${pkgJson.version})`);
