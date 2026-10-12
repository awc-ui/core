import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentationUI } from './documentation-ui.js';

// Minimal DOM boundary for event/state tests; rendering and focus behavior are
// additionally checked in the real browser. No browser implementation dependency.
const decode = value => value.replace(/&(amp|quot|lt|gt|#39);/g, (_, entity) => ({ amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" })[entity]);
class ElementStub {
  constructor(attributes = {}) {
    this.attributes = attributes; this.dataset = {}; this.listeners = {}; this.nodes = [];
    this.id = attributes.id; this.value = attributes.value || ''; this.open = Object.hasOwn(attributes, 'open');
    this.disabled = Object.hasOwn(attributes, 'disabled'); this.hidden = false; this.isConnected = true;
    this.style = {}; this.offsetWidth = 300; this.offsetHeight = 120;
    for (const [name, value] of Object.entries(attributes)) if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  async emit(name, event = {}) { for (const listener of this.listeners[name] || []) await listener({ target: this, ...event }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() { return { left: 50, right: 70, top: 30 }; }
  matches(selector) { return selector === ':hover' ? false : selector.startsWith('#') ? this.id === selector.slice(1) : /^\[([\w-]+)\]$/.test(selector) && Object.hasOwn(this.attributes, selector.slice(1, -1)); }
  closest(selector) { return this.matches(selector) ? this : null; }
  contains(node) { return this.nodes.includes(node); }
  focus() { document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  querySelectorAll(selector) {
    const match = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    return this.nodes.filter(node => match ? Object.hasOwn(node.attributes, match[1]) && (match[2] === undefined || node.attributes[match[1]] === match[2]) : node.matches(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  set innerHTML(html) {
    this.html = html; this.nodes.forEach(node => { node.isConnected = false; });
    this.nodes = [...html.matchAll(/<([a-z-]+)\b([^>]*)>/gi)].map(([, , raw]) => {
      const attributes = Object.fromEntries([...raw.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, decode(value || '')]));
      return new ElementStub(attributes);
    });
  }
  get innerHTML() { return this.html || ''; }
}
function fixture(t, extra = {}) {
  const root = new ElementStub(), search = new ElementStub(), doc = new ElementStub();
  doc.activeElement = null; doc.body = { append() {} }; doc.createElement = name => {
    const element = new ElementStub();
    if (name === 'template') element.content = { querySelector: () => null };
    return element;
  };
  doc.querySelector = selector => selector === '#usage-docs' ? root : selector === '#props-search' ? search : root.querySelector(selector);
  doc.querySelectorAll = () => []; doc.getElementById = id => root.querySelector(`#${id}`);
  for (const [key, value] of Object.entries({ document: doc, window: new ElementStub(), Element: ElementStub, innerWidth: 1200, innerHeight: 800 })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  const component = { tag: 'md-text-field', properties: [], methods: [{ name: 'setCustomValidity', parameters: [{ name: 'message', type: 'string' }], returnType: 'inferred' }], ...extra };
  const state = { selected: component, platform: 'web', props: {}, target: { outerHTML: '<md-text-field></md-text-field>' } };
  let interactions = 0;
  const ui = createDocumentationUI({ getState: () => state, notify() {}, watchEvents() {}, afterInteraction() { interactions++; } });
  return { ui, root, state, doc, interactions: () => interactions };
}

test('same-component docs enrichment and platform switches retain open sections, method args and caret', t => {
  const { ui, root, state } = fixture(t);
  ui.renderUsage();
  root.querySelector('[data-usage-section="Methods"]').open = true;
  root.querySelector('[data-usage-section="Usage example"]').open = false;
  const input = root.querySelector('[data-method-name="setCustomValidity"]');
  input.value = '["Use a longer value"]'; input.focus(); input.setSelectionRange(2, 9);
  state.selected = { ...state.selected, dataTypes: [{ name: 'Value', body: 'string' }] };
  ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').open, true);
  assert.equal(root.querySelector('[data-usage-section="Usage example"]').open, false);
  assert.equal(document.activeElement.value, '["Use a longer value"]');
  assert.deepEqual([document.activeElement.selectionStart, document.activeElement.selectionEnd], [2, 9]);
  assert.doesNotMatch(root.innerHTML, /Returns <code>inferred/);
  state.platform = 'android'; ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').open, true);
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '["Use a longer value"]');
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').disabled, true);
  state.selected = { ...state.selected, tag: 'md-number-field' }; ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').open, false);
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '[]');
});

test('data/callback types have accessible help and escaped source content', async t => {
  const { ui, root, doc } = fixture(t, { dataTypes: [{ name: 'Data', body: '<img src=x onerror=evil()>', description: '<script>evil()</script>' }], callableProps: [{ name: 'format', body: '(value: string) => string' }] });
  ui.renderUsage();
  const buttons = root.querySelectorAll('[data-doc-info]');
  assert.ok(buttons.some(button => button.attributes['aria-label'] === 'About Data'));
  assert.ok(buttons.some(button => button.attributes['aria-label'] === 'About format'));
  assert.doesNotMatch(root.innerHTML, /<img|<script>/);
  assert.match(root.innerHTML, /&lt;img/);
  const help = buttons.find(button => button.attributes['aria-label'] === 'About Data');
  await doc.emit('focusin', { target: help });
  assert.equal(help.attributes['aria-describedby'], 'documentation-tooltip');
  await doc.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(help.attributes['aria-describedby'], undefined);
});

test('late async method results cannot synchronize a replacement preview', async t => {
  const { ui, root, state, interactions } = fixture(t);
  let complete;
  state.target.setCustomValidity = () => new Promise(resolve => { complete = resolve; });
  ui.renderUsage();
  const running = root.querySelector('[data-run-method="0"]').emit('click');
  state.target = { outerHTML: '<md-text-field></md-text-field>' }; ui.renderUsage();
  complete('Old result'); await running;
  assert.equal(interactions(), 0);
  assert.equal(root.querySelector('#method-result-0').textContent, undefined);
});

test('examples retain static recipe composition without live runtime markup or native text overrides', t => {
  const { ui, root, state } = fixture(t);
  state.selected = { ...state.selected, tag: 'md-button' };
  state.target.outerHTML = '<md-button class="hydrated runtime-only" tabindex="-1">Runtime mutated</md-button>';
  state.docSlotValues = { '': 'Web-only label' };
  ui.renderUsage();
  const web = root.querySelector('#usage-snippet').textContent;
  assert.doesNotMatch(web, /hydrated|runtime-only|Runtime mutated/);
  state.platform = 'android'; ui.renderUsage();
  assert.doesNotMatch(root.querySelector('#usage-snippet').textContent, /Web-only label/);
});
