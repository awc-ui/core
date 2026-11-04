import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { SWITCH_APPEARANCE_FIELDS, CHECKBOX_APPEARANCE_FIELDS, RADIO_APPEARANCE_FIELDS, CHIP_APPEARANCE_FIELDS, SELECTION_PARTS, chipAppearance } from './selection-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativeThemeOptions } from './native-theme-options.js';
import { SWITCH_UPDATE_PROPERTIES, CHECKBOX_UPDATE_PROPERTIES, RADIO_UPDATE_PROPERTIES, CHIP_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const load = async tag => JSON.parse(await readFile(new URL(`../../packages/native-compiler/generated/ir/${tag}.json`, import.meta.url), 'utf8'));
const css = async tag => readFile(new URL(`../../packages/core/src/components/${tag}/${tag}.css`, import.meta.url), 'utf8');
const SPEC = {
  'md-switch': { fields: SWITCH_APPEARANCE_FIELDS, key: 'switchAppearance', updates: SWITCH_UPDATE_PROPERTIES, swift: 'awcSwitchAppearance', type: 'AWCSwitchAppearance', count: 12,
    methods: ['setFocus', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'],
    props: { selected: true, disabled: false, softDisabled: false, required: true, name: 'alerts', value: 'on', icons: true, showOnlySelectedIcon: false, selectedIcon: 'done', unselectedIcon: 'close', density: -2, valueMissingLabel: 'Turn it on.' } },
  'md-checkbox': { fields: CHECKBOX_APPEARANCE_FIELDS, key: 'checkboxAppearance', updates: CHECKBOX_UPDATE_PROPERTIES, swift: 'awcCheckboxAppearance', type: 'AWCCheckboxAppearance', count: 14,
    methods: ['getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'],
    props: { checked: false, indeterminate: true, disabled: false, softDisabled: false, required: true, name: 'terms', value: 'yes', error: true, errorText: 'Required', supportingText: 'Weekly', density: -1, valueMissingLabel: 'Check it.' } },
  'md-radio': { fields: RADIO_APPEARANCE_FIELDS, key: 'radioAppearance', updates: RADIO_UPDATE_PROPERTIES, swift: 'awcRadioAppearance', type: 'AWCRadioAppearance', count: 7,
    methods: ['syncValidityFromGroup', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity', 'setFocus', 'setBlur', 'select'],
    props: { checked: false, disabled: false, softDisabled: false, required: true, name: 'plan', value: 'pro', density: -3, valueMissingLabel: 'Pick one.' } },
  'md-chip': { fields: CHIP_APPEARANCE_FIELDS, key: 'chipAppearance', updates: CHIP_UPDATE_PROPERTIES, swift: 'awcChipAppearance', type: 'AWCChipHookAppearance', count: 12, methods: [],
    props: { variant: 'filter', icon: 'palette', trailingIcon: 'expand_more', selected: true, selectable: true, appearance: 'filled', color: 'tertiary', elevated: false, disabled: false, softDisabled: false, removable: true, label: 'Design', contentAlign: 'start', density: -1 } },
};
const sample = field => ({ color: '#12345680', corners: '12px 4px / 6px 2px', length: '18px', shadow: '0px 1px 3px 1px #00000026' })[field.kind];
const styled = tag => Object.fromEntries(SPEC[tag].fields.map(f => [f.name, componentAppearance(tag).parseInput(f.name, sample(f))]));
const components = Object.fromEntries(await Promise.all(Object.keys(SPEC).map(async tag => [tag, await load(tag)])));

test('appearance fields exactly cover each stylesheet\'s hooks, the IR and both released policies', async () => {
  for (const [tag, spec] of Object.entries(SPEC)) {
    const ir = components[tag], source = await css(tag);
    const hooks = [...new Set([...source.matchAll(new RegExp(`var\\(\\s*(--${tag}-[a-z0-9-]+)`, 'g'))].map(m => m[1]))].sort();
    assert.equal(hooks.length, spec.count, tag);
    assert.deepEqual(spec.fields.map(f => f.cssProperty).sort(), hooks, tag);
    assert.deepEqual(ir.cssProperties.map(p => p.name).sort(), hooks, `${tag} IR`);
    for (const platform of ['ios', 'android']) {
      const policy = ir.support[platform];
      assert.deepEqual([...policy.appearance.fields], spec.fields.map(f => f.name), `${tag} ${platform} appearance`);
      for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual([...policy[key]].sort(), ir[key].map(m => m.name).sort(), `${tag} ${platform} ${key}`);
      for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots']) assert.deepEqual(policy[key] ?? [], [], `${tag} ${platform} ${key}`);
      assert.deepEqual(policy.visualParts, ir.cssParts.map(p => p.name)); assert.deepEqual(policy.visualParts, [...SELECTION_PARTS[tag]]);
      assert.ok(policy.notes.length >= 3, `${tag} notes`);
    }
    assert.equal(Object.keys(componentAppearance(tag).css(styled(tag))).length, spec.count);
  }
});

test('typed kinds roundtrip CSS, native data and native literals; invalid values are rejected', () => {
  for (const tag of Object.keys(SPEC)) {
    const profile = componentAppearance(tag), styles = styled(tag), generated = profile.css(styles);
    for (const field of SPEC[tag].fields) {
      assert.deepEqual(profile.parseInput(field.name, profile.formatInput(field.name, styles[field.name])), styles[field.name], `${tag} ${field.name}`);
      if (field.kind === 'length') assert.equal(generated[field.cssProperty], '18px');
      if (field.kind === 'color') assert.equal(generated[field.cssProperty], '#12345680');
    }
    assert.throws(() => profile.normalize({ nope: 1 }), { code: `INVALID_${tag.slice(3).toUpperCase()}_APPEARANCE` });
    assert.throws(() => profile.normalize({ [SPEC[tag].fields.find(f => f.kind === 'color').name]: 'red' }), { code: `INVALID_${tag.slice(3).toUpperCase()}_APPEARANCE` });
    assert.throws(() => profile.normalize({ [SPEC[tag].fields.find(f => f.kind === 'length').name]: -2 }));
  }
  assert.equal(chipAppearance.nativeValue('iconSize', 18, 'swift'), '.points(18.0)', 'SwiftUI chip lengths are AWCChipLength');
  assert.equal(chipAppearance.nativeValue('iconSize', 18, 'android'), undefined, 'Compose chip lengths use the shared dp literal');
  assert.match(chipAppearance.nativeValue('elevation', styled('md-chip').elevation, 'swift'), /^\[AWCBoxShadow\(/);
  assert.match(componentAppearance('md-checkbox').nativeValue('containerShape', styled('md-checkbox').containerShape, 'android'), /^AWCCornerShape\(/);
});

test('render transport and theme options carry each typed appearance; other tags reject it', () => {
  for (const [tag, spec] of Object.entries(SPEC)) {
    const styles = styled(tag);
    const request = nativeRenderRequest(tag, spec.props, true, { ...componentAppearanceOptions({ selected: components[tag], [spec.key]: styles }), direction: 'rtl' });
    const valid = validateRenderRequest(request, new Set([tag]));
    assert.deepEqual(valid[spec.key], styles, tag); assert.deepEqual(valid.properties, spec.props, tag);
    assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: `INVALID_${tag.slice(3).toUpperCase()}_APPEARANCE` });
    assert.deepEqual(nativeThemeOptions({ [`${spec.key}Defaults`]: styles })[`${spec.key}Defaults`], styles);
  }
});

test('retained updates cover every source property with its source type, gated by released support', () => {
  for (const [tag, spec] of Object.entries(SPEC)) {
    assert.deepEqual([...spec.updates].sort(), components[tag].properties.map(p => p.name).sort(), tag);
    assert.deepEqual(nativePropertyUpdate(tag, spec.props), { command: 'update', properties: spec.props });
    for (const platform of ['ios', 'android']) assert.equal(supportsRetainedPropertyUpdates(components[tag], platform), true, `${tag} ${platform}`);
    for (const patch of [{ density: -5 }, { disabled: 'true' }, { open: true }]) assert.throws(() => nativePropertyUpdate(tag, patch), { code: 'INVALID_PROPERTY_UPDATE' }, `${tag} ${JSON.stringify(patch)}`);
  }
  for (const patch of [{ variant: 'choice' }, { appearance: 'tonal' }, { contentAlign: 'left' }, { removable: 1 }]) assert.throws(() => nativePropertyUpdate('md-chip', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  for (const patch of [{ checked: 'yes' }, { required: 1 }, { name: 3 }]) assert.throws(() => nativePropertyUpdate('md-radio', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
});

test('selection methods: supported by the released policies, validated commands and validated results', () => {
  for (const [tag, spec] of Object.entries(SPEC)) {
    for (const method of components[tag].methods.map(m => m.name)) {
      assert.equal(nativeSelectionMethod(tag, method), spec.methods.includes(method), `${tag}.${method}`);
      for (const platform of ['ios', 'android']) assert.equal(nativeMethodSupported(tag, method, components[tag].support[platform]), true, `${tag}.${method} ${platform}`);
    }
    for (const method of spec.methods.filter(m => m !== 'setCustomValidity')) {
      assert.deepEqual(nativeMethodCommand(tag, method, []), { command: 'method', method, arguments: [] });
      assert.throws(() => nativeMethodCommand(tag, method, [1]), { code: 'INVALID_METHOD' });
    }
    if (spec.methods.includes('setCustomValidity')) {
      assert.deepEqual(nativeMethodCommand(tag, 'setCustomValidity', ['Bad']), { command: 'method', method: 'setCustomValidity', arguments: ['Bad'] });
      for (const args of [[], [1], ['a', 'b'], ['x'.repeat(4097)]]) assert.throws(() => nativeMethodCommand(tag, 'setCustomValidity', args), { code: 'INVALID_METHOD' });
    }
  }
  assert.equal(nativeSelectionMethod('md-checkbox', 'setFocus'), false);
  const flags = Object.fromEntries(['valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'].map(k => [k, k === 'valueMissing']));
  assert.deepEqual(nativeMethodValue({ valid: false, validationMessage: 'Pick one.', flags }), { valid: false, validationMessage: 'Pick one.', flags });
  assert.equal(nativeMethodValue(true), true); assert.deepEqual(nativeMethodValue([0, 2]), [0, 2]);
  for (const value of [null, 'yes', [1.5], { valid: true }, { valid: true, validationMessage: '', flags: { x: 1 } }, { valid: true, validationMessage: '', flags: {}, extra: 1 }])
    assert.throws(() => nativeMethodValue(value), { code: 'INVALID_METHOD_RESULT' }, JSON.stringify(value));
});

test('the Styles panels expose every hook on all three platforms and invalid input keeps the last valid value', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  for (const [tag, spec] of Object.entries(SPEC)) {
    const state = { selected: components[tag], platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
    for (const platform of ['web', 'ios', 'android']) {
      state.platform = platform; ui.render();
      assert.equal(document.querySelectorAll('[data-appearance-field]').length, spec.count, `${tag} ${platform}`);
      for (const field of spec.fields) {
        const input = document.querySelector(`#appearance-${field.name}`);
        input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
        assert.equal(input.error, false, `${tag} ${field.name} accepts ${sample(field)}`);
      }
      assert.equal(Object.keys(state[spec.key]).length, spec.count);
      const color = spec.fields.find(f => f.kind === 'color').name, before = state[spec.key][color];
      const input = document.querySelector(`#appearance-${color}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: 'reddish' }));
      assert.equal(input.error, true); assert.equal(state[spec.key][color], before);
    }
    const target = document.createElement(tag); ui.apply(target);
    for (const field of spec.fields) assert.ok(target.style.getPropertyValue(field.cssProperty), `${tag} ${field.cssProperty} applied`);
  }
});

test('framework snippets carry every hook with the native types', () => {
  for (const [tag, spec] of Object.entries(SPEC)) {
    for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
      const code = usageSnippet(components[tag], spec.props, platform, { html: recipeFor(tag).html, [spec.key]: styled(tag) });
      assert.doesNotMatch(code, /\[object Object\]/, `${tag} ${platform}`);
      for (const field of spec.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${tag} ${platform} ${field.name}`);
      if (platform === 'swift') assert.match(code, new RegExp(`\\.${spec.swift}\\(\\.init\\(`));
      if (platform === 'android') assert.match(code, new RegExp(`${spec.type}Scope\\(appearance = ${spec.type}\\(`));
    }
  }
  assert.match(usageSnippet(components['md-chip'], SPEC['md-chip'].props, 'swift', { html: recipeFor('md-chip').html, chipAppearance: styled('md-chip') }), /iconSize: \.points\(18\.0\)/);
});

test('native API examples: method controller calls and typed part appearances', () => {
  for (const [tag, spec] of Object.entries(SPEC)) for (const platform of ['swift', 'android']) {
    for (const method of spec.methods) {
      const example = nativeApiExample(components[tag], 'method', method, platform);
      assert.equal(example.status, 'supported', `${tag}.${method} ${platform}`);
      assert.match(example.code, platform === 'swift' ? /\.awcSelectionControlController\(controller, for: "md-/ : /AWCSelectionControlControllerScope\(controller, "md-/);
      assert.match(example.code, new RegExp(`controller\\.${method}\\(`));
    }
    for (const part of SELECTION_PARTS[tag]) {
      const example = nativeApiExample(components[tag], 'cssPart', part, platform);
      // The radio's container part paints nothing: the generic theme fallback applies. The chip's primary part is typed (gate-7 R4-09).
      if (tag === 'md-radio' && part === 'container') { assert.doesNotMatch(example.code ?? '', /PartAppearance/, `${tag} ${part}`); continue; }
      assert.equal(example.status, 'native-equivalent', `${tag} ${part} ${platform}`);
      const type = { 'md-switch': 'Switch', 'md-checkbox': 'Checkbox', 'md-radio': 'Radio', 'md-chip': 'Chip' }[tag];
      assert.match(example.code, platform === 'swift' ? new RegExp(`\\.awc${type}PartAppearance\\(\\.init\\(`) : new RegExp(`AWC${type}PartAppearanceScope\\(AWC${type}PartAppearance\\(`), `${tag} ${part}`);
    }
  }
});
