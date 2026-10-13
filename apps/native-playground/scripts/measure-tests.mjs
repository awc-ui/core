import path from 'node:path';
import { readFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { beginTestRun, finishTestRun } from '../test-run-evidence.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
async function runProcess(label, args, cwd) {
  console.log(`\n${label}`);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`, STORYBOOK_DISABLE_TELEMETRY: '1' } });
    child.once('error', error => { console.error(error.message); resolve(1); });
    child.once('exit', code => resolve(code ?? 1));
  });
  return code;
}

async function unitTestFiles(root) {
  const directory = path.join(root, 'packages/core');
  async function visit(parent) {
    const entries = await readdir(parent, { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    return (await Promise.all(entries.filter(entry => !['node_modules', '.git', 'coverage-spec', 'coverage-e2e', 'dist', 'www', 'loader'].includes(entry.name)).map(entry => entry.isDirectory()
      ? visit(path.join(parent, entry.name)) : entry.isFile() && /\.spec\.tsx?$/.test(entry.name) ? [path.relative(root, path.join(parent, entry.name)).split(path.sep).join('/')] : []))).flat();
  }
  return (await visit(directory)).sort();
}

export async function measureUnitTests({ root = repository, run = runProcess, jestPath } = {}) {
  const core = path.join(root, 'packages/core');
  const label = 'Unit tests and instrumented coverage';
  // Remove stale outputs before starting, so infrastructure errors cannot display
  // an earlier unit run as if it belonged to this collection.
  for (const file of ['test-results.json', 'results.json', 'lcov.info', 'coverage-final.json', 'coverage-summary.json', 'run-evidence.json']) {
    await rm(path.join(core, 'coverage-spec', file), { force: true });
  }
  const handle = await beginTestRun({ root, directory: 'packages/core/coverage-spec', category: 'unit', framework: 'jest', label,
    command: 'node apps/native-playground/scripts/measure-tests.mjs --unit', testFiles: await unitTestFiles(root) });
  let exitCode = 1; const errors = [];
  try {
    exitCode = await run(label, [jestPath || createRequire(path.join(core, 'package.json')).resolve('jest/bin/jest'), '--config', 'jest.coverage.config.cjs', '--json', '--outputFile=coverage-spec/test-results.json'], core);
  } catch (error) { errors.push(error.message); console.error(error.message); }
  finally { await finishTestRun(handle, { exitCode, errors }); }
  return { label, exitCode };
}

export async function measureTests({ root = repository, run = runProcess, now = Date.now, jestPath, unitOnly = false } = {}) {
  const core = path.join(root, 'packages/core');
  const outcomes = [await measureUnitTests({ root, run, jestPath })];
  if (unitOnly) return outcomes;
  const collect = async (label, args, cwd = root) => {
    const exitCode = await run(label, args, cwd);
    outcomes.push({ label, exitCode });
  };
  const browserStarted = now();
  await collect('Existing browser suites across the complete catalog', ['apps/native-playground/scripts/coverage/run-browser.mjs', '--all']);
  const manifest = await readFile(path.join(core, 'coverage-e2e/scopes/all/run.json'), 'utf8').then(JSON.parse).catch(() => null);
  // Assertion failures do not block independent story tests. A failed or stale
  // build does: never measure stories against a runtime from another collection.
  if (manifest?.buildCompleted === true && manifest.buildExit === 0 && Date.parse(manifest.startedAt) >= browserStarted - 1000) {
    await collect('Existing Storybook tests and component coverage', ['apps/storybook/scripts/laboratory-coverage.mjs']);
  } else {
    outcomes.push({ label: 'Storybook skipped: this run did not produce a verified isolated core build', exitCode: 1 });
  }
  return outcomes;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!(major >= 24 || major === 22 && minor >= 13)) throw new Error('Test metrics require Node ^22.13.0 or >=24.0.0, matching the repository engines.');
  if (process.argv.length > 3 || process.argv[2] && process.argv[2] !== '--unit') throw new Error('Usage: node apps/native-playground/scripts/measure-tests.mjs [--unit]');
  const outcomes = await measureTests({ unitOnly: process.argv[2] === '--unit' });
  console.log('\nMetric collection results:');
  for (const outcome of outcomes) console.log(`${outcome.exitCode ? 'FAILED' : 'PASSED'} ${outcome.label}`);
  console.log('Refresh Test coverage in Laboratory. Failures remain recorded; source declarations are not counted as passed tests.');
  process.exitCode = outcomes.some(outcome => outcome.exitCode !== 0) ? 1 : 0;
}
