import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dependencies = process.env.AWC_DEPENDENCY_ROOT || root;
const req = createRequire(join(dependencies, 'apps/showcase/community/svelte/package.json'));
const sveltePath = dirname(req.resolve('svelte/package.json'));
const checker = join(dirname(req.resolve('svelte-check/package.json')), 'bin/svelte-check');
const workspace = await mkdtemp(join(tmpdir(), 'awc-svelte-types-'));
try {
  await symlink(join(dependencies, 'apps/showcase/community/svelte/node_modules'), join(workspace, 'node_modules'), 'dir');
  await writeFile(join(workspace, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'node', strict: true, skipLibCheck: true, lib: ['ES2022', 'DOM'],
    baseUrl: dependencies, paths: { '@awc-ui/core': ['packages/core/dist/types/index.d.ts'], 'svelte/*': [sveltePath + '/*'] },
  }, include: ['*.svelte'] }));
  const prefix = `<script lang="ts">
import type {} from '${join(root, 'packages/svelte/src/lib/elements')}';
let text = '';
</script>
`;
  const check = () => spawnSync(process.execPath, [checker, '--workspace', workspace, '--tsconfig', './tsconfig.json', '--output', 'human'], { encoding: 'utf8' });
  await writeFile(join(workspace, 'App.svelte'), prefix + '<md-text-field label="Name" on:mdInput={(event) => text = event.detail} /><md-button variant="filled">Save</md-button>');
  let result = check(); assert.equal(result.status, 0, result.stdout + result.stderr);
  await writeFile(join(workspace, 'App.svelte'), prefix + '<md-button variant="not-a-real-variant">Save</md-button>');
  result = check(); assert.notEqual(result.status, 0, 'unknown variants must fail'); assert.match(result.stdout, /not-a-real-variant/);
  await writeFile(join(workspace, 'App.svelte'), prefix + '<md-text-field on:mdInput={(event) => text = event.detail.nonexistent} />');
  result = check(); assert.notEqual(result.status, 0, 'custom-event detail must be typed'); assert.match(result.stdout, /nonexistent/);
  console.log('Svelte types: inferred custom-event details and valid props pass; invalid props/payloads are rejected.');
} finally { await rm(workspace, { recursive: true, force: true }); }
