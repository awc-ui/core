import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildCatalog } from '../scripts/build-catalog.mjs';

// The fixture repository deliberately has no generators. A released build must
// read the npm artifact and committed guides, never regenerate from the checkout.
test('released catalog builds preserve published documentation and validate their inputs', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'awc-mcp-released-source-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const repository = join(temp, 'repo');
  const core = join(temp, 'package');
  const output = join(temp, 'output/dist');
  const write = async (root, path, content) => {
    const target = join(root, path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, content);
  };
  const pkg = { name: '@awc-ui/core', version: '1.0.0-beta.14' };
  const api = { customElement: true, tagName: 'md-button', summary: 'Released button', members: [] };
  await write(core, 'package.json', JSON.stringify(pkg));
  await write(core, 'custom-elements.json', JSON.stringify({ modules: [{ declarations: [api] }] }));
  await write(core, 'src/components/md-button/readme.md', 'Published component manual');
  await write(core, 'main-llm.md', 'Published build director');
  await write(core, 'LICENSE', 'Published license');
  await write(repository, 'packages/core/package.json', JSON.stringify(pkg));
  const paths = ['getting-started/installation', 'frameworks/react', 'frameworks/vue', 'frameworks/angular', 'frameworks/svelte', 'frameworks/web-components', 'frameworks/ssr', 'theming/customization', 'theming/tokens', 'guides/accessibility'];
  for (const path of paths) await write(repository, `apps/docs/src/content/docs/${path}.mdx`, `Released ${path}`);
  const git = (...args) => execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Released guides');
  await write(repository, 'apps/docs/src/content/docs/frameworks/react.mdx', 'Unreleased React guide');
  const env = { AWC_MCP_CORE_PACKAGE: core, AWC_MCP_GUIDES_REF: 'HEAD' };

  await t.test('uses exact published API, manuals and director plus committed guides', async () => {
    const catalog = await buildCatalog({ repository, output, env });
    assert.equal(catalog.coreVersion, pkg.version);
    assert.deepEqual(catalog.components[0].api, api);
    assert.equal(catalog.components[0].manual, 'Published component manual');
    assert.equal(catalog.guides.find(({ id }) => id === 'build-director').text, 'Published build director');
    assert.equal(catalog.guides.find(({ id }) => id === 'react').text, 'Released frameworks/react');
    assert.deepEqual(JSON.parse(await readFile(join(output, 'catalog.json'), 'utf8')), catalog);
    assert.equal(await readFile(join(output, '../LICENSE'), 'utf8'), 'Published license');
  });
  await t.test('rejects incomplete and relative release configuration', async () => {
    for (const partial of [{ AWC_MCP_CORE_PACKAGE: core }, { AWC_MCP_GUIDES_REF: 'HEAD' }]) {
      await assert.rejects(buildCatalog({ repository, output, env: partial }), /Set AWC_MCP_CORE_PACKAGE and AWC_MCP_GUIDES_REF together/);
    }
    await assert.rejects(buildCatalog({ repository, output, env: { ...env, AWC_MCP_CORE_PACKAGE: './package' } }), /absolute path/);
  });
  await t.test('rejects a non-Core package and mismatched guide version', async () => {
    await write(core, 'package.json', JSON.stringify({ ...pkg, name: 'different-package' }));
    await assert.rejects(buildCatalog({ repository, output, env }), /must be an @awc-ui\/core package/);
    await write(core, 'package.json', JSON.stringify({ ...pkg, version: '1.0.0-beta.15' }));
    await assert.rejects(buildCatalog({ repository, output, env }), /must contain @awc-ui\/core version 1\.0\.0-beta\.15/);
    await write(core, 'package.json', JSON.stringify(pkg));
  });
  await t.test('rejects missing refs and missing released manuals', async () => {
    await assert.rejects(buildCatalog({ repository, output, env: { ...env, AWC_MCP_GUIDES_REF: 'not-a-release' } }));
    await rm(join(core, 'src/components/md-button/readme.md'));
    await assert.rejects(buildCatalog({ repository, output, env }), /ENOENT/);
  });
});
