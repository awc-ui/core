import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDocsRelease } from './check-docs-release.mjs';
import { PACKAGES } from './check-publish-auth.mjs';

const manifests = PACKAGES.map(name => ({ name, version: '1.0.0' }));
function metadata(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://registry.npmjs.org');
  const [name, version] = parsed.pathname.slice(1).split('/').map(decodeURIComponent);
  return { name, version };
}
const published = async url => Response.json(metadata(url));
const mustNotFetch = () => { assert.fail('must not fetch'); };

test('docs require matching public registry metadata for all eight packages', async () => {
  const seen = [];
  const result = await checkDocsRelease({ manifests, fetchImpl: async (url, init) => {
    seen.push(metadata(url).name);
    assert.deepEqual(init.headers, { accept: 'application/json' });
    assert(init.signal instanceof AbortSignal);
    return published(url);
  } });
  assert.deepEqual(seen, PACKAGES);
  assert.deepEqual(result, { version: '1.0.0', packages: PACKAGES });
});

test('default manifest loading reads all eight source package.json files', async t => {
  const repository = await mkdtemp(join(tmpdir(), 'awc-docs-release-'));
  t.after(() => rm(repository, { recursive: true, force: true }));
  for (const manifest of manifests) {
    const directory = join(repository, 'packages', manifest.name.slice('@awc-ui/'.length));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'package.json'), JSON.stringify(manifest));
  }
  assert.equal((await checkDocsRelease({ repository, fetchImpl: published })).version, '1.0.0');
});

test('one unpublished package blocks deployment', async () => {
  await assert.rejects(checkDocsRelease({ manifests, fetchImpl: async url =>
    metadata(url).name === '@awc-ui/mcp' ? new Response(null, { status: 404 }) : published(url),
  }), /Cannot verify published @awc-ui\/mcp@1\.0\.0: npm HTTP 404/);
});

for (const field of ['name', 'version']) {
  test('incorrect registry ' + field + ' blocks deployment', async () => {
    await assert.rejects(checkDocsRelease({ manifests, fetchImpl: async url =>
      Response.json({ ...metadata(url), [field]: 'incorrect' }),
    }), /npm metadata must identify/);
  });
}

test('missing or duplicate source packages fail before registry access', async () => {
  await assert.rejects(checkDocsRelease({ manifests: manifests.slice(1), fetchImpl: mustNotFetch }), /all eight/);
  await assert.rejects(checkDocsRelease({ manifests: [...manifests.slice(1), manifests[1]], fetchImpl: mustNotFetch }), /all eight/);
});

for (const [description, change] of [['inconsistent', { version: '1.0.1' }], ['private', { private: true }]]) {
  test(description + ' source package fails before registry access', async () => {
    await assert.rejects(checkDocsRelease({ manifests: manifests.map(item =>
      item.name === '@awc-ui/theme' ? { ...item, ...change } : item), fetchImpl: mustNotFetch,
    }), /Source package @awc-ui\/theme must be public and match @awc-ui\/core@1\.0\.0/);
  });
}

test('invalid source versions fail before registry access', async () => {
  for (const version of [undefined, 1, '', 'latest', '1.0', 'v1.0.0', '01.0.0', '1.0.0-01', '1.0.0-rc..1', '1.0.0\n']) {
    await assert.rejects(checkDocsRelease({ manifests: manifests.map(item => ({ ...item, version })), fetchImpl: mustNotFetch }),
      /Invalid source package version/);
  }
});

test('prerelease and build metadata versions require exact publication matches', async () => {
  for (const version of ['1.0.1-rc.1', '1.0.0+build.01', '1.0.1-rc.1+build.01']) {
    const result = await checkDocsRelease({ manifests: manifests.map(item => ({ ...item, version })), fetchImpl: published });
    assert.equal(result.version, version);
  }
});

test('registry network failures and malformed metadata block deployment', async () => {
  await assert.rejects(checkDocsRelease({ manifests, fetchImpl: async () => { throw new Error('Network unavailable'); } }),
    /Cannot verify published.*Network unavailable/);
  await assert.rejects(checkDocsRelease({ manifests, fetchImpl: async () => new Response('not json') }),
    /Cannot verify published/);
});

test('a stalled registry request times out and fails closed', async () => {
  await assert.rejects(checkDocsRelease({ manifests, timeoutMs: 5, fetchImpl: (_url, { signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(Response.json({})), 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    }),
  }), /Cannot verify published.*tim(e|ed)\s*out/i);
});
