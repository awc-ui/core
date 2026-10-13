import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runBrowserCoverage } from './scripts/coverage/run-browser.mjs';
import { collectStoryCoverage } from '../storybook/scripts/laboratory-coverage.mjs';
import { readTestRunEvidence, beginIsolatedBuild, finishIsolatedBuild, verifyIsolatedBuild } from './test-run-evidence.mjs';

async function fixture(t, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awc-collector-evidence-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), value);
  }
  return root;
}
const e2eDirectory = 'packages/core/coverage-e2e/scopes/all';
const reactDirectory = 'apps/test-react/coverage-native/scopes/all';
const e2eTest = 'packages/core/src/components/md-button/button.e2e.ts';
const reactTest = 'apps/test-react/e2e/button.spec.tsx';
const oldReports = ['results.json', 'test-results.json', 'lcov.info', 'coverage-final.json', 'coverage-summary.json', 'run-evidence.json'];
const tools = () => ({ executable: process.execPath, stencil: '/test/stencil', playwright: '/test/playwright' });
const scope = root => ({ tag: 'all', scopeId: 'all', tags: ['md-button'], e2eTests: [path.join(root, e2eTest)], componentTests: [path.join(root, reactTest)] });

test('browser collectors seal separate run identities and keep failed E2E coverage errors out of React evidence', async t => {
  const root = await fixture(t, { [e2eTest]: "it('clicks', () => {});", [reactTest]: "test('mounts', () => {});",
    ...Object.fromEntries([e2eDirectory, reactDirectory].flatMap(directory => oldReports.map(name => [`${directory}/${name}`, '{}']))),
  });
  const manifest = await runBrowserCoverage({ root, scope: scope(root), resolveTools: tools,
    runProcess: async (_, args) => {
      if (args[1] === 'build') {
        for (const directory of [e2eDirectory, reactDirectory]) {
          const running = JSON.parse(await fs.readFile(path.join(root, directory, 'run-evidence.json'), 'utf8'));
          assert.equal(running.status, 'running');
          for (const name of oldReports.filter(name => name !== 'run-evidence.json')) await assert.rejects(fs.stat(path.join(root, directory, name)), { code: 'ENOENT' });
        }
        await fs.mkdir(path.join(root, e2eDirectory, 'components'), { recursive: true });
        await fs.mkdir(path.join(root, e2eDirectory, 'www/build'), { recursive: true });
        await fs.writeFile(path.join(root, e2eDirectory, 'www/build/md3.esm.js'), 'export {};');
        await fs.writeFile(path.join(root, e2eDirectory, 'components/index.js'), 'export {};');
        return 0;
      }
      const directory = args[0] === '/test/stencil' ? e2eDirectory : reactDirectory;
      await fs.writeFile(path.join(root, directory, 'results.json'), JSON.stringify({ testResults: [] }));
      if (directory === reactDirectory) {
        await fs.mkdir(path.join(root, directory, 'report'), { recursive: true });
        await fs.writeFile(path.join(root, directory, 'report/lcov.info'), 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n');
      }
      return directory === e2eDirectory ? 1 : 0;
    }, collectReport: async () => { throw new Error('Raw E2E coverage was incomplete'); },
  });
  const e2e = await readTestRunEvidence(root, e2eDirectory), react = await readTestRunEvidence(root, reactDirectory);
  assert.equal(manifest.stencilExit, 1); assert.equal(manifest.componentExit, 0);
  assert.notEqual(e2e.runId, react.runId);
  assert.equal(e2e.exitCode, 1); assert.match(e2e.errors.join(' '), /Raw E2E coverage/);
  assert.deepEqual(e2e.validArtifacts, ['results.json']);
  assert.equal(react.exitCode, 0); assert.deepEqual(react.errors, []);
  assert.deepEqual(react.validArtifacts.sort(), ['lcov.info', 'results.json']);
  assert.deepEqual(e2e.testFiles, [e2eTest]); assert.deepEqual(react.testFiles, [reactTest]);
  assert.equal(e2e.source.matchesCurrent, true); assert.equal(react.source.matchesCurrent, true);
  assert.equal(e2e.build.verified, true); assert.equal(react.build.verified, true);
  assert.equal(e2e.build.buildId, react.build.buildId, 'Both runners used the same sealed build despite different test outcomes');
  assert.equal((await verifyIsolatedBuild({ root, runtimeDirectory: `${e2eDirectory}/www/build` })).buildId, e2e.build.buildId);
});

test('a failed isolated build seals both attempted categories without borrowing old reports', async t => {
  const root = await fixture(t, { [e2eTest]: "it('clicks', () => {});", [reactTest]: "test('mounts', () => {});" });
  let calls = 0;
  await runBrowserCoverage({ root, scope: scope(root), resolveTools: tools, runProcess: async () => { calls++; return 1; } });
  assert.equal(calls, 1);
  for (const directory of [e2eDirectory, reactDirectory]) {
    const evidence = await readTestRunEvidence(root, directory);
    assert.equal(evidence.status, 'completed'); assert.equal(evidence.exitCode, 1);
    assert.match(evidence.errors.join(' '), /build failed/); assert.deepEqual(evidence.validArtifacts, []);
  }
});

test('compiled runtime changes fail the collector without rewriting the recorded test outcome', async t => {
  const root = await fixture(t, { [e2eTest]: "it('clicks', () => {});" });
  const selected = { ...scope(root), componentTests: [] };
  const manifest = await runBrowserCoverage({ root, scope: selected, resolveTools: tools, runProcess: async (_, args) => {
    if (args[1] === 'build') {
      for (const name of ['www/build', 'components']) {
        await fs.mkdir(path.join(root, e2eDirectory, name), { recursive: true });
        await fs.writeFile(path.join(root, e2eDirectory, name, 'index.js'), 'export {};');
      }
    } else {
      await fs.writeFile(path.join(root, e2eDirectory, 'results.json'), '{"testResults":[]}');
      await fs.writeFile(path.join(root, e2eDirectory, 'www/build/index.js'), 'tampered');
    }
    return 0;
  }, collectReport: async ({ output }) => {
    const report = path.join(output, 'collected.info');
    await fs.writeFile(report, 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n');
    return report;
  } });
  const evidence = await readTestRunEvidence(root, e2eDirectory);
  assert.equal(manifest.status, 'failed');
  assert.equal(evidence.exitCode, 0, 'The process outcome is retained separately from the collector integrity error');
  assert.equal(evidence.build.verified, false);
  assert.equal(evidence.source.matchesCurrent, false);
  assert.match(evidence.errors.join(' '), /runtime files changed/);
});

async function storyFixture(t) {
  const source = 'export class MdButton {}';
  const root = await fixture(t, {
    'packages/core/src/components/md-button/md-button.tsx': source,
    'packages/core/src/components/md-button/md-button.css': ':host { color: red; }',
    'packages/core/src/utils/fixed-position.ts': 'export const anchor = 1;',
    'apps/native-playground/scripts/coverage/stencil.config.ts': 'export const config = {};',
    'apps/storybook/src/stories/MdButton.stories.ts': "export const Primary: Story = {};",
    ...Object.fromEntries(oldReports.map(name => [`apps/storybook/coverage-stories/${name}`, '{}'])),
  });
  const building = await beginIsolatedBuild({ root, directory: e2eDirectory });
  await fs.mkdir(path.join(root, e2eDirectory, 'www/build'), { recursive: true });
  await fs.mkdir(path.join(root, e2eDirectory, 'components'), { recursive: true });
  for (const name of ['md3.esm.js', 'md-button.entry.js']) await fs.writeFile(path.join(root, e2eDirectory, 'www/build', name), 'export {};');
  await fs.writeFile(path.join(root, e2eDirectory, 'components/index.js'), 'export {};');
  await fs.writeFile(path.join(root, e2eDirectory, 'www/build/md-button.entry.js.map'), JSON.stringify({ sources: ['../../../src/components/md-button/md-button.tsx'], sourcesContent: [source] }));
  await finishIsolatedBuild(building, { exitCode: 0 });
  return root;
}

for (const coverageFailure of [false, true]) test(`Storybook seals assertion outcomes after report generation, coverage failure=${coverageFailure}`, async t => {
  const root = await storyFixture(t), directory = 'apps/storybook/coverage-stories';
  const code = await collectStoryCoverage({ root, runtimeSource: path.join(root, e2eDirectory, 'www/build'), run: async () => {
    const running = JSON.parse(await fs.readFile(path.join(root, directory, 'run-evidence.json'), 'utf8'));
    assert.equal(running.status, 'running');
    assert.deepEqual(running.testFiles, ['apps/storybook/src/stories/MdButton.stories.ts']);
    for (const name of oldReports.filter(name => name !== 'run-evidence.json')) await assert.rejects(fs.stat(path.join(root, directory, name)), { code: 'ENOENT' });
    await fs.writeFile(path.join(root, directory, 'results.json'), JSON.stringify({ testResults: [] }));
    return 1;
  }, generateReport: async ({ output }) => {
    if (coverageFailure) throw new Error('Story maps could not be collected');
    await fs.writeFile(path.join(output, 'lcov.info'), 'SF:src/components/md-button/md-button.tsx\nDA:1,1\nend_of_record\n');
  } });
  const evidence = await readTestRunEvidence(root, directory);
  assert.equal(code, 1); assert.equal(evidence.exitCode, 1); assert.equal(evidence.status, 'completed');
  assert.equal(evidence.source.matchesCurrent, true);
  assert.deepEqual(evidence.validArtifacts.sort(), coverageFailure ? ['results.json'] : ['lcov.info', 'results.json']);
  assert.deepEqual(evidence.errors, coverageFailure ? ['Story maps could not be collected'] : []);
  assert.equal(evidence.build.verified, true);
});

for (const changed of [
  'packages/core/src/components/md-button/md-button.css',
  'packages/core/src/utils/fixed-position.ts',
  'apps/native-playground/scripts/coverage/stencil.config.ts',
  `${e2eDirectory}/www/build/md-button.entry.js`,
]) test(`Storybook rejects a stale or tampered isolated build before execution: ${changed}`, async t => {
  const root = await storyFixture(t);
  await fs.writeFile(path.join(root, changed), 'changed');
  await assert.rejects(collectStoryCoverage({ root, runtimeSource: path.join(root, e2eDirectory, 'www/build'),
    run: async () => assert.fail('A stale runtime must not execute stories') }), /build inputs changed|runtime files changed/);
});

test('Storybook rejects a runtime changed in its private copy during a test run', async t => {
  const root = await storyFixture(t), directory = 'apps/storybook/coverage-stories';
  const code = await collectStoryCoverage({ root, runtimeSource: path.join(root, e2eDirectory, 'www/build'), run: async () => {
    await fs.writeFile(path.join(root, directory, 'runtime/md-button.entry.js'), 'tampered');
    await fs.writeFile(path.join(root, directory, 'results.json'), '{"testResults":[]}');
    return 0;
  }, generateReport: async () => {} });
  const evidence = await readTestRunEvidence(root, directory);
  assert.equal(code, 1);
  assert.equal(evidence.source.matchesCurrent, false);
  assert.equal(evidence.build.verified, false);
  assert.match(evidence.errors.join(' '), /Copied runtime does not match/);
});
