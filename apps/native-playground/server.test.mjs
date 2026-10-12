import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveAsset } from './server.mjs';
import { recipeFor } from './recipes.js';
import { readFile } from 'node:fs/promises';

// The lab serves source files from a repository, so traversal and symlink
// escape protection are part of its functional security contract.
test('asset routing rejects traversal, private files and symlink escapes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'awc-native-lab-'));
  try {
    const repo = path.join(root, 'repo'); const app = path.join(repo, 'apps/native-playground');
    await mkdir(app, { recursive: true }); await mkdir(path.join(repo, 'packages/native-ios'), { recursive: true });
    await writeFile(path.join(app, 'index.html'), 'lab'); await writeFile(path.join(root, 'private.txt'), 'private');
    await symlink(path.join(root, 'private.txt'), path.join(repo, 'packages/native-ios/escape.swift'));
    const options = { repoRoot: repo, appRoot: app };
    assert.equal(await resolveAsset('/', options), await realpath(path.join(app, 'index.html')));
    for (const url of ['/../private.txt', '/%2e%2e/private.txt', '/repo/.env', '/repo/packages/native-ios/.env', '/repo/packages/native-ios/.private/secrets.json', '/repo/packages/native-ios/../../.env', '/repo/packages/native-ios/escape.swift', '/server.mjs', '/%00', '/%zz', '/repo\\.env']) assert.equal(await resolveAsset(url, options), null, url);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('an explicitly configured web build can live outside the checkout', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'awc-native-web-'));
  try {
    const repo = path.join(root, 'repo'); const dist = path.join(root, 'built-dist');
    await mkdir(path.join(repo, 'packages/core'), { recursive: true }); await mkdir(dist);
    await writeFile(path.join(dist, 'index.js'), 'export {}'); await symlink(dist, path.join(repo, 'packages/core/dist'));
    assert.equal(await resolveAsset('/web-dist/index.js', { repoRoot: repo }), await realpath(path.join(dist, 'index.js')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('browser documentation modules are served without opening nearby internal modules', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'awc-native-doc-modules-'));
  try {
    const allowed = ['documentation.js', 'documentation-ui.js', 'usage-snippets.js', 'property-controls.js'];
    const denied = ['documentation.test.mjs', 'documentation-ui.test.js', 'usage-snippets.mjs', 'server.mjs', 'native-live.mjs'];
    for (const file of [...allowed, ...denied]) await writeFile(path.join(root, file), 'export {};');
    for (const file of allowed) assert.equal(await resolveAsset(`/${file}`, { appRoot: root }), await realpath(path.join(root, file)), file);
    for (const file of denied) assert.equal(await resolveAsset(`/${file}`, { appRoot: root }), null, file);
    assert.equal(await resolveAsset('/nested/documentation.js', { appRoot: root }), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('component documentation routes allow only JSON records and component readmes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'awc-native-docs-'));
  try {
    const repo = path.join(root, 'repo');
    const allowed = [
      'apps/docs/src/data/components/button.json',
      'apps/docs/src/data/components/text-field.json',
      'packages/core/src/components/md-button/readme.md',
    ];
    const denied = [
      'apps/docs/src/data/components.json',
      'apps/docs/src/data/components/button.md',
      'apps/docs/src/data/components/button.test.json',
      'apps/docs/src/data/components/.private.json',
      'apps/docs/src/data/components/Button.json',
      'apps/docs/src/data/components/button--private.json',
      'apps/docs/src/data/components/nested/button.json',
      'apps/docs/src/content/docs/components/button.mdx',
      'packages/core/src/components/md-button/md-button.tsx',
      'packages/core/src/components/md-button/notes.md',
      'packages/core/src/components/md-button/nested/readme.md',
      'packages/core/src/components/button/readme.md',
      'packages/core/src/components/md-button--private/readme.md',
    ];
    for (const file of [...allowed, ...denied]) {
      await mkdir(path.dirname(path.join(repo, file)), { recursive: true });
      await writeFile(path.join(repo, file), '{}');
    }
    for (const file of allowed) assert.equal(await resolveAsset(`/repo/${file}`, { repoRoot: repo }), await realpath(path.join(repo, file)), file);
    for (const file of denied) assert.equal(await resolveAsset(`/repo/${file}`, { repoRoot: repo }), null, file);
    for (const url of [
      '/repo/apps/docs/src/data/components/../components.json',
      '/repo/apps/docs/src/data/components/%2e%2e/components.json',
      '/repo/apps/docs/src/data/components/button.json/../../components.json',
      '/repo/packages/core/src/components/md-button/%2e%2e/md-button/readme.md',
    ]) assert.equal(await resolveAsset(url, { repoRoot: repo }), null, url);
    await writeFile(path.join(root, 'private.json'), '{}');
    await symlink(path.join(root, 'private.json'), path.join(repo, 'apps/docs/src/data/components/escape.json'));
    await mkdir(path.join(repo, 'packages/core/src/components/md-escape'));
    await symlink(path.join(root, 'private.json'), path.join(repo, 'packages/core/src/components/md-escape/readme.md'));
    for (const url of ['/repo/apps/docs/src/data/components/escape.json', '/repo/packages/core/src/components/md-escape/readme.md']) {
      assert.equal(await resolveAsset(url, { repoRoot: repo }), null, url);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('all 81 source components have reachable JSON documentation and readmes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const tags = manifest.modules.flatMap(module => module.declarations || []).map(component => component.tagName).filter(Boolean);
  assert.equal(tags.length, 81);
  for (const tag of tags) {
    assert.ok(await resolveAsset(`/repo/apps/docs/src/data/components/${tag.slice(3)}.json`), `${tag} JSON`);
    assert.ok(await resolveAsset(`/repo/packages/core/src/components/${tag}/readme.md`), `${tag} readme`);
  }
});

test('every manifest component has a recipe containing that component', async () => {
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const tags = manifest.modules.flatMap(module => module.declarations || []).map(component => component.tagName).filter(Boolean);
  assert.equal(tags.length, 81);
  for (const tag of tags) {
    assert.ok(recipeFor(tag).html.includes(`<${tag}`), `${tag} missing from recipe`);
    assert.notEqual(recipeFor(tag).note, 'Source component reference', `${tag} requires an intentional recipe`);
  }
});

test('mixed source literal unions round-trip booleans, numbers and strings without coercion', async () => {
  const { literalChoices, encodeLiteralChoice, decodeLiteralChoice, literalChoiceLabel } = await import('./contracts.js');
  const mode = { type: "'internal' | 'external' | false", options: [] };
  assert.deepEqual(literalChoices(mode), ['internal', 'external', false]);
  assert.equal(decodeLiteralChoice(encodeLiteralChoice(false), mode), false);
  const mixed = { type: "'false' | false | true | -1 | 0.5 | 'a|b' | null" };
  const choices = literalChoices(mixed);
  assert.deepEqual(choices, ['false', false, true, -1, 0.5, 'a|b', null]);
  for (const value of choices) assert.ok(Object.is(decodeLiteralChoice(encodeLiteralChoice(value), mixed), value));
  assert.equal(literalChoiceLabel(false, choices), 'false (boolean)');
  assert.equal(literalChoiceLabel('false', choices), 'false (string)');
  assert.throws(() => decodeLiteralChoice('"true"', mixed), /outside/);
  assert.deepEqual(literalChoices({ type: "string | number" }), []);
  assert.deepEqual(literalChoices({ type: "'filled' | 'outlined'" }), ['filled', 'outlined']);
});

test('all actual mixed false literal props expose a real boolean choice', async () => {
  const { literalChoices, decodeLiteralChoice } = await import('./contracts.js');
  const manifest = JSON.parse(await readFile(new URL('../../packages/core/custom-elements.json', import.meta.url), 'utf8'));
  const field = manifest.modules.flatMap(module => module.declarations || []).find(component => component.tagName === 'md-text-field');
  for (const name of ['clearable', 'passwordToggle', 'speechToText', 'multiline']) {
    const member = field.members.find(property => property.name === name);
    const property = { ...member, type: member.type.text };
    assert.ok(literalChoices(property).includes(false), name);
    assert.equal(decodeLiteralChoice('false', property), false, name);
  }
});

test('portability totals include per-platform API gaps even with no static diagnostics', async () => {
  const { portabilityFindings } = await import('./contracts.js');
  assert.deepEqual(portabilityFindings({ diagnostics: [], support: { ios: { unsupportedProperties: ['density'] }, android: { unsupportedProperties: ['icon', 'shape', 'density'], unsupportedSlots: [''] } } }), { source: 0, ios: 1, android: 4, total: 5 });
  assert.deepEqual(portabilityFindings({ diagnostics: [{ code: 'DOM_QUERY' }], support: { ios: { status: 'missing-adapter' } } }), { source: 1, ios: 1, android: 0, total: 2 });
  assert.equal(portabilityFindings({}).total, 0);
});
