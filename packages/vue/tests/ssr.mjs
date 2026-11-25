import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dependencies = process.env.AWC_DEPENDENCY_ROOT || root;
const req = createRequire(join(dependencies, 'packages/vue/package.json'));
const coreReq = createRequire(join(dependencies, 'packages/core/package.json'));
const { build } = coreReq('esbuild');
const { JSDOM } = coreReq('jsdom');
const { createSSRApp, h } = await import(req.resolve('vue'));
const { renderToString: renderVue } = await import(req.resolve('vue/server-renderer'));
const { renderToString: hydrate } = await import(pathToFileURL(join(dependencies, 'packages/core/hydrate/index.mjs')));
const out = await mkdtemp(join(tmpdir(), 'awc-vue-ssr-'));
try {
  await build({
    entryPoints: [join(root, 'packages/vue/lib/components.ts')], outfile: join(out, 'components.mjs'),
    bundle: true, format: 'esm', platform: 'node',
    plugins: [{ name: 'existing-workspace-dependencies', setup(b) {
      b.onResolve({ filter: /^(vue$|@awc-ui\/core)/ }, args => ({
        path: args.path === 'vue' ? req.resolve('vue') : join(dependencies, 'packages/core', args.path.slice('@awc-ui/core/'.length)),
        external: true,
      }));
    } }],
  });
  const { MdAutocomplete, MdCheckbox, MdMultiSelect, MdSideSheet, MdSlider, MdTab, MdTabs, MdTextField } =
    await import(pathToFileURL(join(out, 'components.mjs')));
  const firstValues = ['not-listed', 'disabled', 'available'];
  const secondValues = ['available', 'disabled'];
  const options = [
    { value: 'available', label: 'Available' },
    { value: 'disabled', label: 'Disabled choice', disabled: true },
  ];
  const app = createSSRApp({ render: () => h('main', [
    h(MdTabs, { activeTabIndex: 1 }, () => [h(MdTab, { label: 'Overview' }), h(MdTab, { label: 'Activity' })]),
    h(MdSlider, { range: true, valueStart: 10, valueEnd: 65 }),
    h(MdSideSheet, { sheetAriaLabel: 'Filters & sorting' }),
    h(MdTextField, { spellcheck: false, label: 'Details' }),
    h(MdCheckbox, { modelValue: true, error: true, errorText: 'Needs attention', 'onUpdate:modelValue': () => {} }),
    h(MdMultiSelect, { options, modelValue: firstValues, countFormatter: () => 'private function' }),
    h(MdAutocomplete, { multiple: true, options, modelValue: secondValues }),
  ]) });
  const html = await renderVue(app);
  assert.match(html, /active-tab-index="1"/);
  assert.match(html, /aria-label="Filters &amp; sorting"/);
  assert.match(html, /spellcheck="false"/);
  assert.doesNotMatch(html, /modelValue|countFormatter|private function|\[object Object\]/);
  const result = await hydrate(html, { fullDocument: false, serializeShadowRoot: 'declarative-shadow-dom' });
  assert.deepEqual(result.diagnostics.filter(item => item.level === 'error'), []);
  const { document } = new JSDOM(result.html).window;
  const shadow = tag => document.querySelector(`${tag} > template`).content;
  const selection = tag => JSON.parse(document.querySelector(tag).getAttribute('data-awc-initial-values'));
  assert.deepEqual([...document.querySelectorAll('md-tab')].map(tab => tab.getAttribute('aria-selected')), ['false', 'true']);
  assert.deepEqual([...shadow('md-slider').querySelectorAll('input')].map(input => input.getAttribute('aria-valuenow')), ['10', '65']);
  assert.equal(document.querySelector('md-checkbox').getAttribute('aria-checked'), 'true');
  assert.match(shadow('md-checkbox').textContent, /Needs attention/);
  assert.deepEqual(selection('md-multi-select'), firstValues);
  assert.deepEqual(selection('md-autocomplete'), secondValues);
  const chipLabels = tag => [...shadow(tag).querySelectorAll('md-chip')].map(chip =>
    chip.querySelector('template').content.querySelector('[part="label"]').textContent.trim());
  assert.deepEqual(chipLabels('md-multi-select'), ['Disabled choice', 'Available']);
  assert.deepEqual(chipLabels('md-autocomplete'), ['Available', 'Disabled choice']);
  console.log('Vue SSR: actual Stencil attribute aliases, scalar form state, and structured selections survived server rendering.');
} finally {
  await rm(out, { recursive: true, force: true });
}
