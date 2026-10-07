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
