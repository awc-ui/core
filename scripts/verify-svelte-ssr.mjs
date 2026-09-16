import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createPageTransform, createSvelteHydration } from '../packages/core/ssr/sveltekit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = createRequire(join(root, 'packages/core/package.json'));
const svelte = createRequire(join(root, 'apps/example-sveltekit/package.json'));
const { JSDOM } = core('jsdom');
const { build } = core('esbuild');
const { compile } = svelte('svelte/compiler');
const { renderToString } = core('./hydrate/index.js');
const options = { fullDocument: false, serializeShadowRoot: 'declarative-shadow-dom', removeScripts: false, removeHtmlComments: false };
const source = '<script>let count = 0;</script><md-card variant="elevated"><span>Revenue</span></md-card><button onclick={() => count += 1}>{count}</button>';
const bundle = async (contents, platform = 'browser', format = 'iife') => (await build({
  stdin: { contents, resolveDir: join(root, 'apps/example-sveltekit') },
  bundle: true, format, write: false, platform,
})).outputFiles[0].text;
// Svelte 5's server output supplies the hydration boundary markers. Feed that
// output through Stencil just as the SvelteKit server hook does in production.
const server = compile(source, { generate: 'server', css: 'external', name: 'Probe' }).js.code;
const serverBundle = await bundle(`${server}\nimport { render } from 'svelte/server';\nexport const html = render(Probe).body;`, 'node', 'esm');
const { html } = await import(`data:text/javascript;base64,${Buffer.from(serverBundle).toString('base64')}`);
const rendered = await renderToString(`<div id="app">${html}</div>`, options);
const compiled = compile(source, { generate: 'client', css: 'external', name: 'Probe' }).js.code;
const framework = await bundle(`${compiled}\nimport { hydrate, flushSync } from 'svelte';\nwindow.mountProbe=()=>{hydrate(Probe,{target:document.getElementById('app'),recover:false});flushSync();};\nwindow.flushProbe=flushSync;`);
const components = await bundle("import '@awc-ui/core/components/md-card';");

async function hydrate(preserve) {
  const dom = new JSDOM(`<!doctype html><html><body>${rendered.html}</body></html>`, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
  });
  const { window } = dom;
  try {
    // jsdom does not parse DSD; emulate only that parser operation. Framework
    // claiming and Stencil adoption below use their actual production runtimes.
    for (const template of window.document.querySelectorAll('template[shadowrootmode]')) {
      template.parentElement.attachShadow({ mode: 'open' }).append(template.content);
      template.remove();
    }
    const serverCard = window.document.querySelector('md-card');
    const serverShadow = serverCard.shadowRoot;
    const lifecycle = createSvelteHydration();
    lifecycle.capture(window.document);
    window.eval(framework);
    window.mountProbe();
    const card = window.document.querySelector('md-card');
    assert.equal(card, serverCard, 'Svelte must hydrate the existing custom-element host');
    assert.equal(card.shadowRoot, serverShadow, 'framework hydration must preserve server shadow DOM');
    if (preserve) lifecycle.restore();
    assert.ok(card.hasAttribute('s-id'), 'Stencil adoption needs the server host annotation');
    window.eval(components);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    assert.equal(card.shadowRoot, serverShadow, 'Stencil must adopt the existing shadow root');
    const button = window.document.querySelector('button');
    button.click();
    window.flushProbe();
    assert.equal(button.textContent, '1', 'the Svelte component must be interactive after hydration');
    return {
      slots: card.shadowRoot.querySelectorAll('slot').length,
      unclaimed: card.shadowRoot.querySelectorAll('[c-id]').length,
    };
  } finally {
    window.close();
  }
}

test('Svelte 5 hydrates and adopts server shadow DOM with and without the annotation helper', async () => {
  assert.deepEqual(await hydrate(false), { slots: 1, unclaimed: 0 });
  assert.deepEqual(await hydrate(true), { slots: 1, unclaimed: 0 });
});

test('restoration keeps application changes and forgets the initial snapshot', () => {
  const dom = new JSDOM('<md-card s-id="1" variant="elevated"></md-card>');
  try {
    const card = dom.window.document.querySelector('md-card');
    const lifecycle = createSvelteHydration();
    lifecycle.capture(dom.window.document);
    card.removeAttribute('s-id');
    card.setAttribute('variant', 'outlined');
    lifecycle.restore();
    assert.equal(card.getAttribute('s-id'), '1');
    assert.equal(card.getAttribute('variant'), 'outlined');
    card.removeAttribute('s-id');
    lifecycle.restore();
    assert.equal(card.getAttribute('s-id'), null);
  } finally {
    dom.window.close();
  }
});

test('HTML split inside a component reaches the renderer as one document', async () => {
  const chunks = ['<!doctype html><html><head></head><body><main><md-card>Split ', 'content</md-card></main></body></html>'];
  let calls = 0;
  const transform = createPageTransform(async (html) => {
    calls++;
    assert.equal(html, chunks.join(''));
    return (await renderToString(html, { ...options, fullDocument: true })).html;
  });
  assert.equal(await transform({ html: chunks[0], done: false }), '');
  const result = await transform({ html: chunks[1], done: true });
  assert.equal(calls, 1);
  const dom = new JSDOM(result);
  try {
    assert.equal(dom.window.document.querySelector('md-card').textContent, 'Split content');
    assert.equal(dom.window.document.querySelectorAll('md-card').length, 1);
    assert.match(result, /shadowrootmode="open"/);
  } finally {
    dom.window.close();
  }
});

test('separate requests keep their HTML buffers separate', async () => {
  const a = createPageTransform((html) => html);
  const b = createPageTransform((html) => html);
  await a({ html: 'a', done: false });
  await b({ html: 'b', done: false });
  assert.equal(await a({ html: '1', done: true }), 'a1');
  assert.equal(await b({ html: '2', done: true }), 'b2');
});
