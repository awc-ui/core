import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { createSnapshot, parseArguments, saveSnapshot, snapshotDocs } from './snapshot-docs.mjs';
import { assertVersion, checkArchives, decodeBundle, encodeBundle, readManifest, sha256, validateBundle, validateManifest } from './lib/docs-versions.mjs';

const api = { kind: 'class', name: 'MdButton', customElement: true, tagName: 'md-button', description: 'A released button.', members: [{ kind: 'method', name: 'focus' }] };
const manifest = { schemaVersion: '1.0.0', modules: [{ kind: 'javascript-module', path: 'src/components/md-button/md-button.tsx', declarations: [api] }] };
const manual = '# md-button\r\n\r\nRelease text, including trailing spaces.  \r\n';
const guideText = '---\ntitle: "React setup"\n---\n\nReleased React guide.\n';
const guideRoot = 'apps/docs/src/content/docs/';
const node = process.execPath;

function git(repository, ...args) {
  return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
async function write(root, path, content) {
  const full = join(root, path);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, content);
}
async function fixture(t, { withManifest = true } = {}) {
  const repository = await mkdtemp(join(tmpdir(), 'awc-docs-version-test-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  git(repository, 'init', '-q');
  git(repository, 'config', 'user.name', 'Docs test');
  git(repository, 'config', 'user.email', 'docs@example.invalid');
  await write(repository, 'packages/core/package.json', JSON.stringify({ name: '@awc-ui/core', version: '1.2.3' }));
  if (withManifest) await write(repository, 'packages/core/custom-elements.json', JSON.stringify(manifest));
  await write(repository, 'packages/core/src/components/md-button/readme.md', manual);
  await write(repository, guideRoot + 'frameworks/react.mdx', guideText);
  for (const category of ['getting-started', 'theming', 'behaviour', 'guides', 'recipes']) {
    await write(repository, guideRoot + category + '/index.mdx', `---\ntitle: ${category}\n---\n\nReleased ${category}.\n`);
  }
  await write(repository, guideRoot + 'compare/other.mdx', '---\ntitle: Comparison\n---\nExcluded.\n');
  await write(repository, guideRoot + 'showcase/index.mdx', '---\ntitle: Showcase\n---\nExcluded.\n');
  await write(repository, guideRoot + 'components/button.mdx', '---\ntitle: Interactive demo\n---\nExcluded.\n');
  git(repository, 'add', '.');
  git(repository, 'commit', '-qm', 'Release source');
  git(repository, 'tag', 'v1.2.3');
  return { repository, commit: git(repository, 'rev-parse', 'HEAD'), output: join(repository, 'archives') };
}
async function extractedPackage(repository, version = '1.2.3') {
  const directory = join(repository, 'published-package');
  await write(directory, 'package.json', JSON.stringify({ name: '@awc-ui/core', version }));
  await write(directory, 'custom-elements.json', JSON.stringify(manifest));
  await write(directory, 'src/components/md-button/readme.md', manual);
  return directory;
}

test('extracts immutable tag sources, full guide categories, byte-exact manuals and API declarations', async t => {
  const { repository, commit } = await fixture(t);
  await write(repository, 'packages/core/src/components/md-button/readme.md', 'Unreleased working tree changes');
  await write(repository, 'packages/core/custom-elements.json', JSON.stringify({ modules: [] }));
  await write(repository, guideRoot + 'frameworks/react.mdx', 'Unreleased guide');
  const bundle = await createSnapshot({ repository, ref: 'v1.2.3' });
  assert.equal(bundle.sourceCommit, commit);
  assert.equal(bundle.version, '1.2.3');
  assert.equal(bundle.components[0].manual, manual);
  assert.deepEqual(bundle.components[0].api, api);
  assert.equal(bundle.guides.length, 6);
  assert.equal(bundle.guides.find(g => g.slug === 'frameworks/react').text, guideText);
  assert.equal(bundle.guides.find(g => g.slug === 'frameworks/react').title, 'React setup');
  assert.ok(bundle.guides.some(g => g.slug === 'getting-started'));
  assert.ok(bundle.guides.every(g => !/compare|showcase|components\//.test(g.slug)));
  assert.deepEqual(await createSnapshot({ repository, ref: 'refs/tags/v1.2.3' }), bundle);
});

test('serializes deterministically, appends a new release, and never rewrites existing archives', async t => {
  const { repository, output } = await fixture(t);
  const first = await snapshotDocs({ repository, output, ref: 'v1.2.3' });
  const original = await readFile(join(output, first.entry.file));
  assert.deepEqual(original, encodeBundle(first.bundle));
  const again = await snapshotDocs({ repository, output, ref: 'v1.2.3' });
  assert.equal(again.created, false);
  assert.deepEqual(await readFile(join(output, first.entry.file)), original);
  const changed = structuredClone(first.bundle);
  changed.components[0].manual = '# Changed same-version docs';
  await assert.rejects(saveSnapshot(output, changed), /Refusing to overwrite immutable/);
  await write(repository, 'packages/core/package.json', JSON.stringify({ name: '@awc-ui/core', version: '1.2.4' }));
  git(repository, 'add', 'packages/core/package.json');
  git(repository, 'commit', '-qm', 'Next release');
  git(repository, 'tag', 'v1.2.4');
  await snapshotDocs({ repository, output, ref: 'v1.2.4' });
  const checked = await checkArchives(output);
  assert.deepEqual(checked.manifest.versions.map(entry => entry.version), ['1.2.3', '1.2.4']);
  assert.deepEqual(await readFile(join(output, first.entry.file)), original);
});

test('idempotence compares source content even if gzip implementation changes', async t => {
  const { repository, output } = await fixture(t);
  const bundle = await createSnapshot({ repository, ref: 'v1.2.3' });
  const bytes = gzipSync(JSON.stringify(bundle), { level: 1 });
  const entry = { version: bundle.version, ref: bundle.sourceRef, commit: bundle.sourceCommit, sha256: sha256(bytes), file: '1.2.3.json.gz' };
  await mkdir(output);
  await writeFile(join(output, entry.file), bytes);
  await writeFile(join(output, 'manifest.json'), JSON.stringify({ schemaVersion: 1, versions: [entry] }));
  assert.equal((await saveSnapshot(output, bundle)).created, false);
  assert.deepEqual(await readFile(join(output, entry.file)), bytes);
});

test('requires a real version-matched release tag, not current workspace version', async t => {
  const { repository } = await fixture(t);
  await assert.rejects(createSnapshot({ repository, ref: 'HEAD' }), /existing release tag/);
  await assert.rejects(createSnapshot({ repository, ref: 'v9.9.9' }), /does not exist/);
  git(repository, 'tag', 'v9.9.9');
  await assert.rejects(createSnapshot({ repository, ref: 'v9.9.9' }), /must contain @awc-ui\/core@9.9.9/);
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3/../../escape' }), /Invalid documentation version/);
});

test('supports published manifest fallback and rejects mixed released-package sources', async t => {
  const { repository } = await fixture(t, { withManifest: false });
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3' }), /Missing release source: packages\/core\/custom-elements/);
  const directory = await extractedPackage(repository);
  const bundle = await createSnapshot({ repository, ref: 'v1.2.3', packageDirectory: directory });
  assert.deepEqual(bundle.components[0].api, api);
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3', packageDirectory: './published-package' }), /absolute extracted/);
  await write(directory, 'package.json', JSON.stringify({ name: '@awc-ui/core', version: '1.2.4' }));
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3', packageDirectory: directory }), /Published package must be/);
  await write(directory, 'package.json', JSON.stringify({ name: '@awc-ui/core', version: '1.2.3' }));
  await write(directory, 'src/components/md-button/readme.md', 'Wrong manual');
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3', packageDirectory: directory }), /manual does not match release tag/);
});

test('rejects an extracted API manifest that differs from tracked released API', async t => {
  const { repository } = await fixture(t);
  const directory = await extractedPackage(repository);
  const changed = structuredClone(manifest);
  changed.modules[0].declarations[0].members.push({ kind: 'method', name: 'unreleased' });
  await write(directory, 'custom-elements.json', JSON.stringify(changed));
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3', packageDirectory: directory }), /API does not match release tag/);
});

test('detects tampered/truncated archives and metadata mismatch without Git history', async t => {
  const { repository, output } = await fixture(t);
  const result = await snapshotDocs({ repository, output, ref: 'v1.2.3' });
  const bytes = await readFile(join(output, result.entry.file));
  await rm(join(repository, '.git'), { recursive: true, force: true });
  assert.equal((await checkArchives(output)).bundles.length, 1);
  assert.throws(() => decodeBundle(bytes.subarray(0, 40), result.entry), /hash mismatch/);
  assert.throws(() => decodeBundle(bytes.subarray(0, 40)), /Cannot decode/);
  assert.throws(() => decodeBundle(bytes, { ...result.entry, commit: 'a'.repeat(40) }), /provenance does not match/);
  await writeFile(join(output, result.entry.file), bytes.subarray(0, 40));
  await assert.rejects(checkArchives(output), /hash mismatch/);
});

test('rejects path traversal, duplicate versions/components/guides and unlisted archives', async t => {
  const { repository, output } = await fixture(t);
  const { bundle, entry } = await snapshotDocs({ repository, output, ref: 'v1.2.3' });
  for (const version of ['../escape', '/absolute', '1.2.3/other', '1.2', '01.2.3', '']) assert.throws(() => assertVersion(version), /Invalid documentation version/);
  assert.throws(() => validateManifest({ schemaVersion: 1, versions: [{ ...entry, file: '../escape.json.gz' }] }), /Invalid archive path/);
  assert.throws(() => validateManifest({ schemaVersion: 1, versions: [entry, entry] }), /Duplicate documentation version/);
  assert.throws(() => validateBundle({ ...bundle, components: [bundle.components[0], bundle.components[0]] }), /Invalid archived component/);
  assert.throws(() => validateBundle({ ...bundle, guides: [bundle.guides[0], bundle.guides[0]] }), /Invalid archived guide/);
  await writeFile(join(output, 'unlisted.json.gz'), encodeBundle(bundle));
  await assert.rejects(checkArchives(output), /Unlisted documentation archive/);
});

test('fails clearly when a released manual or guide title is missing', async t => {
  const { repository } = await fixture(t);
  git(repository, 'rm', 'packages/core/src/components/md-button/readme.md');
  git(repository, 'commit', '-qm', 'Broken manual');
  git(repository, 'tag', '-f', 'v1.2.3');
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3' }), /Missing release source.*readme/);
  await write(repository, 'packages/core/src/components/md-button/readme.md', manual);
  await write(repository, guideRoot + 'frameworks/react.mdx', 'No frontmatter title');
  git(repository, 'add', '.');
  git(repository, 'commit', '-qm', 'Broken guide');
  git(repository, 'tag', '-f', 'v1.2.3');
  await assert.rejects(createSnapshot({ repository, ref: 'v1.2.3' }), /Missing guide title/);
});

test('CLI --check verifies portable output and validates options', async t => {
  const { repository, output } = await fixture(t);
  await snapshotDocs({ repository, output, ref: 'v1.2.3' });
  const script = new URL('./snapshot-docs.mjs', import.meta.url);
  const response = execFileSync(node, [script.pathname, '--check', '--output', output], { encoding: 'utf8' });
  assert.match(response, /Verified 1 immutable documentation archive/);
  for (const args of [[], ['--ref'], ['--version', '1.2.3'], ['--check', '--ref', 'v1.2.3'], ['--ref', 'v1.2.3', '--ref', 'v1.2.4']]) assert.throws(() => parseArguments(args));
  assert.equal(parseArguments(['--ref', 'v1.2.3']).ref, 'v1.2.3');
  assert.equal((await readManifest(output)).versions.length, 1);
});
