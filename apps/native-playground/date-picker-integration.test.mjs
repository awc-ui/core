import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DATE_PICKER_APPEARANCE_FIELDS, datePickerAppearance, datePickerHook, DATE_PICKER_UPDATE_PROPERTIES, DATE_PICKER_ITEM_METHODS, DATE_PICKER_VALIDITY_METHODS } from './date-picker-appearance.js';
import { hookMapNative } from './picker-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeItemMethod, nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { supportsNativeViewportTag, nativeViewportCommand } from './native-viewport.js';
import { nativeApiExample } from './native-api-examples.js';

// md-date-picker in the Laboratory: every source hook as a typed field of the hook map, retained updates of every source
// property but the predicate, the methods through AWCDatePickerController, the overlay viewport, released policies and
// copyable examples.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const policies = { ios: (await read('../../packages/native-ios/NativeSupport.json')).components, android: (await read('../../packages/native-android/support.json')).components };
const TAG = 'md-date-picker', ir = await read('../../packages/native-compiler/generated/ir/md-date-picker.json');
const component = { ...ir, support: { ios: policies.ios[TAG], android: policies.android[TAG] } };
const METHODS = ['show', 'close', 'clear', 'focusInput', 'getValidity', 'checkValidity', 'reportValidity', 'setCustomValidity'];

test('the picker covers every source hook, property, event, method, slot and part in both released policies', () => {
  assert.deepEqual(DATE_PICKER_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), ir.cssProperties.map(p => p.name).sort());
  assert.equal(DATE_PICKER_APPEARANCE_FIELDS.length, 40);
  assert.deepEqual(componentAppearance(TAG).fields, DATE_PICKER_APPEARANCE_FIELDS);
  assert.deepEqual(componentAppearance(TAG).groups.flatMap(g => g[1]).sort(), DATE_PICKER_APPEARANCE_FIELDS.map(f => f.name).sort(), 'every hook sits in exactly one group');
  for (const platform of ['ios', 'android']) {
    const p = policies[platform][TAG], names = key => ir[key].map(x => x.name);
    assert.deepEqual(p.appearance.fields, DATE_PICKER_APPEARANCE_FIELDS.map(f => f.name), platform);
    for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual(p[key], names(key), `${platform} ${key}`);
    assert.deepEqual(p.visualParts, names('cssParts'), platform);
    for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots']) assert.deepEqual(p[key] ?? [], [], `${platform} ${key}`);
  }
  assert.deepEqual([...METHODS].sort(), ir.methods.map(m => m.name).sort());
  assert.equal(datePickerHook('daySelectedBg'), 'day-selected-bg');
  assert.equal(datePickerHook('yearGridViewportBlockSize'), 'year-grid-viewport-block-size');
});

test('hooks normalize to the CSS text the native hook map reads, with copyable native literals', () => {
  const dp = datePickerAppearance.normalize({ daySelectedBg: '#6750a4', panelWidth: '360px', containerShape: '28px', selectionBloomDuration: '0.45s',
    selectionBloomEasing: 'cubic-bezier(.05,.7,.1,1)', gridSlideDuration: '300ms', scrimColor: '#00000052' });
  assert.deepEqual(datePickerAppearance.css(dp), { '--md-date-picker-container-shape': '28px', '--md-date-picker-day-selected-bg': '#6750A4', '--md-date-picker-grid-slide-duration': '300ms',
    '--md-date-picker-panel-width': '360px', '--md-date-picker-scrim-color': '#00000052', '--md-date-picker-selection-bloom-duration': '450ms',
    '--md-date-picker-selection-bloom-easing': 'cubic-bezier(0.05, 0.7, 0.1, 1)' });
  assert.equal(hookMapNative(datePickerAppearance, { daySelectedBg: '#6750A4' }, 'swift'), '["day-selected-bg": "#6750A4"]');
  assert.equal(hookMapNative(datePickerAppearance, { daySelectedBg: '#6750A4' }, 'kotlin'), 'mapOf("day-selected-bg" to "#6750A4")');
  assert.equal(datePickerAppearance.nativeValue('panelWidth', '$x', 'kotlin'), '"\\$x"');
  for (const bad of [{ panelWidth: 12 }, { panelWidth: '-3px' }, { selectionBloomEasing: 'ease-in' }, { selectionBloomEasing: 'cubic-bezier(2,0,0,1)' }, { daySelectedBg: 'rgb(1,2,3)' },
    { calendarBloomDuration: 'fast' }, { bogus: '1px' }, null, []])
    assert.throws(() => datePickerAppearance.normalize(bad), { code: 'INVALID_DATE_PICKER_APPEARANCE' }, JSON.stringify(bad));
});

test('render requests carry local and default hooks only for the date picker', () => {
  const value = { daySelectedBg: '#386A20' };
  const request = nativeRenderRequest(TAG, { value: '2026-10-07' }, true, { ...componentAppearanceOptions({ selected: component, datePickerAppearance: value }), direction: 'rtl' });
  Object.assign(request, { width: 400, height: 640 });
  const valid = validateRenderRequest(request, new Set([TAG]));
  assert.deepEqual(valid.datePickerAppearance, value);
  assert.equal(valid.height, 640);
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button', height: undefined }, new Set(['md-button'])), { code: 'INVALID_DATE_PICKER_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ datePickerAppearanceDefaults: value }).datePickerAppearanceDefaults, value);
  assert.equal(supportsNativeViewportTag(TAG), true);
  assert.deepEqual(nativeViewportCommand(TAG, 2999, 5000), { command: 'resize', width: 1200, height: 1666 });
});

test('retained updates accept every source property but the predicate, with source types', () => {
  assert.deepEqual([...DATE_PICKER_UPDATE_PROPERTIES].sort(), ir.properties.map(p => p.name).filter(n => n !== 'isDateDisabled').sort());
  const patch = { open: true, variant: 'docked', fieldVariant: 'filled', firstDayOfWeek: 1, density: -2, value: '2026-10-07', locale: 'de-DE', commitOnSelect: true };
  assert.deepEqual(nativePropertyUpdate(TAG, patch).properties, patch);
  for (const bad of [{ variant: 'inline' }, { open: 'true' }, { firstDayOfWeek: 7 }, { firstDayOfWeek: 1.5 }, { fieldVariant: 'tonal' }, { density: -5 }, { isDateDisabled: 'x' }, { value: 5 }, { bogus: 1 }])
    assert.throws(() => nativePropertyUpdate(TAG, bad), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(bad));
  for (const platform of ['ios', 'android']) assert.equal(supportsRetainedPropertyUpdates(component, platform), true, platform);
});

test('methods run synchronously on the mounted picker and results keep the validity shape', () => {
  assert.deepEqual([...DATE_PICKER_ITEM_METHODS, ...DATE_PICKER_VALIDITY_METHODS].sort(), [...METHODS].sort());
  for (const method of METHODS) {
    assert.equal(nativeItemMethod(TAG, method) || nativeSelectionMethod(TAG, method), true, method);
    for (const platform of ['ios', 'android']) assert.equal(nativeMethodSupported(TAG, method, policies[platform][TAG]), true, `${method} ${platform}`);
    if (method === 'setCustomValidity') {
      assert.deepEqual(nativeMethodCommand(TAG, method, ['Choose a weekday.']), { command: 'method', method, arguments: ['Choose a weekday.'] });
      for (const bad of [[], [1], ['a', 'b']]) assert.throws(() => nativeMethodCommand(TAG, method, bad), { code: 'INVALID_METHOD' });
    } else {
      assert.deepEqual(nativeMethodCommand(TAG, method, []), { command: 'method', method, arguments: [] });
      assert.throws(() => nativeMethodCommand(TAG, method, ['x']), { code: 'INVALID_METHOD' });
    }
  }
  assert.equal(nativeItemMethod(TAG, 'hide'), false);
  assert.deepEqual(nativeMethodValue({ valid: false, validationMessage: 'Please choose a date.', flags: { valueMissing: true } }).flags, { valueMissing: true });
});

test('method examples bind the native controller', () => {
  for (const method of METHODS) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'method', method, platform);
    assert.equal(example.status, 'supported', `${method} ${platform}`);
    assert.match(example.code, /AWCDatePickerController\(\)/);
    assert.match(example.code, platform === 'swift' ? /\.awcDatePickerController\(controller\)/ : /AWCDatePickerControllerScope\(controller\)/);
    assert.match(example.code, new RegExp(`controller\\.${method}\\(`));
    if (platform === 'swift') assert.match(example.code, /AWCModalScope \{/);
  }
  assert.match(nativeApiExample(component, 'method', 'setCustomValidity', 'swift').code, /setCustomValidity\("Choose a weekday\."\)/);
});
