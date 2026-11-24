import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { awcLazyRuntime, staticModuleImports } from './vite-awc-runtime.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const app = join(repo, 'apps/test-html');
const { build } = await import(createRequire(join(app, 'package.json')).resolve('vite'));

test('bootstrap discovery parses multiline and same-line static imports without eager dynamic chunks', async () => {
  assert.deepEqual(await staticModuleImports(`import './a.js'; import { b } from './b.mjs';
    export {\n c\n} from './c.js';
    import('./later.js'); const text = "import './fake.js'";`, 'loader.js'), ['./a.js', './b.mjs', './c.js']);
});

test('production runtime keeps native chunks, preloads bootstrap, and emits requested maps', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'awc-vite-runtime-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  for (const [name, base, sourcemap] of [
    ['absolute', '/preview/', false], ['relative', './', false], ['maps', '/', true],
  ]) {
    const outDir = join(scratch, name);
    await build({ root: app, configFile: false, base, logLevel: 'silent', plugins: [awcLazyRuntime()],
      build: { outDir, emptyOutDir: true, sourcemap } });
    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(match => match[1]);
    const bootstrap = preloads.filter(url => url.includes('awc-esm/'));
    assert.equal(new Set(bootstrap).size, bootstrap.length, 'No duplicated modulepreloads');
    assert(bootstrap.some(url => url.endsWith('/loader.js')), 'Loader starts with the document');
    assert(bootstrap.some(url => /\/index-[^/]+\.js$/.test(url)), 'Runtime dependency starts with the loader');
    assert(bootstrap.every(url => url.startsWith(base)), 'Preloads follow absolute and relative deployment bases');
    const originalNames = await readdir(join(repo, 'packages/core/dist/esm'));
    const emitted = await readdir(join(outDir, 'awc-esm'));
    assert.deepEqual(emitted.filter(file => file.endsWith('.js')).sort(), originalNames.filter(file => file.endsWith('.js')).sort(),
      'Every computed lazy-import target keeps its original filename');
    const button = emitted.find(name => /^md-button.*\.entry\.js$/.test(name));
    const before = await readFile(join(repo, 'packages/core/dist/esm', button), 'utf8');
    const after = await readFile(join(outDir, 'awc-esm', button), 'utf8');
    assert(after.length < before.length * 0.8, 'Runtime modules receive production minification');
    if (sourcemap) {
      const map = JSON.parse(await readFile(join(outDir, 'awc-esm', `${button}.map`), 'utf8'));
      assert.equal(map.sourcesContent.length, 1);
      assert(map.sourcesContent[0].includes('class '), 'Maps describe the original generated module');
      assert.match(after, /sourceMappingURL=.*\.map/);
    } else {
      assert(!emitted.some(name => name.endsWith('.map')), 'No unused copied source maps');
      assert.doesNotMatch(after, /sourceMappingURL=/);
    }
  }
});
