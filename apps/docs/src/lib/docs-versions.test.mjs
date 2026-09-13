import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  archivePath, currentDocSlugs, loadDocsVersions, pageSlug, referenceMarkdown,
  renderReferenceMarkdown, rewriteArchiveLink, snapshotPages, versionDestination, versionSidebar,
} from './docs-versions.mjs';

const snapshot = {
  schemaVersion: 1, version: '1.0.0-beta.14', sourceRef: 'v1.0.0-beta.14', sourceCommit: 'a'.repeat(40),
  components: [{ tag: 'md-button', summary: 'A committed action', manual: '# md-button\nFrozen button text', api: { tagName: 'md-button' } }],
  guides: [{ slug: 'frameworks/react', title: 'React', source: 'apps/docs/src/content/docs/frameworks/react.mdx', text: '# React\nFrozen React text' }],
};
const release = { version: snapshot.version, commit: snapshot.sourceCommit, snapshot, pages: snapshotPages(snapshot) };

async function fixture(t, editManifest = () => {}, editSnapshot = () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'awc-docs-versions-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = structuredClone(snapshot);
  editSnapshot(data);
  const compressed = gzipSync(JSON.stringify(data));
  const entry = { version: snapshot.version, ref: snapshot.sourceRef, commit: snapshot.sourceCommit, sha256: createHash('sha256').update(compressed).digest('hex'), file: `${snapshot.version}.json.gz` };
  editManifest(entry);
  await writeFile(join(directory, `${snapshot.version}.json.gz`), compressed);
  await writeFile(join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, versions: [entry] }));
  return directory;
}

test('loads frozen manuals and APIs only after validating the manifest and compressed hash', async (t) => {
  const directory = await fixture(t);
  const [loaded] = await loadDocsVersions({ directory });
  assert.equal(loaded.snapshot.components[0].manual, snapshot.components[0].manual);
  assert.deepEqual(loaded.snapshot.components[0].api, snapshot.components[0].api);
  assert.deepEqual(loaded.pages.map((page) => page.slug), ['components/button', 'frameworks/react']);
});

test('rejects tampered data, path traversal, and mismatched snapshot identity', async (t) => {
  await assert.rejects(loadDocsVersions({ directory: await fixture(t, (entry) => { entry.sha256 = '0'.repeat(64); }) }), /checksum mismatch/);
  await assert.rejects(loadDocsVersions({ directory: await fixture(t, (entry) => { entry.file = '../outside.json.gz'; }) }), /Invalid docs version entry/);
  await assert.rejects(loadDocsVersions({ directory: await fixture(t, () => {}, (data) => { data.sourceCommit = 'b'.repeat(40); }) }), /Invalid docs snapshot/);
  await assert.rejects(loadDocsVersions({ directory: await fixture(t, () => {}, (data) => { data.guides[0].slug = '../escape'; }) }), /Invalid guide snapshot/);
});

test('switches versions on corresponding pages and falls back when a page is unavailable', () => {
  const current = new Set(['', 'components/button', 'frameworks/react']);
  assert.equal(versionDestination('/components/button/', release), '/versions/1.0.0-beta.14/components/button/');
  assert.equal(versionDestination('/versions/1.0.0-beta.13/frameworks/react/', release), '/versions/1.0.0-beta.14/frameworks/react/');
  assert.equal(versionDestination('/components/new-component/', release), '/versions/1.0.0-beta.14/');
  assert.equal(versionDestination('/versions/1.0.0-beta.14/frameworks/react/', null, current), '/frameworks/react/');
  assert.equal(versionDestination('/versions/1.0.0-beta.14/removed/', null, current), '/');
  assert.equal(pageSlug('/%invalid'), '');
  assert.throws(() => archivePath('../escape'), /Invalid documentation path/);
  assert.throws(() => archivePath(snapshot.version, '../../escape'), /Invalid documentation path/);
  const sidebar = versionSidebar(release);
  assert.equal(sidebar[1].items[0].link, '/versions/1.0.0-beta.14/frameworks/react/');
  assert.ok(!JSON.stringify(sidebar).includes('autogenerate'));
});

test('discovers existing current content routes without inventing counterparts', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'awc-current-docs-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'components'));
  await mkdir(join(directory, 'getting-started'));
  await writeFile(join(directory, 'index.mdx'), '# Home');
  await writeFile(join(directory, 'getting-started', 'index.mdx'), '# Getting started');
  await writeFile(join(directory, 'components', 'button.mdx'), '# Button');
  assert.deepEqual(await currentDocSlugs({ directory }), new Set(['', 'components/button', 'getting-started', 'llm']));
});

test('strips MDX imports and wrapper markers without losing code-fence imports', () => {
  const text = '---\ntitle: Example\n---\nimport {\n  Tabs, TabItem\n} from "example";\n<Tabs>\n<TabItem label="React">\n```tsx\nimport { MdButton } from "@awc-ui/react";\n<MdButton>Save</MdButton>\n```\n</TabItem>\n</Tabs>';
  const cleaned = referenceMarkdown(text);
  assert.ok(!cleaned.includes('title: Example'));
  assert.ok(!cleaned.includes('from "example"'));
  assert.ok(cleaned.includes('### React'));
  assert.ok(cleaned.includes('import { MdButton } from "@awc-ui/react";'));
  assert.ok(cleaned.includes('<MdButton>Save</MdButton>'));
});

test('renders tables, headings, and code safely without executing HTML or MDX', () => {
  const { html, headings } = renderReferenceMarkdown('# md-button\n\n## Usage\n\n| Prop | Value |\n| --- | --- |\n| disabled | false |\n\n```js\nimport x from "pkg";\n```\n\n<script>alert(1)</script>\n\n<Demo onClick={evil()} />\n\n[bad](javascript:alert)\n\n## Usage', release, release.pages[0]);
  assert.ok(!html.startsWith('<h1'));
  assert.ok(html.includes('<div class="archive-table"><table>'));
  assert.ok(html.includes('import x from &quot;pkg&quot;'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<Demo'));
  assert.ok(!html.includes('href="javascript:'));
  assert.deepEqual(headings.map(({ slug }) => slug), ['usage', 'usage-1']);
});

test('keeps known links in the same release and pins source-file references to its commit', () => {
  const page = release.pages[1];
  assert.equal(rewriteArchiveLink('/components/button/#props', release, page), '/versions/1.0.0-beta.14/components/button/#props');
  assert.equal(rewriteArchiveLink('../components/button.mdx', release, page), '/versions/1.0.0-beta.14/components/button/');
  assert.equal(rewriteArchiveLink('./react.mdx', release, page), '/versions/1.0.0-beta.14/frameworks/react/');
  assert.equal(rewriteArchiveLink('../missing.mdx', release, page), `https://github.com/awc-ui/core/blob/${snapshot.sourceCommit}/apps/docs/src/content/docs/missing.mdx`);
  assert.equal(rewriteArchiveLink('/guides/not-in-release/', release, page), '/versions/1.0.0-beta.14/');
  assert.equal(rewriteArchiveLink('https://example.com/docs', release, page), 'https://example.com/docs');
  assert.equal(rewriteArchiveLink('//untrusted.example', release, page), '#');
  assert.equal(rewriteArchiveLink('javascript:alert(1)', release, page), '#');
  assert.equal(rewriteArchiveLink('data:text/html,evil', release, page), '#');
});
