import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COLOR_PICKER_APPEARANCE_FIELDS, TIME_PICKER_APPEARANCE_FIELDS, colorPickerAppearance, timePickerAppearance, timePickerHook, hookMapNative,
  COLOR_PICKER_UPDATE_PROPERTIES, TIME_PICKER_UPDATE_PROPERTIES } from './picker-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeItemMethod, nativeSelectionMethod, nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { supportsNativeViewportTag, nativeViewportCommand } from './native-viewport.js';
import { nativeApiExample } from './native-api-examples.js';

// md-color-picker and md-time-picker in the Laboratory: every source hook as a typed field, retained updates of every source
// property, the methods through AWCColorPickerController / AWCTimePickerController, the overlay viewport, released policies
// and copyable examples.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const policies = { ios: (await read('../../packages/native-ios/NativeSupport.json')).components, android: (await read('../../packages/native-android/support.json')).components };
const ir = { 'md-color-picker': await read('../../packages/native-compiler/generated/ir/md-color-picker.json'), 'md-time-picker': await read('../../packages/native-compiler/generated/ir/md-time-picker.json') };
const component = tag => ({ ...ir[tag], support: { ios: policies.ios[tag], android: policies.android[tag] } });
const FIELDS = { 'md-color-picker': COLOR_PICKER_APPEARANCE_FIELDS, 'md-time-picker': TIME_PICKER_APPEARANCE_FIELDS };
const METHODS = { 'md-color-picker': ['show', 'close'], 'md-time-picker': ['show', 'hide', 'checkValidity', 'reportValidity', 'getValidity'] };

test('both pickers cover every source hook, property, event, method, slot and part in both released policies', () => {
  for (const tag of ['md-color-picker', 'md-time-picker']) {
    assert.deepEqual(FIELDS[tag].map(f => f.cssProperty).sort(), ir[tag].cssProperties.map(p => p.name).sort(), tag);
    assert.deepEqual(componentAppearance(tag).fields, FIELDS[tag], tag);
    for (const platform of ['ios', 'android']) {
      const p = policies[platform][tag], names = key => ir[tag][key].map(x => x.name);
      assert.deepEqual(p.appearance.fields, FIELDS[tag].map(f => f.name), `${tag} ${platform}`);
      for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual(p[key], names(key), `${tag} ${platform} ${key}`);
      assert.deepEqual(p.visualParts, names('cssParts'), `${tag} ${platform}`);
      for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots']) assert.deepEqual(p[key] ?? [], [], `${tag} ${platform} ${key}`);
    }
  }
  assert.equal(TIME_PICKER_APPEARANCE_FIELDS.length, 81);
  assert.equal(timePickerHook('dialogHorizontalWidth12h'), 'dialog-horizontal-width-12h');
});

test('hooks normalize to the values the native types read, with copyable native literals', () => {
  const cp = colorPickerAppearance.normalize({ width: 320, radius: 12, surfaceColor: '#fff3e0', thumbBorder: '#2e7d32cc', popoverElevation: '0 4px 8px 3px rgba(0,0,0,.15)' });
  assert.deepEqual(cp, { width: 320, radius: 12, surfaceColor: '#FFF3E0', thumbBorder: '#2E7D32CC', popoverElevation: '0px 4px 8px 3px #00000026' });
  assert.equal(colorPickerAppearance.css(cp)['--md-color-picker-width'], '320px');
  assert.equal(colorPickerAppearance.nativeValue('width', 320, 'swift'), '320.0');
  assert.equal(colorPickerAppearance.nativeValue('popoverElevation', '$x', 'kotlin'), '"\\$x"');
  assert.equal(colorPickerAppearance.parseInput('popoverElevation', 'none'), 'none');
  for (const bad of [{ width: -1 }, { surfaceColor: 'red' }, { popoverElevation: '4px' }, { bogus: 1 }, null, []]) assert.throws(() => colorPickerAppearance.normalize(bad), { code: 'INVALID_COLOR_PICKER_APPEARANCE' });
  const tp = timePickerAppearance.normalize({ dialHandColor: '#6750a4', dialSize: '280px', modeSwapDuration: '0.3s', motionEasing: 'cubic-bezier(.2,0,0,1)', handLength: '62.5%', periodHoverOpacity: '0.08', inputFontWeight: '500', dialogElevation: 'none' });
  assert.deepEqual(timePickerAppearance.css(tp), { '--md-time-picker-dial-hand-color': '#6750A4', '--md-time-picker-dial-size': '280px', '--md-time-picker-dialog-elevation': 'none',
    '--md-time-picker-hand-length': '62.5%', '--md-time-picker-input-font-weight': '500', '--md-time-picker-mode-swap-duration': '300ms',
    '--md-time-picker-motion-easing': 'cubic-bezier(0.2, 0, 0, 1)', '--md-time-picker-period-hover-opacity': '0.08' });
  assert.equal(hookMapNative(timePickerAppearance, { dialHandColor: '#6750A4' }, 'swift'), '["dial-hand-color": "#6750A4"]');
  assert.equal(hookMapNative(timePickerAppearance, { dialHandColor: '#6750A4' }, 'kotlin'), 'mapOf("dial-hand-color" to "#6750A4")');
  for (const bad of [{ dialSize: 12 }, { dialSize: '-3px' }, { handLength: '80px' }, { motionEasing: 'ease-in' }, { dialHandColor: 'rgb(1,2,3)' }, { bogus: '1px' }])
    assert.throws(() => timePickerAppearance.normalize(bad), { code: 'INVALID_TIME_PICKER_APPEARANCE' });
});

test('render requests carry local and default hooks only for their own picker', () => {
  for (const [tag, key, value] of [['md-color-picker', 'colorPickerAppearance', { radius: 8 }], ['md-time-picker', 'timePickerAppearance', { dialSize: '240px' }]]) {
    const request = nativeRenderRequest(tag, { value: tag === 'md-color-picker' ? '#6750A4' : '14:30' }, true, { ...componentAppearanceOptions({ selected: component(tag), [key]: value }), direction: 'rtl' });
    Object.assign(request, { width: 400, height: 640 });
    const valid = validateRenderRequest(request, new Set([tag]));
    assert.deepEqual(valid[key], value, tag);
    assert.equal(valid.height, 640, tag);
    assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button', height: undefined }, new Set(['md-button'])), { code: key === 'colorPickerAppearance' ? 'INVALID_COLOR_PICKER_APPEARANCE' : 'INVALID_TIME_PICKER_APPEARANCE' });
    assert.deepEqual(nativeThemeOptions({ [`${key}Defaults`]: value })[`${key}Defaults`], value);
    assert.equal(supportsNativeViewportTag(tag), true);
    assert.deepEqual(nativeViewportCommand(tag, 2999, 5000), { command: 'resize', width: 1200, height: 1666 });
  }
});

test('retained updates accept every source property with source types', () => {
  assert.deepEqual([...COLOR_PICKER_UPDATE_PROPERTIES].sort(), ir['md-color-picker'].properties.map(p => p.name).sort());
  assert.deepEqual([...TIME_PICKER_UPDATE_PROPERTIES].sort(), ir['md-time-picker'].properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate('md-color-picker', { open: true, presets: ['#6750A4'], format: 'hsl', density: -2 }).properties, { open: true, presets: ['#6750A4'], format: 'hsl', density: -2 });
  assert.deepEqual(nativePropertyUpdate('md-time-picker', { format: '24h', minuteStep: 5, periodLayout: 'horizontal', label: 'Start' }).properties, { format: '24h', minuteStep: 5, periodLayout: 'horizontal', label: 'Start' });
  for (const [tag, patch] of [['md-color-picker', { variant: 'dialog' }], ['md-color-picker', { open: 'true' }], ['md-color-picker', { presets: [1] }], ['md-time-picker', { format: '13h' }],
    ['md-time-picker', { minuteStep: NaN }], ['md-time-picker', { orientation: 'diagonal' }], ['md-time-picker', { density: -5 }], ['md-time-picker', { bogus: 1 }]])
    assert.throws(() => nativePropertyUpdate(tag, patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  for (const tag of ['md-color-picker', 'md-time-picker']) for (const platform of ['ios', 'android']) assert.equal(supportsRetainedPropertyUpdates(component(tag), platform), true, `${tag} ${platform}`);
});

test('methods run synchronously on the mounted picker and results keep the validity shape', () => {
  for (const tag of ['md-color-picker', 'md-time-picker']) for (const method of METHODS[tag]) {
    assert.equal(nativeItemMethod(tag, method) || nativeSelectionMethod(tag, method), true, `${tag}.${method}`);
    for (const platform of ['ios', 'android']) assert.equal(nativeMethodSupported(tag, method, policies[platform][tag]), true);
    assert.deepEqual(nativeMethodCommand(tag, method, []), { command: 'method', method, arguments: [] });
    assert.throws(() => nativeMethodCommand(tag, method, ['x']), { code: 'INVALID_METHOD' });
  }
  assert.equal(nativeItemMethod('md-color-picker', 'hide'), false);
  assert.deepEqual(nativeMethodValue({ valid: false, validationMessage: 'Please choose a time.', flags: { valueMissing: true, rangeUnderflow: false, rangeOverflow: false } }).flags.valueMissing, true);
});

test('method examples bind the native controllers; the overview keeps the declarative open', () => {
  for (const tag of ['md-color-picker', 'md-time-picker']) for (const method of METHODS[tag]) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component(tag), 'method', method, platform);
    const type = tag === 'md-color-picker' ? 'AWCColorPickerController' : 'AWCTimePickerController';
    assert.equal(example.status, 'supported', `${tag}.${method} ${platform}`);
    assert.match(example.code, new RegExp(`${type}\\(\\)`));
    assert.match(example.code, platform === 'swift' ? new RegExp(`\\.${tag === 'md-color-picker' ? 'awcColorPickerController' : 'awcTimePickerController'}\\(controller\\)`) : new RegExp(`${type}Scope\\(controller\\)`));
    assert.match(example.code, new RegExp(`controller\\.${method}\\(\\)`));
    if (tag === 'md-time-picker' && platform === 'swift') assert.match(example.code, /AWCModalScope \{/);
  }
});
