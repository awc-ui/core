import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentationUI, snippetProperties } from './documentation-ui.js';

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
  return { ui, root, state, doc, search, interactions: () => interactions };
}

test('same-component docs enrichment and platform switches retain open sections, method args and caret', t => {
  const { ui, root, state } = fixture(t);
  ui.renderUsage();
  root.querySelector('[data-usage-section="Methods"]').open = true;
  const input = root.querySelector('[data-method-name="setCustomValidity"]');
  input.value = '["Use a longer value"]'; input.focus(); input.setSelectionRange(2, 9);
  state.selected = { ...state.selected, dataTypes: [{ name: 'Value', body: 'string' }] };
  ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').open, true);
  assert.ok(root.querySelector('#usage-language-tabs'));
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
  const running = root.querySelector('[data-run-method="0"]').emit('mdClick');
  state.target = { outerHTML: '<md-text-field></md-text-field>' }; ui.renderUsage();
  complete('Old result'); await running;
  assert.equal(interactions(), 0);
  assert.equal(root.querySelector('#method-result-0').textContent, undefined);
});

test('examples retain inert recipe composition and edited slots across all code languages', async t => {
  const { ui, root, state } = fixture(t);
  state.selected = { ...state.selected, tag: 'md-button' };
  state.target.outerHTML = '<md-button class="hydrated runtime-only" tabindex="-1">Runtime mutated</md-button>';
  state.docSlotValues = { '': 'Current slot label' };
  ui.renderUsage();
  const web = root.querySelector('#usage-snippet').textContent;
  assert.doesNotMatch(web, /hydrated|runtime-only|Runtime mutated/);
  state.platform = 'android'; ui.renderUsage();
  await root.querySelector('#usage-language-tabs').emit('mdTabChange', { detail: { index: 6 } });
  assert.match(root.querySelector('#usage-snippet').textContent, /AWCComponent/);
  assert.match(root.querySelector('#usage-snippet').textContent, /Current slot label/);
  assert.doesNotMatch(root.querySelector('#usage-snippet').textContent, /hydrated|runtime-only|Runtime mutated/);
});

test('usage exposes seven AWC language tabs and keeps the chosen language when props or preview platform change', async t => {
  const { ui, root, state } = fixture(t);
  state.selected = { tag: 'md-button', properties: [{ name: 'variant', defaultValue: 'filled' }, { name: 'selected', defaultValue: false }, { name: 'disabled', defaultValue: false }], events: [], slots: [], methods: [] };
  state.props = { variant: 'filled', selected: false, disabled: false };
  ui.renderUsage();
  assert.equal(root.querySelectorAll('[data-snippet-language]').length, 7);
  assert.match(root.innerHTML, /<md-tabs id="usage-language-tabs"/);
  assert.match(root.innerHTML, /<md-button[^>]+id="copy-usage"/);
  assert.match(root.innerHTML, /class="api-reference"/);
  assert.doesNotMatch(root.querySelector('#usage-snippet').textContent, /"disabled"/);
  await root.querySelector('#usage-language-tabs').emit('mdTabChange', { detail: { index: 1 } });
  assert.match(root.querySelector('#usage-snippet').textContent, /@awc-ui\/react/);
  state.props.selected = true;
  ui.updateSnippet();
  assert.match(root.querySelector('#usage-snippet').textContent, /"selected": true/);
  state.platform = 'ios'; ui.renderUsage();
  assert.match(root.querySelector('#usage-snippet').textContent, /@awc-ui\/react/);
  assert.equal(root.querySelector('#usage-language-tabs').attributes['active-tab-index'], '1');
});

test('concise props retain explicit defaults, fixture values and changed structured values', () => {
  const state = {
    selected: { tag: 'md-button', properties: [{ name: 'variant', defaultValue: 'filled' }, { name: 'size', defaultValue: 'md' }, { name: 'disabled', defaultValue: false }, { name: 'selected', defaultValue: false }, { name: 'value', defaultValue: '' }, { name: 'payload', defaultValue: [1] }] },
    props: { variant: 'filled', size: 'md', disabled: false, selected: false, value: '', payload: [1], unknown: 'omit' },
    editedTag: 'md-button', editedProps: { selected: false },
  };
  assert.deepEqual(snippetProperties(state), { variant: 'filled', size: 'md', selected: false });
  state.props.payload = [2]; state.props.value = 'Changed';
  assert.deepEqual(snippetProperties(state), { variant: 'filled', size: 'md', selected: false, value: 'Changed', payload: [2] });
});

test('AWC field events edit slot examples and filter properties; browser input events do not duplicate actions', async t => {
  const { ui, root, state, search, doc } = fixture(t, { slots: [{ name: '' }], cssProperties: [{ name: '--md-color' }] });
  state.platform = 'ios';
  ui.renderUsage();
  assert.match(root.innerHTML, /<md-text-field[^>]+data-slot-index/);
  assert.match(root.innerHTML, /<md-text-field[^>]+data-css-index/);
  assert.match(root.innerHTML, /<md-text-field[^>]+data-method-args/);
  await root.querySelector('[data-slot-index="0"]').emit('mdInput', { detail: 'New label' });
  assert.equal(state.docSlotValues[''], 'New label');
  assert.match(root.querySelector('#usage-snippet').textContent, /New label/);
  await root.querySelector('[data-css-index="0"]').emit('mdInput', { detail: 'rebeccapurple' });
  assert.equal(state.docCssValues['--md-color'], 'rebeccapurple');
  const rows = [{ dataset: { search: 'label string' } }, { dataset: { search: 'disabled boolean' } }];
  const empty = {};
  doc.querySelectorAll = selector => selector === '#props-controls .prop-control' ? rows : [];
  const query = doc.querySelector; doc.querySelector = selector => selector === '#props-empty' ? empty : query(selector);
  search.value = 'disabled'; await search.emit('mdInput');
  assert.equal(rows[0].hidden, true); assert.equal(rows[1].hidden, false); assert.equal(empty.hidden, true);
});

test('method invocation recognizes iframe Elements by nodeType and ignores plain click', async t => {
  const { ui, root, state, interactions } = fixture(t);
  let calls = 0;
  state.target.setCustomValidity = () => { calls++; return { nodeType: 1, tagName: 'INPUT', circular: state.target }; };
  ui.renderUsage();
  await root.querySelector('[data-run-method="0"]').emit('click');
  assert.equal(calls, 0);
  await root.querySelector('[data-run-method="0"]').emit('mdClick');
  assert.equal(calls, 1); assert.equal(interactions(), 1);
  assert.equal(root.querySelector('#method-result-0').textContent, '<input>');
});

test('slot overrides use the target document and preserve unrelated named slots', t => {
  const { ui, state } = fixture(t);
  const removed = [], appended = [], properties = [];
  const text = { nodeType: 3, remove: () => removed.push('text') };
  const leading = { nodeType: 1, getAttribute: () => 'leading-icon', remove: () => removed.push('leading') };
  const created = [];
  state.target = { childNodes: [text, leading], ownerDocument: { createElement: name => { created.push(name); return {}; } }, append: node => appended.push(node), style: { setProperty: (...args) => properties.push(args), removeProperty: name => properties.push([name]) } };
  state.docSlotValues = { '': 'New default' }; state.docCssValues = { '--md-color': 'red' };
  ui.applyOverrides();
  assert.deepEqual(removed, ['text']); assert.deepEqual(created, ['span']);
  assert.equal(appended[0].textContent, 'New default');
  assert.deepEqual(properties, [['--md-color', 'red']]);
});
