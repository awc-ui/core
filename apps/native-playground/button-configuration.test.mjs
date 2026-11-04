import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import { createButtonConfigurationUI, nativeButtonSelection, setButtonSelection } from './button-configuration.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const jsdomPackage = packages.find(name => name.startsWith('jsdom@'));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${jsdomPackage}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
function fixture(t, platform = 'web', tag = 'md-button') {
  const dom = new JSDOM('<div id="props-controls"></div>' + (tag === 'md-fab' ? '<md-fab icon="add" label="Create"><span id="authored" slot="icon">existing</span></md-fab>' : tag === 'md-icon-button' ? '<md-icon-button aria-label="Save">authored text<span id="authored">icon</span><md-badge>3</md-badge><span slot="selected" id="selected-authored">selected</span></md-icon-button>' : '<md-button><span slot="leading-icon" id="authored">original</span>Continue</md-button>'));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
  t.after(() => { dom.window.close(); if (previous) Object.defineProperty(globalThis, 'document', previous); else delete globalThis.document; });
  Object.defineProperty(dom.window.HTMLElement.prototype, 'value', { configurable: true, get() { return this._value ?? this.getAttribute('value') ?? ''; }, set(value) { this._value = value; } });
  const state = { platform, selected: { tag, slots: (tag === 'md-fab' ? ['icon'] : tag === 'md-icon-button' ? ['', 'selected'] : ['', 'leading-icon', 'trailing-icon', 'loader']).map(name => ({ name })) }, props: { size: 'md' }, docSlotValues: {} };
  const changes = [], target = document.querySelector(tag), root = document.querySelector('#props-controls');
  const ui = createButtonConfigurationUI({ getState: () => state, onChange: (...args) => { changes.push(args); if (state.platform === 'web') ui.apply(target); } });
  function render() { root.innerHTML = ui.markup(); ui.bind(); }
  render();
  const change = (id, value, name = 'mdChange') => {
    const input = document.getElementById(id); input.value = value;
    input.dispatchEvent(new dom.window.CustomEvent(name, { bubbles: true, detail: value }));
    return input;
  };
  return { dom, state, changes, target, root, ui, render, change };
}

test('all native/Web right panels expose named slots and tri-state expanded without synthesizing a public property', t => {
  const f = fixture(t);
  for (const platform of ['web', 'ios', 'android']) {
    f.state.platform = platform; f.render();
    assert.equal(f.root.querySelectorAll('[data-button-slot-mode]').length, 3);
    f.change('button-aria-expanded', 'true');
    assert.equal(f.state.props['aria-expanded'], true);
    f.change('button-aria-expanded', 'false');
    assert.equal(f.state.props['aria-expanded'], false);
    f.change('button-aria-expanded', '');
    assert.equal(Object.hasOwn(f.state.props, 'aria-expanded'), false);
    assert.equal(f.root.querySelector('#button-slot-mode-leading-icon').hasAttribute('disabled'), false);
  }
  f.state.selected = { tag: 'md-card' };
  assert.equal(f.ui.markup(), '');
});

test('named slot mode transitions retain literal text, restore fallback and never inject markup', t => {
  const f = fixture(t);
  const original = f.target.querySelector('#authored');
  f.change('button-slot-mode-leading-icon', 'text');
  assert.equal(f.state.docSlotValues['leading-icon'], '', 'empty content explicitly masks fallback');
  assert.equal(original.isConnected, false);
  f.change('button-slot-value-leading-icon', '<img src=x onerror=alert(1)>', 'mdInput');
  assert.equal(f.target.querySelector('[slot="leading-icon"]').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(f.target.querySelector('img'), null);
  f.change('button-slot-mode-leading-icon', 'symbol');
  assert.deepEqual(f.state.docSlotValues['leading-icon'], { kind: 'symbol', value: 'add' });
  assert.equal(f.target.querySelector('[slot="leading-icon"]').className, 'material-symbols-outlined');
  f.change('button-slot-mode-leading-icon', 'text');
  assert.equal(f.target.querySelector('[slot="leading-icon"]').hasAttribute('class'), false, 'text must not retain symbol font styling');
  f.change('button-slot-mode-leading-icon', 'default');
  assert.equal(Object.hasOwn(f.state.docSlotValues, 'leading-icon'), false);
  assert.equal(f.target.querySelector('[slot="leading-icon"]'), original);
  assert.equal(f.root.querySelector('#button-slot-value-leading-icon').hidden, true);
});

test('invalid symbol drafts retain the last valid preview and never send a new native configuration', t => {
  const f = fixture(t, 'android');
  f.change('button-slot-mode-trailing-icon', 'symbol');
  const count = f.changes.length;
  const input = f.change('button-slot-value-trailing-icon', '<script>', 'mdInput');
  assert.equal(input.error, true);
  assert.deepEqual(f.state.docSlotValues['trailing-icon'], { kind: 'symbol', value: 'arrow_forward' });
  assert.equal(f.changes.length, count);
  f.change('button-slot-value-trailing-icon', 'check_circle', 'mdInput');
  assert.equal(input.error, false);
  assert.deepEqual(f.state.docSlotValues['trailing-icon'], { kind: 'symbol', value: 'check_circle' });
  f.state.platform = 'web'; f.render(); f.ui.apply(f.target);
  assert.equal(f.target.querySelector('[slot="trailing-icon"]').textContent, 'check_circle');
});

test('progress composition remains mounted on unrelated edits and resets completely', t => {
  const f = fixture(t);
  f.change('button-slot-mode-loader', 'progress');
  const progress = f.target.querySelector('md-progress-indicator');
  assert.equal(progress.getAttribute('size'), '24');
  f.change('button-aria-expanded', 'true');
  assert.equal(f.target.getAttribute('aria-expanded'), 'true');
  f.ui.apply(f.target);
  assert.equal(f.target.querySelector('md-progress-indicator'), progress);
  assert.equal(f.root.querySelector('#button-slot-value-loader').hidden, true);
  f.state.props = {}; f.state.docSlotValues = {}; f.ui.apply(f.target);
  assert.equal(f.target.hasAttribute('aria-expanded'), false);
  assert.equal(f.target.querySelector('[slot="loader"]'), null);
});

test('symbol size follows changed size properties while maintaining its authored node', t => {
  const f = fixture(t);
  f.change('button-slot-mode-leading-icon', 'symbol');
  const symbol = f.target.querySelector('[slot="leading-icon"]');
  assert.match(symbol.getAttribute('style'), /calc\(24px/);
  f.state.props.size = 'xl'; f.ui.apply(f.target);
  assert.equal(f.target.querySelector('[slot="leading-icon"]'), symbol);
  assert.match(symbol.getAttribute('style'), /calc\(40px/);
});

test('native selection feedback follows committed events only and ignores demos or unrelated components', () => {
  const state = { selected: { tag: 'md-button' }, platform: 'ios' };
  const event = selected => ({ tag: 'md-button', name: 'mdChange', detail: { selected, value: 'save' } });
  assert.equal(nativeButtonSelection(state, [event(true), event(false)]), false);
  assert.equal(nativeButtonSelection(state, [{ ...event(true), name: 'mdClick' }]), undefined);
  assert.equal(nativeButtonSelection(state, [event('false')]), undefined);
  assert.equal(nativeButtonSelection(state, [{ ...event(true), tag: 'md-checkbox' }]), undefined);
  assert.equal(nativeButtonSelection(state, [{ ...event(true), defaultPrevented: true }]), undefined);
  for (const extra of [{ nativeScenario: 'button-behavior' }, { platform: 'web' }, { selected: { tag: 'md-chip' } }]) assert.equal(nativeButtonSelection({ ...state, ...extra }, [event(true)]), undefined);
});

test('a committed toggle replaces stale edited selection on subsequent platform mounts', () => {
  const state = { selected: { tag: 'md-button' }, props: { selected: false, toggle: true }, editedTag: 'md-button', editedProps: { selected: false, toggle: true, value: 'save' } };
  setButtonSelection(state, true);
  assert.equal(state.props.selected, true);
  assert.deepEqual(state.editedProps, { selected: true, toggle: true, value: 'save' });
  const remounted = { selected: false };
  Object.assign(remounted, state.editedProps);
  assert.equal(remounted.selected, true);
  setButtonSelection(state, false);
  assert.equal(state.editedProps.selected, false);
  setButtonSelection(state, 'true');
  assert.equal(state.editedProps.selected, false, 'do not coerce invalid native values');
  setButtonSelection({ ...state, selected: { tag: 'md-chip' } }, true);
  assert.equal(state.editedProps.selected, false);
});


test('icon slots edit both visual states while retaining live badge identity and restoring original content', t => {
  const f = fixture(t, 'web', 'md-icon-button');
  const original = f.target.querySelector('#authored'), badge = f.target.querySelector('md-badge');
  const originalText = f.target.firstChild, selected = f.target.querySelector('#selected-authored');
  assert.equal(f.root.querySelectorAll('[data-button-slot-mode]').length, 2);
  assert.equal(f.root.querySelector('#button-aria-expanded'), null);
  assert.equal(f.root.querySelector('[value="progress"]'), null);
  f.change('button-slot-mode-default', 'symbol');
  assert.deepEqual(f.state.docSlotValues[''], { kind: 'symbol', value: 'favorite_border' });
  assert.equal(original.isConnected, false);
  assert.equal(originalText.isConnected, false);
  assert.equal(f.target.querySelector('md-badge'), badge);
  assert.equal(badge.isConnected, true);
  assert.equal(f.target.querySelector('[slot="selected"]'), selected);
  const symbol = f.target.querySelector('[slot=""]');
  assert.match(symbol.getAttribute('style'), /--md-icon-button-icon-size,max\(18px,calc\(24px/);
  f.change('button-slot-mode-selected', 'symbol');
  assert.deepEqual(f.state.docSlotValues.selected, { kind: 'symbol', value: 'favorite' });
  f.state.props.size = 'xl'; f.ui.apply(f.target);
  assert.equal(f.target.querySelector('[slot=""]'), symbol);
  assert.match(symbol.getAttribute('style'), /max\(28px,calc\(40px .* \* 3px/);
  f.change('button-aria-label', 'Save favorite', 'mdInput');
  assert.equal(f.target.getAttribute('aria-label'), 'Save favorite');
  assert.equal(f.state.props['aria-label'], 'Save favorite');
  f.change('button-slot-mode-default', 'default');
  f.change('button-slot-mode-selected', 'default');
  assert.equal(original.parentNode, f.target);
  assert.equal(originalText.parentNode, f.target);
  assert.equal(selected.parentNode, f.target);
  assert.equal(badge.parentNode, f.target);
  assert.equal(f.target.querySelector('.material-symbols-outlined'), null);
});

test('icon native selection follows post-commit mdClick even when its event was canceled', () => {
  const state = { selected: { tag: 'md-icon-button' }, platform: 'android', props: {} };
  const event = { tag: 'md-icon-button', name: 'mdClick', detail: { selected: true }, defaultPrevented: true };
  assert.equal(nativeButtonSelection(state, [event]), true);
  assert.equal(nativeButtonSelection(state, [{ ...event, name: 'mdChange' }]), undefined);
  assert.equal(nativeButtonSelection(state, [{ ...event, tag: 'md-button' }]), undefined);
  setButtonSelection(state, true);
  assert.deepEqual(state.editedProps, { selected: true });
  assert.equal(state.editedTag, 'md-icon-button');
});

test('FAB icon-slot controls preserve authored content and expose an accessible name on every platform', t => {
  const f=fixture(t,'web','md-fab'); f.state.props={size:'large',label:'Create'};
  const authored=f.target.querySelector('#authored');
  assert.equal(f.root.querySelectorAll('[data-button-slot-mode]').length,1);
  assert.equal(f.root.querySelector('#button-aria-expanded'),null);
  f.change('button-aria-label','Create document','mdInput');
  assert.equal(f.target.getAttribute('aria-label'),'Create document');
  f.change('button-slot-mode-icon','symbol');
  assert.match(f.target.querySelector('[slot="icon"]').getAttribute('style'),/calc\(24px/);
  f.state.props.label='';f.ui.apply(f.target);
  assert.match(f.target.querySelector('[slot="icon"]').getAttribute('style'),/calc\(36px/);
  f.change('button-slot-mode-icon','text');
  assert.equal(f.target.querySelector('[slot="icon"]').textContent,'');
  for(const platform of ['ios','android']) {f.state.platform=platform;f.render();assert.equal(f.root.querySelector('#button-slot-mode-icon').value,'text');}
  f.state.platform='web';f.render();f.change('button-slot-mode-icon','default');
  assert.equal(f.target.querySelector('[slot="icon"]'),authored);
  assert.equal(f.target.getAttribute('icon'),'add');
});
