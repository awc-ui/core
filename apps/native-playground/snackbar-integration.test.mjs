import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { SNACKBAR_APPEARANCE_FIELDS, parseSnackbarAppearanceInput } from './snackbar-appearance.js';
import { componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';
import { apiExample } from './api-examples.js';
import { nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-snackbar.json', import.meta.url), 'utf8'));
// This synthetic policy tests shared wiring, not native implementation acceptance.
const policy = { properties: source.properties.map(prop => prop.name), visualParts: source.cssParts.map(part => part.name), events: source.events.map(event => event.name), slots: source.slots.map(slot => slot.name), methods: [], appearance: { fields: SNACKBAR_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { ...source, support: { ios: policy, android: policy } };
const appearance = Object.fromEntries([
  ['containerColor', '#12345680'], ['messageColor', '#FEDCBA80'], ['actionColor', '#22BB99'], ['closeColor', '#EEBB33'],
  ['containerShape', '12px 4px / 6px 2px'], ['minWidth', '24em'], ['maxWidth', 'calc(100% - 48px)'],
].map(([name, input]) => [name, parseSnackbarAppearanceInput(name, input)]));

test('Snackbar transport preserves all seven fields and source props while keeping local styles component-scoped', () => {
  const properties = { open: true, message: 'Saved', action: 'Undo', closeable: true, autoHide: false, autoHideDuration: 0, position: 'top-start', stacked: true, politeness: 'assertive', dismissLabel: 'Dismiss message', density: -2 };
  const request = nativeRenderRequest(component.tag, properties, true, { ...componentAppearanceOptions({ selected: component, snackbarAppearance: appearance, snackbarAppearanceDefaults: { messageColor: '#ABCDEF' } }), direction: 'rtl' });
  const valid = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(valid.properties, properties); assert.deepEqual(valid.snackbarAppearance, appearance);
  assert.deepEqual(valid.snackbarAppearanceDefaults, { messageColor: '#ABCDEF' }); assert.equal(valid.direction, 'rtl');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_SNACKBAR_APPEARANCE' });
});

test('Snackbar Styles exposes all seven controls and keeps the last valid value after an invalid width edit', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const state = { selected: component, platform: 'web', props: { open: true, autoHide: false } };
  let updates = 0;
  const ui = createButtonAppearanceUI({ getState: () => state, onChange() { updates++; } });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    assert.equal(document.querySelectorAll('[data-appearance-field]').length, 7);
    for (const [name, value] of [['containerColor', '#33669980'], ['containerShape', '50% / 4px'], ['minWidth', '400px'], ['maxWidth', '0px']]) {
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: value })); assert.equal(input.error, false);
    }
    const input = document.querySelector('#appearance-maxWidth');
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: 'min(100%, 400px)' }));
    assert.equal(input.error, true); assert.equal(state.snackbarAppearance.maxWidth.points, 0);
  }
  assert.equal(updates, 12);
  const target = document.createElement('md-snackbar'); ui.apply(target);
  assert.equal(target.style.getPropertyValue('--md-snackbar-container-color'), '#33669980');
  assert.equal(target.style.getPropertyValue('--md-snackbar-container-shape'), '50% / 4px');
  assert.equal(target.style.getPropertyValue('--md-snackbar-min-width'), '400px');
  assert.equal(target.style.getPropertyValue('--md-snackbar-max-width'), '0px');
  assert.deepEqual(state.props, { open: true, autoHide: false });
});

test('all seven framework snippets preserve Snackbar shared appearance and native length types', () => {
  const recipe = recipeFor(component.tag);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { open: true, autoHide: false, message: 'Saved', action: 'Undo' }, platform, { html: recipe.html, snackbarAppearance: appearance });
    assert.doesNotMatch(code, /\[object Object\]/);
    if (platform === 'swift' || platform === 'android') {
      assert.match(code, /AWCSnackbarLength/); assert.match(code, /AWCCornerShape/);
      for (const field of SNACKBAR_APPEARANCE_FIELDS) assert.match(code, new RegExp(field.name));
      const guide = componentAppearanceGuide(component, platform === 'swift' ? 'ios' : platform);
      assert.match(guide, /actual overlay and font context/);
    } else {
      for (const field of SNACKBAR_APPEARANCE_FIELDS) assert.match(code, new RegExp(field.cssProperty));
    }
  }
});

test('Snackbar real controller, event and part recipes stay gated on implemented native declarations', () => {
  const readyPolicy = { ...policy, methods: ['show', 'hide'] };
  const ready = { ...component, support: { ios: readyPolicy, android: readyPolicy } };
  for (const platform of ['swift', 'android']) {
    for (const method of ['show', 'hide']) {
      const example = apiExample(ready, 'method', method, platform);
      assert.equal(example.status, 'supported');
      assert.match(example.code, /controller\.show\(/);
      assert.match(example.code, /controller\.hide\(/);
      assert.match(example.code, /AWCSnackbarScope/);
      assert.match(example.notes.join(' '), /does not wait for the visual transition/);
      assert.doesNotMatch(apiExample(component, 'method', method, platform).code || '', /AWCSnackbarController/);
    }
    for (const event of ['mdOpen', 'mdClose', 'mdAction']) {
      const example = apiExample(ready, 'event', event, platform);
      assert.equal(example.status, 'supported');
      assert.match(example.code, new RegExp(event));
      assert.match(example.notes.join(' '), /mdClose carries a reason object/);
      assert.match(example.notes.join(' '), /does not immediately dismiss/);
      assert.doesNotMatch(example.notes.join(' '), /Android emits null for mdClose/);
    }
    for (const part of policy.visualParts) {
      assert.match(apiExample(ready, 'cssPart', part, platform).code, /[aA][wW][cC]SnackbarPartAppearance/);
    }
    for (const slot of ['', 'action', 'close']) {
      const example = apiExample(ready, 'slot', slot, platform);
      assert.match(example.code, /AWCSnackbarScope/);
      if (slot === 'action') assert.match(example.code, /tapCount/);
      if (slot === 'close') assert.match(example.code, /controller\.hide\(/);
      if (platform === 'swift') assert.match(example.code, /awcSnackbarSlot/);
    }
    assert.match(nativeUsageExample(ready, platform).code, /controller\.hide\(/);
    const copied = usageSnippet(ready, { open: false, message: 'Saved from the property panel', position: 'top-end' }, platform, { html: recipeFor('md-snackbar').html, snackbarAppearance: appearance });
    assert.match(copied, /AWCSnackbarScope/);
    assert.match(copied, /snackbarController\.show\(/);
    assert.match(copied, /snackbarController\.hide\(/);
    assert.match(copied, /Saved from the property panel/);
    assert.match(copied, /top-end/);
    for (const field of SNACKBAR_APPEARANCE_FIELDS) assert.match(copied, new RegExp(field.name));
    assert.doesNotMatch(usageSnippet(component, {}, platform, { html: recipeFor('md-snackbar').html }), /AWCSnackbarController/);
    const unavailable = { ...ready, support: { ios: { ...readyPolicy, visualParts: [] }, android: { ...readyPolicy, visualParts: [] } } };
    assert.doesNotMatch(apiExample(unavailable, 'cssPart', 'surface', platform).code || '', /[aA][wW][cC]SnackbarPartAppearance/);
  }
});
