import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OTP_FIELD_APPEARANCE_FIELDS, OTP_FIELD_PARTS, OTP_FIELD_UPDATE_PROPERTIES, otpFieldAppearance, validOTPFieldUpdate } from './otp-field-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-otp-field in the Laboratory: seven typed hooks, retained updates of every source property, the methods with results,
// released policies, method and part examples.
const ir = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-otp-field.json', import.meta.url), 'utf8'));
const policies = { ios: JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url), 'utf8')).components['md-otp-field'],
  android: JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url), 'utf8')).components['md-otp-field'] };
const component = { ...ir, support: policies };

test('the seven hooks cover the IR and both released policies', () => {
  assert.deepEqual(OTP_FIELD_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), ir.cssProperties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) {
    const p = policies[platform];
    assert.deepEqual(p.appearance.fields, OTP_FIELD_APPEARANCE_FIELDS.map(f => f.name), platform);
    for (const k of ['properties', 'events', 'methods', 'slots']) assert.deepEqual(p[k], ir[k].map(x => x.name ?? x), `${platform} ${k}`);
    assert.deepEqual(p.visualParts, ir.cssParts.map(x => x.name), platform);
    assert.equal(p.appearance.parts, platform === 'ios' ? '.awcOTPFieldPartAppearance(AWCOTPFieldPartAppearance)' : 'AWCOTPFieldPartAppearanceScope(AWCOTPFieldPartAppearance)');
  }
  const registry = componentAppearance('md-otp-field');
  assert.equal(registry.key, 'otpFieldAppearance'); assert.equal(registry.swiftModifier, 'awcOTPFieldAppearance'); assert.equal(registry.nativeType, 'AWCOTPFieldAppearance');
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { cellGap: 14, cellHeight: 64, cellShape: 16, cellWidth: 52, focusColor: '#C62828', fontSize: 30, outlineColor: '#1565C0' };
  assert.deepEqual(otpFieldAppearance.css(value), { '--md-otp-field-cell-gap': '14px', '--md-otp-field-cell-height': '64px', '--md-otp-field-cell-shape': '16px',
    '--md-otp-field-cell-width': '52px', '--md-otp-field-focus-color': '#C62828', '--md-otp-field-font-size': '30px', '--md-otp-field-outline-color': '#1565C0' });
  for (const f of OTP_FIELD_APPEARANCE_FIELDS) assert.deepEqual(otpFieldAppearance.parseInput(f.name, otpFieldAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  for (const bad of [{ cellGap: -1 }, { focusColor: 'red' }, { cellRadius: 2 }]) assert.throws(() => otpFieldAppearance.normalize(bad), { code: 'INVALID_OTP_FIELD_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ otpFieldAppearance: { cellWidth: 40 } }).otpFieldAppearance, { cellWidth: 40 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-otp-field', properties: {}, otpFieldAppearance: { cellWidth: 40 } }, new Set(['md-otp-field'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-otp-field', properties: {}, otpFieldAppearance: { cellWidth: 'x' } }, new Set(['md-otp-field'])));
});

test('retained updates of every source property', () => {
  assert.deepEqual([...OTP_FIELD_UPDATE_PROPERTIES].sort(), ir.properties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), platform);
  const ok = { length: 4, value: '12', validationType: 'alphanumeric', transform: 'uppercase', mask: true, groupSize: 3, density: -2, incompleteLabel: 'Finish the code' };
  for (const [key, value] of Object.entries(ok)) assert.deepEqual(nativePropertyUpdate('md-otp-field', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of [['length', 0], ['length', 2.5], ['validationType', 'hex'], ['transform', 'lowercase'], ['bogus', 1], ['mask', 'yes'], ['value', 12]])
    assert.throws(() => nativePropertyUpdate('md-otp-field', { [key]: value }), undefined, key);
  assert.ok(validOTPFieldUpdate('groupSize', 0));
});

test('methods with results and their examples', () => {
  for (const name of ['setFocus', 'clear', 'getValidity', 'setCustomValidity', 'checkValidity', 'reportValidity']) {
    assert.ok(nativeSelectionMethod('md-otp-field', name), name);
    assert.ok(nativeMethodSupported('md-otp-field', name, policies.ios), name);
  }
  assert.deepEqual(nativeMethodCommand('md-otp-field', 'clear', []), { command: 'method', method: 'clear', arguments: [] });
  assert.deepEqual(nativeMethodCommand('md-otp-field', 'setCustomValidity', ['Expired']), { command: 'method', method: 'setCustomValidity', arguments: ['Expired'] });
  assert.throws(() => nativeMethodCommand('md-otp-field', 'clear', [1]));
  for (const name of ir.methods.map(m => m.name)) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'method', name, platform);
    assert.equal(example.status, 'supported', `${platform} ${name}`);
    assert.match(example.code, /AWCOTPFieldController\(\)/);
    assert.match(example.code, new RegExp(`controller\\.${name}\\(`));
  }
  for (const platform of ['swift', 'android']) for (const part of ['cells', 'cell', 'separator', 'supporting-text']) {
    const example = nativeApiExample(component, 'cssPart', part, platform);
    assert.equal(example.status, 'native-equivalent', `${platform} ${part}`);
    assert.match(example.code, platform === 'swift' ? /\.awcOTPFieldPartAppearance\(\.init\(/ : /AWCOTPFieldPartAppearanceScope\(AWCOTPFieldPartAppearance\(/);
    for (const field of OTP_FIELD_PARTS[part]) assert.match(example.code, new RegExp(field));
  }
  assert.deepEqual(Object.keys(OTP_FIELD_PARTS).sort(), ir.cssParts.map(x => x.name).sort());
});
