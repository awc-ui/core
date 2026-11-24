// Run against built Core custom elements with Puppeteer's Chrome installed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripLightDomAnnotations } from '../../../scripts/lib/html-comments.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const vueRequire = createRequire(new URL('../package.json', import.meta.url));
const core = new URL('../../core/', import.meta.url);
const coreRequire = createRequire(new URL('package.json', core));
const { build } = coreRequire('esbuild');
const puppeteer = coreRequire('puppeteer');
const { createSSRApp, h } = vueRequire('vue');
const { renderToString: renderVue } = vueRequire('vue/server-renderer');
const { renderToString: hydrate } = await import(new URL('hydrate/index.mjs', core));
const componentEntry = join(root, 'packages/vue/lib/components.ts');
const options = [
  { value: 'available', label: 'Available' },
  { value: 'disabled', label: 'Disabled choice', disabled: true },
];
const values = ['not-listed', 'disabled', 'available'];
const tags = ['md-tab', 'md-tabs', 'md-checkbox', 'md-multi-select', 'md-text-field'];
const enabled = { id: 'field', name: 'who', value: 'expected', disabled: false };
const disabled = { id: 'disabled-field', name: 'excluded', value: 'omit', disabled: true };
const checkbox = { id: 'checkbox', name: 'agree', value: 'yes', disabled: false };
const out = await mkdtemp(join(tmpdir(), 'awc-vue-ssr-browser-'));
let server;
let browser;

try {
  const serverWrappers = join(out, 'components.mjs');
  await build({
    entryPoints: [componentEntry], outfile: serverWrappers, bundle: true, format: 'esm', platform: 'node',
    plugins: [{ name: 'server-dependencies', setup(builder) {
      builder.onResolve({ filter: /^(vue$|@awc-ui\/core\/)/ }, ({ path }) => ({
        path: path === 'vue' ? vueRequire.resolve('vue') : fileURLToPath(new URL(path.slice('@awc-ui/core/'.length), core)),
        external: true,
      }));
    } }],
  });
  const { MdTabs, MdTab, MdCheckbox, MdMultiSelect, MdTextField } = await import(pathToFileURL(serverWrappers));
  const html = await renderVue(createSSRApp({ render: () => h('main', [
    h(MdTabs, { activeTabIndex: 1 }, () => [h(MdTab, { label: 'Overview' }), h(MdTab, { label: 'Activity' })]),
    h('form', { id: 'form' }, [
      h(MdCheckbox, { ...checkbox, modelValue: true }),
      h(MdTextField, enabled),
      h(MdTextField, disabled),
    ]),
    h(MdMultiSelect, { id: 'multi', options, modelValue: values }),
  ]) }));
  const rendered = await hydrate(html, { fullDocument: false, serializeShadowRoot: 'declarative-shadow-dom' });
  assert.deepEqual(rendered.diagnostics.filter(item => item.level === 'error'), []);
  const documentHtml = stripLightDomAnnotations(`<!doctype html><link rel="stylesheet" href="/dist/md3/md3.css"><div id="app">${rendered.html}</div>`);

  const { outputFiles } = await build({
    bundle: true, write: false, splitting: true, format: 'esm', platform: 'browser', outdir: out, entryNames: 'client',
    nodePaths: [join(root, 'packages/vue/node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
    stdin: { resolveDir: root, sourcefile: 'client.js', contents: `
      import { createSSRApp, h, ref } from 'vue';
      const enabled = ${JSON.stringify(enabled)};
      const disabled = ${JSON.stringify(disabled)};
      const checkbox = ${JSON.stringify(checkbox)};
      export async function mountWrappers() {
        const { MdTabs, MdTab, MdCheckbox, MdMultiSelect, MdTextField } = await import('./packages/vue/lib/components.ts');
        const checked = ref(true);
        const choices = ref(${JSON.stringify(values)});
        window.checkboxModel = checked;
        createSSRApp({ render: () => h('main', [
          h(MdTabs, { activeTabIndex: 1 }, () => [h(MdTab, { label: 'Overview' }), h(MdTab, { label: 'Activity' })]),
          h('form', { id: 'form' }, [
            h(MdCheckbox, { ...checkbox, modelValue: checked.value, 'onUpdate:modelValue': value => checked.value = value }),
            h(MdTextField, enabled),
            h(MdTextField, disabled),
          ]),
          h(MdMultiSelect, { id: 'multi', options: ${JSON.stringify(options)}, modelValue: choices.value }),
        ]) }).mount('#app');
      }
      export function mountRawElements() {
        const rawControl = ({ disabled, ...props }) => ({ ...props, '.disabled': disabled });
        createSSRApp({ render: () => h('main', [
          h('md-tabs', { 'active-tab-index': 1 }, [h('md-tab', { label: 'Overview' }), h('md-tab', { label: 'Activity' })]),
          h('form', { id: 'form' }, [
            h('md-checkbox', { ...rawControl(checkbox), checked: true }),
            h('md-text-field', rawControl(enabled)),
            h('md-text-field', rawControl(disabled)),
          ]),
          h('md-multi-select', { id: 'multi', '.value': [] }),
        ]) }).mount('#app');
      }
    ` },
    plugins: [{ name: 'built-browser-components', setup(builder) {
      builder.onResolve({ filter: /^@awc-ui\/core\/dist\/components\// }, ({ path }) => ({
        path: path.slice('@awc-ui/core'.length), external: true,
      }));
    } }],
  });

  const assets = new Map(outputFiles.map(file => [`/${basename(file.path)}`, file.contents]));
  const mime = { '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const send = (body, type) => response.writeHead(200, { 'Content-Type': type }).end(body);
    if (path === '/') {
      send(documentHtml, 'text/html');
    } else if (assets.has(path)) {
      send(assets.get(path), mime['.js']);
    } else if (/^\/(?:dist|ssr)\/(?:[\w-]+\/)*[\w.-]+$/.test(path) && mime[extname(path)]) {
      try {
        send(await readFile(new URL(`.${path}`, core)), mime[extname(path)]);
      } catch {
        response.writeHead(404).end();
      }
    } else {
      response.writeHead(path === '/favicon.ico' ? 204 : 404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await puppeteer.launch({
    headless: 'shell',
    args: ['--no-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH,
  });

  for (const frameworkFirst of [false, true]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(origin);
    assert.deepEqual(await page.evaluate(() => {
      const multi = document.querySelector('#multi');
      const nodes = [...document.querySelectorAll('main md-tabs, main md-tab, #checkbox, #multi, #field, #disabled-field')];
      window.ssrProbe = { nodes, shadows: nodes.map(node => node.shadowRoot), motions: [] };
      for (const root of window.ssrProbe.shadows) {
        root.addEventListener('animationstart', event => window.ssrProbe.motions.push(event.animationName), true);
        root.addEventListener('transitionrun', event => window.ssrProbe.motions.push(event.propertyName), true);
      }
      return {
        seed: JSON.parse(multi.getAttribute('data-awc-initial-values')),
        tabs: [...document.querySelectorAll('md-tab')].map(tab => tab.getAttribute('aria-selected')),
        visible: getComputedStyle(multi).visibility,
        hostDisabled: ['field', 'checkbox', 'disabled-field'].map(id => document.getElementById(id).hasAttribute('disabled')),
        inputDisabled: ['field', 'disabled-field'].map(id => document.getElementById(id).shadowRoot.querySelector('input').disabled),
      };
    }), { seed: values, tabs: ['false', 'true'], visible: 'visible',
      hostDisabled: [false, false, true], inputDisabled: [false, true] });

    const preUpgrade = await page.evaluate(async (frameworkFirst, tags) => {
      const { preserveSsrClasses } = await import('/ssr/classes.mjs');
      const finish = preserveSsrClasses();
      const { mountRawElements, mountWrappers } = await import('/client.js');
      let beforeDefinition;
      if (frameworkFirst) {
        mountRawElements();
        const multi = document.querySelector('#multi');
        beforeDefinition = {
          registered: customElements.get('md-multi-select') !== undefined,
          assigned: Object.hasOwn(multi, 'value'),
          value: Array.from(multi.value),
        };
      }
      await Promise.all(tags.map(tag => import(`/dist/components/${tag}.js`)));
      if (!frameworkFirst) await mountWrappers();
      finish();
      return beforeDefinition;
    }, frameworkFirst, tags);
    if (frameworkFirst) assert.deepEqual(preUpgrade, { registered: false, assigned: true, value: [] });
    await page.waitForFunction(() => window.ssrProbe.nodes.every(node => node.hasAttribute('data-awc-motion-ready')), { timeout: 7000 });
    assert.deepEqual(await page.$eval('#multi', multi => ({
      preserved: window.ssrProbe.nodes.every((node, index) =>
        node.isConnected && node.shadowRoot === window.ssrProbe.shadows[index]),
      value: Array.from(multi.value),
      seed: multi.hasAttribute('data-awc-initial-values'),
      motions: window.ssrProbe.motions,
    })), { preserved: true, value: frameworkFirst ? [] : values, seed: false, motions: [] });

    assert.deepEqual(await page.evaluate(() => ({
      hostDisabled: ['field', 'checkbox', 'disabled-field'].map(id => document.getElementById(id).matches(':disabled')),
      inputDisabled: ['field', 'disabled-field'].map(id => document.getElementById(id).shadowRoot.querySelector('input').disabled),
      formData: [...new FormData(document.getElementById('form'))],
    })), { hostDisabled: [false, false, true], inputDisabled: [false, true], formData: [['agree', 'yes'], ['who', 'expected']] });

    if (!frameworkFirst) {
      await page.$eval('#checkbox', checkbox => {
        window.trustedClick = false;
        checkbox.addEventListener('click', event => { window.trustedClick = event.isTrusted; }, { once: true });
      });
      await page.click('#checkbox');
      await page.waitForFunction(() => window.trustedClick && !window.checkboxModel.value &&
        document.querySelector('#checkbox').getAttribute('aria-checked') === 'false', { timeout: 5000 });
    }
    assert.deepEqual(errors, []);
    console.log(`Vue ${frameworkFirst ? 'framework-first' : 'runtime-first'} hydration preserved DSD and selection without startup motion.`);
    await page.close();
  }
} finally {
  await browser?.close();
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  await rm(out, { recursive: true, force: true });
}
