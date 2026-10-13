import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(app, '../..');
const output = path.join(app, 'coverage-stories');
const require = createRequire(path.join(app, 'package.json'));
const { CoverageReport } = require('monocart-coverage-reports');
const { completeSourceCoverage } = require(path.join(root, 'apps/native-playground/scripts/coverage/complete-source-coverage.cjs'));
const source = path.resolve(process.env.AWC_STORY_LIBRARY_RUNTIME || path.join(root, 'packages/core/coverage-e2e/scopes/all/www/build'));
if (!process.env.AWC_STORY_LIBRARY_RUNTIME) {
  const build = JSON.parse(await fs.readFile(path.join(root, 'packages/core/coverage-e2e/scopes/all/run.json'), 'utf8'));
  if (build.buildCompleted !== true || build.buildExit !== 0) throw new Error('The isolated all-component build has not completed successfully. Wait for the Laboratory browser collector build.');
}
await fs.access(path.join(source, 'md3.esm.js')).catch(() => { throw new Error('Run node apps/native-playground/scripts/coverage/run-browser.mjs --all first, or set AWC_STORY_LIBRARY_RUNTIME to an isolated source-mapped core build.'); });
// A stale map must never silently remove a component from the report. Verify
// the snapshot before replacing earlier results, using the same exact-content
// rule as the remapper. The runtime copy then stays stable during the run.
const mappedComponents = new Set(), staleSources = new Set();
for (const filename of await fs.readdir(source)) {
  if (!filename.endsWith('.js.map')) continue;
  const map = JSON.parse(await fs.readFile(path.join(source, filename), 'utf8'));
  for (const [index, name] of (map.sources || []).entries()) {
    const match = /(?:^|\/)src\/(components\/(md-[a-z0-9-]+)\/[^?]+\.tsx?)$/.exec(name.replaceAll('\\', '/'));
    if (!match || match[1].split('/').includes('..')) continue;
    const current = await fs.readFile(path.join(root, 'packages/core/src', match[1]), 'utf8').catch(() => null);
    if (current !== map.sourcesContent?.[index]) staleSources.add(match[1]);
    else mappedComponents.add(match[2]);
  }
}
if (!mappedComponents.size || staleSources.size) throw new Error(`The isolated runtime is stale or lacks matching source maps. Rebuild it before collecting stories. Mismatches: ${[...staleSources].join(', ') || 'no component source maps'}`);
console.log(`Verified source maps for ${mappedComponents.size} components in ${path.relative(root, source)}.`);
await fs.mkdir(output, { recursive: true });
for (const name of ['results.json', 'lcov.info', 'run.json']) await fs.rm(path.join(output, name), { force: true });
for (const name of ['runtime', 'raw', 'report']) await fs.rm(path.join(output, name), { recursive: true, force: true });
await fs.cp(source, path.join(output, 'runtime'), { recursive: true });
const startedAt = new Date().toISOString();
const args = ['run', '--config', 'vitest.laboratory.config.mts', ...process.argv.slice(2)];
const exitCode = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ...args], { cwd: app, stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` } });
  child.once('error', reject);
  child.once('exit', code => resolve(code ?? 1));
});
let coverageError = null;
try {
  const raw = await fs.readdir(path.join(output, 'raw')).catch(() => []);
  const captures = [];
  for (const name of raw) captures.push(JSON.parse(await fs.readFile(path.join(output, 'raw', name), 'utf8')));
  const report = new CoverageReport({ name: 'AWC UI existing Storybook tests', outputDir: path.join(output, 'report'), reports: ['lcovonly', 'console-summary'], logging: 'error',
    ...completeSourceCoverage({ repository: root, runtime: path.join(output, 'runtime'), tags: [...mappedComponents], observedEntries: captures.flat() }),
  });
  for (const capture of captures) await report.add(capture);
  if (raw.length) {
    await report.generate();
    await fs.copyFile(path.join(output, 'report/lcov.info'), path.join(output, 'lcov.info'));
  } else coverageError = 'No browser coverage was captured.';
} catch (error) { coverageError = error.message; }
await fs.writeFile(path.join(output, 'run.json'), JSON.stringify({ startedAt, completedAt: new Date().toISOString(), exitCode, coverageError,
  runtimeSource: path.relative(root, source).split(path.sep).join('/'), filters: process.argv.slice(2), mappedComponents: [...mappedComponents].sort(),
  command: 'node apps/storybook/scripts/laboratory-coverage.mjs', scope: 'Existing Storybook story tests and play assertions; configured accessibility audits retain their original rules.' }, null, 2));
if (coverageError) console.error(coverageError);
process.exitCode = exitCode || (coverageError ? 1 : 0);
