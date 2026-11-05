import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { createAIInstructionsUI } from './ai-instructions-ui.js';
import { renderCode } from './syntax-highlighting.js';

const directory = new URL('../../node_modules/.pnpm/', import.meta.url);
const stencil = (await readdir(directory)).filter(name => name.startsWith('@stencil+core@')).sort().at(-1);
const loaded = await import(new URL(`${stencil}/node_modules/@stencil/core/mock-doc/index.cjs`, directory));
const dom = loaded.default ?? loaded;

function fixture(t) {
  const document = dom.createDocument('<div id="ai-instructions-panel"></div>');
  // Mock-doc dispatches focus events but does not track document.activeElement.
  let focused;
  document.addEventListener('focus', event => { focused = event.target; });
  Object.defineProperty(document, 'activeElement', {
    get: () => focused && document.body.contains(focused) ? focused : document.body,
  });
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });
  const state = { selected: { tag: 'md-button' } }, requests = [], notices = [];
  t.mock.method(globalThis, 'fetch', url => new Promise((resolve, reject) => {
    requests.push({ url, reject, resolve(guide) { resolve({ ok: true, json: async () => guide }); } });
  }));
  const ui = createAIInstructionsUI({ getState: () => state, notify: message => notices.push(message) });
  return { document, panel: document.querySelector('#ai-instructions-panel'), state, requests, notices, ui };
}
const guide = (tag, markdown = `# ${tag}\n\nComponent instructions.`) => ({ filename: `${tag}.md`, markdown });

test('revisiting mounted instructions preserves code, focus and both scroll positions without fetching', async t => {
  const { ui, requests, document, panel } = fixture(t);
  const first = ui.load(), result = guide('md-button');
  requests[0].resolve(result);
  await first;
  const card = panel.querySelector('.ai-instructions-card'), code = panel.querySelector('.ai-instructions-code');
  await renderCode(code, result.markdown, 'markdown');
  const highlighted = code.firstChild, copy = panel.querySelector('#ai-copy');
  copy.focus();
  code.scrollTop = 120;
  panel.scrollTop = 45;
  panel.hidden = true;
  panel.hidden = false;
  await ui.load();
  assert.equal(requests.length, 1);
  assert.equal(panel.querySelector('.ai-instructions-card'), card);
  assert.equal(panel.querySelector('.ai-instructions-code'), code);
  assert.equal(code.firstChild, highlighted, 'Revisiting preserves the highlighted DOM and text selection');
  assert.equal(document.activeElement, copy);
  assert.equal(code.scrollTop, 120);
  assert.equal(panel.scrollTop, 45);
  assert.equal(panel.hasAttribute('aria-busy'), false);
});

test('same-component in-flight reentry shares one request and keeps its existing loading state', async t => {
  const { ui, panel, requests } = fixture(t);
  const first = ui.load(), loader = panel.firstElementChild;
  assert.equal(ui.load(), first);
  assert.equal(ui.load(true), first, 'Refresh during the same pending fetch does not start a competing request');
  assert.equal(requests.length, 1);
  assert.equal(panel.firstElementChild, loader);
  assert.equal(panel.getAttribute('aria-busy'), 'true');
  requests[0].resolve(guide('md-button'));
  await first;
  assert.ok(panel.querySelector('.ai-instructions-card'));
  assert.equal(panel.hasAttribute('aria-busy'), false);
});

test('explicit refresh retains mounted controls and code while updating the latest guide', async t => {
  const { ui, panel, requests, document } = fixture(t);
  const first = ui.load();
  requests[0].resolve(guide('md-button'));
  await first;
  const card = panel.querySelector('.ai-instructions-card'), code = panel.querySelector('.ai-instructions-code');
  const refresh = panel.querySelector('#ai-refresh');
  refresh.focus();
  code.scrollTop = 30;
  const update = ui.load(true);
  assert.equal(requests.length, 2);
  assert.equal(panel.querySelector('.ai-instructions-card'), card);
  assert.equal(panel.getAttribute('aria-busy'), 'true');
  assert.equal(ui.load(), update, 'A tab revisit joins the explicit refresh');
  requests[1].resolve({ filename: 'updated-button.md', markdown: '# Updated Button\n\nNew instructions.' });
  await update;
  assert.equal(panel.querySelector('.ai-instructions-card'), card);
  assert.equal(panel.querySelector('.ai-instructions-code'), code);
  assert.equal(code.textContent, '# Updated Button\n\nNew instructions.');
  assert.equal(panel.querySelector('.ai-instructions-toolbar strong').textContent, 'updated-button.md');
  assert.equal(code.scrollTop, 30);
  assert.equal(document.activeElement, refresh);
  assert.equal(panel.hasAttribute('aria-busy'), false);
});

test('stale results cannot replace another component or clear its busy state', async t => {
  const { ui, state, panel, requests } = fixture(t);
  const button = ui.load();
  state.selected.tag = 'md-chip';
  const chip = ui.load(), chipLoader = panel.firstElementChild;
  requests[0].resolve(guide('md-button'));
  await button;
  assert.equal(panel.firstElementChild, chipLoader);
  assert.equal(panel.getAttribute('aria-busy'), 'true');
  requests[1].resolve(guide('md-chip'));
  await chip;
  assert.equal(panel.querySelector('.ai-instructions-code').textContent, guide('md-chip').markdown);
  assert.equal(panel.hasAttribute('aria-busy'), false);
});

test('returning to a component during overlapping loads keeps the newest request authoritative', async t => {
  const { ui, state, panel, requests, notices } = fixture(t);
  const oldButton = ui.load();
  state.selected.tag = 'md-chip';
  const chip = ui.load();
  state.selected.tag = 'md-button';
  const newButton = ui.load();
  requests[2].resolve(guide('md-button', '# Current button instructions'));
  await newButton;
  const currentCard = panel.querySelector('.ai-instructions-card');
  requests[0].resolve(guide('md-button', '# Obsolete button instructions'));
  requests[1].reject(new Error('Obsolete chip failure'));
  await Promise.all([oldButton, chip]);
  assert.equal(panel.querySelector('.ai-instructions-card'), currentCard);
  assert.equal(panel.querySelector('.ai-instructions-code').textContent, '# Current button instructions');
  assert.deepEqual(notices, []);
});

test('refresh failure retains the last guide and a later refresh can retry', async t => {
  const { ui, panel, requests, notices } = fixture(t);
  const first = ui.load();
  requests[0].resolve(guide('md-button'));
  await first;
  const card = panel.querySelector('.ai-instructions-card');
  const refresh = ui.load(true);
  requests[1].reject(new Error('Report unavailable'));
  await refresh;
  assert.equal(panel.querySelector('.ai-instructions-card'), card);
  assert.equal(panel.querySelector('.ai-instructions-code').textContent, guide('md-button').markdown);
  assert.equal(panel.hasAttribute('aria-busy'), false);
  assert.deepEqual(notices, ['Report unavailable']);
  const retry = ui.load(true);
  requests[2].resolve(guide('md-button', '# Reloaded'));
  await retry;
  assert.equal(panel.querySelector('.ai-instructions-code').textContent, '# Reloaded');
});

test('switching back to a cached component renders directly without another request', async t => {
  const { ui, state, panel, requests } = fixture(t);
  const button = ui.load();
  requests[0].resolve(guide('md-button'));
  await button;
  state.selected.tag = 'md-chip';
  const chip = ui.load();
  requests[1].resolve(guide('md-chip'));
  await chip;
  state.selected.tag = 'md-button';
  const revisit = ui.load();
  assert.ok(panel.querySelector('.ai-instructions-card'), 'Cached content replaces the other component synchronously');
  assert.equal(panel.querySelector('.coverage-loading'), null);
  await revisit;
  assert.equal(requests.length, 2);
  assert.equal(panel.querySelector('.ai-instructions-code').textContent, guide('md-button').markdown);
  assert.equal(panel.hasAttribute('aria-busy'), false);
});
