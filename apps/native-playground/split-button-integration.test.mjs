import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SPLIT_BUTTON_APPEARANCE_FIELDS, normalizeSplitButtonAppearance, splitButtonAppearanceCSS } from './split-button-appearance.js';
import { splitButtonCheckedOptions, updateSplitButtonChecked } from './split-button-state.js';
import { defaultSlotMaskingProperty, nativeContentSlots } from './content-slots.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { apiExample } from './api-examples.js';
import { snippetProperties } from './documentation-ui.js';
import { createButtonConfigurationUI } from './button-configuration.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-split-button.json', import.meta.url), 'utf8'));
const policy = { properties: source.properties.map(value => value.name), events: ['mdLeadingClick', 'mdTrailingClick'], slots: [''], methods: [], visualParts: ['leading', 'trailing', 'leading-state-layer', 'trailing-state-layer', 'icon', 'label', 'trailing-icon'], appearance: { fields: SPLIT_BUTTON_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { ...source, support: { ios: policy, android: policy } };
const appearance = { containerColor: '#123456', labelColor: '#abcdef', iconColor: '#006A6A', outlineColor: '#FEDCBA', cornerRadius: 0, iconSize: 32 };

test('Split Button maps exactly six public source hooks and validates data without invoking getters', async () => {
  const css = await readFile(new URL('../../packages/core/src/components/md-split-button/md-split-button.css', import.meta.url), 'utf8');
  assert.deepEqual(SPLIT_BUTTON_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(css.match(/--md-split-button-[a-z-]+/g))].sort());
  assert.deepEqual(normalizeSplitButtonAppearance(appearance), { ...appearance, labelColor: '#ABCDEF' });
  assert.equal(splitButtonAppearanceCSS(appearance)['--md-split-button-container-shape'], '0px');
  assert.equal(splitButtonAppearanceCSS(appearance)['--md-split-button-icon-size'], '32px');
  const accessor = Object.defineProperty({}, 'iconSize', { get() { throw Error('Getter invoked'); } });
  for (const value of [accessor, null, [], { unknown: 0 }, { iconSize: -1 }, { cornerRadius: Infinity }, { labelColor: '#abc' }, { containerColor: '#12345680' }]) assert.throws(() => normalizeSplitButtonAppearance(value), { code: 'INVALID_SPLIT_BUTTON_APPEARANCE' });
});

test('appearance transport preserves local/default scopes and rejects local styles on another root', () => {
  const request = nativeRenderRequest(component.tag, { trailingChecked: true, label: 'Create' }, false, { splitButtonAppearance: appearance, splitButtonAppearanceDefaults: { iconSize: 18 }, slots: { '': ' project' } });
  const actual = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(actual.splitButtonAppearance, normalizeSplitButtonAppearance(appearance));
  assert.deepEqual(actual.splitButtonAppearanceDefaults, { iconSize: 18 });
  assert.equal(actual.properties.label, 'Create');
  assert.equal(actual.slots[''], ' project');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_SPLIT_BUTTON_APPEARANCE' });
  assert.throws(() => nativeContentSlots({ '': { kind: 'symbol', value: 'add' } }, component.tag), { code: 'INVALID_SLOTS' });
});

test('only actual root Boolean frame state persists; false survives code generation and platform edits', () => {
  assert.deepEqual(splitButtonCheckedOptions(undefined, component.tag), {});
  for (const checked of [false, true]) assert.deepEqual(splitButtonCheckedOptions(checked, component.tag), { splitButtonChecked: checked });
  for (const checked of [null, 1, 'true', {}]) assert.throws(() => splitButtonCheckedOptions(checked, component.tag), { code: 'INVALID_SPLIT_BUTTON_STATE' });
  assert.throws(() => splitButtonCheckedOptions(true, 'md-button'), { code: 'INVALID_SPLIT_BUTTON_STATE' });
  const state = { selected: component, props: { label: 'Create', trailingChecked: true }, editedTag: 'md-button', editedProps: { selected: true } };
  assert.equal(updateSplitButtonChecked(state, false), true);
  assert.deepEqual(state.editedProps, { trailingChecked: false });
  assert.equal(updateSplitButtonChecked(state, false), false);
  assert.equal(updateSplitButtonChecked(state, undefined), false);
  assert.equal(snippetProperties(state).trailingChecked, false);
  assert.equal(state.props.label, 'Create');
  assert.equal(updateSplitButtonChecked({ selected: { tag: 'md-button' } }, true), false);
});

test('additive default-slot edits keep the label on all seven frameworks including empty content', () => {
  assert.equal(defaultSlotMaskingProperty(component.tag), undefined);
  const recipe = recipeFor(component.tag);
  for (const framework of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) for (const content of [' project', '', ' \n']) {
    const code = usageSnippet(component, { ...recipe.props, label: 'Create', trailingChecked: false, 'aria-label': 'Create item' }, framework, { html: recipe.html, slots: { '': content }, splitButtonAppearance: appearance });
    assert.match(code, /Create/);
    assert.match(code, /Create item/);
    assert.doesNotMatch(code, /trailingToggle|\[object Object\]/);
    if (framework === 'swift') {
      assert.match(code, /"label": \.string\("Create"\)/);
      assert.match(code, /awcSplitButtonAppearance/);
    } else if (framework === 'android') {
      assert.match(code, /"label" to "Create"/);
      assert.match(code, /AWCSplitButtonAppearanceScope/);
    } else assert.match(code, /--md-split-button-icon-size/);
  }
});

test('all API examples preserve committed trailing payload, void leading event and truthful part styling', () => {
  for (const framework of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const trailing = apiExample(component, 'event', 'mdTrailingClick', framework);
    assert.ok(trailing.code);
    assert.match(trailing.notes.join(' '), /before|committed/);
    assert.match(trailing.notes.join(' '), /cannot undo/);
    const leading = apiExample(component, 'event', 'mdLeadingClick', framework);
    assert.ok(leading.code);
    assert.match(leading.notes.join(' '), /no detail|null detail/);
    const slot = apiExample(component, 'slot', '', framework);
    assert.ok(slot.code);
    if (['swift', 'android'].includes(framework)) {
      assert.match(slot.code, /Create/);
      assert.match(slot.code, / project/);
      for (const part of policy.visualParts) assert.ok(apiExample(component, 'cssPart', part, framework).code, `${framework} ${part}`);
    }
  }
});

test('configuration exposes accessible name and native style guide explains leading-only icon hooks', () => {
  const state = { selected: component, props: { 'aria-label': 'Create item' } };
  const ui = createButtonConfigurationUI({ getState: () => state });
  assert.match(ui.markup(), /button-aria-label/);
  assert.doesNotMatch(ui.markup(), /button-aria-expanded|button-slot-mode/);
  for (const platform of ['ios', 'android']) {
    const guide = componentAppearanceGuide(component, platform);
    for (const field of SPLIT_BUTTON_APPEARANCE_FIELDS) assert.ok(guide.includes(field.cssProperty));
    assert.match(guide, /trailing glyph retains/);
    assert.match(guide, /additional to the label/);
  }
});
