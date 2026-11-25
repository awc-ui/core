import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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

test('production runtime warms initial dependencies from the app, preserves bases and requested maps', async t => {
  const scratch = await mkdtemp(join(tmpdir(), 'awc-vite-runtime-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  for (const [name, base, sourcemap] of [
    ['absolute', '/preview/', false], ['relative', './', false], ['maps', '/', true],
  ]) {
    const outDir = join(scratch, name);
    await build({ root: app, configFile: false, base, logLevel: 'silent',
      plugins: [awcLazyRuntime({ initialEntries: ['md-loading-indicator.entry.js'] })],
      build: { outDir, emptyOutDir: true, sourcemap } });
    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(match => match[1]);
    const bootstrap = preloads.filter(url => url.includes('awc-esm/'));
    assert.equal(bootstrap.length, 0, 'Runtime must not compete with the app entry before first content');
    const entryUrl = html.match(/<script[^>]*src="([^"]+)"/)[1];
    const entry = await readFile(join(outDir, 'assets', basename(entryUrl)), 'utf8');
    assert.match(entry, /modulepreload/, 'App kickoff warms dependencies');
    assert.match(entry, /awc-esm\/loader\.js/, 'Loader is warmed');
    assert.match(entry, /awc-esm\/index-[^/]+\.js/, 'Runtime is warmed alongside the loader');
    assert.match(entry, /awc-esm\/md-loading-indicator\.entry\.js/, 'Initial nested spinner entry is warmed');
    assert.match(entry, /awc-esm\/md-loading-indicator-[^/]+\.js/, 'Spinner implementation avoids a second waterfall');
    const mount = base === './' ? '/arbitrary/nested/' : base;
    const scriptUrl = new URL(entryUrl, `https://example.test${mount}`);
    const assetUrls = [...entry.matchAll(/new URL\("([^\"]+)",import\.meta\.url\)/g)]
      .map(match => new URL(match[1], scriptUrl));
    assert(assetUrls.some(url => url.pathname === `${mount}awc-esm/loader.js`),
      'Loader resolves from the emitted script at the configured deployment base');
    assert(assetUrls.every(url => url.origin === scriptUrl.origin && url.pathname.startsWith(`${mount}awc-esm/`)),
      'Warmup assets resolve inside the same absolute or nested relative deployment');
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
