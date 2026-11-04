import test from 'node:test';
import assert from 'node:assert/strict';
import { initializePreviewFrame } from './preview-frame.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture() {
  const definition = deferred(), hydration = deferred(), attributes = new Map(), events = [];
  const doc = { theme: null, querySelectorAll: () => [{ componentOnReady: () => hydration.promise }] };
  let load, selected = true, theme = 'dark';
  const frame = {
    style: {}, inert: false, isConnected: true, contentDocument: doc,
    contentWindow: { customElements: { whenDefined: tag => { events.push(`define:${tag}`); return definition.promise; } } },
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    addEventListener: (name, callback) => { assert.equal(name, 'load'); load = callback; },
  };
  initializePreviewFrame(frame, {
    tag: 'md-button', isCurrent: () => selected,
    onDocument: document => { document.theme = theme; events.push('theme'); },
    onReady: () => { events.push('mount'); },
    onError: error => { events.push(`error:${error.message}`); },
  });
  return {
    frame, doc, attributes, events, definition, hydration, load: () => load(),
    selectAnother: () => { selected = false; },
    changeTheme: value => { theme = value; if (events.includes('theme')) doc.theme = theme; },
  };
}

test('a pending frame is invisible and inert until the current theme and hydrated component are ready', async () => {
  const view = fixture();
  assert.equal(view.frame.style.visibility, 'hidden', 'hide before insertion/navigation can paint');
  assert.equal(view.frame.inert, true);
  assert.equal(view.attributes.get('aria-busy'), 'true');
  const loading = view.load();
  assert.equal(view.doc.theme, 'dark', 'theme precedes even slow custom-element registration');
  assert.deepEqual(view.events, ['theme', 'define:md-button']);
  view.definition.resolve();
  await Promise.resolve();
  assert.equal(view.frame.style.visibility, 'hidden', 'registration alone does not imply hydration');
  view.changeTheme('light');
  view.hydration.resolve();
  await loading;
  assert.equal(view.doc.theme, 'light', 'theme changes during hydration are preserved');
  assert.equal(view.frame.style.visibility, '');
  assert.equal(view.frame.inert, false);
  assert.equal(view.attributes.has('aria-busy'), false);
  assert.deepEqual(view.events, ['theme', 'define:md-button', 'mount']);
});

test('late loads cannot replace the active preview document', async () => {
  const view = fixture();
  view.selectAnother();
  await view.load();
  assert.deepEqual(view.events, []);
  assert.equal(view.frame.style.visibility, 'hidden');
  assert.equal(view.frame.inert, true);
});

test('changing selection during runtime loading does not mount or reveal the old component', async () => {
  const view = fixture(), loading = view.load();
  view.selectAnother();
  view.definition.resolve();
  await loading;
  assert.deepEqual(view.events, ['theme', 'define:md-button']);
  assert.equal(view.frame.style.visibility, 'hidden');
});

test('changing selection during hydration never reveals the stale frame', async () => {
  const view = fixture(), loading = view.load();
  view.definition.resolve();
  await Promise.resolve();
  view.selectAnother();
  view.hydration.resolve();
  await loading;
  assert.equal(view.frame.style.visibility, 'hidden');
  assert.equal(view.frame.inert, true);
});

test('detached or navigated frames cannot reveal a document after hydration', async () => {
  for (const replaceDocument of [false, true]) {
    const view = fixture(), loading = view.load();
    view.definition.resolve();
    await Promise.resolve();
    if (replaceDocument) view.frame.contentDocument = {};
    else view.frame.isConnected = false;
    view.hydration.resolve();
    await loading;
    assert.equal(view.frame.style.visibility, 'hidden');
    assert.equal(view.frame.inert, true);
  }
});

test('hydration failure stays hidden and reports an error only for the active preview', async () => {
  for (const stale of [false, true]) {
    const view = fixture(), loading = view.load();
    view.definition.resolve();
    await Promise.resolve();
    if (stale) view.selectAnother();
    view.hydration.reject(new Error('Component failed to hydrate'));
    await loading;
    assert.equal(view.frame.style.visibility, 'hidden');
    assert.equal(view.frame.inert, true);
    assert.equal(view.events.includes('error:Component failed to hydrate'), !stale);
  }
});
