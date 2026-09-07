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
const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/' });
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'customElements', 'CustomEvent']) globalThis[key] = dom.window[key];
for (const tag of ['md-button', 'md-text-field', 'md-checkbox', 'md-switch', 'md-slider', 'md-multi-select', 'md-radio']) {
  customElements.define(tag, class extends HTMLElement { value = ''; checked = false; selected = false; });
}
const Vue = await import(req.resolve('vue'));
const { compileTemplate } = await import(req.resolve('vue/compiler-sfc'));
const out = await mkdtemp(join(tmpdir(), 'awc-vue-forms-'));
try {
  await build({ entryPoints: [join(root, 'packages/vue/lib/components.ts')], outfile: join(out, 'components.mjs'), bundle: true, format: 'esm', platform: 'node',
    plugins: [{ name: 'existing-workspace-dependencies', setup(b) {
      b.onResolve({ filter: /^(vue$|@awc-ui\/core)/ }, (args) => ({ path: args.path === 'vue' ? req.resolve('vue') : join(dependencies, 'packages/core', args.path.slice('@awc-ui/core/'.length)), external: true }));
    } }],
  });
  const components = await import(pathToFileURL(join(out, 'components.mjs')));
  const { createApp, h, nextTick, ref } = Vue;
  const model = ref('Alice'); let calls = 0;
  // Compile actual SFC event/v-model syntax rather than hand-authoring event props.
  const { code } = compileTemplate({ source: '<MdTextField v-model="model" @mdInput="onInput" />', filename: 'Form.vue', id: 'form' });
  const body = code.replace(/^import \{([^}]+)\} from "vue"/m, (_, imports) => 'const {' + imports.replaceAll(' as ', ': ') + '} = Vue;').replace('export function render', 'return function render');
  let app = createApp({ components: { MdTextField: components.MdTextField }, setup: () => ({ model, onInput(event) { calls++; assert.equal(model.value, 'Bob', 'v-model updates before the user handler'); assert.equal(event.detail, 'Bob'); } }), render: new Function('Vue', body)(Vue) });
  app.mount('#app'); let el = document.querySelector('md-text-field');
  assert.equal(el.value, 'Alice'); el.value = 'Bob'; el.dispatchEvent(new CustomEvent('mdInput', { detail: 'Bob', bubbles: true })); await nextTick();
  assert.equal(model.value, 'Bob'); assert.equal(calls, 1, 'camel-case custom event is delivered exactly once');
  model.value = 'Carol'; await nextTick(); assert.equal(el.value, 'Carol');
  app.unmount();
  let buttonCalls = 0;
  app = createApp({ render: () => h(components.MdButton, { onMdClick: () => buttonCalls++ }) });
  app.mount('#app'); document.querySelector('md-button').dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
  assert.equal(buttonCalls, 1, 'components without v-model also bridge custom events'); app.unmount();
  for (const [name, tag, prop, initial, changed] of [
    ['MdCheckbox', 'md-checkbox', 'checked', false, true], ['MdSwitch', 'md-switch', 'selected', false, true],
    ['MdSlider', 'md-slider', 'value', 0, 7], ['MdMultiSelect', 'md-multi-select', 'value', ['a'], ['b', 'c']],
  ]) {
    const value = ref(initial);
    app = createApp({ render: () => h(components[name], { modelValue: value.value, 'onUpdate:modelValue': (next) => value.value = next }) });
    app.mount('#app'); el = document.querySelector(tag); assert.deepEqual(el[prop], initial);
    el[prop] = changed; el.dispatchEvent(new CustomEvent('mdChange', { bubbles: true })); await nextTick(); assert.deepEqual(value.value, changed);
    value.value = initial; await nextTick(); assert.deepEqual(el[prop], initial); app.unmount();
  }
  const plan = ref('pro');
  app = createApp({ render: () => h('div', ['basic', 'pro'].map(value => h(components.MdRadio, { value, modelValue: plan.value, 'onUpdate:modelValue': value => plan.value = value }))) });
  app.mount('#app'); const radios = [...document.querySelectorAll('md-radio')];
  assert.deepEqual(radios.map(r => r.value), ['basic', 'pro']); assert.deepEqual(radios.map(r => r.checked), [false, true]);
  radios[0].checked = true; radios[0].dispatchEvent(new CustomEvent('mdChange', { bubbles: true })); await nextTick();
  assert.equal(plan.value, 'basic'); assert.deepEqual(radios.map(r => r.checked), [true, false]);
  plan.value = null; await nextTick(); assert.deepEqual(radios.map(r => r.checked), [false, false]);
  app.unmount();
  console.log('Vue forms: compiled SFC events, model ordering, text/boolean/numeric/array bindings and radio selection/reset passed.');
} finally { dom.window.close(); await rm(out, { recursive: true, force: true }); }
