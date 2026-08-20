/**
 * SSR coverage — instruments the server-render path.
 *
 * SSR logic only executes with no DOM present: the guards that make components
 * server-safe (`typeof window === 'undefined'`, deferred observer setup,
 * hydrate-only branches) are unreachable from a story or an e2e test by
 * definition, because both run in a browser.
 *
 * Node writes V8 coverage to NODE_V8_COVERAGE; monocart ingests that directory
 * and remaps it onto the .tsx sources via the hydrate build's source maps, so
 * this merges with the browser suites instead of being a separate number.
 *
 * Run:  node scripts/ssr-coverage.mjs   (after a source-mapped build)
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { CoverageReport } = require_('monocart-coverage-reports');

const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(here, '..');
const rawDir = join(coreRoot, '.v8-coverage-ssr');
const outDir = join(coreRoot, 'coverage-ssr');

rmSync(rawDir, { recursive: true, force: true });

// Run the existing SSR smoke gate with V8 coverage recording. Reusing it rather
// than writing a parallel harness means SSR coverage tracks whatever that gate
// actually renders — every md-* component — and cannot drift away from it.
const res = spawnSync(process.execPath, [join(here, 'ssr-smoke.mjs')], {
  cwd: coreRoot,
  env: { ...process.env, NODE_V8_COVERAGE: rawDir },
  stdio: 'inherit',
});

if (!existsSync(rawDir)) {
  console.error('ssr-coverage: Node wrote no coverage data — did the smoke run start?');
  process.exit(1);
}

const report = new CoverageReport({
  name: 'AWC UI — SSR coverage',
  outputDir: outDir,
  sourcePath: (p) => p.replace(/^.*?packages\/core\//, ''),
  sourceFilter: (p) =>
    /(^|\/)src\/(components|utils|global)\//.test(p) &&
    /\.[tj]sx?(\?|$)/.test(p) &&
    !/\.(spec|e2e)\.[tj]sx?\b/.test(p),
  reports: ['v8', 'console-summary', 'lcovonly'],
  logging: 'error',
});

await report.addFromDir(rawDir);
await report.generate();

if (res.status !== 0) {
  console.warn(`ssr-coverage: the smoke gate exited ${res.status} — coverage was still collected.`);
}
