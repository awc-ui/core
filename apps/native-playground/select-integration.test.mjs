import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SELECT_APPEARANCE_FIELDS, MULTI_SELECT_APPEARANCE_FIELDS, SELECT_UPDATE_PROPERTIES, MULTI_SELECT_UPDATE_PROPERTIES, selectAppearance, multiSelectAppearance,
  validSelectUpdate, nativeSelectMethod, selectMethodArguments } from './select-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-select / md-multi-select in the Laboratory (gate 3): typed hooks (8 fields / 38 hooks as a hook map), retained updates of
// every supported source property, the controller methods with results, released policies and examples.
const json = async p => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const ios = (await json('../../packages/native-ios/NativeSupport.json')).components, android = (await json('../../packages/native-android/support.json')).components;
const load = async tag => { const ir = await json(`../../packages/native-compiler/generated/ir/${tag}.json`); return { ...ir, tag, support: { ios: ios[tag], android: android[tag] } }; };
const select = await load('md-select'), multi = await load('md-multi-select');
const names = items => items.map(x => x.name ?? x);

test('the hooks cover the IR and both released policies', () => {
  assert.deepEqual(SELECT_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), names(select.cssProperties).sort());
  assert.deepEqual(MULTI_SELECT_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), names(multi.cssProperties).sort());
  for (const [component, fields] of [[select, SELECT_APPEARANCE_FIELDS.map(f => f.name)], [multi, MULTI_SELECT_APPEARANCE_FIELDS.map(f => f.cssProperty.slice('--md-multi-select-'.length))]])
    for (const platform of ['ios', 'android']) {
      const p = component.support[platform];
      assert.deepEqual([...p.appearance.fields].sort(), [...fields].sort(), `${component.tag} ${platform}`);
      assert.match(p.appearance.api, component.tag === 'md-select' ? /AWCSelectAppearance/ : /AWCMultiSelectAppearance/);
      assert.ok(p.notes.some(n => n.startsWith('Laboratory (gate 3)')), `${component.tag} ${platform} note`);
    }
  for (const [tag, fields] of [['md-select', SELECT_APPEARANCE_FIELDS], ['md-multi-select', MULTI_SELECT_APPEARANCE_FIELDS]]) {
    const registry = componentAppearance(tag);
    assert.deepEqual(registry.groups.flatMap(([, n]) => n).sort(), fields.map(f => f.name).sort(), `${tag} groups cover every field once`);
  }
  assert.equal(componentAppearance('md-multi-select').hookPrefix, '--md-multi-select-');
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const value = { width: 320, minWidth: 200, caretColor: '#6750A4', caretSize: 28, clearColor: '#B3261E', trailingGap: 6, optionIconColor: '#386A20', spinnerSize: 20 };
  const css = selectAppearance.css(value);
  assert.equal(Object.keys(css).length, 8); assert.equal(css['--md-select-caret-size'], '28px'); assert.equal(css['--md-select-caret-color'], '#6750A4');
  for (const f of SELECT_APPEARANCE_FIELDS) assert.deepEqual(selectAppearance.parseInput(f.name, selectAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  for (const bad of [{ width: -1 }, { caretColor: 'red' }, { chipHeight: 2 }]) assert.throws(() => selectAppearance.normalize(bad), { code: 'INVALID_SELECT_APPEARANCE' });
  const m = multiSelectAppearance.normalize({ chipHeight: 28, clearBackground: '#FFFFFF80', searchPadding: '4px 8px', emptyFont: 'italic 500 15px/20px  Roboto' });
  assert.deepEqual(m, { chipHeight: '28px', clearBackground: '#FFFFFF80', emptyFont: 'italic 500 15px/20px Roboto', searchPadding: '4px 8px 4px 8px' });
  assert.deepEqual(multiSelectAppearance.css({ chipHeight: '28px' }), { '--md-multi-select-chip-height': '28px' });
  for (const bad of [{ chipHeight: -1 }, { emptyFont: 'big' }, { nope: '1px' }, { searchPadding: '1px 2px 3px 4px 5px' }]) assert.throws(() => multiSelectAppearance.normalize(bad), { code: 'INVALID_MULTI_SELECT_APPEARANCE' }, JSON.stringify(bad));
  assert.equal(multiSelectAppearance.nativeValue('chipHeight', '28px', 'swift'), '"28px"');
  assert.deepEqual(nativeThemeOptions({ selectAppearance: { caretSize: 30 }, multiSelectAppearance: { chipGap: '6px' } }).selectAppearance, { caretSize: 30 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-select', properties: {}, selectAppearance: { caretSize: 30 } }, new Set(['md-select'])));
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-multi-select', properties: {}, multiSelectAppearance: { chipGap: '6px' } }, new Set(['md-multi-select'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-select', properties: {}, selectAppearance: { caretSize: 'x' } }, new Set(['md-select'])));
});

test('retained updates of every supported source property', () => {
  const unsupported = component => [...component.support.ios.unsupportedProperties];
  assert.deepEqual([...SELECT_UPDATE_PROPERTIES].sort(), names(select.properties).filter(n => !unsupported(select).includes(n)).sort());
  assert.deepEqual([...MULTI_SELECT_UPDATE_PROPERTIES].sort(), names(multi.properties).filter(n => !unsupported(multi).includes(n)).sort());
  for (const c of [select, multi]) for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(c, platform), `${c.tag} ${platform}`);
  const options = [{ value: 'london', label: 'London' }, { value: 'paris', label: 'Paris', disabled: true }];
  for (const [key, value] of Object.entries({ value: 'paris', options, open: true, density: -2, placement: 'top-end', maxHeight: '20rem', filterable: true, variant: 'filled' }))
    assert.deepEqual(nativePropertyUpdate('md-select', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of Object.entries({ value: ['london'], maxSelected: 2, displayMode: 'chips-inline', chipOverflow: 'wrap', chipPosition: 'left', trigger: 'button', maxHeight: 240 }))
    assert.deepEqual(nativePropertyUpdate('md-multi-select', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [tag, key, value] of [['md-select', 'value', ['a']], ['md-select', 'virtualize', 'never'], ['md-select', 'density', -5], ['md-select', 'options', [{ value: 1 }]],
    ['md-multi-select', 'maxHeight', '20rem'], ['md-multi-select', 'countFormatter', 'x'], ['md-multi-select', 'maxSelected', -1], ['md-multi-select', 'displayMode', 'list']])
    assert.throws(() => nativePropertyUpdate(tag, { [key]: value }), undefined, `${tag} ${key}`);
  assert.equal(validSelectUpdate('md-select', 'options', '[{"value":"a"}]'), true);
});

test('methods with arguments and results, and their examples', () => {
  for (const c of [select, multi]) for (const name of names(c.methods)) {
    assert.ok(nativeSelectMethod(c.tag, name), name);
    assert.ok(nativeMethodSupported(c.tag, name, c.support.ios), `${c.tag} ${name}`);
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample(c, 'method', name, platform);
      assert.equal(example.status, 'supported', `${c.tag} ${platform} ${name}`);
      assert.match(example.code, c.tag === 'md-select' ? /AWCSelectController\(\)/ : /AWCMultiSelectController\(\)/);
      assert.match(example.code, new RegExp(`controller\\.${name}\\(`));
    }
  }
  assert.deepEqual(nativeMethodCommand('md-select', 'setQuery', ['to']), { command: 'method', method: 'setQuery', arguments: ['to'] });
  assert.deepEqual(nativeMethodCommand('md-multi-select', 'getLabels', [['london']]), { command: 'method', method: 'getLabels', arguments: [['london']] });
  assert.deepEqual(nativeMethodCommand('md-select', 'loadOptions', [[{ value: 'oslo', label: 'Oslo' }]]), { command: 'method', method: 'loadOptions', arguments: [[{ value: 'oslo', label: 'Oslo' }]] });
  for (const [method, args] of [['show', [1]], ['setQuery', []], ['loadOptions', ['[]']], ['getLabels', [[1]]], ['setCustomValidity', [2]]]) assert.throws(() => nativeMethodCommand('md-select', method, args), undefined, method);
  assert.deepEqual(selectMethodArguments('md-select', 'reset', []), []);
  assert.deepEqual(nativeMethodValue({ awcSelectLabels: { london: 'London' } }), { london: 'London' });
  assert.throws(() => nativeMethodValue({ awcSelectLabels: { london: 1 } }));
});
