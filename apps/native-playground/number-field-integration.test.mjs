import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NUMBER_FIELD_APPEARANCE_FIELDS, NUMBER_FIELD_UPDATE_PROPERTIES, numberFieldAppearance, validNumberFieldUpdate } from './number-field-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-number-field in the Laboratory: five typed hooks, retained updates of every source property, the methods with results
// (stepUp/stepDown take the optional repeat count), released policies, method and part examples.
const ir = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-number-field.json', import.meta.url), 'utf8'));
const policies = { ios: JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url), 'utf8')).components['md-number-field'],
  android: JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url), 'utf8')).components['md-number-field'] };
const component = { ...ir, support: policies };

test('the five hooks cover the IR and both released policies', () => {
  assert.deepEqual(NUMBER_FIELD_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), ir.cssProperties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) {
    const p = policies[platform];
    assert.deepEqual(p.appearance.fields, NUMBER_FIELD_APPEARANCE_FIELDS.map(f => f.name), platform);
    for (const k of ['properties', 'events', 'methods', 'slots']) assert.deepEqual(p[k], ir[k].map(x => x.name), `${platform} ${k}`);
    assert.deepEqual(p.visualParts, ir.cssParts.map(x => x.name), platform);
  }
  const registry = componentAppearance('md-number-field');
  assert.equal(registry.key, 'numberFieldAppearance'); assert.equal(registry.swiftModifier, 'awcNumberFieldAppearance'); assert.equal(registry.nativeType, 'AWCNumberFieldAppearance');
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { width: 300, minWidth: 260, stepperIconSize: 28, stepperColor: '#C62828', splitStepperSize: 48 };
  assert.deepEqual(numberFieldAppearance.css(value), { '--md-number-field-width': '300px', '--md-number-field-min-width': '260px', '--md-number-field-stepper-icon-size': '28px',
    '--md-number-field-stepper-color': '#C62828', '--md-number-field-split-stepper-size': '48px' });
  for (const f of NUMBER_FIELD_APPEARANCE_FIELDS) assert.deepEqual(numberFieldAppearance.parseInput(f.name, numberFieldAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  for (const bad of [{ width: -1 }, { stepperColor: 'red' }, { height: 2 }]) assert.throws(() => numberFieldAppearance.normalize(bad), { code: 'INVALID_NUMBER_FIELD_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ numberFieldAppearance: { width: 280 } }).numberFieldAppearance, { width: 280 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-number-field', properties: {}, numberFieldAppearance: { width: 280 } }, new Set(['md-number-field'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-number-field', properties: {}, numberFieldAppearance: { width: 'x' } }, new Set(['md-number-field'])));
});

test('retained updates of every source property', () => {
  assert.deepEqual([...NUMBER_FIELD_UPDATE_PROPERTIES].sort(), ir.properties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), platform);
  const ok = { value: 12.5, min: null, max: 100, step: 0.5, smallStep: 0.1, largeStep: 10, locale: 'de-DE', formatOptions: { style: 'currency', currency: 'EUR' },
    steppers: 'split', density: -2, variant: 'outlined', snapOnStep: true, allowWheelScrub: true, incrementLabel: 'Plus' };
  for (const [key, value] of Object.entries(ok)) assert.deepEqual(nativePropertyUpdate('md-number-field', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  assert.ok(validNumberFieldUpdate('formatOptions', '{"style":"percent"}'));
  for (const [key, value] of [['value', '12'], ['steppers', 'trailing'], ['step', null], ['formatOptions', { style: { nested: 1 } }], ['bogus', 1], ['required', 'yes']])
    assert.throws(() => nativePropertyUpdate('md-number-field', { [key]: value }), undefined, key);
});

test('methods with results and their examples', () => {
  for (const name of ['setFocus', 'select', 'stepUp', 'stepDown', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']) {
    assert.ok(nativeSelectionMethod('md-number-field', name), name);
    assert.ok(nativeMethodSupported('md-number-field', name, policies.ios), name);
  }
  assert.deepEqual(nativeMethodCommand('md-number-field', 'stepUp', []), { command: 'method', method: 'stepUp', arguments: [] });
  assert.deepEqual(nativeMethodCommand('md-number-field', 'stepDown', [3]), { command: 'method', method: 'stepDown', arguments: [3] });
  assert.throws(() => nativeMethodCommand('md-number-field', 'stepUp', ['3']));
  assert.throws(() => nativeMethodCommand('md-number-field', 'stepUp', [1, 2]));
  assert.throws(() => nativeMethodCommand('md-number-field', 'select', [1]));
  for (const name of ir.methods.map(m => m.name)) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'method', name, platform);
    assert.equal(example.status, 'supported', `${platform} ${name}`);
    assert.match(example.code, /AWCNumberFieldController\(\)/);
    assert.match(example.code, new RegExp(`controller\\.${name}\\(`));
  }
  for (const platform of ['swift', 'android']) {
    const part = nativeApiExample(component, 'cssPart', 'field', platform);
    assert.equal(part.status, 'native-equivalent');
    assert.match(part.code, platform === 'swift' ? /\.awcTextFieldAppearance\(/ : /AWCTextFieldAppearanceScope\(/);
  }
});
