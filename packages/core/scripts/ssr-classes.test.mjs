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
