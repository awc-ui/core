import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { preserveSsrClasses } from '../ssr/classes.mjs';
import { mergeSsrClasses } from '../ssr/classes-internal.mjs';
import { createSvelteHydration } from '../ssr/sveltekit.mjs';

const { JSDOM } = createRequire(import.meta.url)('jsdom');
function fixture(tag = 'md-card', state = 'outlined') {
  const dom = new JSDOM(`<!doctype html><style>${tag}:not(.hydrated){visibility:hidden}</style><${tag} s-id="1" class="old-app ${tag} ${tag}--${state} sc-${tag}-h sc-${tag} hydrated"></${tag}>`, { pretendToBeVisual: true });
  const element = dom.window.document.querySelector(tag);
  element.attachShadow({ mode: 'open' }).innerHTML = '<span>Server content</span>';
  return { dom, element, document: dom.window.document, flush: () => new Promise(resolve => dom.window.queueMicrotask(resolve)) };
}

function trackResources(f) {
  const NativeObserver = f.dom.window.MutationObserver;
  const stats = { created: 0, active: 0, inputListeners: 0, callbacks: 0 };
  f.dom.window.MutationObserver = class extends NativeObserver {
    watching = false;
    constructor(callback) {
      super(records => { stats.callbacks++; callback(records); });
      stats.created++;
    }
    observe(...args) {
      if (!this.watching) { this.watching = true; stats.active++; }
      return super.observe(...args);
    }
    disconnect() {
      if (this.watching) { this.watching = false; stats.active--; }
      return super.disconnect();
    }
  };
  for (const [method, delta] of [['addEventListener', 1], ['removeEventListener', -1]]) {
    const original = f.document[method].bind(f.document);
    f.document[method] = (type, ...args) => {
      if (['pointerdown', 'keydown', 'click'].includes(type)) stats.inputListeners += delta;
      return original(type, ...args);
    };
  }
  return stats;
}

test('framework class replacement preserves native DSD visibility and keeps the new application class', async () => {
  const f = fixture();
  try {
    const finish = preserveSsrClasses(f.document);
    f.element.className = 'new-app';
    await f.flush();
    assert.equal(f.dom.window.getComputedStyle(f.element).visibility, 'visible');
    assert(f.element.classList.contains('md-card--outlined'));
    assert(f.element.classList.contains('sc-md-card-h'));
    assert(f.element.classList.contains('new-app'));
    assert(!f.element.classList.contains('old-app'));
    finish();
  } finally { f.dom.window.close(); }
});

test('framework-first loading remains protected until the component adopts, then stops', async () => {
  const f = fixture();
  try {
    const finish = preserveSsrClasses(f.document);
    finish();
    f.element.className = 'new-app';
    await f.flush();
    assert(f.element.classList.contains('hydrated'));
    f.element.setAttribute('data-awc-motion-ready', '');
    await f.flush();
    f.element.className = 'after-adoption';
    await f.flush();
    assert.equal(f.element.className, 'after-adoption');
  } finally { f.dom.window.close(); }
});

test('runtime-first loading keeps classes during framework claim even after s-id was consumed', async () => {
  const f = fixture();
  try {
    f.element.removeAttribute('s-id');
    f.element.setAttribute('data-awc-motion-ready', '');
    const finish = preserveSsrClasses(f.document);
    f.element.className = 'new-app';
    await f.flush();
    assert(f.element.classList.contains('hydrated'));
    assert(f.element.classList.contains('md-card--outlined'));
    finish();
    f.element.classList.remove('md-card--outlined');
    await f.flush();
    assert(!f.element.classList.contains('md-card--outlined'));
  } finally { f.dom.window.close(); }
});

test('a real component state update during claim replaces the baseline rather than replaying selected state', async () => {
  const f = fixture('md-button', 'selected');
  try {
    const finish = preserveSsrClasses(f.document);
    f.element.classList.remove('md-button--selected');
    f.element.classList.add('md-button--outlined');
    await f.flush();
    assert(!f.element.classList.contains('md-button--selected'));
    f.element.className = 'new-app';
    await f.flush();
    assert(!f.element.classList.contains('md-button--selected'));
    assert(f.element.classList.contains('md-button--outlined'));
    finish();
  } finally { f.dom.window.close(); }
});

test('disconnected SSR hosts are released and cannot receive stale class repairs after reuse', async () => {
  const f = fixture();
  try {
    preserveSsrClasses(f.document);
    f.element.remove();
    await f.flush();
    f.element.className = 'reused';
    f.document.body.append(f.element);
    await f.flush();
    assert.equal(f.element.className, 'reused');
  } finally { f.dom.window.close(); }
});

test('unrendered custom elements and framework-owned class names are not promoted into hydrated content', () => {
  const f = fixture();
  try {
    const empty = f.document.createElement('md-card');
    empty.setAttribute('s-id', '2');
    empty.className = 'new-app';
    f.document.body.append(empty);
    preserveSsrClasses(f.document)();
    assert(!empty.classList.contains('hydrated'));
    mergeSsrClasses(empty, 'old-app md-other-widget md-card md-card--filled hydrated');
    assert(!empty.classList.contains('old-app'));
    assert(!empty.classList.contains('md-other-widget'));
    assert(empty.classList.contains('new-app'));
  } finally { f.dom.window.close(); }
  assert.doesNotThrow(() => preserveSsrClasses(undefined)());
});

test('Svelte restore merges reserved classes without discarding application changes or duplicating markers', async () => {
  const f = fixture();
  try {
    const marker = f.document.createComment('r.1');
    f.element.append(marker, 'Label');
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.document);
    f.element.className = 'new-app';
    lifecycle.restore();
    await f.flush();
    assert(f.element.classList.contains('new-app'));
    assert(!f.element.classList.contains('old-app'));
    assert(f.element.classList.contains('md-card--outlined'));
    assert.equal(f.element.firstChild, marker);
    assert.equal([...f.element.childNodes].filter(node => node.nodeType === 8).length, 1);
  } finally { f.dom.window.close(); }
});


test('Svelte restoration does not replay stale selected state after a component rendered during claim', async () => {
  const f = fixture('md-button', 'selected');
  try {
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.document);
    f.element.classList.remove('md-button--selected');
    f.element.classList.add('md-button--outlined');
    lifecycle.restore();
    await f.flush();
    assert(!f.element.classList.contains('md-button--selected'));
    assert(f.element.classList.contains('md-button--outlined'));
  } finally { f.dom.window.close(); }
});

test('Svelte restore does not replay consumed ownership annotations or removed props after runtime-first adoption', () => {
  const f = fixture('md-switch', 'selected');
  try {
    f.element.setAttribute('selected', '');
    f.element.setAttribute('s-attrs', '["md-switch md-switch--selected",[["aria-checked","true"]]]');
    const marker = f.document.createComment('r.1');
    f.element.append(marker, 'Label');
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.document);
    // Stencil's documented s-id attribute becomes its internal host identity
    // during adoption, before the readiness frame is published.
    f.element['s-id'] = '1';
    f.element.removeAttribute('s-id');
    f.element.removeAttribute('s-attrs');
    f.element.removeAttribute('selected');
    f.element.classList.remove('md-switch--selected');
    lifecycle.restore();
    assert.equal(f.element.hasAttribute('s-id'), false);
    assert.equal(f.element.hasAttribute('s-attrs'), false);
    assert.equal(f.element.hasAttribute('selected'), false);
    assert.equal(marker.parentNode, null);
    assert.equal(f.element.classList.contains('md-switch--selected'), false);
  } finally { f.dom.window.close(); }
});


test('same-task component state changes survive a subsequent wholesale framework class write', async () => {
  const f = fixture('md-button', 'selected');
  try {
    const finish = preserveSsrClasses(f.document);
    f.element.classList.remove('md-button--selected');
    f.element.classList.add('md-button--outlined');
    f.element.className = 'new-app';
    await f.flush();
    assert(!f.element.classList.contains('md-button--selected'));
    assert(f.element.classList.contains('md-button--outlined'));
    assert(f.element.classList.contains('new-app'));
    finish();
  } finally { f.dom.window.close(); }
});

test('finishing claim synchronously flushes the latest component state before repairing class replacement', () => {
  const f = fixture('md-button', 'selected');
  try {
    const finish = preserveSsrClasses(f.document);
    f.element.classList.remove('md-button--selected');
    f.element.className = 'new-app';
    finish();
    assert(!f.element.classList.contains('md-button--selected'));
    assert(f.element.classList.contains('hydrated'));
    assert(f.element.classList.contains('new-app'));
  } finally { f.dom.window.close(); }
});

test('Svelte synchronous restoration cannot replay a state superseded in the same task', () => {
  const f = fixture('md-button', 'selected');
  try {
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.document);
    f.element.classList.remove('md-button--selected');
    f.element.className = 'new-app';
    lifecycle.restore();
    assert(!f.element.classList.contains('md-button--selected'));
    assert(f.element.classList.contains('hydrated'));
    assert(f.element.classList.contains('new-app'));
  } finally { f.dom.window.close(); }
});


test('moving a connected host into another document releases the original observer', async () => {
  const f = fixture();
  const destination = new JSDOM('<!doctype html><body></body>');
  try {
    preserveSsrClasses(f.document);
    destination.window.document.body.append(destination.window.document.adoptNode(f.element));
    await f.flush();
    f.element.className = 'destination-app';
    await f.flush();
    assert.equal(f.element.className, 'destination-app');
  } finally { f.dom.window.close(); destination.window.close(); }
});

test('repeated Svelte capture has one handoff and no observer retaining the old snapshot', async () => {
  const f = fixture();
  try {
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.document);
    lifecycle.capture(f.document);
    f.element.className = 'new-app';
    lifecycle.restore();
    f.element.setAttribute('data-awc-motion-ready', '');
    await f.flush();
    f.element.className = 'after-adoption';
    await f.flush();
    assert.equal(f.element.className, 'after-adoption');
  } finally { f.dom.window.close(); }
});

test('Svelte captures annotations on the root element as well as its descendants', () => {
  const f = fixture();
  try {
    const marker = f.document.createComment('r.1');
    f.element.append(marker, 'Label');
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.element);
    assert.equal(marker.parentNode, null, 'The target host marker must not interfere with claim.');
    f.element.removeAttribute('s-id');
    lifecycle.restore();
    assert.equal(f.element.getAttribute('s-id'), '1');
    assert.equal(f.element.firstChild, marker);
  } finally { f.dom.window.close(); }
});

test('distinct and overlapping Svelte roots share one class observer and finish together', async () => {
  const f = fixture();
  try {
    const stats = trackResources(f);
    const second = f.element.cloneNode();
    second.setAttribute('s-id', '2');
    second.attachShadow({ mode: 'open' });
    f.document.body.append(second);
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.element);
    lifecycle.capture(f.element);
    lifecycle.capture(second);
    lifecycle.capture(f.document);
    assert.equal(stats.created, 1);
    assert.equal(stats.inputListeners, 3);
    f.element.className = 'first-app';
    second.className = 'second-app';
    await f.flush();
    assert(f.element.classList.contains('hydrated'));
    assert(second.classList.contains('hydrated'), 'The second root must be protected before restore.');
    lifecycle.restore();
    for (const element of [f.element, second]) element.setAttribute('data-awc-motion-ready', '');
    await f.flush();
    assert.equal(stats.active, 0);
    assert.equal(stats.inputListeners, 0);
    second.className = 'after-adoption';
    await f.flush();
    assert.equal(second.className, 'after-adoption');
  } finally { f.dom.window.close(); }
});

for (const nestedShadow of [false, true]) {
  test(`removing a partial root releases observers and input listeners (nested shadow=${nestedShadow})`, async () => {
    const f = fixture();
    try {
      const stats = trackResources(f);
      const container = f.document.createElement('div');
      f.document.body.append(container);
      let root = container;
      let removed = container;
      if (nestedShadow) {
        const outer = container.attachShadow({ mode: 'open' });
        const inner = f.document.createElement('div');
        outer.append(inner);
        root = inner.attachShadow({ mode: 'open' });
        removed = inner;
      }
      root.append(f.element);
      const finish = preserveSsrClasses(root);
      finish(); // Framework complete; Core's lazy entry has not arrived yet.
      assert.equal(stats.active, 1);
      removed.remove();
      await f.flush();
      assert.equal(stats.active, 0);
      assert.equal(stats.inputListeners, 0);
      f.element.className = 'reused';
      f.document.body.append(f.element);
      await f.flush();
      assert.equal(f.element.className, 'reused');
    } finally { f.dom.window.close(); }
  });
}

test('a later Svelte root remains protected after an earlier root unmounted', async () => {
  const f = fixture();
  try {
    const stats = trackResources(f);
    const lifecycle = createSvelteHydration();
    lifecycle.capture(f.element);
    f.element.remove();
    await f.flush();
    assert.equal(stats.active, 0);
    const replacement = f.document.createElement('md-card');
    replacement.className = 'md-card hydrated';
    replacement.setAttribute('s-id', '2');
    replacement.attachShadow({ mode: 'open' });
    f.document.body.append(replacement);
    lifecycle.capture(replacement);
    replacement.className = 'new-app';
    await f.flush();
    assert(replacement.classList.contains('hydrated'));
    lifecycle.restore();
    replacement.setAttribute('data-awc-motion-ready', '');
    await f.flush();
    assert.equal(stats.active, 0);
    assert.equal(stats.inputListeners, 0);
  } finally { f.dom.window.close(); }
});

test('a pending partial root moved into a shadow tree is released on its later removal', async () => {
  const f = fixture();
  try {
    const wrapper = f.document.createElement('div');
    f.document.body.append(wrapper);
    const destination = wrapper.attachShadow({ mode: 'open' });
    const stats = trackResources(f);
    const finish = preserveSsrClasses(f.element);
    finish();
    destination.append(f.element);
    await f.flush();
    assert.equal(stats.active, 1, 'Reparenting a connected pending host retains protection.');
    f.element.remove();
    await f.flush();
    assert.equal(stats.active, 0);
    assert.equal(stats.inputListeners, 0);
  } finally { f.dom.window.close(); }
});

test('partial-root protection does not observe unrelated class mutations', async () => {
  const f = fixture();
  try {
    const unrelated = f.document.createElement('div');
    f.document.body.append(unrelated);
    const stats = trackResources(f);
    const finish = preserveSsrClasses(f.element);
    for (let i = 0; i < 100; i++) unrelated.className = `unrelated-${i}`;
    await f.flush();
    assert.equal(stats.callbacks, 0);
    finish();
  } finally { f.dom.window.close(); }
});

test('input capture releases a target before handlers change state, including a later finish call', async () => {
  const f = fixture('md-button', 'selected');
  try {
    const stats = trackResources(f);
    const add = f.document.addEventListener.bind(f.document);
    let captureInput;
    f.document.addEventListener = (type, listener, ...args) => {
      if (type === 'pointerdown') captureInput = listener;
      return add(type, listener, ...args);
    };
    const finish = preserveSsrClasses(f.element);
    // Invoke the installed capture listener before the component handler. The
    // actual trusted-event path is also exercised by the Chromium startup gate.
    captureInput({ isTrusted: true, composedPath: () => [f.element, f.document.body, f.document] });
    f.element.className = 'after-input';
    await f.flush();
    assert.equal(stats.active, 0);
    assert.equal(stats.inputListeners, 0);
    assert.equal(f.element.className, 'after-input');
    finish();
    f.element.className = 'later-state';
    await f.flush();
    assert.equal(f.element.className, 'later-state');
  } finally { f.dom.window.close(); }
});
