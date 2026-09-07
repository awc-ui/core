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
const source = '<md-card variant="elevated"><span>Revenue</span></md-card>';
const rendered = await renderToString(`<div id="app">${source}</div>`, options);
const bundle = async (contents) => (await build({
  stdin: { contents, resolveDir: join(root, 'apps/example-sveltekit') },
  bundle: true, format: 'iife', write: false, platform: 'browser',
})).outputFiles[0].text;
const compiled = compile(source, { generate: 'dom', hydratable: true, css: 'external', name: 'Probe' }).js.code;
const framework = await bundle(`${compiled}\nwindow.mountProbe=()=>new Probe({target:document.getElementById('app'),hydrate:true});`);
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
    const lifecycle = createSvelteHydration();
    lifecycle.capture(window.document);
    window.eval(framework);
    window.mountProbe();
    const card = window.document.querySelector('md-card');
    assert.equal(card.getAttribute('s-id'), null, 'fixture must reproduce Svelte 4 stripping');
    if (preserve) lifecycle.restore();
    window.eval(components);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    return {
      slots: card.shadowRoot.querySelectorAll('slot').length,
      unclaimed: card.shadowRoot.querySelectorAll('[c-id]').length,
    };
  } finally {
    window.close();
  }
}

test('Svelte 4 loses adoption without preservation, then adopts with the helper', async () => {
  assert.deepEqual(await hydrate(false), { slots: 2, unclaimed: 1 });
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
