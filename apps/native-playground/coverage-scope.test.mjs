import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { discoverScope } from './scripts/coverage/scope.mjs';

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
