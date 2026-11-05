import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOOLBAR_APPEARANCE_FIELDS, TOOLBAR_APPEARANCE_GROUPS, toolbarAppearance, TOOLBAR_UPDATE_PROPERTIES, validToolbarUpdate } from './toolbar-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// n5's navigation components in the Laboratory (md-toolbar): typed hooks, retained updates of every source property,
// setFocus() through the controller, released policies and examples.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ios = (await read('../../packages/native-ios/NativeSupport.json')).components, android = (await read('../../packages/native-android/support.json')).components;
const irOf = async tag => read(`../../packages/native-compiler/generated/ir/${tag}.json`);
const toolbar = await irOf('md-toolbar');
const component = (tag, ir) => ({ ...ir, tag, support: { ios: ios[tag], android: android[tag] } });

test('md-toolbar hooks cover the IR and both released policies', () => {
  assert.deepEqual(TOOLBAR_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), toolbar.cssProperties.map(p => p.name).sort());
  for (const [platform, p] of [['ios', ios['md-toolbar']], ['android', android['md-toolbar']]]) {
    assert.deepEqual(p.appearance.fields, TOOLBAR_APPEARANCE_FIELDS.map(f => f.name), platform);
    for (const kind of ['properties', 'methods', 'events', 'slots']) assert.deepEqual(p[kind], toolbar[kind].map(x => x.name), `${platform} ${kind}`);
    for (const kind of ['unsupportedProperties', 'unsupportedMethods', 'unsupportedEvents', 'unsupportedSlots']) assert.deepEqual(p[kind] ?? [], [], `${platform} ${kind}`);
  }
  const registry = componentAppearance('md-toolbar');
  assert.equal(registry.nativeType, 'AWCToolbarAppearance'); assert.equal(registry.key, 'toolbarAppearance'); assert.equal(registry.swiftModifier, 'awcToolbarAppearance');
  assert.deepEqual(TOOLBAR_APPEARANCE_GROUPS.flatMap(([, names]) => names).sort(), TOOLBAR_APPEARANCE_FIELDS.map(f => f.name).sort());
});

test('md-toolbar hook values normalize, render as CSS and round-trip through the inputs', () => {
  const v = { containerColor: '#FFE0B2', iconColor: '#BF360C', containerShape: 12, containerHeight: 72, padding: 20, gap: 10, fabGap: 28, overflowX: 'auto', overflowY: 'hidden', flexWrap: 'wrap', scrollbarWidth: 'thin' };
  const css = toolbarAppearance.css(v);
  assert.equal(Object.keys(css).length, 11);
  assert.equal(css['--md-toolbar-container-shape'], '12px'); assert.equal(css['--md-toolbar-overflow-x'], 'auto'); assert.equal(css['--md-toolbar-flex-wrap'], 'wrap');
  for (const f of TOOLBAR_APPEARANCE_FIELDS) assert.deepEqual(toolbarAppearance.parseInput(f.name, toolbarAppearance.formatInput(f.name, v[f.name])), v[f.name], f.name);
  assert.equal(toolbarAppearance.normalize({ overflowX: ' SCROLL ' }).overflowX, 'scroll');
  for (const bad of [{ overflowX: 'sideways' }, { flexWrap: 'yes' }, { scrollbarWidth: 2 }, { gap: -1 }, { containerColor: 'red' }, { bogus: 1 }])
    assert.throws(() => toolbarAppearance.normalize(bad), { code: 'INVALID_TOOLBAR_APPEARANCE' }, JSON.stringify(bad));
  assert.equal(toolbarAppearance.nativeValue('overflowX', 'auto', 'swift'), '"auto"');
  assert.equal(toolbarAppearance.nativeValue('gap', 10, 'kotlin'), '10.0');
  assert.deepEqual(nativeThemeOptions({ toolbarAppearance: { gap: 8 }, toolbarAppearanceDefaults: { padding: 12 } }), { toolbarAppearance: { gap: 8 }, toolbarAppearanceDefaults: { padding: 12 } });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-toolbar', properties: {}, toolbarAppearance: { containerColor: '#FFE0B2' } }, new Set(['md-toolbar'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-toolbar', properties: {}, toolbarAppearance: { overflowX: 'nope' } }, new Set(['md-toolbar'])));
});

test('md-toolbar retained updates of every source property', () => {
  assert.deepEqual([...TOOLBAR_UPDATE_PROPERTIES].sort(), toolbar.properties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component('md-toolbar', toolbar), platform), platform);
  for (const [key, value] of Object.entries({ variant: 'floating', color: 'vibrant', layout: 'vertical', alignment: 'space-between', containerSemantics: 'generic', ariaLabelProp: 'Formatting', ariaLabelledby: 'heading', density: -3 }))
    assert.deepEqual(nativePropertyUpdate('md-toolbar', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of [['variant', 'pill'], ['layout', 'diagonal'], ['density', -5], ['density', '0'], ['alignment', 'around'], ['bogus', 1]])
    assert.throws(() => nativePropertyUpdate('md-toolbar', { [key]: value }), undefined, `${key} ${value}`);
  assert.equal(validToolbarUpdate('ariaLabelProp', 3), false);
});

test('md-toolbar setFocus() through AWCToolbarController and its examples', () => {
  assert.equal(nativeMethodSupported('md-toolbar', 'setFocus', ios['md-toolbar']), true);
  assert.deepEqual(nativeMethodCommand('md-toolbar', 'setFocus', []), { command: 'method', method: 'setFocus', arguments: [] });
  assert.throws(() => nativeMethodCommand('md-toolbar', 'setFocus', [1]));
  for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component('md-toolbar', toolbar), 'method', 'setFocus', platform);
    assert.equal(example.status, 'supported', platform);
    assert.match(example.code, /controller\.setFocus\(\)/, platform);
    assert.match(example.code, platform === 'swift' ? /\.awcToolbarController\(controller\)/ : /AWCToolbarControllerScope\(controller\)/, platform);
  }
});
