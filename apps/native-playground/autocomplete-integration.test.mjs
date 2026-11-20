import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AUTOCOMPLETE_APPEARANCE_FIELDS, AUTOCOMPLETE_UPDATE_PROPERTIES, AUTOCOMPLETE_METHODS, autocompleteAppearance, validAutocompleteUpdate } from './autocomplete-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-autocomplete in the Laboratory: eleven typed hooks, retained updates of every source property but the filterer closure
// and the three virtualization properties, the nine methods with results (getLabels in its own envelope), released
// policies and the method examples.
const ir = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-autocomplete.json', import.meta.url), 'utf8'));
const policies = { ios: JSON.parse(await readFile(new URL('../../packages/native-ios/NativeSupport.json', import.meta.url), 'utf8')).components['md-autocomplete'],
  android: JSON.parse(await readFile(new URL('../../packages/native-android/support.json', import.meta.url), 'utf8')).components['md-autocomplete'] };
const component = { ...ir, support: policies };
const names = items => items.map(x => x.name ?? x);
const UNSUPPORTED = ['virtualize', 'filterMode', 'rowHeight'];

test('the eleven hooks cover the IR and both released policies', () => {
  assert.deepEqual(AUTOCOMPLETE_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), names(ir.cssProperties).sort());
  for (const platform of ['ios', 'android']) {
    const p = policies[platform];
    assert.deepEqual(p.appearance.fields, AUTOCOMPLETE_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(p.properties, names(ir.properties).filter(n => !UNSUPPORTED.includes(n)), `${platform} properties`);
    for (const k of ['events', 'methods', 'slots']) assert.deepEqual(p[k], names(ir[k]), `${platform} ${k}`);
    assert.match(p.notes.join(' '), /virtualize/);
  }
  assert.equal(policies.ios.status, 'native-adapter');
  assert.deepEqual(policies.ios.unsupportedProperties, UNSUPPORTED);
  assert.deepEqual(policies.ios.unsupportedMethods, []);
  assert.deepEqual(policies.ios.unsupportedSlots, []);
  const registry = componentAppearance('md-autocomplete');
  assert.equal(registry.key, 'autocompleteAppearance'); assert.equal(registry.swiftModifier, 'awcAutocompleteAppearance'); assert.equal(registry.nativeType, 'AWCAutocompleteAppearance');
  assert.deepEqual(registry.groups.flatMap(([, fields]) => fields), AUTOCOMPLETE_APPEARANCE_FIELDS.map(f => f.name));
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { width: 300, minWidth: 240, chipGap: 6, chipRadius: 12, caretColor: '#C62828', caretSize: 28, clearColor: '#1565C0',
    optionIconColor: '#2E7D32', optionIconSize: 22, loadingColor: '#6A1B9A', spinnerSize: 20 };
  const css = autocompleteAppearance.css(value);
  assert.equal(css['--md-autocomplete-width'], '300px'); assert.equal(css['--md-autocomplete-caret-color'], '#C62828'); assert.equal(css['--md-autocomplete-spinner-size'], '20px');
  assert.equal(Object.keys(css).length, 11);
  for (const f of AUTOCOMPLETE_APPEARANCE_FIELDS) assert.deepEqual(autocompleteAppearance.parseInput(f.name, autocompleteAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  for (const bad of [{ width: -1 }, { caretColor: 'red' }, { chipGap: '4px' }, { height: 2 }]) assert.throws(() => autocompleteAppearance.normalize(bad), { code: 'INVALID_AUTOCOMPLETE_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ autocompleteAppearance: { width: 280 } }).autocompleteAppearance, { width: 280 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-autocomplete', properties: {}, autocompleteAppearance: { width: 280 } }, new Set(['md-autocomplete'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-autocomplete', properties: {}, autocompleteAppearance: { width: 'x' } }, new Set(['md-autocomplete'])));
});

test('retained updates of every source property but the filterer and the virtualization properties', () => {
  assert.deepEqual([...AUTOCOMPLETE_UPDATE_PROPERTIES].sort(), names(ir.properties).filter(n => !['filterer', ...UNSUPPORTED].includes(n)).sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), platform);
  const ok = { value: ['a', 'd'], options: [{ value: 'a', label: 'Apple', supportingText: 'Red' }, { value: 'kiwi' }], chipPosition: 'inline', density: -2, variant: 'outlined',
    multiple: true, freeSolo: true, maxSelected: 3, limitResults: 5, statusTemplate: '{count} fruit', placement: 'top-end', maxHeight: null, clearOnBlur: true, inputValue: 'ap' };
  for (const [key, value] of Object.entries(ok)) assert.deepEqual(nativePropertyUpdate('md-autocomplete', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  assert.ok(validAutocompleteUpdate('options', '[{"value":"a"}]'));
  assert.ok(validAutocompleteUpdate('value', 'a'));
  for (const [key, value] of [['chipPosition', 'bottom'], ['value', 3], ['options', [{ label: 'No value' }]], ['options', ['kiwi']], ['limitResults', -1], ['maxSelected', 1.5], ['filterer', 'x'],
    ['virtualize', 'always'], ['bogus', 1], ['required', 'yes']])
    assert.throws(() => nativePropertyUpdate('md-autocomplete', { [key]: value }), undefined, key);
});

test('methods with results and their examples', () => {
  assert.deepEqual([...AUTOCOMPLETE_METHODS].sort(), names(ir.methods).sort());
  for (const name of AUTOCOMPLETE_METHODS) assert.ok(nativeMethodSupported('md-autocomplete', name, policies.ios), name);
  assert.deepEqual(nativeMethodCommand('md-autocomplete', 'showMenu', []), { command: 'method', method: 'showMenu', arguments: [] });
  assert.deepEqual(nativeMethodCommand('md-autocomplete', 'loadOptions', [[{ value: 'kiwi' }, { value: 'lime', label: 'Lime' }]]), { command: 'method', method: 'loadOptions', arguments: [[{ value: 'kiwi' }, { value: 'lime', label: 'Lime' }]] });
  assert.deepEqual(nativeMethodCommand('md-autocomplete', 'getLabels', [['a', 'b']]), { command: 'method', method: 'getLabels', arguments: [['a', 'b']] });
  assert.deepEqual(nativeMethodCommand('md-autocomplete', 'setCustomValidity', ['Nope']), { command: 'method', method: 'setCustomValidity', arguments: ['Nope'] });
  for (const [name, args] of [['showMenu', [1]], ['loadOptions', ['kiwi']], ['loadOptions', [['kiwi']]], ['loadOptions', [[{ label: 'x' }]]], ['getLabels', [[1]]], ['getLabels', []], ['setCustomValidity', []]])
    assert.throws(() => nativeMethodCommand('md-autocomplete', name, args), undefined, name);
  assert.deepEqual(nativeMethodValue({ awcAutocompleteLabels: { a: 'Apple', zz: 'zz' } }), { a: 'Apple', zz: 'zz' });
  assert.throws(() => nativeMethodValue({ awcAutocompleteLabels: { a: 1 } }));
  assert.equal(nativeMethodValue(true), true);
  for (const name of names(ir.methods)) for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'method', name, platform);
    assert.equal(example.status, 'supported', `${platform} ${name}`);
    assert.match(example.code, /AWCAutocompleteController\(\)/);
    assert.match(example.code, new RegExp(`controller\\.${name}\\(`));
  }
});
