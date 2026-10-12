import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentationUI, snippetProperties } from './documentation-ui.js';

// Minimal DOM boundary for event/state tests; rendering and focus behavior are
// additionally checked in the real browser. No browser implementation dependency.
const decode = value => value.replace(/&(amp|quot|lt|gt|#39);/g, (_, entity) => ({ amp: '&', quot: '"', lt: '<', gt: '>', '#39': "'" })[entity]);
class ElementStub {
  constructor(attributes = {}) {
    this.attributes = attributes; this.dataset = {}; this.listeners = {}; this.nodes = [];
    this.id = attributes.id; this.value = attributes.value || ''; this.open = Object.hasOwn(attributes, 'open'); this.expanded = Object.hasOwn(attributes, 'expanded');
    this.disabled = Object.hasOwn(attributes, 'disabled'); this.hidden = false; this.isConnected = true;
    this.style = {}; this.offsetWidth = 300; this.offsetHeight = 120;
    for (const [name, value] of Object.entries(attributes)) if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  removeEventListener(name, listener) { this.listeners[name] = (this.listeners[name] || []).filter(candidate => candidate !== listener); }
  async emit(name, event = {}) { for (const listener of this.listeners[name] || []) await listener({ target: this, ...event }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() { return { left: 50, right: 70, top: 30 }; }
  matches(selector) { return selector === ':hover' ? false : selector.startsWith('#') ? this.id === selector.slice(1) : /^\[([\w-]+)\]$/.test(selector) && Object.hasOwn(this.attributes, selector.slice(1, -1)); }
  closest(selector) { return this.matches(selector) ? this : null; }
  contains(node) { return this.nodes.includes(node); }
  focus() { document.activeElement = this; }
  async focusHeader() { this.focusHeaderCalls = (this.focusHeaderCalls || 0) + 1; document.activeElement = this; }
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
  const cssRoot = new ElementStub(), cssSection = new ElementStub(), cssCount = new ElementStub(), cssNote = new ElementStub();
  const surfaces = { '#usage-docs': root, '#props-search': search, '#css-controls': cssRoot, '#css-variables-section': cssSection, '#css-variables-count': cssCount, '#css-variables-note': cssNote };
  doc.activeElement = null; doc.body = { append() {} }; doc.createElement = name => {
    const element = new ElementStub();
    if (name === 'template') element.content = { querySelector: () => null };
    return element;
  };
  doc.querySelector = selector => surfaces[selector] || root.querySelector(selector) || cssRoot.querySelector(selector);
  doc.querySelectorAll = () => []; doc.getElementById = id => doc.querySelector(`#${id}`);
  for (const [key, value] of Object.entries({ document: doc, window: new ElementStub(), Element: ElementStub, innerWidth: 1200, innerHeight: 800 })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  const component = { tag: 'md-text-field', properties: [], methods: [{ name: 'setCustomValidity', parameters: [{ name: 'message', type: 'string' }], returnType: 'inferred' }], ...extra };
  const state = { selected: component, platform: 'web', props: {}, target: { outerHTML: '<md-text-field></md-text-field>' } };
  let interactions = 0;
  const ui = createDocumentationUI({ getState: () => state, notify() {}, watchEvents() {}, afterInteraction() { interactions++; } });
  return { ui, root, cssRoot, cssSection, cssCount, cssNote, state, doc, search, interactions: () => interactions };
}

test('same-component docs enrichment and platform switches retain open sections, method args and caret', t => {
  const { ui, root, state } = fixture(t);
  ui.renderUsage();
  root.querySelector('[data-usage-section="Methods"]').expanded = true;
  const input = root.querySelector('[data-method-name="setCustomValidity"]');
  input.value = '["Use a longer value"]'; input.focus(); input.setSelectionRange(2, 9);
  state.selected = { ...state.selected, dataTypes: [{ name: 'Value', body: 'string' }] };
  ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').expanded, true);
  assert.ok(root.querySelector('#usage-language-tabs'));
  assert.equal(document.activeElement.value, '["Use a longer value"]');
  assert.deepEqual([document.activeElement.selectionStart, document.activeElement.selectionEnd], [2, 9]);
  assert.doesNotMatch(root.innerHTML, /Returns <code>inferred/);
  state.platform = 'android'; ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').expanded, true);
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '["Use a longer value"]');
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').disabled, true);
  state.selected = { ...state.selected, tag: 'md-number-field' }; ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Methods"]').expanded, false);
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '[]');
});

test('API topics and payloads use AWC disclosures, retain independent expansion and restore header focus', t => {
  const { ui, root, state } = fixture(t, {
    events: [{ name: 'mdInput', detail: 'string' }, { name: 'mdChange', detail: '{ value: string }' }],
    slots: [{ name: '' }], cssParts: [{ name: 'input' }], dataTypes: [{ name: 'Payload', body: 'string' }],
  });
  ui.renderUsage();
  assert.equal(root.querySelectorAll('[data-usage-section]').length, 5);
  assert.equal(root.querySelectorAll('[data-usage-payload]').length, 2);
  assert.doesNotMatch(root.innerHTML, /<details\b|<summary\b|<button\b|<input\b/);
  assert.match(root.innerHTML, /<md-accordion-item[^>]+data-usage-section="Events"/);
  assert.match(root.innerHTML, /<md-accordion-item[^>]+data-usage-payload="mdInput"[^>]+content-max-height="300px"/);
  assert.match(root.innerHTML, /<md-button[^>]+class="usage-guide"/);
  root.querySelector('[data-usage-section="Events"]').expanded = true;
  root.querySelector('[data-usage-section="Slots"]').expanded = true;
  const payload = root.querySelector('[data-usage-payload="mdInput"]');
  payload.expanded = true;
  payload.focus();
  state.platform = 'ios';
  ui.renderUsage();
  assert.equal(root.querySelector('[data-usage-section="Events"]').expanded, true);
  assert.equal(root.querySelector('[data-usage-section="Slots"]').expanded, true);
  assert.equal(root.querySelector('[data-usage-payload="mdInput"]').expanded, true);
  assert.equal(root.querySelector('[data-usage-payload="mdChange"]').expanded, false);
  assert.equal(document.activeElement, root.querySelector('[data-usage-payload="mdInput"]'));
  assert.equal(document.activeElement.focusHeaderCalls, 1, 'Restores the actual AWC header through its public API');
  state.selected = { ...state.selected, tag: 'md-number-field' };
  ui.renderUsage();
  assert.ok(root.querySelectorAll('[data-usage-section]').every(item => !item.expanded));
  assert.ok(root.querySelectorAll('[data-usage-payload]').every(item => !item.expanded));
});

test('event details show readable source fields and examples before an optional escaped type definition', t => {
  const { ui, root, state } = fixture(t, {
    tag: 'md-button', methods: [], events: [{ name: 'mdClick', detail: 'ClickDetail', cancelable: true }, { name: 'mdOpen', detail: 'void' }],
    eventTypes: [{ name: 'ClickDetail', kind: 'interface', body: '/** <source> */\nselected: boolean;', fields: [
      { name: 'selected', type: 'boolean', description: 'Proposed **selected** state; cancellation prevents the change.', optional: false },
      { name: 'hint', type: 'string', description: '<script>untrusted()</script>', optional: true },
    ] }],
  });
  ui.renderUsage();
  assert.match(root.innerHTML, /class="payload-fields"/);
  assert.match(root.innerHTML, /<dt><code>selected<\/code>/);
  assert.match(root.innerHTML, /Proposed <strong>selected<\/strong> state; cancellation prevents the change/);
  assert.match(root.innerHTML, /payload-field-optional">Optional/);
  assert.match(root.innerHTML, /Read this event/);
  assert.match(root.innerHTML, /event\.preventDefault/);
  assert.match(root.innerHTML, /headline="Type definition"/);
  assert.equal(root.querySelector('[data-usage-payload="mdClick"]').expanded, false);
  assert.equal(root.querySelector('[data-usage-payload="mdOpen"]'), null);
  assert.match(root.innerHTML, /This event does not carry payload data/);
  assert.ok(root.innerHTML.indexOf('class="payload-fields"') < root.innerHTML.indexOf('headline="Type definition"'));
  assert.doesNotMatch(root.innerHTML, /<source>|<script>/);
  assert.match(root.innerHTML, /&lt;source&gt;/);
  state.platform = 'ios'; ui.renderUsage();
  assert.match(root.innerHTML, /Native callbacks use their adapter payload/);
  assert.match(root.innerHTML, /DOM event objects are not sent to the native renderer/);
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
  const tooltip = root.querySelector(`[data-doc-tooltip="${help.dataset.docInfo}"]`);
  assert.equal(tooltip.attributes.variant, 'rich');
  assert.equal(tooltip.attributes.position, 'left-start');
  assert.ok(Number(tooltip.attributes['hide-delay']) > 0, 'AWC owns a grace period to reach the rich popup');
  assert.match(root.innerHTML, /slot="subhead"/);
  assert.match(root.innerHTML, /slot="content" class="doc-tooltip-content" tabindex="0"/);
  assert.match(root.innerHTML, /slot="actions"[^>]*>Full guide<\/md-button>/);
  assert.equal(doc.listeners.focusin, undefined, 'Hover, focus, descriptions and Escape belong to md-tooltip');
  assert.equal(doc.listeners.keydown, undefined);
  assert.equal(help.attributes['aria-describedby'], undefined, 'No cross-shadow custom IDREF is added');
});

test('AWC rich tooltip lifecycle coordinates one popup and supports tap/outside dismissal', async t => {
  const { ui, root, doc } = fixture(t, { events: [{ name: 'mdInput', detail: 'string' }] });
  ui.renderUsage();
  const buttons = root.querySelectorAll('[data-doc-info]');
  const firstButton = buttons[0], secondButton = buttons[1];
  const first = root.querySelector(`[data-doc-tooltip="${firstButton.dataset.docInfo}"]`);
  const second = root.querySelector(`[data-doc-tooltip="${secondButton.dataset.docInfo}"]`);
  for (const [button, tooltip] of [[firstButton, first], [secondButton, second]]) {
    button.closest = selector => selector === '[data-doc-info]' ? button : selector === '[data-doc-tooltip]' ? tooltip : null;
    tooltip.contains = node => node === button || node === tooltip;
  }
  first.open = true; await doc.emit('mdOpen', { target: first });
  second.open = true; await doc.emit('mdOpen', { target: second });
  assert.equal(first.open, false); assert.equal(second.open, true);
  await doc.emit('mdClose', { target: first });
  await doc.emit('click', { target: secondButton });
  assert.equal(second.open, true, 'A click inside the native tooltip stays open');
  await doc.emit('click', { target: new ElementStub() });
  assert.equal(second.open, false);
  await doc.emit('mdClick', { target: firstButton });
  assert.equal(first.open, true, 'Tap reveals using the public open property');
  ui.beginRender();
  assert.equal(first.open, false, 'Replacing component properties dismisses the old popup');
});

test('rich help preserves property metadata, event flags, method parameters and return details', t => {
  const { ui } = fixture(t);
  const property = ui.infoButton('property', { name: 'variant', type: "'filled' | 'outlined'", default: "'filled'", attribute: 'variant', options: ['filled', 'outlined'], description: 'A **visual** choice.' });
  assert.match(property, /<strong>visual<\/strong>/);
  for (const value of ['Type', 'Default', 'Attribute', 'Values', 'filled', 'outlined']) assert.ok(property.includes(value));
  const event = ui.infoButton('event', { name: 'mdClick', description: 'Native action', cancelable: true, bubbles: true, composed: false, detail: 'ActionDetail' });
  assert.match(event, /cancelable: true · bubbles: true · composed: false/);
  const method = ui.infoButton('method', { name: 'setCustomValidity', parameters: [{ name: 'message', type: 'string', optional: true, description: 'Validation detail.' }], returnType: 'Promise<void>' });
  assert.match(method, /message\?: string/);
  assert.match(method, /Validation detail/);
  assert.match(method, /Returns <code>Promise&lt;void&gt;<\/code>/);
  assert.match(ui.infoButton('slot', { name: '', description: 'Child content' }), /Default slot/);
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
  const { ui, root, cssRoot, state, search, doc } = fixture(t, { slots: [{ name: '' }], cssProperties: [{ name: '--md-color' }] });
  state.platform = 'ios';
  ui.renderUsage();
  assert.match(root.innerHTML, /<md-text-field[^>]+data-slot-index/);
  assert.match(cssRoot.innerHTML, /<md-text-field[^>]+data-css-index/);
  assert.doesNotMatch(root.innerHTML, /data-css-index|data-usage-section="CSS variables"/);
  assert.match(root.innerHTML, /<md-text-field[^>]+data-method-args/);
  await root.querySelector('[data-slot-index="0"]').emit('mdInput', { detail: 'New label' });
  assert.equal(state.docSlotValues[''], 'New label');
  assert.match(root.querySelector('#usage-snippet').textContent, /New label/);
  await cssRoot.querySelector('[data-css-index="0"]').emit('mdInput', { detail: 'rebeccapurple' });
  assert.equal(state.docCssValues['--md-color'], 'rebeccapurple');
  const rows = [{ dataset: { search: 'label string' } }, { dataset: { search: 'disabled boolean' } }];
  const empty = {};
  doc.querySelectorAll = selector => selector === '#props-controls .prop-control' ? rows : [];
  const query = doc.querySelector; doc.querySelector = selector => selector === '#props-empty' ? empty : query(selector);
  search.value = 'disabled'; await search.emit('mdInput');
  assert.equal(rows[0].hidden, true); assert.equal(rows[1].hidden, false); assert.equal(empty.hidden, true);
});

test('sidebar CSS editing preserves focus, caret and expansion on refresh and resets for a new component', async t => {
  const { ui, cssRoot, cssSection, cssCount, cssNote, state, doc } = fixture(t, { cssProperties: [{ name: '--md-color', description: 'Accent color.' }] });
  state.platform = 'ios';
  ui.renderUsage();
  cssSection.expanded = true;
  const input = cssRoot.querySelector('[data-css-index="0"]');
  input.value = 'rebeccapurple'; input.focus(); input.setSelectionRange(2, 7);
  await input.emit('mdInput', { detail: input.value });
  ui.renderUsage();
  assert.equal(cssRoot.querySelector('[data-css-index="0"]'), input, 'Ordinary preview refresh keeps the mounted editor');
  assert.equal(cssSection.expanded, true);
  assert.equal(doc.activeElement, input);
  assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 7]);
  assert.equal(cssCount.textContent, '1');
  assert.match(cssRoot.innerHTML, /data-doc-tooltip|About --md-color/);
  state.selected = { ...state.selected, cssProperties: [{ name: '--md-color', description: 'Enriched description.' }] };
  ui.renderUsage();
  assert.notEqual(doc.activeElement, input, 'Metadata enrichment refreshes help content');
  assert.equal(doc.activeElement.value, 'rebeccapurple');
  assert.deepEqual([doc.activeElement.selectionStart, doc.activeElement.selectionEnd], [2, 7]);
  assert.equal(cssSection.expanded, true);
  state.platform = 'android'; ui.renderUsage();
  assert.equal(cssSection.expanded, true);
  assert.equal(doc.activeElement.value, 'rebeccapurple');
  state.selected = { ...state.selected, tag: 'md-button', cssProperties: [] }; state.docCssValues = {};
  ui.renderUsage();
  assert.equal(cssSection.expanded, false);
  assert.equal(cssRoot.querySelectorAll('[data-css-index]').length, 0);
  assert.equal(cssCount.textContent, '0');
  assert.equal(cssNote.textContent, 'No public CSS variables declared.');
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

test('rich help prefers vertical placement on mobile, updates mounted hosts on resize and disposes listeners', async t => {
  const { ui, root, doc, search } = fixture(t);
  const viewport = window;
  let width = 390;
  viewport.matchMedia = query => {
    assert.equal(query, '(max-width: 640px)');
    return { matches: width <= 640 };
  };
  doc.querySelectorAll = selector => root.querySelectorAll(selector);
  ui.renderUsage();
  const tooltip = root.querySelector('[data-doc-tooltip]');
  assert.equal(tooltip.attributes.position, 'bottom');
  tooltip.open = true;
  await doc.emit('mdOpen', { target: tooltip });

  width = 1200;
  await viewport.emit('resize');
  assert.equal(tooltip.position, 'left-start');
  assert.equal(tooltip.open, true, 'placement changes preserve the active help popup');
  width = 640;
  await viewport.emit('resize');
  assert.equal(tooltip.position, 'bottom', 'the breakpoint includes 640 CSS pixels');
  assert.ok(root.querySelectorAll('[data-doc-tooltip]').every(host => host.position === 'bottom'));
  assert.match(ui.infoButton('property', { name: 'value', type: 'string' }), /position="bottom"/);

  ui.dispose();
  assert.equal(tooltip.open, false);
  assert.equal(viewport.listeners.resize.length, 0);
  assert.ok(Object.values(doc.listeners).every(listeners => listeners.length === 0));
  assert.equal(search.listeners.mdInput.length, 0);
  width = 1200;
  await viewport.emit('resize');
  assert.equal(tooltip.position, 'bottom', 'disposed controllers do not update mounted hosts');
  ui.dispose(); // Cleanup is safe when repeated.
});
