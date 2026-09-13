import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDocsRelease } from './check-docs-release.mjs';
import { PACKAGES } from './check-publish-auth.mjs';
import { encodeBundle, sha256 } from './lib/docs-versions.mjs';

const manifests = PACKAGES.map(name => ({ name, version: '1.0.0' }));
function metadata(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://registry.npmjs.org');
  const [name, version] = parsed.pathname.slice(1).split('/').map(decodeURIComponent);
  return { name, version };
}
const published = async url => Response.json(metadata(url));

async function fixture(t, { version = '1.0.0', hidden = false } = {}) {
  const repository = await mkdtemp(join(tmpdir(), 'awc-docs-release-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  const archiveDirectory = join(repository, 'apps/docs/versions');
  await mkdir(archiveDirectory, { recursive: true });
  const commit = 'a'.repeat(40);
  const bundle = {
    schemaVersion: 1, version, sourceRef: `v${version}`, sourceCommit: commit,
    components: [{ tag: 'md-button', summary: 'Button', manual: '# Button', api: { tagName: 'md-button', customElement: true } }],
    guides: [{ slug: 'getting-started/installation', title: 'Install', source: 'apps/docs/src/content/docs/getting-started/installation.mdx', text: '# Install' }],
  };
  const bytes = encodeBundle(bundle);
  const entry = { version, ref: `v${version}`, commit, file: `${version}.json.gz`, sha256: sha256(bytes), hidden };
  await writeFile(join(archiveDirectory, entry.file), bytes);
  await writeFile(join(archiveDirectory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, versions: [entry] }));
  return { repository, archiveDirectory, manifests, fetchImpl: published };
}

test('stable docs require matching public registry metadata for all eight packages', async t => {
  const options = await fixture(t);
  const seen = [];
  const result = await checkDocsRelease({ ...options, fetchImpl: async (url, init) => {
    seen.push(metadata(url).name);
    assert.deepEqual(init.headers, { accept: 'application/json' });
    assert(init.signal instanceof AbortSignal);
    return published(url);
  } });
  assert.deepEqual(seen, PACKAGES);
  assert.deepEqual(result, { version: '1.0.0', packages: PACKAGES });
});

test('default manifest loading reads all eight source package.json files', async t => {
  const options = await fixture(t);
  for (const manifest of manifests) {
    const directory = join(options.repository, 'packages', manifest.name.slice('@awc-ui/'.length));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
  }
  assert.equal((await checkDocsRelease({ ...options, manifests: undefined })).version, '1.0.0');
});

test('one unpublished package blocks deployment', async t => {
  const options = await fixture(t);
  await assert.rejects(checkDocsRelease({ ...options, fetchImpl: async url =>
    metadata(url).name === '@awc-ui/mcp' ? new Response(null, { status: 404 }) : published(url),
  }), /Cannot verify published @awc-ui\/mcp@1\.0\.0: npm HTTP 404/);
});

for (const field of ['name', 'version']) {
  test(`incorrect registry ${field} blocks deployment`, async t => {
    const options = await fixture(t);
    await assert.rejects(checkDocsRelease({ ...options, fetchImpl: async url =>
      Response.json({ ...metadata(url), [field]: 'incorrect' }),
    }), /npm metadata must identify/);
  });
}

test('missing or inconsistent source packages fail before registry access', async t => {
  const options = { ...await fixture(t), fetchImpl: () => { assert.fail('must not fetch'); } };
  await assert.rejects(checkDocsRelease({ ...options, manifests: manifests.slice(1) }), /all eight/);
  await assert.rejects(checkDocsRelease({ ...options, manifests: manifests.map(item =>
    item.name === '@awc-ui/theme' ? { ...item, version: '1.0.1' } : item),
  }), /Source package @awc-ui\/theme must.*1\.0\.0/);
});

for (const [description, archive] of [['absent', { version: '0.9.0' }], ['hidden', { hidden: true }]]) {
  test(`${description} current stable archive blocks deployment`, async t => {
    const options = await fixture(t, archive);
    await assert.rejects(checkDocsRelease({ ...options, fetchImpl: () => { assert.fail('must not fetch'); } }), /visible documentation archive for 1\.0\.0/);
  });
}

test('archive integrity is checked before deployment', async t => {
  const options = await fixture(t);
  await writeFile(join(options.archiveDirectory, '1.0.0.json.gz'), 'corrupt archive');
  await assert.rejects(checkDocsRelease(options), /Archive hash mismatch/);
});

test('a stalled registry request times out and fails closed', async t => {
  const options = await fixture(t);
  await assert.rejects(checkDocsRelease({ ...options, timeoutMs: 5, fetchImpl: (_url, { signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(Response.json({})), 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    }),
  }), /Cannot verify published.*tim(e|ed)\s*out/i);
});

test('prerelease source still requires all packages but no stable archive', async () => {
  const prerelease = manifests.map(item => ({ ...item, version: '1.0.1-rc.1' }));
  const result = await checkDocsRelease({ manifests: prerelease, archiveDirectory: '/does-not-exist', fetchImpl: published });
  assert.equal(result.version, '1.0.1-rc.1');
});
