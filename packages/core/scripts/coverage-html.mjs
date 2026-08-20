/**
 * Emit the standard Istanbul HTML report from an existing
 * coverage-spec/coverage-final.json — no need to re-run the 4-minute suite just
 * to get a browsable report.
 *
 * The jest config writes json + lcovonly + text-summary (lcov feeds the merge
 * tooling); this turns that same data into the drill-down report. The reporter
 * packages come from jest's own dependency tree and are resolved out of the
 * pnpm store, since pnpm does not hoist them anywhere resolvable.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const require = createRequire(resolve(repoRoot, 'package.json'));
const ROOT = resolve(repoRoot, 'node_modules/.pnpm');
const libCoverage = require(`${ROOT}/istanbul-lib-coverage@3.2.2/node_modules/istanbul-lib-coverage`);
const libReport   = require(`${ROOT}/istanbul-lib-report@3.0.1/node_modules/istanbul-lib-report`);
const reports     = require(`${ROOT}/istanbul-reports@3.2.0/node_modules/istanbul-reports`);
const { readFileSync } = await import('fs');

const json = JSON.parse(readFileSync('coverage-spec/coverage-final.json', 'utf8'));
const map = libCoverage.createCoverageMap(json);
const context = libReport.createContext({
  dir: 'coverage-spec/html',
  coverageMap: map,
  defaultSummarizer: 'nested',
});
reports.create('html', { skipEmpty: false }).execute(context);
reports.create('text-summary').execute(context);
console.log('\nwrote coverage-spec/html/index.html');
