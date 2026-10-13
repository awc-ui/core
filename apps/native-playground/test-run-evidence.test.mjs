import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, utimes, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { beginTestRun, finishTestRun, readTestRunEvidence, beginIsolatedBuild, finishIsolatedBuild, verifyIsolatedBuild, MAX_TEST_REPORT_BYTES } from './test-run-evidence.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'awc-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'packages/core/src/components/md-button'), { recursive: true });
  await writeFile(path.join(root, 'packages/core/src/components/md-button/md-button.tsx'), 'export const value = 1;');
  const options = { root, directory: 'packages/core/coverage-spec', category: 'unit', framework: 'jest', label: 'Unit', command: 'jest',
    testFiles: ['packages/core/src/components/md-button/md-button.spec.ts'], tags: ['md-button'] };
  return { root, options, output: path.join(root, options.directory) };
}

test('completed invocation correlates content-hashed artifacts despite later filesystem timestamps', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options);
  await writeFile(path.join(output, 'lcov.info'), 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n');
  await writeFile(path.join(output, 'test-results.json'), '{"testResults":[]}');
  await finishTestRun(handle, { exitCode: 0 });
  await utimes(path.join(output, 'lcov.info'), new Date(0), new Date(0));
  const evidence = await readTestRunEvidence(root, options.directory);
  assert.equal(evidence.runId, handle.runId);
  assert.deepEqual(evidence.validArtifacts.sort(), ['lcov.info', 'test-results.json']);
  assert.equal(evidence.source.matchesCurrent, true);
  assert.equal(evidence.source.stableDuringRun, true);
});

test('changed report bytes cannot borrow correlation from an earlier run', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options);
  await writeFile(path.join(output, 'results.json'), '{"ok":true}');
  await writeFile(path.join(output, 'lcov.info'), 'original');
  await finishTestRun(handle, { exitCode: 1, errors: ['One test failed'] });
  await writeFile(path.join(output, 'lcov.info'), 'modified');
  const evidence = await readTestRunEvidence(root, options.directory);
  assert.deepEqual(evidence.validArtifacts, ['results.json']);
  assert.equal(evidence.exitCode, 1);
  assert.equal(evidence.errors[0], 'One test failed');
});

test('source changes after a run keep report correlation but invalidate current input match', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options);
  await writeFile(path.join(output, 'lcov.info'), 'coverage');
  await finishTestRun(handle, { exitCode: 0 });
  const file = 'packages/core/src/components/md-button/md-button.tsx';
  await writeFile(path.join(root, file), 'export const value = 2;');
  const evidence = await readTestRunEvidence(root, options.directory);
  assert.deepEqual(evidence.validArtifacts, ['lcov.info']);
  assert.equal(evidence.source.matchesCurrent, false);
  assert.deepEqual(evidence.source.changedFiles, [file]);
});

test('changes during collection and added inputs cannot appear as a stable tested snapshot', async t => {
  const { root, options } = await fixture(t);
  const handle = await beginTestRun(options);
  await writeFile(path.join(root, 'packages/core/src/new-input.ts'), 'export const added = true;');
  await finishTestRun(handle, { exitCode: 0 });
  const evidence = await readTestRunEvidence(root, options.directory);
  assert.equal(evidence.source.stableDuringRun, false);
  assert.equal(evidence.source.matchesCurrent, false);
  assert.deepEqual(evidence.source.changedDuringRun, ['packages/core/src/new-input.ts']);
});

test('running invocation does not use old artifacts and categories cannot cross-link', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options);
  await writeFile(path.join(output, 'lcov.info'), 'coverage');
  assert.deepEqual((await readTestRunEvidence(root, options.directory)).validArtifacts, []);
  await assert.rejects(beginTestRun({ ...options, category: 'e2e' }), /Unsupported/);
  await finishTestRun(handle, { exitCode: 0 });
  const file = path.join(output, 'run-evidence.json');
  const value = JSON.parse(await readFile(file, 'utf8'));
  value.category = 'e2e';
  await writeFile(file, JSON.stringify(value));
  assert.equal(await readTestRunEvidence(root, options.directory), null);
  assert.equal(await readTestRunEvidence(root, '../escape'), null);
});

test('stale files not produced by this invocation are not sealed into evidence', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options);
  await writeFile(path.join(output, 'lcov.info'), 'old coverage');
  await utimes(path.join(output, 'lcov.info'), new Date(0), new Date(0));
  await finishTestRun(handle, { exitCode: 1 });
  assert.deepEqual((await readTestRunEvidence(root, options.directory)).validArtifacts, []);
});

test('a known JSON report larger than 64 MiB is streamed into the seal and verified by content', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options), filename = path.join(output, 'results.json');
  const file = await open(filename, 'w'), hash = createHash('sha256');
  const header = '{"testResults":[]}\n', chunk = Buffer.alloc(1024 * 1024, ' ');
  try {
    await file.write(header); hash.update(header);
    for (let i = 0; i < 65; i++) { await file.write(chunk); hash.update(chunk); }
  } finally { await file.close(); }
  const record = await finishTestRun(handle, { exitCode: 0 });
  assert.equal(record.artifacts['results.json'].size, 65 * 1024 * 1024 + Buffer.byteLength(header));
  assert.equal(record.artifacts['results.json'].sha256, hash.digest('hex'));
  assert.deepEqual(record.errors, []);
  assert.deepEqual((await readTestRunEvidence(root, options.directory)).validArtifacts, ['results.json']);
  const changed = await open(filename, 'r+');
  try { await changed.write('x', 0); } finally { await changed.close(); }
  assert.deepEqual((await readTestRunEvidence(root, options.directory)).validArtifacts, []);
});

test('a report above the collection bound records an explicit error instead of silently disappearing', async t => {
  const { root, options, output } = await fixture(t);
  const handle = await beginTestRun(options), file = await open(path.join(output, 'results.json'), 'w');
  try { await file.truncate(MAX_TEST_REPORT_BYTES + 1); } finally { await file.close(); }
  const record = await finishTestRun(handle, { exitCode: 0 });
  assert.deepEqual(record.artifacts, {});
  assert.match(record.errors.join(' '), /results\.json/);
  assert.match(record.errors.join(' '), /exceeds.*collection limit/);
  const evidence = await readTestRunEvidence(root, options.directory);
  assert.deepEqual(evidence.validArtifacts, []);
  assert.deepEqual(evidence.errors, record.errors);
});

test('React mounting templates and inherited root/theme configuration belong to the tested snapshot', async t => {
  const { root, options } = await fixture(t);
  const files = ['apps/test-react/playwright/index.html', 'apps/test-react/playwright/index.tsx', 'tsconfig.json', 'packages/theme/tsconfig.json'];
  for (const file of files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), '{}');
  }
  const handle = await beginTestRun({ ...options, directory: 'apps/test-react/coverage-native/scopes/all', category: 'component', framework: 'playwright' });
  await finishTestRun(handle, { exitCode: 0 });
  for (const file of files) await writeFile(path.join(root, file), 'changed');
  const evidence = await readTestRunEvidence(root, handle.directory);
  assert.equal(evidence.source.matchesCurrent, false);
  assert.deepEqual(evidence.source.changedFiles.sort(), files.sort());
});

test('a build whose inputs changed during compilation cannot authorize later runtime reuse', async t => {
  const { root } = await fixture(t), directory = 'packages/core/coverage-e2e/scopes/all';
  const handle = await beginIsolatedBuild({ root, directory });
  await writeFile(path.join(root, 'packages/core/src/components/md-button/md-button.tsx'), 'export const changed = true;');
  for (const name of ['www/build', 'components']) {
    await mkdir(path.join(root, directory, name), { recursive: true });
    await writeFile(path.join(root, directory, name, 'index.js'), 'export {};');
  }
  const built = await finishIsolatedBuild(handle, { exitCode: 0 });
  assert.equal(built.source.stableDuringBuild, false);
  await assert.rejects(verifyIsolatedBuild({ root, runtimeDirectory: `${directory}/www/build` }), /incomplete or changed/);
});
