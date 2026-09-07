import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildFrame } from './build.mjs';

test('the docs build is self-contained at a nested showcase URL and preserves sibling apps', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'frame-showcase-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const destination = join(temporary, 'showcase/frame/html');
  const sibling = join(temporary, 'showcase/design/html/index.html');
  await mkdir(join(temporary, 'showcase/design/html'), { recursive: true });
  await writeFile(sibling, 'Existing design showcase');
  await buildFrame(destination);

  const base = new URL('https://example.test/showcase/frame/html/');
  const html = await readFile(join(destination, 'index.html'), 'utf8');
  for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (asset.startsWith('#')) continue;
    const url = new URL(asset, base);
    assert.ok(url.pathname.startsWith(base.pathname), `Asset escaped its mount: ${asset}`);
    await access(join(temporary, url.pathname));
  }
  for (const file of ['app.js', 'player.js', 'model.js']) {
    const js = await readFile(join(destination, file), 'utf8');
    for (const [, dependency] of js.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.ok(dependency.startsWith('./'), `${file} has an unresolved package import`);
      await access(join(destination, dependency));
    }
  }
  assert.match(await readFile(join(destination, 'awc/md3.esm.js'), 'utf8'), /md-navigation-rail/);
  assert.equal(await readFile(sibling, 'utf8'), 'Existing design showcase');
  assert.equal(relative(temporary, destination), 'showcase/frame/html');
});
