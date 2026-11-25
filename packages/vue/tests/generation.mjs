import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dependencies = process.env.AWC_DEPENDENCY_ROOT || root;
const req = createRequire(join(dependencies, 'packages/core/package.json'));
const { build } = req('esbuild');
const { vueOutputTarget } = req('@stencil/vue-output-target');
const out = await mkdtemp(join(tmpdir(), 'awc-vue-generation-'));
try {
  await build({ entryPoints: [join(root, 'packages/vue/stencil-output-target.ts')], outfile: join(out, 'target.mjs'), bundle: true, format: 'esm', platform: 'node' });
  const { withVueRuntime } = await import(pathToFileURL(join(out, 'target.mjs')));
  const files = new Map();
  const fs = { async writeFile(path, source) { await Promise.resolve(); files.set(path, source); } };
  const target = withVueRuntime(vueOutputTarget({
    componentCorePackage: '@awc-ui/core', proxiesFile: '../vue/lib/components.ts', includeImportCustomElements: true,
    customElementsDir: 'dist/components', componentModels: [{ elements: ['md-text-field'], targetAttr: 'value', event: 'mdInput' }],
  }));
  const config = { rootDir: join(dependencies, 'packages/core'), sys: { async copy() {}, glob() {} } };
  const context = {
    components: [
      { tagName: 'md-text-field', properties: [{ name: 'value', attribute: 'value' }], events: [{ name: 'mdInput' }] },
      { tagName: 'md-side-sheet', properties: [{ name: 'sheetAriaLabel', attribute: 'aria-label' }] },
      { tagName: 'md-multi-select', properties: [{ name: 'value' }, { name: 'options', attribute: 'options' }, { name: 'countFormatter' }] },
    ],
    createTimeSpan() { return { finish() {} }; },
  };
  for (let i = 0; i < 2; i++) {
    await target.generator(config, { fs }, context);
    const generated = files.get('../vue/lib/components.ts');
    assert.match(generated, /from '\.\/runtime\.js'/, 'actual upstream writes must use the hand-owned runtime');
    assert.doesNotMatch(generated, /vue-component-lib\/utils/);
    assert.match(generated, /'value', 'mdInput'/, 'model metadata survives generation');
    assert.match(generated, /'md-text-field', \{"value":"value"\}, defineMdTextField/);
    assert.match(generated, /'md-side-sheet', \{"sheetAriaLabel":"aria-label"\}, defineMdSideSheet/);
    assert.match(generated, /'md-multi-select', \{"value":\[null,"values"\],"options":\["options","json"\]\}, defineMdMultiSelect/);
  }
  console.log('Vue generation: actual upstream target preserves runtime and model metadata across repeated asynchronous writes.');
} finally { await rm(out, { recursive: true, force: true }); }
