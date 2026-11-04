import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import { normalizeButtonGroupSelection, buttonGroupSelectionOptions, updateButtonGroupSelection, applyButtonGroupSelection } from './button-group-state.js';
import { createButtonGroupConfigurationUI } from './button-group-configuration.js';
import { recipeButtonGroupChildren, usageSnippet } from './usage-snippets.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const component = { tag: 'md-button-group', properties: [{ name: 'selectionMode' }], events: [{ name: 'mdSelectionChange' }], slots: [{ name: '' }] };
const html = '<md-button-group><md-button value="same" selected>First</md-button><div><md-icon-button value="same" aria-label="Second" icon="star"><md-badge>3</md-badge></md-icon-button></div><md-button value="">Empty</md-button></md-button-group>';

test('ordered child states preserve duplicate and empty values instead of guessing from event values', () => {
  const children = recipeButtonGroupChildren(component, { html });
  assert.deepEqual(children.map(child => [child.tag, child.value, child.label, child.selected]), [['md-button', 'same', 'First', true], ['md-icon-button', 'same', 'Second', false], ['md-button', '', 'Empty', false]]);
  const state = { selected: component, buttonGroupChildren: children, buttonGroupSelection: [true, false, false] };
  assert.equal(updateButtonGroupSelection(state, [false, true, true]), true);
  assert.deepEqual(state.buttonGroupSelection, [false, true, true]);
  assert.equal(updateButtonGroupSelection(state, undefined), false);
  assert.equal(updateButtonGroupSelection(state, [true]), false, 'stale composition cannot overwrite current controls');
  assert.equal(updateButtonGroupSelection(state, [false, true, true]), false, 'idle frames do not rewrite code');
  state.selected = { tag: 'md-button' };
  assert.equal(updateButtonGroupSelection(state, [true, false, false]), false);
});

test('selection schema rejects malformed or accessor-backed arrays and isolates tags', () => {
  const error = { code: 'INVALID_BUTTON_GROUP_SELECTION' };
  for (const value of [null, {}, [0], ['false'], new Array(2), new Array(101).fill(false), Object.assign([true], { extra: true })]) assert.throws(() => normalizeButtonGroupSelection(value), error);
  const accessor = [false]; Object.defineProperty(accessor, '0', { get() { throw Error('Must not execute'); } });
  assert.throws(() => normalizeButtonGroupSelection(accessor), error);
  assert.deepEqual(buttonGroupSelectionOptions(undefined, 'md-button'), {});
  assert.throws(() => buttonGroupSelectionOptions([false], 'md-button'), error);
  const value = [true, false]; assert.notEqual(normalizeButtonGroupSelection(value), value);
});

test('controls retain real child composition and synchronize live state on all platforms', t => {
  const dom = new JSDOM(`<div id="props-controls"></div>${html}`), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { dom.window.close(); if (previous) globalThis.document = previous; else delete globalThis.document; });
  const state = { selected: component, buttonGroupChildren: recipeButtonGroupChildren(component, { html }), buttonGroupSelection: [true, false, false] };
  const target = document.querySelector('md-button-group'), root = document.querySelector('#props-controls');
  const children = [...target.querySelectorAll('md-button,md-icon-button')], badge = target.querySelector('md-badge');
  let changes = 0;
  const ui = createButtonGroupConfigurationUI({ getState: () => state, onChange: () => { ++changes; ui.apply(target); } });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; root.innerHTML = ui.markup(); ui.bind(); ui.sync();
    const input = document.getElementById('group-child-1');
    assert.equal(input.selected, state.buttonGroupSelection[1]);
    input.selected = !input.selected; input.dispatchEvent(new dom.window.CustomEvent('mdChange', { bubbles: true }));
    assert.equal(state.buttonGroupSelection[1], input.selected);
    assert.equal(children[1].selected, input.selected);
    assert.deepEqual([...target.querySelectorAll('md-button,md-icon-button')], children);
    assert.equal(target.querySelector('md-badge'), badge);
  }
  assert.equal(changes, 3);
  updateButtonGroupSelection(state, [false, true, true]); ui.sync();
  assert.equal(document.getElementById('group-child-0').selected, false);
  assert.equal(document.getElementById('group-child-2').selected, true);
  applyButtonGroupSelection(target, [true]); assert.equal(children[0].selected, true, 'mismatched arrays do not partially mutate children');
  state.selected = { tag: 'md-card' }; assert.equal(ui.markup(), '');
});

test('copyable examples reflect each actual child state and preserve structures across all seven frameworks', () => {
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { selectionMode: 'multi-select' }, platform, { html, sourceHtml: html, buttonGroupSelection: [false, true, true] });
    assert.match(code, /First/); assert.match(code, /Empty/);
    assert.match(code, ['react', 'vue'].includes(platform) ? /MdBadge/ : /md-badge/);
    assert.doesNotMatch(code, /buttonGroupSelection/);
    if (platform === 'swift') assert.match(code, /"selected": \.bool\(false\)/);
    else if (platform === 'android') assert.match(code, /"selected" to false/);
    else assert.match(code, platform === 'html' ? /selected="false"/ : platform === 'angular' ? /\[selected\]="false"/ : platform === 'vue' ? /:selected="false"/ : /selected=\{false\}/);
  }
  assert.equal(recipeButtonGroupChildren(component, { html })[0].selected, true, 'serialization never mutates authored defaults');
  assert.throws(() => usageSnippet(component, {}, 'html', { html, buttonGroupSelection: [true] }), /match its authored children/);
});
