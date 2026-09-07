import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.AWC_DEPENDENCY_ROOT || fileURLToPath(new URL('../', import.meta.url));
const core = process.env.AWC_CORE_ROOT || join(root, 'packages/core');
const require = createRequire(join(root, 'packages/core/package.json'));
const { build } = require('esbuild');
const { JSDOM } = require('jsdom');

for (const entry of ['components', 'components-csr']) {
  test(`side-effect import registers one component from ${entry} after bundling`, async () => {
    const result = await build({
      stdin: { contents: `import '@awc-ui/core/${entry}/md-button';`, resolveDir: core },
      bundle: true, write: false, format: 'iife', platform: 'browser', minify: true,
      logLevel: 'silent',
    });
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', url: 'https://example.test/' });
    try {
      dom.window.eval(result.outputFiles[0].text);
      assert.equal(typeof dom.window.customElements.get('md-button'), 'function', 'bundling must retain automatic custom element registration');
      assert.equal(dom.window.customElements.get('md-table'), undefined, 'one component import must not register the entire catalog');
    } finally { dom.window.close(); }
  });
}

test('React named imports retain only the selected wrapper component', async () => {
  const result = await build({
    stdin: { contents: `export { MdButton } from '${join(root, 'packages/react/dist/index.js')}';`, resolveDir: root },
    alias: { '@awc-ui/core': core },
    bundle: true, write: false, format: 'esm', platform: 'browser', minify: true, metafile: true,
    external: ['react', 'react-dom', 'react/jsx-runtime'], logLevel: 'silent',
  });
  const retained = Object.entries(Object.values(result.metafile.outputs)[0].inputs)
    .filter(([path, info]) => /\/md-[\w-]+\.js$/.test(path) && info.bytesInOutput > 0)
    .map(([path]) => path.split('/').at(-1));
  assert.deepEqual(retained, ['md-button.js']);
});
