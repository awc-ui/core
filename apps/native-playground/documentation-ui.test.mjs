import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import { createDocumentationUI, snippetProperties } from './documentation-ui.js';
import { BUTTON_APPEARANCE_FIELDS } from './button-appearance.js';
import { componentAppearance } from './component-appearance.js';

// The generic CSS-property path needs a tag without a dedicated appearance module (tags gain modules as their Laboratory
// integration lands: md-card, md-chip, md-breadcrumb-item and the md-table family so far): the first such candidate.
const GENERIC_TAG = ['md-step', 'md-select-option', 'md-tab-panel'].find(tag => !componentAppearance(tag));
import { TEXT_FIELD_APPEARANCE_FIELDS } from './text-field-appearance.js';

// Minimal DOM boundary for event/state tests; rendering and focus behavior are
// additionally checked in the real browser. No browser implementation dependency.
const styleStub = () => ({ setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; }, getPropertyPriority() { return ''; } });
const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const jsdomPackage = packages.find(name => name.startsWith('jsdom@'));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${jsdomPackage}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
function fixture(t, extra = {}, callbacks = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="usage-docs"></div><div id="props-controls"></div><md-text-field id="props-search"></md-text-field><div id="css-controls"></div><section id="css-variables-section"></section><span id="css-variables-count"></span><p id="css-variables-note"></p><div id="button-appearance-controls"></div><md-tab id="css-variables-tab"></md-tab></body>');
  const { window } = dom, doc = window.document;
  Object.defineProperty(doc, 'activeElement', { value: null, writable: true, configurable: true });
  const events = window.EventTarget.prototype, add = events.addEventListener, remove = events.removeEventListener;
  events.addEventListener = function(name, listener, options) {
    (this.listeners ||= {}); (this.listeners[name] ||= []).push(listener);
    return add.call(this, name, listener, options);
  };
  events.removeEventListener = function(name, listener, options) {
    if (this.listeners?.[name]) this.listeners[name] = this.listeners[name].filter(item => item !== listener);
    return remove.call(this, name, listener, options);
  };
  events.emit = async function(name, event = {}) {
    for (const listener of [...(this.listeners?.[name] || [])]) await listener({ target: this, ...event });
  };
  const elements = window.HTMLElement.prototype;
  for (const key of ['value', 'open', 'expanded', 'disabled']) Object.defineProperty(elements, key, {
    configurable: true,
    get() { return this[`_${key}`] ?? (key === 'value' ? this.getAttribute(key) || '' : this.hasAttribute(key)); },
    set(value) { this[`_${key}`] = value; },
  });
  elements.focus = function() { doc.activeElement = this; };
  elements.focusHeader = async function() { this.focusHeaderCalls = (this.focusHeaderCalls || 0) + 1; this.focus(); };
  elements.focusTrigger = async function() { this.focusTriggerCalls = (this.focusTriggerCalls || 0) + 1; this.focus(); };
  elements.setSelectionRange = function(start, end) { this.selectionStart = start; this.selectionEnd = end; };
  for (const prototype of [window.Element.prototype, window.Document.prototype, window.DocumentFragment.prototype]) {
    const queryAll = prototype.querySelectorAll;
    prototype.querySelectorAll = function(selector) { return [...queryAll.call(this, selector)]; };
  }
  const root = doc.querySelector('#usage-docs'), propsRoot = doc.querySelector('#props-controls'), search = doc.querySelector('#props-search');
  const cssRoot = doc.querySelector('#css-controls'), cssSection = doc.querySelector('#css-variables-section'), cssCount = doc.querySelector('#css-variables-count'), cssNote = doc.querySelector('#css-variables-note');
  const appearanceRoot = doc.querySelector('#button-appearance-controls'), cssTab = doc.querySelector('#css-variables-tab');
  for (const [key, value] of Object.entries({ document: doc, window, Element: window.Element, innerWidth: 1200, innerHeight: 800 })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  t.after(() => dom.window.close());
  const component = { tag: 'md-text-field', properties: [], methods: [{ name: 'setCustomValidity', parameters: [{ name: 'message', type: 'string' }], returnType: 'inferred' }], ...extra };
  const state = { selected: component, platform: 'web', props: {}, target: { outerHTML: '<md-text-field></md-text-field>', style: styleStub() } };
  let interactions = 0, watched = 0;
  const contentChanges = [];
  const ui = createDocumentationUI({ getState: () => state, notify() {}, watchEvents() { watched++; }, afterInteraction() { interactions++; }, onContentChange: (...args) => contentChanges.push(args), ...callbacks });
  return { ui, root, propsRoot, cssRoot, cssSection, cssCount, cssNote, state, doc, search, appearanceRoot, cssTab, contentChanges, interactions: () => interactions, watched: () => watched };
}

test('Split default-slot control remains additive across Web and native property panels', async t => {
  const { ui, propsRoot, state, doc, contentChanges } = fixture(t, { tag: 'md-split-button', slots: [{ name: '' }] });
  state.props = { label: 'Create project' };
  state.target = doc.createElement('md-split-button');
  state.target.label = state.props.label;
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform;
    propsRoot.innerHTML = ui.textControl(); ui.bindTextControl();
    assert.match(propsRoot.textContent, /Default slot/);
    assert.match(propsRoot.textContent, /label property stays unchanged/);
    const input = propsRoot.querySelector('#component-text');
    for (const value of [' extra', '', ' \n']) {
      await input.emit('mdInput', { detail: value });
      assert.equal(state.docSlotValues[''], value);
      assert.equal(state.props.label, 'Create project');
      assert.equal(state.target.label, 'Create project');
      assert.equal(contentChanges.at(-1)[1], value);
      if (platform === 'web') assert.equal(state.target.textContent, value);
    }
  }
});

test('Text editor shares default-slot state with usage, preserves empty labels, and resets to the fixture', async t => {
  const { ui, root, propsRoot, state, contentChanges } = fixture(t, { tag: 'md-button', slots: [{ name: '' }] });
  state.platform = 'ios';
  propsRoot.innerHTML = ui.textControl(); ui.bindTextControl(); ui.renderUsage();
  assert.match(propsRoot.innerHTML, /<md-text-field[^>]+aria-label="Text"/);
  const input = propsRoot.querySelector('#component-text');
  assert.equal(input.value, 'Continue');
  assert.equal(root.querySelector('[data-slot-index="0"]').value, 'Continue');
  await input.emit('mdInput', { detail: 'Salvează <draft> & "preview"' });
  assert.equal(state.docSlotValues[''], 'Salvează <draft> & "preview"');
  assert.equal(root.querySelector('[data-slot-index="0"]').value, state.docSlotValues['']);
  assert.match(root.querySelector('#usage-snippet').textContent, /Salvează &lt;draft&gt; &amp; &quot;preview&quot;/);
  assert.deepEqual(contentChanges, [['', state.docSlotValues['']]]);
  await root.querySelector('[data-slot-index="0"]').emit('mdInput', { detail: '' });
  assert.equal(input.value, '');
  assert.equal(state.docSlotValues[''], '');
  state.platform = 'android'; ui.renderUsage(); propsRoot.innerHTML = ui.textControl();
  assert.equal(propsRoot.querySelector('#component-text').value, '');
  assert.doesNotMatch(root.querySelector('#usage-snippet').textContent, /Continue/);
  state.docSlotValues = {}; propsRoot.innerHTML = ui.textControl(); ui.renderUsage();
  assert.equal(propsRoot.querySelector('#component-text').value, 'Continue');
  assert.equal(root.querySelector('[data-slot-index="0"]').value, 'Continue');
  assert.deepEqual(state.props, {}, 'Text must not create a fake public property');
  state.selected = { tag: 'md-chip', properties: [{ name: 'label' }] };
  assert.equal(ui.textControl(), '', 'components with a label property keep their own editor');
});

test('Text input immediately applies safe plain content to the Web preview', async t => {
  const { ui, propsRoot, state } = fixture(t, { tag: 'md-button', slots: [{ name: '' }] });
  const appended = [], removed = [];
  state.target = { childNodes: [{ nodeType: 3, remove: () => removed.push('old text') }, { nodeType: 1, getAttribute: () => 'leading-icon', remove: () => removed.push('icon') }], append: node => appended.push(node), style: styleStub() };
  propsRoot.innerHTML = ui.textControl(); ui.bindTextControl();
  await propsRoot.querySelector('#component-text').emit('mdInput', { detail: '<img src=x>Save' });
  assert.deepEqual(removed, ['old text']);
  assert.equal(appended[0].textContent, '<img src=x>Save');
  assert.equal(appended[0].innerHTML, '&lt;img src=x&gt;Save');
});

test('same-component docs enrichment and platform switches retain method args and caret', t => {
  const { ui, root, state } = fixture(t);
  ui.renderUsage();
  const input = root.querySelector('[data-method-name="setCustomValidity"]');
  input.value = '["Use a longer value"]'; input.focus(); input.setSelectionRange(2, 9);
  state.selected = { ...state.selected, dataTypes: [{ name: 'Value', body: 'string' }] };
  ui.renderUsage();
  assert.ok(root.querySelector('#usage-language-tabs'));
  assert.equal(document.activeElement.value, '["Use a longer value"]');
  assert.deepEqual([document.activeElement.selectionStart, document.activeElement.selectionEnd], [2, 9]);
  assert.doesNotMatch(root.innerHTML, /Returns <code>inferred/);
  state.platform = 'android'; ui.renderUsage();
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '["Use a longer value"]');
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').disabled, true);
  state.selected = { ...state.selected, tag: 'md-number-field' }; ui.renderUsage();
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '["Please review this value."]');
});

test('API categories explain their purpose, open the first topic and retain independent help', async t => {
  const { ui, root, state, watched } = fixture(t, {
    events: [{ name: 'mdInput', detail: 'string' }, { name: 'mdChange', detail: '{ value: string }' }],
    slots: [{ name: '' }], cssParts: [{ name: 'input' }], dataTypes: [{ name: 'Payload', body: 'string' }],
  });
  ui.renderUsage();
  assert.equal(root.querySelectorAll('[data-usage-section]').length, 5);
  assert.equal(root.querySelectorAll('[data-usage-payload]').length, 2);
  assert.doesNotMatch(root.innerHTML, /<details\b|<summary\b|<button\b|<input\b/);
  const accordions = root.querySelectorAll('[data-usage-section]').filter(item => item.tagName === 'MD-ACCORDION-ITEM');
  assert.equal(accordions.length, 4);
  assert.deepEqual(accordions.map(item => item.dataset.usageSection), ['Events', 'Slots', 'Methods', 'CSS parts']);
  assert.deepEqual(accordions.filter(item => item.expanded).map(item => item.dataset.usageSection), ['Events']);
  assert.ok(accordions.every(item => item.getAttribute('heading-level') === '3'));
  assert.equal(root.querySelectorAll('[data-category-info]').length, 4);
  for (const title of ['Events', 'Slots', 'Methods', 'CSS parts']) {
    const tooltip = root.querySelector(`[data-category-info="${title}"]`);
    assert.equal(tooltip.getAttribute('variant'), 'rich');
    const button = root.querySelector(`[data-doc-info="${tooltip.dataset.docTooltip}"]`);
    assert.equal(button.getAttribute('aria-label'), `About ${title}`);
  }
  // Each tools container follows the item's closing tag: no nested interactive
  // triggers in its header button or hidden triggers in its collapsed panel.
  assert.equal([...root.innerHTML.matchAll(/<\/md-accordion-item><div class="usage-accordion-tools">/g)].length, 4);
  assert.equal(root.querySelectorAll('md-chip').length, 5);
  assert.ok(root.querySelectorAll('md-chip').every(chip => chip.hasAttribute('inert') && chip.getAttribute('aria-hidden') === 'true'));
  assert.match(root.innerHTML, /slot="headline" class="sr-only">Events, 2 declarations\. Handle interactions/);
  assert.match(root.innerHTML, /class="usage-accordion-label" aria-hidden="true">Events<\/span><md-tooltip[^>]+data-category-info="Events"/);
  assert.match(root.innerHTML, /<md-card[^>]+class="usage-code-card"[^>]+data-usage-payload="mdInput"/);
  assert.match(root.innerHTML, /class="usage-code-description"/);
  assert.doesNotMatch(root.innerHTML, /Full component guide|Full guide|slot="actions"/);
  await root.querySelector('#watch-usage-events').emit('mdClick');
  assert.equal(watched(), 1);
  root.querySelector('#usage-section-events').expanded = true;
  const code = root.querySelector('#usage-payload-0-code');
  assert.equal(code.getAttribute('tabindex'), '0');
  assert.equal(code.getAttribute('aria-labelledby'), 'usage-payload-0-title');
  code.focus();
  state.platform = 'ios';
  ui.renderUsage();
  assert.equal(document.activeElement, root.querySelector('#usage-payload-0-code'));
  assert.equal(root.querySelector('#usage-section-events').expanded, true);
  assert.doesNotMatch(root.innerHTML, /content-max-height/);
  const header = root.querySelector('#usage-section-events');
  await header.focusHeader(); ui.renderUsage();
  assert.equal(document.activeElement, root.querySelector('#usage-section-events'));
  assert.equal(document.activeElement.focusHeaderCalls, 1, 'Restore the real header button through its AWC API');
  state.selected = { ...state.selected, tag: 'md-number-field' };
  ui.renderUsage();
  assert.notEqual(document.activeElement, root.querySelector('#usage-payload-0-code'), 'Changing component does not move focus into new code');
  assert.equal(root.querySelector('#usage-section-events').expanded, true, 'New components show their first available topic');
});

test('event details show readable source fields and explained code cards with escaped type definitions', async t => {
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
  assert.match(root.innerHTML, /Handle mdClick/);
  assert.match(root.innerHTML, /event\.preventDefault/);
  assert.match(root.innerHTML, />Type definition<\/h4>/);
  assert.match(root.innerHTML, /The TypeScript contract for <code>mdClick<\/code> event detail/);
  assert.ok(root.querySelector('[data-usage-payload="mdClick"]'));
  assert.equal(root.querySelector('[data-usage-payload="mdOpen"]'), null);
  assert.match(root.innerHTML, /This event does not carry payload data/);
  assert.ok(root.innerHTML.indexOf('class="payload-fields"') < root.innerHTML.indexOf('>Type definition</h4>'));
  assert.doesNotMatch(root.innerHTML, /<source>|<script>/);
  assert.match(root.innerHTML, /&lt;source&gt;/);
  state.platform = 'ios'; ui.renderUsage();
  assert.match(root.innerHTML, /class="event-payload"/, 'Preview platform does not override the chosen documentation framework');
  await root.querySelector('#api-framework').emit('mdChange', { detail: { value: 'swift' } });
  assert.match(root.innerHTML, /data-api-framework="swift"/);
  assert.doesNotMatch(root.innerHTML, /class="event-payload"|data-usage-payload=/);
});

test('data/callback types have accessible help and escaped source content', async t => {
  const { ui, root, doc } = fixture(t, { dataTypes: [{ name: 'Data', body: '<img src=x onerror=evil()>', description: '<script>evil()</script>' }], callableProps: [{ name: 'format', body: '(value: string) => string' }] });
  ui.renderUsage();
  const buttons = root.querySelectorAll('[data-doc-info]');
  assert.ok(buttons.some(button => button.getAttribute('aria-label') === 'About Data'));
  assert.ok(buttons.some(button => button.getAttribute('aria-label') === 'About format'));
  assert.doesNotMatch(root.innerHTML, /<img|<script>/);
  assert.match(root.innerHTML, /&lt;img/);
  const help = buttons.find(button => button.getAttribute('aria-label') === 'About Data');
  const tooltip = root.querySelector(`[data-doc-tooltip="${help.dataset.docInfo}"]`);
  assert.equal(tooltip.getAttribute('variant'), 'rich');
  assert.equal(tooltip.getAttribute('position'), 'left-start');
  assert.ok(Number(tooltip.getAttribute('hide-delay')) > 0, 'AWC owns a grace period to reach the rich popup');
  assert.match(root.innerHTML, /slot="subhead"/);
  assert.match(root.innerHTML, /slot="content" class="doc-tooltip-content" tabindex="0"/);
  assert.doesNotMatch(root.innerHTML, /slot="actions"|Full guide/);
  assert.equal(doc.listeners.focusin, undefined, 'Hover, focus, descriptions and Escape belong to md-tooltip');
  assert.equal(doc.listeners.keydown, undefined);
  assert.equal(help.getAttribute('aria-describedby'), null, 'No cross-shadow custom IDREF is added');
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
  await doc.emit('click', { target: doc.createElement('div') });
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
  assert.equal(root.querySelector('#method-result-0').textContent, '');
});

test('examples retain inert recipe composition and edited slots across all code languages', async t => {
  const { ui, root, state } = fixture(t);
  state.selected = { ...state.selected, tag: 'md-button', slots: [{ name: '' }], support: { android: { status: 'adapter-implemented', slots: [''] } } };
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
  assert.equal(root.querySelector('#usage-language-tabs').getAttribute('active-tab-index'), '1');
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
  const { ui, root, cssRoot, state, search, doc } = fixture(t, { tag: 'md-button', slots: [{ name: '' }], cssProperties: [{ name: '--md-color' }] });
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
  const query = doc.querySelector.bind(doc); doc.querySelector = selector => selector === '#props-empty' ? empty : query(selector);
  search.value = 'disabled'; await search.emit('mdInput');
  assert.equal(rows[0].hidden, true); assert.equal(rows[1].hidden, false); assert.equal(empty.hidden, true);
});

test('sidebar CSS tab editing preserves focus and caret on refresh and resets for a new component', async t => {
  const { ui, cssRoot, cssCount, cssNote, state, doc } = fixture(t, { cssProperties: [{ name: '--md-color', description: 'Accent color.' }] });
  state.platform = 'ios';
  ui.renderUsage();
  const input = cssRoot.querySelector('[data-css-index="0"]');
  input.value = 'rebeccapurple'; input.focus(); input.setSelectionRange(2, 7);
  await input.emit('mdInput', { detail: input.value });
  ui.renderUsage();
  assert.equal(cssRoot.querySelector('[data-css-index="0"]'), input, 'Ordinary preview refresh keeps the mounted editor');
  assert.equal(doc.activeElement, input);
  assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 7]);
  assert.equal(cssCount.textContent, String(TEXT_FIELD_APPEARANCE_FIELDS.length));
  assert.match(cssRoot.innerHTML, /data-doc-tooltip|About --md-color/);
  state.selected = { ...state.selected, cssProperties: [{ name: '--md-color', description: 'Enriched description.' }] };
  ui.renderUsage();
  assert.notEqual(doc.activeElement, input, 'Metadata enrichment refreshes help content');
  assert.equal(doc.activeElement.value, 'rebeccapurple');
  assert.deepEqual([doc.activeElement.selectionStart, doc.activeElement.selectionEnd], [2, 7]);
  state.platform = 'android'; ui.renderUsage();
  assert.equal(doc.activeElement.value, 'rebeccapurple');
  state.selected = { ...state.selected, tag: 'md-button', cssProperties: [] }; state.docCssValues = {};
  ui.renderUsage();
  assert.equal(cssRoot.querySelectorAll('[data-css-index]').length, 0);
  assert.equal(cssCount.textContent, String(BUTTON_APPEARANCE_FIELDS.length));
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
  const { ui, state } = fixture(t, { tag: GENERIC_TAG, slots: [{ name: '' }] });
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
  assert.equal(tooltip.getAttribute('position'), 'bottom');
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
  assert.ok(['mdOpen', 'mdClose', 'mdClick', 'click'].every(name => doc.listeners[name].length === 0));
  assert.equal(search.listeners.mdInput.length, 0);
  width = 1200;
  await viewport.emit('resize');
  assert.equal(tooltip.position, 'bottom', 'disposed controllers do not update mounted hosts');
  ui.dispose(); // Cleanup is safe when repeated.
});


test('shared appearance edits only this button and preserves zero and last valid values', async t => {
  const { ui, state, appearanceRoot, cssTab } = fixture(t, { tag: 'md-button' });
  ui.renderUsage();
  assert.equal(cssTab.label, 'Styles');
  assert.equal(appearanceRoot.querySelectorAll('[data-appearance-field]').length, BUTTON_APPEARANCE_FIELDS.length);
  const gap = appearanceRoot.querySelector('#appearance-gap');
  await gap.emit('mdInput', { detail: '0' });
  assert.equal(state.buttonAppearance.gap, 0);
  await gap.emit('mdInput', { detail: '-1' });
  assert.equal(gap.error, true);
  assert.equal(state.buttonAppearance.gap, 0);
  assert.equal(appearanceRoot.querySelector('#appearance-scope'), null);
  assert.doesNotMatch(appearanceRoot.innerHTML, /Theme default|Appearance scope/);
  assert.equal(gap.placeholder, 'Component default');
  await gap.emit('mdInput', { detail: '12' });
  assert.equal(state.buttonAppearance.gap, 12);
  assert.deepEqual(state.buttonAppearanceDefaults, {});
  await appearanceRoot.querySelector('#appearance-reset').emit('mdClick');
  assert.deepEqual(state.buttonAppearance, {});
  assert.deepEqual(state.buttonAppearanceDefaults, {});
});

test('divider shared editor preserves signed insets and validates thickness on every platform', async t => {
  const { ui, state, appearanceRoot } = fixture(t, { tag: 'md-divider' });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform;
    ui.renderUsage();
    assert.equal(appearanceRoot.querySelectorAll('[data-appearance-field]').length, 4);
    await appearanceRoot.querySelector('#appearance-insetStart').emit('mdInput', { detail: '-18.5' });
    await appearanceRoot.querySelector('#appearance-insetEnd').emit('mdInput', { detail: '24' });
    await appearanceRoot.querySelector('#appearance-thickness').emit('mdInput', { detail: '0' });
    assert.deepEqual(state.dividerAppearance, { insetStart: -18.5, insetEnd: 24, thickness: 0 });
    await appearanceRoot.querySelector('#appearance-thickness').emit('mdInput', { detail: '-1' });
    assert.equal(appearanceRoot.querySelector('#appearance-thickness').error, true);
    assert.equal(state.dividerAppearance.thickness, 0);
    assert.doesNotMatch(appearanceRoot.innerHTML, /undefined|Infinity/);
    await appearanceRoot.querySelector('#appearance-reset').emit('mdClick');
    assert.deepEqual(state.dividerAppearance, {});
  }
});

test('button size and focus appearance controls are available on every platform and reset sparse values', async t => {
  const { ui, state, appearanceRoot } = fixture(t, { tag: 'md-button' });
  const values = { width: '320', minWidth: '0', maxWidth: '640', height: '56.5', minHeight: '0', focusRingColor: '#12abcd' };
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.renderUsage();
    for (const [name, value] of Object.entries(values)) {
      const input = appearanceRoot.querySelector(`#appearance-${name}`);
      assert.ok(input, `${platform}: ${name}`);
      assert.equal(input.disabled, false);
      await input.emit('mdInput', { detail: value });
    }
    assert.deepEqual(state.buttonAppearance, { width: 320, minWidth: 0, maxWidth: 640, height: 56.5, minHeight: 0, focusRingColor: '#12ABCD' });
    await appearanceRoot.querySelector('#appearance-width').emit('mdInput', { detail: '2401' });
    assert.equal(state.buttonAppearance.width, 320);
    assert.equal(appearanceRoot.querySelector('#appearance-width').error, true);
    await appearanceRoot.querySelector('#appearance-reset').emit('mdClick');
    assert.deepEqual(state.buttonAppearance, {});
  }
});

test('button host attribute and typed slot controls apply real content and keep snippet state separate from public declarations', async t => {
  const { ui, state, propsRoot, doc, contentChanges } = fixture(t, { tag: 'md-button', slots: ['', 'leading-icon', 'trailing-icon', 'loader'].map(name => ({ name })) });
  state.target = doc.createElement('md-button');
  propsRoot.innerHTML = ui.textControl() + ui.configurationControls(); ui.bindTextControl();
  const expanded = propsRoot.querySelector('#button-aria-expanded');
  expanded.value = 'false'; await expanded.emit('mdChange');
  assert.equal(state.target.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(snippetProperties(state), { 'aria-expanded': false });
  const slot = propsRoot.querySelector('#button-slot-mode-loader');
  slot.value = 'progress'; await slot.emit('mdChange');
  assert.deepEqual(state.docSlotValues.loader, { kind: 'progress' });
  assert.equal(state.target.querySelector('md-progress-indicator').getAttribute('slot'), 'loader');
  assert.deepEqual(contentChanges, [['aria-expanded', false], ['loader', { kind: 'progress' }]]);
  expanded.value = ''; await expanded.emit('mdChange');
  assert.equal(state.target.hasAttribute('aria-expanded'), false);
  assert.deepEqual(snippetProperties(state), {});
});

test('framework tabs and API selector update all examples together while retaining editor state', async t => {
  const { ui, root, state } = fixture(t, {
    events: [{ name: 'mdInput', detail: 'string' }],
    slots: [{ name: '' }], cssParts: [{ name: 'input' }],
    support: { android: { events: ['mdInput'], slots: [''], unsupportedMethods: ['setCustomValidity'] } },
  });
  ui.renderUsage();
  root.querySelector('[data-method-name="setCustomValidity"]').value = '["Review this value"]';
  root.querySelector('#usage-section-slots').expanded = true;
  await root.querySelector('#usage-language-tabs').emit('mdTabChange', { detail: { index: 1 } });
  assert.equal(state.snippetLanguage, 'react');
  assert.equal(root.querySelector('#api-framework').value, 'react');
  assert.ok(root.querySelectorAll('[data-api-framework]').every(node => node.dataset.apiFramework === 'react'));
  assert.match(root.innerHTML, /onMdInput/);
  assert.equal(root.querySelector('#usage-section-slots').expanded, true);
  assert.equal(root.querySelector('[data-method-name="setCustomValidity"]').value, '["Review this value"]');
  root.querySelector('#api-framework').focus();
  await root.querySelector('#api-framework').emit('mdChange', { detail: 'android' });
  assert.equal(state.snippetLanguage, 'android');
  assert.equal(state.platform, 'web', 'Documentation selection does not silently switch the preview');
  assert.equal(root.querySelector('#usage-language-tabs').getAttribute('active-tab-index'), '6');
  assert.equal(document.activeElement.id, 'api-framework');
  assert.equal(root.querySelector('#api-framework').focusTriggerCalls || 0, 0, 'The mounted select retains focus without a second focus operation');
  assert.ok(root.querySelectorAll('[data-api-framework]').every(node => node.dataset.apiFramework === 'android'));
  assert.match(root.innerHTML, /AWCComponent/);
  assert.doesNotMatch(root.innerHTML, /class="event-payload"/);
  const generation = root.querySelector('#api-framework');
  await generation.emit('mdChange', { detail: { value: 'unsupported-framework' } });
  assert.equal(root.querySelector('#api-framework'), generation, 'Unknown values do not rebuild the interface');
});

test('API copy action copies the associated code block, not all page text', async t => {
  const { ui, root } = fixture(t, { events: [{ name: 'mdInput', detail: 'string' }] });
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const copied = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async value => copied.push(value) } } });
  t.after(() => prior ? Object.defineProperty(globalThis, 'navigator', prior) : delete globalThis.navigator);
  ui.renderUsage();
  const code = root.querySelector('#usage-api-event-0-code');
  const expected = 'component.addEventListener("mdInput", onInput);';
  code.textContent = expected;
  await root.querySelector('[data-copy-api-code="usage-api-event-0-code"]').emit('mdClick');
  // Async highlighting can replace the stub's text after the click; assert
  // against the source present when copying, not the later mutable DOM.
  assert.deepEqual(copied, [expected]);
});

test('retired theme defaults cannot remain hidden in Studio appearance state', t => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const removed = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem() { throw new Error('Retired defaults must never be loaded'); },
    removeItem: key => removed.push(key),
  } });
  t.after(() => prior ? Object.defineProperty(globalThis, 'localStorage', prior) : delete globalThis.localStorage);
  const { state } = fixture(t, { tag: 'md-button' });
  assert.deepEqual(state.buttonAppearanceDefaults, {});
  assert.deepEqual(removed, ['awc-studio-button-appearance']);
});

test('Styles search opens matching groups and Reset clears all edits without replacing mounted inputs', async t => {
  const { ui, cssRoot, state } = fixture(t, { tag: GENERIC_TAG, cssProperties: [{ name: `--${GENERIC_TAG}-color` }, { name: `--${GENERIC_TAG}-gap` }] });
  ui.renderUsage();
  const color = cssRoot.querySelector('#css-0'), gap = cssRoot.querySelector('#css-1');
  await color.emit('mdInput', { detail: '#006A6A' });
  await gap.emit('mdInput', { detail: '8px' });
  assert.equal(cssRoot.querySelector('#styles-edit-count').textContent, '2 overrides');
  const search = cssRoot.querySelector('#styles-search'); search.value = 'gap'; await search.emit('mdInput');
  assert.equal(cssRoot.querySelector('[data-style-field="0"]').hidden, true);
  assert.equal(cssRoot.querySelector('[data-style-field="1"]').hidden, false);
  assert.equal(cssRoot.querySelector('[data-style-group="Layout"]').expanded, true);
  await cssRoot.querySelector('#reset-css-styles').emit('mdClick');
  assert.deepEqual(state.docCssValues, { [`--${GENERIC_TAG}-color`]: '', [`--${GENERIC_TAG}-gap`]: '' });
  assert.equal(cssRoot.querySelector('#css-0'), color);
  assert.equal(cssRoot.querySelector('#styles-edit-count').textContent, 'Using component defaults');
  assert.equal(cssRoot.querySelector('#reset-css-styles').disabled, true);
});

test('structural slot overrides are not offered or applied to the interactive preview', t => {
  const { ui, root, state } = fixture(t, { tag: 'md-tabs', slots: [{ name: '' }] });
  const removed = [], appended = [];
  state.target.childNodes = [{ nodeType: 1, getAttribute: () => '', remove: () => removed.push(true) }];
  state.target.append = node => appended.push(node);
  state.docSlotValues = { '': 'Must not erase tabs' };
  ui.renderUsage(); ui.applyOverrides();
  assert.equal(root.querySelectorAll('[data-slot-index]').length, 0);
  assert.match(root.innerHTML, /child components remain interactive/);
  assert.deepEqual(removed, []); assert.deepEqual(appended, []);
});

test('oversized slot drafts keep the last valid content and do not restart the native preview', async t => {
  const { ui, root, state, contentChanges } = fixture(t, { tag: 'md-button', slots: [{ name: '' }] });
  state.platform = 'android'; ui.renderUsage();
  const input = root.querySelector('[data-slot-index="0"]');
  await input.emit('mdInput', { detail: 'Valid content' });
  await input.emit('mdInput', { detail: 'ă'.repeat(2049) });
  assert.equal(input.error, true); assert.match(input.errorText, /4096 UTF-8/);
  assert.equal(state.docSlotValues[''], 'Valid content');
  assert.deepEqual(contentChanges, [['', 'Valid content']]);
  await input.emit('mdInput', { detail: '' });
  assert.equal(input.error, false); assert.equal(state.docSlotValues[''], '');
  assert.deepEqual(contentChanges.at(-1), ['', '']);
});

test('default-slot editing clears only the competing label, preserving unrelated titles', async t => {
  const { ui, root, state } = fixture(t, { tag: 'md-list-item', slots: [{ name: '' }] });
  state.props = { headline: 'Fixture title', supportingText: 'Keep this explanation' };
  state.target.childNodes = []; state.target.append = () => {};
  ui.renderUsage();
  await root.querySelector('[data-slot-index="0"]').emit('mdInput', { detail: 'Edited title' });
  assert.equal(state.props.headline, ''); assert.equal(state.target.headline, '');
  assert.equal(state.editedProps.headline, '');
  assert.equal(state.props.supportingText, 'Keep this explanation');
});

test('all framework switches keep hydrated controls, code cards, editor focus and section state mounted', async t => {
  const { ui, root, cssRoot, state, watched } = fixture(t, {
    events: [{ name: 'mdInput', detail: 'string' }], slots: [{ name: '' }], cssProperties: [{ name: '--md-color' }],
    dataTypes: [{ name: 'Value', body: 'string' }],
    support: { ios: { status: 'adapter-implemented', events: ['mdInput'] }, android: { status: 'adapter-implemented', events: ['mdInput'] } },
  });
  const disconnected = [];
  window.customElements.define('md-card', class extends window.HTMLElement {
    connectedCallback() { this.classList.add('hydrated'); }
    disconnectedCallback() { disconnected.push(this); }
    componentOnReady() { return Promise.resolve(this); }
  });
  ui.renderUsage();
  const tabs = root.querySelector('#usage-language-tabs'), select = root.querySelector('#api-framework');
  const snippet = root.querySelector('#usage-snippet'), card = root.querySelector('.usage-snippet-card'), apiCard = root.querySelector('#usage-data-type-0');
  const input = root.querySelector('[data-method-name]'), styles = cssRoot.querySelector('#css-0');
  const slots = root.querySelector('#usage-section-slots'), events = root.querySelector('#usage-section-events');
  tabs.classList.add('hydrated'); tabs.setAttribute('role', 'tablist');
  input.value = '["Unsubmitted draft"]'; input.focus(); input.setSelectionRange(2, 7);
  slots.expanded = true; events.expanded = false;
  for (const index of [1, 2, 3, 4, 5, 6, 0, 1]) {
    await tabs.emit('mdTabChange', { detail: { index } });
    assert.equal(root.querySelector('#usage-language-tabs'), tabs);
    assert.equal(root.querySelector('#api-framework'), select);
    assert.equal(root.querySelector('#usage-snippet'), snippet);
    assert.equal(root.querySelector('[data-method-name]'), input);
    assert.equal(cssRoot.querySelector('#css-0'), styles);
    assert.equal(document.activeElement, input);
    assert.equal(input.value, '["Unsubmitted draft"]');
    assert.deepEqual([input.selectionStart, input.selectionEnd], [2, 7]);
    assert.equal(slots.expanded, true); assert.equal(events.expanded, false);
    assert.ok(tabs.classList.contains('hydrated'));
    assert.equal(tabs.getAttribute('role'), 'tablist');
    assert.equal(root.getAttribute('aria-busy'), null);
  }
  assert.ok(!disconnected.includes(card), 'the persistent snippet card never disconnects');
  assert.equal(root.querySelector('#usage-data-type-0'), apiCard);
  assert.ok(!disconnected.includes(apiCard), 'native-to-Web changes never disconnect the retained API subtree');
  assert.equal(root.querySelector('#watch-usage-events').listeners.mdClick.length, 1);
  await root.querySelector('#watch-usage-events').emit('mdClick');
  assert.equal(watched(), 1, 'retained controls receive one action per activation');
  assert.equal(state.snippetLanguage, 'react');
});

test('new native sections hydrate in their final position without replacing focused controls', async t => {
  const { ui, root } = fixture(t, { tag: 'md-button', methods: [], slots: [{ name: '' }], support: { ios: { status: 'adapter-implemented' }, android: { status: 'adapter-implemented' } } });
  ui.renderUsage();
  const tabs = root.querySelector('#usage-language-tabs'), select = root.querySelector('#api-framework');
  const snippet = root.querySelector('#usage-snippet'), previousCode = snippet.textContent;
  const waiting = [];
  for (const tag of ['md-card', 'md-accordion-item']) window.customElements.define(tag, class extends window.HTMLElement {
    componentOnReady() {
      return this.closest('.native-integration-examples') ? new Promise(resolve => waiting.push(() => resolve(this))) : Promise.resolve(this);
    }
  });
  select.focus();
  const switching = tabs.emit('mdTabChange', { detail: { index: 5 } });
  const staged = root.querySelector('.native-integration-examples');
  assert.ok(staged?.isConnected);
  assert.equal(staged.style.visibility, 'hidden', `busy=${root.getAttribute('aria-busy')}; pending=${waiting.length}; style=${staged.getAttribute('style')}`);
  assert.equal(root.getAttribute('aria-busy'), 'true');
  assert.equal(snippet.textContent, previousCode, 'previous code stays readable while new components hydrate');
  assert.equal(document.activeElement, select);
  const parent = staged.parentNode;
  waiting.forEach(resolve => resolve()); await switching;
  assert.equal(root.querySelector('.native-integration-examples'), staged);
  assert.equal(staged.parentNode, parent, 'hydrated nodes are revealed in place');
  assert.equal(staged.style.visibility, '');
  assert.equal(root.querySelector('#api-framework'), select);
  assert.match(snippet.textContent, /AWCNativeView/);
  assert.equal(root.getAttribute('aria-busy'), null);
});

test('rapid framework changes cancel pending native sections and cannot replace newer documentation', async t => {
  const { ui, root, state } = fixture(t, { tag: 'md-button', methods: [], support: { ios: { status: 'adapter-implemented' }, android: { status: 'adapter-implemented' } } });
  ui.renderUsage();
  const waiting = [];
  for (const tag of ['md-card', 'md-accordion-item']) window.customElements.define(tag, class extends window.HTMLElement {
    componentOnReady() {
      return this.closest('.native-integration-examples') ? new Promise(resolve => waiting.push(() => resolve(this))) : Promise.resolve(this);
    }
  });
  const tabs = root.querySelector('#usage-language-tabs');
  const stale = tabs.emit('mdTabChange', { detail: { index: 5 } });
  const retired = root.querySelector('.native-integration-examples');
  await tabs.emit('mdTabChange', { detail: { index: 1 } });
  await stale;
  assert.equal(retired.isConnected, false);
  assert.equal(state.snippetLanguage, 'react');
  assert.match(root.querySelector('#usage-snippet').textContent, /@awc-ui\/react/);
  waiting.forEach(resolve => resolve()); await Promise.resolve();
  assert.equal(root.querySelector('.native-integration-examples'), null);
  const next = tabs.emit('mdTabChange', { detail: { index: 6 } });
  state.selected = { tag: 'md-chip', properties: [], methods: [] }; ui.renderUsage();
  await next;
  assert.equal(root.getAttribute('aria-busy'), null);
  assert.match(root.querySelector('#usage-snippet').textContent, /md-chip/);
  waiting.forEach(resolve => resolve()); await Promise.resolve();
  assert.doesNotMatch(root.querySelector('#usage-snippet').textContent, /md-button/);
});


test('late method failures cannot overwrite results after a same-component render', async t => {
  const { ui, root, state } = fixture(t);
  let reject;
  state.target.setCustomValidity = () => new Promise((_, fail) => { reject = fail; });
  ui.renderUsage();
  const output = root.querySelector('#method-result-0');
  const running = root.querySelector('[data-run-method="0"]').emit('mdClick');
  ui.renderUsage();
  assert.equal(root.querySelector('#method-result-0'), output);
  reject(new Error('Retired failure')); await running;
  assert.equal(output.textContent, '');
});

test('group controls and seven style fields retain actual child selection through snippet and platform updates', async t => {
  const { ui, state, propsRoot, root, appearanceRoot, doc } = fixture(t, { tag: 'md-button-group', properties: [{ name: 'selectionMode' }], slots: [{ name: '' }], events: [{ name: 'mdSelectionChange' }] });
  state.buttonGroupChildren = ['Day', 'Week', 'Month'].map((label, index) => ({ label, value: label.toLowerCase(), selected: index === 0 }));
  state.buttonGroupSelection = [true, false, false];
  const target = doc.createElement('md-button-group'); target.innerHTML = '<md-button value="day">Day</md-button><md-button value="week">Week</md-button><md-button value="month">Month</md-button>';
  state.target = target;
  propsRoot.innerHTML = ui.configurationControls(); ui.bindTextControl(); ui.renderUsage();
  assert.equal(appearanceRoot.querySelectorAll('[data-appearance-field]').length, 7);
  assert.equal(propsRoot.querySelectorAll('[data-group-child]').length, 3);
  const week = propsRoot.querySelector('#group-child-1'); week.selected = true; await week.emit('mdChange');
  assert.deepEqual(state.buttonGroupSelection, [true, true, false]);
  assert.equal(target.children[1].selected, true);
  assert.match(root.querySelector('#usage-snippet').textContent, /value="week" selected="true"/);
  for (const platform of ['ios', 'android', 'web']) {
    state.platform = platform; ui.renderUsage();
    const width = appearanceRoot.querySelector('#appearance-width'); await width.emit('mdInput', { detail: '440' });
    assert.deepEqual(state.buttonGroupSelection, [true, true, false]);
    assert.equal(state.buttonGroupAppearance.width, 440);
    assert.match(root.querySelector('#usage-snippet').textContent, /selected/);
  }
  state.buttonGroupSelection = [false, false, true]; ui.syncGroupSelection(); ui.updateSnippet();
  assert.equal(week.selected, false);
  assert.equal(propsRoot.querySelector('#group-child-2').selected, true);
  assert.match(root.querySelector('#usage-snippet').textContent, /value="month" selected="true"/);
  assert.deepEqual(state.props, {}, 'child controls never fabricate a group selected property');
});

test('native FAB method control awaits the actual bridge without changing authored properties or slots', async t => {
  let resolve;const applied=new Promise(done=>{resolve=done;});const calls=[];
  const {ui,state,root}=fixture(t,{tag:'md-fab',methods:[{name:'setMenuIcon',parameters:[{name:'icon',type:'string | null'}]}],slots:[{name:'icon'}]}, {invokeNativeMethod:(method,args)=>{calls.push([method,args]);return applied;}});
  state.platform='ios';state.target=null;state.props={icon:'add',label:'Create'};state.docSlotValues={icon:{kind:'symbol',value:'edit'}};ui.renderUsage();
  const button=root.querySelector('[data-run-method]'), input=root.querySelector('[data-method-args]');
  assert.equal(button.hasAttribute('disabled'),false);assert.equal(input.hasAttribute('disabled'),false);
  input.value='["close"]';const pending=button.emit('mdClick');
  assert.deepEqual(calls,[['setMenuIcon',['close']]]);
  assert.equal(root.querySelector('#method-result-0').textContent,'');
  resolve();await pending;
  assert.equal(root.querySelector('#method-result-0').textContent,'Done');
  assert.deepEqual(state.props,{icon:'add',label:'Create'});
  assert.deepEqual(state.docSlotValues,{icon:{kind:'symbol',value:'edit'}});
});

test('segmented documentation retains set children and style scope while context controls rebuild the preview', async t => {
  let contextChanges = 0;
  const { ui, state, propsRoot, root, appearanceRoot, doc } = fixture(t, {
    tag: 'md-segmented-button', properties: [{ name: 'selected' }, { name: 'label' }, { name: 'segmentTotal' }],
    slots: [{ name: '' }, { name: 'icon' }], events: [{ name: 'mdSegmentClick' }], methods: [],
  }, { onPreviewContextChange: () => { ++contextChanges; } });
  state.segmentedContext = { mode: 'set', multiselect: false, density: 0, selection: [true, false, false] };
  state.props = { label: 'Day', selected: true, segmentTotal: 3 };
  const set = doc.createElement('md-segmented-button-set'); set.innerHTML = '<md-segmented-button label="Day"></md-segmented-button><md-segmented-button label="Week"></md-segmented-button><md-segmented-button label="Month"></md-segmented-button>';
  state.target = set.firstChild;
  propsRoot.innerHTML = ui.configurationControls(); ui.bindTextControl(); ui.renderUsage();
  assert.equal(appearanceRoot.querySelectorAll('[data-appearance-field]').length, 7);
  const week = propsRoot.querySelector('[data-segment-child="1"]'); week.selected = true; await week.emit('mdChange');
  assert.equal(contextChanges, 1);
  assert.deepEqual(state.segmentedContext.selection, [true, true, false]);
  assert.match(root.querySelector('#usage-snippet').textContent, /value="week" selected="true"/);
  const color = appearanceRoot.querySelector('#appearance-labelColor'); await color.emit('mdInput', { detail: '#123456' });
  assert.equal(state.target.style.getPropertyValue('--md-segmented-button-label-color'), '#123456');
  assert.equal(set.children[1].style.getPropertyValue('--md-segmented-button-label-color'), '', 'local style does not affect siblings');
  const mode = propsRoot.querySelector('#segment-preview-mode'); mode.value = 'standalone'; await mode.emit('mdChange');
  assert.equal(contextChanges, 2);
  assert.doesNotMatch(root.querySelector('#usage-snippet').textContent, /md-segmented-button-set|Week|Month/);
});
