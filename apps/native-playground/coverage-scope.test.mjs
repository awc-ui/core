import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { discoverScope, prepareScopeReports, scopeDirectories, writeScopeManifest } from './scripts/coverage/scope.mjs';
import { collectStencilReport } from './scripts/coverage/stencil-report.mjs';

async function fixture(t, files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awc-coverage-scope-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [relative, source] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await fs.writeFile(path.join(root, relative), source);
  }
  return root;
}

test('scope discovery matches only existing suites belonging to the requested component', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awc-coverage-scope-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const relative of [
    'packages/core/src/components/md-button/md-button.tsx',
    'packages/core/src/components/md-button/button.e2e.ts',
    'packages/core/src/components/md-button/nested/link.e2e.ts',
    'packages/core/src/components/md-button/button.spec.ts',
    'packages/core/src/components/md-switch/md-switch.tsx',
    'packages/core/src/components/md-switch/switch.e2e.ts',
    'packages/core/src/components/md-badge/md-badge.tsx',
    'apps/test-react/e2e/button.spec.tsx',
    'apps/test-react/e2e/icon-button.spec.tsx',
  ]) {
    await fs.mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await fs.writeFile(path.join(root, relative), '');
  }
  const button = await discoverScope(root);
  assert.equal(button.tag, 'md-button');
  assert.equal(button.e2eTests.length, 2);
  assert.deepEqual(button.componentTests, [path.join(root, 'apps/test-react/e2e/button.spec.tsx')]);
  const toggle = await discoverScope(root, 'md-switch');
  assert.equal(toggle.e2eTests.length, 1);
  assert.deepEqual(toggle.componentTests, []);
  await assert.rejects(discoverScope(root, '../md-button'), /Invalid component tag/);
  await assert.rejects(discoverScope(root, 'md-unknown'), /Unknown source component/);
  await assert.rejects(discoverScope(root, 'md-badge'), /No existing browser suites/);
});

test('all mode includes every authored browser suite and all source tags, including untested components', async t => {
  const root = await fixture(t, {
    'packages/core/src/components/md-button/md-button.tsx': '',
    'packages/core/src/components/md-button/button.e2e.ts': '',
    'packages/core/src/components/md-switch/md-switch.tsx': '',
    'packages/core/src/components/md-badge/md-badge.tsx': '',
    'packages/core/src/components/hidden-attribute.e2e.ts': "const SAMPLE = ['md-button', 'md-switch'];",
    'packages/core/src/components/helpers/not-a-component.tsx': '',
    'apps/test-react/e2e/forms/grouped.test.tsx': "import { MdButton, MdSwitch } from '@awc-ui/react';",
    'apps/test-react/e2e/coverage.ts': '',
  });
  const all = await discoverScope(root, 'all');
  assert.equal(all.scopeId, 'all');
  assert.deepEqual(all.tags, ['md-badge', 'md-button', 'md-switch']);
  assert.deepEqual(all.e2eTests.map(file => path.relative(root, file)), [
    'packages/core/src/components/hidden-attribute.e2e.ts',
    'packages/core/src/components/md-button/button.e2e.ts',
  ]);
  assert.deepEqual(all.componentTests, [path.join(root, 'apps/test-react/e2e/forms/grouped.test.tsx')]);
});

test('scoped discovery recognizes shared tag literals and wrapper references without substring matches', async t => {
  const root = await fixture(t, {
    'packages/core/src/components/md-button/md-button.tsx': '',
    'packages/core/src/components/md-icon-button/md-icon-button.tsx': '',
    'packages/core/src/components/hidden-attribute.e2e.ts': "const SAMPLE = ['md-button'];",
    'packages/core/src/components/icon-only.e2e.ts': 'await page.setContent(`<md-icon-button></md-icon-button>`);',
    'apps/test-react/e2e/grouped.test.tsx': 'export const demo = <MdButton>Save</MdButton>;',
    'apps/test-react/e2e/icon-only.spec.tsx': 'export const demo = <MdIconButton />;',
    'apps/test-react/e2e/html.spec.tsx': 'const demo = "<md-button>Save</md-button>";',
    'apps/test-react/e2e/unrelated.spec.tsx': 'const demo = "md-button-group";',
  });
  const scope = await discoverScope(root, 'md-button');
  assert.deepEqual(scope.e2eTests, [path.join(root, 'packages/core/src/components/hidden-attribute.e2e.ts')]);
  assert.deepEqual(scope.componentTests.map(file => path.basename(file)), ['grouped.test.tsx', 'html.spec.tsx']);
});

test('a new component run removes stale results only in its own scope and preserves full-library and legacy evidence', async t => {
  const root = await fixture(t, {});
  for (const category of ['packages/core/coverage-e2e', 'apps/test-react/coverage-native']) {
    for (const scope of ['', '/scopes/all', '/scopes/md-switch', '/scopes/md-button']) {
      const dir = path.join(root, `${category}${scope}`);
      await fs.mkdir(path.join(dir, 'raw'), { recursive: true });
      await fs.mkdir(path.join(dir, 'www'), { recursive: true });
      await fs.writeFile(path.join(dir, 'results.json'), '{"existing":true}');
      await fs.writeFile(path.join(dir, 'raw/coverage.json'), '[]');
    }
  }
  const selected = await prepareScopeReports(root, 'md-button');
  assert.deepEqual(selected, scopeDirectories(root, 'md-button'));
  for (const category of ['packages/core/coverage-e2e', 'apps/test-react/coverage-native']) {
    for (const scope of ['', '/scopes/all', '/scopes/md-switch']) {
      assert.equal(await fs.readFile(path.join(root, `${category}${scope}/results.json`), 'utf8'), '{"existing":true}');
      assert.equal(await fs.readFile(path.join(root, `${category}${scope}/raw/coverage.json`), 'utf8'), '[]');
    }
    for (const child of ['results.json', 'raw', 'www']) await assert.rejects(fs.stat(path.join(root, `${category}/scopes/md-button/${child}`)), { code: 'ENOENT' });
  }
  assert.throws(() => scopeDirectories(root, '../all'), /Invalid coverage scope/);
});

test('durable manifests preserve running and failed states identically in both categories without fabricating reports', async t => {
  const root = await fixture(t, {});
  const directories = await prepareScopeReports(root, 'all');
  const manifest = { schemaVersion: 1, scopeId: 'all', tags: ['md-button'], status: 'running', startedAt: '2026-10-13T10:00:00.000Z', completedAt: null, buildExit: null, buildCompleted: false, stencilExit: null, componentExit: null, e2eTests: ['packages/core/src/components/md-button/button.e2e.ts'], componentTests: [], errors: [] };
  await writeScopeManifest(directories, manifest);
  for (const directory of Object.values(directories)) assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')), manifest);
  Object.assign(manifest, { status: 'failed', completedAt: '2026-10-13T10:01:00.000Z', buildExit: 1, errors: ['The browser build failed.'] });
  await writeScopeManifest(directories, manifest);
  for (const directory of Object.values(directories)) {
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')), manifest);
    assert.deepEqual(await fs.readdir(directory), ['run.json']);
  }
});

test('reused Jest workers keep coverage from separate suite environments and collect each page only once', async t => {
  const output = await fixture(t, {});
  const filename = fileURLToPath(new URL('./scripts/coverage/stencil-coverage.cjs', import.meta.url));
  const source = await fs.readFile(filename, 'utf8');
  for (const name of ['first-suite', 'second-suite']) {
    let closed = false;
    const page = {
      isClosed: () => closed,
      close: async () => { closed = true; },
      coverage: {
        startJSCoverage: async () => {},
        stopJSCoverage: async () => [{ url: `http://localhost:5337/build/${name}.js`, text: `function ${name.replace('-', '_')}() {}`, rawScriptCoverage: { functions: [] } }],
      },
    };
    const global = { __NEW_TEST_PAGE__: async () => page };
    vm.runInNewContext(source, { global, require: createRequire(filename), __dirname: path.dirname(filename), process: { pid: process.pid, env: { AWC_COVERAGE_E2E_OUTPUT: output } }, Buffer, URL }, { filename });
    const wrapped = await global.__NEW_TEST_PAGE__();
    await wrapped.close();
    await wrapped.close();
  }
  const captures = await fs.readdir(path.join(output, 'raw'));
  assert.equal(captures.length, 2, 'one capture from each suite survives the reused worker PID');
  const urls = (await Promise.all(captures.map(file => fs.readFile(path.join(output, 'raw', file), 'utf8')))).flatMap(value => JSON.parse(value).map(entry => entry.url)).sort();
  assert.deepEqual(urls, ['http://localhost:5337/build/first-suite.js', 'http://localhost:5337/build/second-suite.js']);
});

test('a browser run without captured data cannot produce a zero or passing coverage report', async t => {
  const output = await fixture(t, {});
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  await assert.rejects(collectStencilReport({ repository, output, tags: ['md-button'] }), /No browser coverage was captured/);
  assert.deepEqual(await fs.readdir(output), []);
});
