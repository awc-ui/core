import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { beginTestRun, finishTestRun, verifyIsolatedBuild } from '../../native-playground/test-run-evidence.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
async function runVitest({ app, args }) {
  const require = createRequire(path.join(app, 'package.json'));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), ...args], { cwd: app, stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` } });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}
async function generateStoryReport({ root, output, mappedComponents }) {
  const require = createRequire(path.join(root, 'apps/storybook/package.json'));
  const { CoverageReport } = require('monocart-coverage-reports');
  const { completeSourceCoverage } = require(path.join(root, 'apps/native-playground/scripts/coverage/complete-source-coverage.cjs'));
  const raw = await fs.readdir(path.join(output, 'raw')).catch(() => []);
  if (!raw.length) throw new Error('No browser coverage was captured.');
  const captures = [];
  for (const name of raw) captures.push(JSON.parse(await fs.readFile(path.join(output, 'raw', name), 'utf8')));
  const report = new CoverageReport({ name: 'AWC UI existing Storybook tests', outputDir: path.join(output, 'report'), reports: ['lcovonly', 'console-summary'], logging: 'error',
    ...completeSourceCoverage({ repository: root, runtime: path.join(output, 'runtime'), tags: [...mappedComponents], observedEntries: captures.flat() }),
  });
  for (const capture of captures) await report.add(capture);
  await report.generate();
  await fs.copyFile(path.join(output, 'report/lcov.info'), path.join(output, 'lcov.info'));
}
async function storyFiles(root) {
  const directory = path.join(root, 'apps/storybook/src/stories');
  async function visit(parent) {
    const entries = await fs.readdir(parent, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? visit(path.join(parent, entry.name))
      : entry.isFile() && /\.stories\.[cm]?[jt]sx?$/.test(entry.name) ? [path.relative(root, path.join(parent, entry.name)).split(path.sep).join('/')] : []))).flat();
  }
  return (await visit(directory)).sort();
}

export async function collectStoryCoverage({ root = repository, args = [], runtimeSource = process.env.AWC_STORY_LIBRARY_RUNTIME, run = runVitest, generateReport = generateStoryReport } = {}) {
  const app = path.join(root, 'apps/storybook');
  const output = path.join(app, 'coverage-stories');
  const source = path.resolve(runtimeSource || path.join(root, 'packages/core/coverage-e2e/scopes/all/www/build'));
  const runtimeDirectory = path.relative(root, source).split(path.sep).join('/');
  await verifyIsolatedBuild({ root, runtimeDirectory });
  if (!runtimeSource) {
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
  for (const name of ['results.json', 'test-results.json', 'lcov.info', 'coverage-final.json', 'coverage-summary.json', 'run.json', 'run-evidence.json']) await fs.rm(path.join(output, name), { force: true });
  for (const name of ['runtime', 'raw', 'report']) await fs.rm(path.join(output, name), { recursive: true, force: true });
  await fs.cp(source, path.join(output, 'runtime'), { recursive: true });
  const copyDirectory = 'apps/storybook/coverage-stories/runtime';
  let build = await verifyIsolatedBuild({ root, runtimeDirectory, copyDirectory });
  const command = ['node apps/storybook/scripts/laboratory-coverage.mjs', ...args.map(argument => JSON.stringify(argument))].join(' ');
  const handle = await beginTestRun({ root, directory: 'apps/storybook/coverage-stories', category: 'component', framework: 'vitest',
    label: 'Existing Storybook story tests', command, tags: [...mappedComponents].sort(), testFiles: await storyFiles(root) });
  const startedAt = new Date().toISOString();
  let exitCode = 1, coverageError = null;
  const errors = [];
  try {
    exitCode = await run({ app, args: ['run', '--config', 'vitest.laboratory.config.mts', ...args] });
    try { await generateReport({ root, output, mappedComponents }); }
    catch (error) { coverageError = error.message; errors.push(coverageError); console.error(coverageError); }
  } catch (error) { errors.push(error.message); console.error(error.message); }
  finally {
    try { await verifyIsolatedBuild({ root, runtimeDirectory, copyDirectory }); }
    catch (error) { errors.push(error.message); build = { ...build, verified: false, error: error.message }; }
    await fs.writeFile(path.join(output, 'run.json'), JSON.stringify({ startedAt, completedAt: new Date().toISOString(), exitCode, coverageError, errors,
      runtimeSource: path.relative(root, source).split(path.sep).join('/'), filters: args, mappedComponents: [...mappedComponents].sort(),
      command, scope: 'Existing Storybook story tests and play assertions; configured accessibility audits retain their original rules.' }, null, 2));
    await finishTestRun(handle, { exitCode, errors, build });
  }
  return exitCode || (errors.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await collectStoryCoverage({ args: process.argv.slice(2) });
}
