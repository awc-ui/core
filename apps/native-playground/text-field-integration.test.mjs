import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TEXT_FIELD_APPEARANCE_FIELDS, TEXT_FIELD_PARTS, TEXT_FIELD_UPDATE_PROPERTIES, textFieldAppearance, validTextFieldUpdate } from './text-field-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-text-field in the Laboratory: the seventeen typed hooks (signed focus inset / optical nudge, the cursor keyword),
// retained updates of every source property, the synchronous methods with results, released policies and examples.
const ir = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-text-field.json', import.meta.url), 'utf8'));
const policies = { ios: JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url), 'utf8')).components['md-text-field'],
  android: JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url), 'utf8')).components['md-text-field'] };
const component = { ...ir, support: policies };

test('the seventeen hooks cover the IR and both released policies', () => {
  assert.deepEqual(TEXT_FIELD_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), ir.cssProperties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) {
    const p = policies[platform];
    assert.deepEqual(p.appearance.fields, TEXT_FIELD_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(p.properties, ir.properties.map(x => x.name), platform);
    assert.deepEqual(p.methods, ir.methods.map(x => x.name), platform);
    assert.deepEqual(p.events, ir.events.map(x => x.name), platform);
    assert.deepEqual(p.slots, ir.slots.map(x => x.name), platform);
    assert.deepEqual(p.visualParts, ir.cssParts.map(x => x.name), platform);
  }
  assert.deepEqual(Object.keys(TEXT_FIELD_PARTS).sort(), ir.cssParts.map(x => x.name).sort());
  const registry = componentAppearance('md-text-field');
  assert.equal(registry.key, 'textFieldAppearance'); assert.equal(registry.swiftModifier, 'awcTextFieldAppearance'); assert.equal(registry.nativeType, 'AWCTextFieldAppearance');
  assert.deepEqual(registry.groups.flatMap(([, names]) => names).sort(), TEXT_FIELD_APPEARANCE_FIELDS.map(f => f.name).sort());
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { activeIndicatorColor: '#C62828', containerColor: '#FFF3E0', containerShape: 16, cursor: 'crosshair', errorColor: '#AD1457', filledPill: 1,
    focusBorderWidth: 4, focusInset: -3, iconColor: '#2E7D32', iconSize: 30, inputColor: '#0D47A1', labelColor: '#6A1B9A', opticalNudge: 3,
    outlineColor: '#1565C0', paddingInlineStart: 28, paddingInlineEnd: 28, supportingTextColor: '#E65100' };
  const css = textFieldAppearance.css(value);
  assert.equal(Object.keys(css).length, 17);
  assert.equal(css['--md-text-field-focus-inset'], '-3px'); assert.equal(css['--md-text-field-optical-nudge'], '3px'); assert.equal(css['--md-text-field-cursor'], 'crosshair');
  assert.equal(css['--md-text-field-container-shape'], '16px'); assert.equal(css['--md-text-field-filled-pill'], '1');
  for (const f of TEXT_FIELD_APPEARANCE_FIELDS) assert.deepEqual(textFieldAppearance.parseInput(f.name, textFieldAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  for (const bad of [{ focusInset: '3px' }, { opticalNudge: Infinity }, { cursor: 'url(x.png)' }, { containerShape: -1 }, { filledPill: 2 }, { labelColor: 'red' }, { width: 2 }])
    assert.throws(() => textFieldAppearance.normalize(bad), { code: 'INVALID_TEXT_FIELD_APPEARANCE' }, JSON.stringify(bad));
  assert.equal(textFieldAppearance.nativeValue('cursor', 'pointer', 'swift'), '"pointer"');
  assert.deepEqual(nativeThemeOptions({ textFieldAppearance: { focusInset: -2 } }).textFieldAppearance, { focusInset: -2 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-text-field', properties: {}, textFieldAppearance: { focusInset: -2, cursor: 'text' } }, new Set(['md-text-field'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-text-field', properties: {}, textFieldAppearance: { cursor: 1 } }, new Set(['md-text-field'])));
});

test('retained updates of every source property except the closures', () => {
  assert.deepEqual([...TEXT_FIELD_UPDATE_PROPERTIES].sort(), ir.properties.map(p => p.name).filter(n => !['formatter', 'parser'].includes(n)).sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), platform);
  const ok = { variant: 'outlined', label: 'Email', value: 'a@b.co', type: 'email', required: true, minLength: 3, maxLength: null, min: 2, max: '10', step: null,
    clearable: 'internal', passwordToggle: true, speechToText: 'external', density: -2, multiline: 'auto-grow', rows: 3, formatOn: 'input', focusBorderWidth: 2,
    inputRole: 'combobox', inputAriaAutocomplete: 'list', inputExpanded: true, debounce: 250, throttle: 0 };
  for (const [key, value] of Object.entries(ok)) assert.deepEqual(nativePropertyUpdate('md-text-field', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of [['multiline', true], ['clearable', 'yes'], ['density', -5], ['maxLength', -1], ['rows', 1.5], ['variant', 'plain'], ['formatter', 'x'], ['bogus', 1], ['required', 'true']])
    assert.throws(() => nativePropertyUpdate('md-text-field', { [key]: value }), undefined, key);
  assert.equal(validTextFieldUpdate('inputAriaAutocomplete', 'both'), true);
});

test('methods with results and their examples', () => {
  for (const name of ['setFocus', 'select', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity']) {
    assert.ok(nativeSelectionMethod('md-text-field', name), name);
    assert.ok(nativeMethodSupported('md-text-field', name, policies.ios), name);
  }
  assert.equal(nativeMethodSupported('md-text-field', 'getInputElement', policies.ios), false);
  assert.deepEqual(nativeMethodCommand('md-text-field', 'setCustomValidity', ['Taken']), { command: 'method', method: 'setCustomValidity', arguments: ['Taken'] });
  assert.deepEqual(nativeMethodCommand('md-text-field', 'getValidity', []), { command: 'method', method: 'getValidity', arguments: [] });
  assert.throws(() => nativeMethodCommand('md-text-field', 'select', [1]));
  assert.throws(() => nativeMethodCommand('md-text-field', 'setCustomValidity', []));
  const flags = Object.fromEntries(['valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'].map(k => [k, k === 'valueMissing']));
  assert.deepEqual(nativeMethodValue({ valid: false, validationMessage: 'Please fill out this field.', flags }), { valid: false, validationMessage: 'Please fill out this field.', flags });
  for (const name of ir.methods.map(m => m.name)) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'method', name, platform);
    assert.equal(example.status, 'supported', `${platform} ${name}`);
    assert.match(example.code, /AWCTextFieldController\(\)/);
    assert.match(example.code, new RegExp(`controller\\.${name}\\(`));
  }
});

test('typed part examples', () => {
  for (const part of ['container', 'label', 'input', 'supporting-text', 'counter']) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'cssPart', part, platform);
    assert.equal(example.status, 'native-equivalent', `${platform} ${part}`);
    assert.match(example.code, platform === 'swift' ? /\.awcTextFieldPartAppearance\(\.init\(/ : /AWCTextFieldPartAppearanceScope\(AWCTextFieldPartAppearance\(/);
    for (const field of TEXT_FIELD_PARTS[part]) assert.match(example.code, new RegExp(field));
  }
  assert.match(nativeApiExample(component, 'cssPart', 'chips', 'swift').description, /chip appearance/);
});
