import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { measureTests } from './scripts/measure-tests.mjs';
import { readTestRunEvidence } from './test-run-evidence.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'awc-measure-tests-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const unit = path.join(root, 'packages/core/coverage-spec');
  const browser = path.join(root, 'packages/core/coverage-e2e/scopes/all');
  await mkdir(unit, { recursive: true });
  await mkdir(browser, { recursive: true });
  await writeFile(path.join(unit, 'test-results.json'), '{"oldPass":true}');
  await writeFile(path.join(unit, 'lcov.info'), 'old passing coverage');
  return { root, unit, browser };
}

test('independent coverage stages still run after assertion failures and stale unit outputs are removed first', async t => {
  const { root, unit, browser } = await fixture(t);
  const now = Date.parse('2026-10-13T12:00:00Z'), calls = [];
  const result = await measureTests({ root, now: () => now, jestPath: '/test/jest.js', run: async (label, args, cwd) => {
    calls.push({ label, args, cwd });
    if (calls.length === 1) {
      await assert.rejects(readFile(path.join(unit, 'test-results.json')), { code: 'ENOENT' });
      await assert.rejects(readFile(path.join(unit, 'lcov.info')), { code: 'ENOENT' });
      return 1;
    }
    if (calls.length === 2) {
      await writeFile(path.join(browser, 'run.json'), JSON.stringify({ startedAt: new Date(now).toISOString(), buildCompleted: true, buildExit: 0, status: 'failed' }));
      return 1;
    }
    return 0;
  } });
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].args, ['apps/native-playground/scripts/coverage/run-browser.mjs', '--all']);
  assert.match(calls[2].args[0], /storybook/);
  assert.deepEqual(result.map(item => item.exitCode), [1, 1, 0]);
});

for (const manifest of [null, { buildCompleted: false, buildExit: 1 }, { buildCompleted: true, buildExit: 0, startedAt: '2020-01-01T00:00:00Z' }]) {
  test(`story collection never uses an absent, failed or stale build: ${JSON.stringify(manifest)}`, async t => {
    const { root, browser } = await fixture(t);
    const calls = [];
    const result = await measureTests({ root, jestPath: '/test/jest.js', run: async (label) => {
      calls.push(label);
      if (calls.length === 2 && manifest) await writeFile(path.join(browser, 'run.json'), JSON.stringify(manifest));
      return 0;
    } });
    assert.equal(calls.length, 2);
    assert.equal(result.at(-1).exitCode, 1);
    assert.match(result.at(-1).label, /skipped/);
  });
}

test('standalone Unit collection seals the actual failed result and source inputs without running browser suites', async t => {
  const { root, unit } = await fixture(t);
  const spec = 'packages/core/src/components/md-button/md-button.spec.ts';
  await mkdir(path.dirname(path.join(root, spec)), { recursive: true });
  await writeFile(path.join(root, spec), "it('renders', () => {});");
  const calls = [];
  const outcomes = await measureTests({ root, unitOnly: true, jestPath: '/test/jest.js', run: async (label, args) => {
    calls.push(args);
    const running = JSON.parse(await readFile(path.join(unit, 'run-evidence.json'), 'utf8'));
    assert.equal(running.status, 'running');
    assert.deepEqual(running.testFiles, [spec]);
    assert.deepEqual(running.artifacts, {});
    await writeFile(path.join(unit, 'test-results.json'), JSON.stringify({ success: false, testResults: [{ name: spec, assertionResults: [{ title: 'renders', status: 'failed' }] }] }));
    await writeFile(path.join(unit, 'lcov.info'), 'SF:src/components/md-button/md-button.tsx\nDA:1,0\nend_of_record\n');
    return 1;
  } });
  assert.equal(calls.length, 1); assert.equal(outcomes[0].exitCode, 1);
  const evidence = await readTestRunEvidence(root, 'packages/core/coverage-spec');
  assert.equal(evidence.status, 'completed'); assert.equal(evidence.exitCode, 1);
  assert.equal(evidence.source.matchesCurrent, true);
  assert.deepEqual(evidence.validArtifacts.sort(), ['lcov.info', 'test-results.json']);
  assert.match(evidence.command, /--unit$/);
});

test('Unit launch failure seals an empty failed run after removing every old report', async t => {
  const { root, unit } = await fixture(t);
  for (const name of ['results.json', 'coverage-final.json', 'coverage-summary.json', 'run-evidence.json']) await writeFile(path.join(unit, name), '{}');
  const outcomes = await measureTests({ root, unitOnly: true, jestPath: '/test/jest.js', run: async () => { throw new Error('Jest could not launch'); } });
  const evidence = await readTestRunEvidence(root, 'packages/core/coverage-spec');
  assert.equal(outcomes[0].exitCode, 1); assert.equal(evidence.exitCode, 1);
  assert.deepEqual(evidence.errors, ['Jest could not launch']);
  assert.deepEqual(evidence.validArtifacts, []);
});
