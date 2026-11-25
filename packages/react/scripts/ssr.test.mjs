import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';
import React from 'react';
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import { MdAutocomplete, MdAvatar, MdBottomSheet, MdButton, MdCard, MdCheckbox, MdMultiSelect, MdOrganizationChart, MdSelect, MdTextField, MdTransferList } from '../dist/server.js';

const requireCore = createRequire(new URL('../../core/package.json', import.meta.url));
const { JSDOM } = requireCore('jsdom');

async function render(Component, props) {
  const html = renderToStaticMarkup(await Component(props));
  const document = new JSDOM(html).window.document;
  const host = document.body.firstElementChild;
  return { html, host, shadow: host.querySelector('template')?.content };
}

test('quoted, ampersand and angle-bracket props survive both SSR serialization passes', async () => {
  const text = 'Say "hello" & <goodbye> \'again\'';
  const { host, shadow } = await render(MdTextField, { label: text, value: text, title: text, 'data-description': text });
  assert.equal(host.getAttribute('label'), text);
  assert.equal(host.getAttribute('value'), text);
  assert.equal(host.getAttribute('title'), text);
  assert.equal(host.getAttribute('data-description'), text);
  assert.equal(shadow.querySelector('input').getAttribute('value'), text);
  assert.ok(shadow.textContent.includes(text));
});

test('quoted props cannot create markup, event attributes or sibling elements', async () => {
  const text = '"><img src=x onerror="globalThis.injected=true"><span title="';
  const { host, shadow } = await render(MdTextField, { label: text, value: text, title: text });
  assert.equal(host.getAttribute('title'), text);
  assert.equal(host.ownerDocument.querySelector('img'), null);
  assert.equal(shadow.querySelector('img'), null);
  assert.equal(host.getAttribute('onerror'), null);
  assert.equal(shadow.querySelector('input').getAttribute('value'), text);
});

test('style values are escaped once without changing the parsed CSS', async () => {
  const style = { fontFamily: '"A&B"', '--description': '"<quoted>"', '--scale': 1.5, '--brandColor': 'red' };
  const { host } = await render(MdButton, { style, children: 'Press' });
  assert.equal(host.style.fontFamily, '"A&B"');
  assert.equal(host.style.getPropertyValue('--description'), '"<quoted>"');
  assert.equal(host.style.getPropertyValue('--scale'), '1.5');
  assert.equal(host.style.getPropertyValue('--brandColor'), 'red');
  assert.equal(host.ownerDocument.querySelector('quoted'), null);
});

test('explicit false reaches default-true Core properties before SSR rendering', async () => {
  const avatar = await render(MdAvatar, { name: 'Alice', colorFromName: false });
  assert.equal(avatar.host.getAttribute('color-from-name'), 'false');
  assert.doesNotMatch(avatar.host.className, /md-avatar--palette-/);
  const button = await render(MdButton, { ripple: false, shapeMorph: false, children: 'Press' });
  assert.equal(button.shadow.querySelector('md-ripple'), null);
  assert.equal(button.host.classList.contains('md-button--shape-morph'), false);
  const sheet = await render(MdBottomSheet, { open: true, showDragHandle: false });
  assert.equal(sheet.host.classList.contains('md-bottom-sheet--no-drag-handle'), true);
});

test('native false, ARIA false, null and absent properties keep their own semantics', async () => {
  const { host } = await render(MdCheckbox, { disabled: false, checked: false, hidden: false,
    'aria-hidden': false, 'data-enabled': false, title: null, supportingText: undefined });
  assert.equal(host.hasAttribute('disabled'), false);
  assert.equal(host.classList.contains('md-checkbox--disabled'), false);
  assert.equal(host.getAttribute('aria-checked'), 'false');
  assert.equal(host.hasAttribute('hidden'), false);
  assert.equal(host.getAttribute('aria-hidden'), 'false');
  assert.equal(host.getAttribute('data-enabled'), 'false');
  assert.equal(host.hasAttribute('title'), false);
  assert.equal(host.hasAttribute('supporting-text'), false);
});

test('only supported structured props reach the browser as escaped JSON', async () => {
  const options = [{ value: 'a', label: 'Apple "<fruit>" & fresh' }];
  for (const [Component, attribute, array] of [
    [MdSelect, 'options', options],
    [MdMultiSelect, 'options', options],
    [MdAutocomplete, 'options', options],
    [MdOrganizationChart, 'nodes', [{ id: 'root', name: 'Root' }]],
    [MdTransferList, 'items', [{ value: 'a', label: 'A' }]],
  ]) {
    const { host } = await render(Component, { [attribute]: array });
    assert.deepEqual(JSON.parse(host.getAttribute(attribute)), array);
    assert.equal(host.ownerDocument.querySelector('fruit'), null);
  }
  const multi = await render(MdMultiSelect, { options, value: ['a'], countFormatter: count => String(count) });
  assert.deepEqual(JSON.parse(multi.host.getAttribute('data-awc-initial-values')), ['a']);
  assert.equal(multi.host.hasAttribute('value'), false);
  assert.equal(multi.host.hasAttribute('count-formatter'), false);
  assert.equal(multi.shadow.querySelectorAll('md-chip').length, 1);
  const autocomplete = await render(MdAutocomplete, { options, value: [], multiple: true });
  assert.deepEqual(JSON.parse(autocomplete.host.getAttribute('data-awc-initial-values')), []);
});

test('concurrent server wrappers preserve the process console while resolving children', async () => {
  const original = console.error;
  let during, after;
  try {
    const renders = Promise.all([MdTextField({ label: 'A' }), MdButton({ children: 'B' })]);
    during = console.error;
    await renders;
    after = console.error;
  } finally {
    console.error = original;
  }
  assert.equal(during, original);
  assert.equal(after, original);
});

test('raw function and numeric props participate in the initial rendered state', async () => {
  const formatter = value => `[${value}]`;
  const { host, shadow } = await render(MdTextField, { value: '12', formatter, maxLength: 10 });
  assert.equal(shadow.querySelector('input').getAttribute('value'), '[12]');
  assert.equal(host.getAttribute('max-length'), '10');
  assert.equal(host.hasAttribute('formatter'), false);
});

test('server hydration receives unchanged object, array, function, false and null props', async () => {
  const { createComponent } = await import('../dist/ssr-runtime.js?property-contract');
  const properties = { data: [1, null, 3], options: { label: '"quoted"' }, formatter: value => `[${value}]`, active: false, disabled: false, value: null, count: 0 };
  let captured;
  const Component = createComponent({
    tagName: 'md-fixture', properties: Object.fromEntries(Object.keys(properties).map(key => [key, key])),
    hydrateModule: Promise.resolve({
      async renderToString(html, options) {
        const document = new JSDOM(html).window.document;
        await options.beforeHydrate(document);
        const host = document.querySelector('md-fixture');
        captured = Object.fromEntries(Object.keys(properties).map(key => [key, host[key]]));
        return { html: '<md-fixture>\n  <template shadowrootmode="open">\n    <span>Ready</span>\n  </template>\n</md-fixture>', styles: [] };
      },
    }),
  });
  await Component(properties);
  for (const key of Object.keys(properties)) assert.equal(captured[key], properties[key], key);
});

test('browser factory returns the original client wrapper with unchanged props', async () => {
  const { createComponent } = await import('../dist/ssr-runtime.js?client-contract');
  const props = { label: '"quoted" & original', active: false, data: [1, 2] };
  const client = passed => passed;
  globalThis.window = {};
  try {
    const wrapper = createComponent({ tagName:'md-fixture', properties:{}, clientModule:client });
    assert.equal(wrapper, client);
    assert.equal(wrapper(props), props);
  } finally {
    delete globalThis.window;
  }
});

test('nested async AWC wrappers and ordinary React children retain their contents', async () => {
  function Child() {
    const [label] = React.useState('React child "quoted" & complete');
    return React.createElement('span', null, label);
  }
  const tree = React.createElement(MdCard, null,
    React.createElement(MdButton, { title: 'Nested "button"' }, 'Press'),
    React.createElement(Child),
    React.createElement('em', null, 'Ordinary child'),
  );
  let html = '';
  await new Promise((resolve, reject) => {
    const sink = new Writable({ write(chunk, _encoding, callback) { html += chunk; callback(); } });
    sink.on('finish', resolve);
    const stream = renderToPipeableStream(tree, { onAllReady() { stream.pipe(sink); }, onError: reject });
  });
  const document = new JSDOM(html).window.document;
  const card = document.querySelector('md-card');
  assert.equal(card.querySelector('md-button').getAttribute('title'), 'Nested "button"');
  assert.equal(card.querySelector('span').textContent, 'React child "quoted" & complete');
  assert.equal(card.querySelector('em').textContent, 'Ordinary child');
  assert.ok(card.querySelector('md-button > template'));
});
