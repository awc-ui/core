import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { APP_BAR_APPEARANCE_FIELDS, APP_BAR_APPEARANCE_GROUPS, appBarAppearance, APP_BAR_UPDATE_PROPERTIES, APP_BAR_PART_FIELDS } from './appbar-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeApiExample } from './native-api-examples.js';

// md-app-bar in the Laboratory (n5): the 38 typed hooks (the stylesheet's list), retained updates of every source property,
// the typed part appearances of every exported part, the released policies and their examples.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ios = (await read('../../packages/native-ios/NativeSupport.json')).components, android = (await read('../../packages/native-android/support.json')).components;
const ir = await read('../../packages/native-compiler/generated/ir/md-app-bar.json');
const component = { ...ir, tag: 'md-app-bar', support: { ios: ios['md-app-bar'], android: android['md-app-bar'] } };
const SEARCH_EXTRA = ['--md-app-bar-search-container-color', '--md-app-bar-search-container-color-scrolled', '--md-app-bar-search-container-shape',
  '--md-app-bar-search-placeholder-color', '--md-app-bar-search-input-color', '--md-app-bar-search-trailing-icon-color'];

test('app-bar hooks cover the IR (plus the six search hooks the CEM generator drops) and both released policies', () => {
  assert.equal(APP_BAR_APPEARANCE_FIELDS.length, 38);
  assert.deepEqual(APP_BAR_APPEARANCE_FIELDS.map(f => f.cssProperty).filter(n => !ir.cssProperties.some(p => p.name === n)).sort(), [...SEARCH_EXTRA].sort());
  assert.equal(ir.cssProperties.every(p => APP_BAR_APPEARANCE_FIELDS.some(f => f.cssProperty === p.name)), true);
  for (const [platform, p] of [['ios', ios['md-app-bar']], ['android', android['md-app-bar']]]) {
    assert.deepEqual(p.appearance.fields, APP_BAR_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(p.visualParts, ir.cssParts.map(x => x.name), `${platform} parts`);
    for (const kind of ['properties', 'methods', 'events', 'slots']) assert.deepEqual(p[kind], ir[kind].map(x => x.name), `${platform} ${kind}`);
    for (const kind of ['unsupportedProperties', 'unsupportedMethods', 'unsupportedEvents', 'unsupportedSlots']) assert.deepEqual(p[kind] ?? [], [], `${platform} ${kind}`);
  }
  const registry = componentAppearance('md-app-bar');
  assert.equal(registry.nativeType, 'AWCAppBarAppearance'); assert.equal(registry.key, 'appBarAppearance'); assert.equal(registry.swiftModifier, 'awcAppBarAppearance');
  assert.deepEqual(APP_BAR_APPEARANCE_GROUPS.flatMap(([, n]) => n).sort(), APP_BAR_APPEARANCE_FIELDS.map(f => f.name).sort());
});

test('app-bar hook values normalize, render as CSS text and round-trip through the inputs', () => {
  const v = { containerColor: '#FFF3E0', rowHeight: 72, containerShape: 16, searchContainerShape: '0 0 24px 24px', containerElevation: '0 1px 2px rgba(0, 0, 0, 0.3)', iconSize: 28 };
  const css = appBarAppearance.css(v);
  assert.equal(css['--md-app-bar-row-height'], '72px'); assert.equal(css['--md-app-bar-container-shape'], '16px');
  assert.equal(css['--md-app-bar-search-container-shape'], '0 0 24px 24px'); assert.equal(css['--md-app-bar-container-color'], '#FFF3E0');
  for (const [name, value] of Object.entries(v)) assert.deepEqual(appBarAppearance.parseInput(name, appBarAppearance.formatInput(name, value)), value, name);
  assert.equal(appBarAppearance.nativeValue('rowHeight', 72, 'swift'), '"72px"');
  assert.equal(appBarAppearance.nativeValue('containerColor', '#fff3e0', 'android'), '"#FFF3E0"');
  for (const bad of [{ containerColor: 'red' }, { rowHeight: -1 }, { containerShape: '1em' }, { containerElevation: 'x;y' }, { bogus: 1 }])
    assert.throws(() => appBarAppearance.normalize(bad), { code: 'INVALID_APP_BAR_APPEARANCE' }, JSON.stringify(bad));
  assert.deepEqual(nativeThemeOptions({ appBarAppearance: { rowHeight: 72 }, appBarAppearanceDefaults: { containerColor: '#E0F2F1' } }),
    { appBarAppearance: { rowHeight: 72 }, appBarAppearanceDefaults: { containerColor: '#E0F2F1' } });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-app-bar', properties: {}, appBarAppearance: { containerColor: '#E0F2F1' } }, new Set(['md-app-bar'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-app-bar', properties: {}, appBarAppearance: { iconSize: -2 } }, new Set(['md-app-bar'])));
});

test('retained updates of every source property', () => {
  assert.deepEqual([...APP_BAR_UPDATE_PROPERTIES].sort(), ir.properties.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component, platform), platform);
  for (const [key, value] of Object.entries({ variant: 'search', titleAlignment: 'center', headline: 'Inbox', subtitle: '12 unread', scrolled: true, density: -2,
    leadingIcon: 'arrow_back', leadingIconLabel: 'Back', searchPlaceholder: 'Search mail', searchValue: 'report', searchAriaLabel: 'Search mail', searchDisabled: true }))
    assert.deepEqual(nativePropertyUpdate('md-app-bar', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of [['variant', 'tiny'], ['titleAlignment', 'end'], ['density', -5], ['scrolled', 'yes'], ['bogus', 1]])
    assert.throws(() => nativePropertyUpdate('md-app-bar', { [key]: value }), undefined, `${key} ${value}`);
});

test('every exported part has a typed native part appearance example with the fields it honours', () => {
  assert.deepEqual(Object.keys(APP_BAR_PART_FIELDS).sort(), ir.cssParts.map(p => p.name).sort());
  for (const platform of ['swift', 'android']) for (const part of ir.cssParts.map(p => p.name)) {
    const example = nativeApiExample(component, 'cssPart', part, platform);
    assert.equal(example.status, 'native-equivalent', `${part} ${platform}`);
    const swiftCase = part.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), kotlinCase = swiftCase[0].toUpperCase() + swiftCase.slice(1);
    assert.match(example.code, platform === 'swift' ? new RegExp(`\\.awcAppBarPartAppearance\\(\\.init\\(.*\\), part: \\.${swiftCase}\\)`)
      : new RegExp(`AWCAppBarPartAppearanceScope\\(AWCAppBarPart\\.${kotlinCase}, AWCAccordionPartAppearance\\(`), `${part} ${platform}`);
    assert.ok(example.notes.some(n => n.includes(APP_BAR_PART_FIELDS[part].join(', '))), `${part} notes`);
  }
});
