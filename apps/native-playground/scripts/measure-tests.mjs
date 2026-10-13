import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

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

export async function measureTests({ root = repository, run = runProcess, now = Date.now, jestPath } = {}) {
  const core = path.join(root, 'packages/core');
  const outcomes = [];
  const collect = async (label, args, cwd = root) => {
    const exitCode = await run(label, args, cwd);
    outcomes.push({ label, exitCode });
  };
  // Remove stale outputs before starting, so infrastructure errors cannot display
  // an earlier unit run as if it belonged to this collection.
  for (const file of ['test-results.json', 'results.json', 'lcov.info', 'coverage-final.json', 'coverage-summary.json']) {
    await rm(path.join(core, 'coverage-spec', file), { force: true });
  }
  await collect('Unit tests and instrumented coverage', [jestPath || createRequire(path.join(core, 'package.json')).resolve('jest/bin/jest'), '--config', 'jest.coverage.config.cjs', '--json', '--outputFile=coverage-spec/test-results.json'], core);
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
  if (process.argv.length > 2) throw new Error('Usage: node apps/native-playground/scripts/measure-tests.mjs');
  const outcomes = await measureTests();
  console.log('\nMetric collection results:');
  for (const outcome of outcomes) console.log(`${outcome.exitCode ? 'FAILED' : 'PASSED'} ${outcome.label}`);
  console.log('Refresh Test coverage in Laboratory. Failures remain recorded; source declarations are not counted as passed tests.');
  process.exitCode = outcomes.some(outcome => outcome.exitCode !== 0) ? 1 : 0;
}
