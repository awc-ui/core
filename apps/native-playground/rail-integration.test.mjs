import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NAVIGATION_RAIL_APPEARANCE_FIELDS, NAVIGATION_RAIL_TAB_APPEARANCE_FIELDS, NAVIGATION_RAIL_APPEARANCE_GROUPS, NAVIGATION_RAIL_TAB_APPEARANCE_GROUPS, navigationRailAppearance,
  navigationRailTabAppearance, NAVIGATION_RAIL_UPDATE_PROPERTIES, NAVIGATION_RAIL_TAB_UPDATE_PROPERTIES, RAIL_PART_FIELDS, RAIL_TAB_PART_FIELDS } from './rail-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-navigation-rail / md-navigation-rail-tab in the Laboratory (n5): typed hooks (the stylesheet's lists), retained updates
// of every source property, the methods through AWCNavigationRailController, the typed part appearances of every exported
// part, the released policies and their examples.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ios = (await read('../../packages/native-ios/NativeSupport.json')).components, android = (await read('../../packages/native-android/support.json')).components;
const irOf = async tag => read(`../../packages/native-compiler/generated/ir/${tag}.json`);
const ir = { 'md-navigation-rail': await irOf('md-navigation-rail'), 'md-navigation-rail-tab': await irOf('md-navigation-rail-tab') };
const component = tag => ({ ...ir[tag], tag, support: { ios: ios[tag], android: android[tag] } });
const FIELDS = { 'md-navigation-rail': NAVIGATION_RAIL_APPEARANCE_FIELDS, 'md-navigation-rail-tab': NAVIGATION_RAIL_TAB_APPEARANCE_FIELDS };

test('rail and destination hooks cover the IR (the rail adds the documented horizontal-height) and both released policies', () => {
  assert.deepEqual(NAVIGATION_RAIL_TAB_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), ir['md-navigation-rail-tab'].cssProperties.map(p => p.name).sort());
  assert.deepEqual(NAVIGATION_RAIL_APPEARANCE_FIELDS.map(f => f.cssProperty).filter(n => !ir['md-navigation-rail'].cssProperties.some(p => p.name === n)), ['--md-navigation-rail-horizontal-height']);
  assert.equal(ir['md-navigation-rail'].cssProperties.every(p => NAVIGATION_RAIL_APPEARANCE_FIELDS.some(f => f.cssProperty === p.name)), true);
  for (const tag of ['md-navigation-rail', 'md-navigation-rail-tab']) for (const [platform, p] of [['ios', ios[tag]], ['android', android[tag]]]) {
    assert.deepEqual(p.appearance.fields, FIELDS[tag].map(f => f.name), `${platform} ${tag}`);
    assert.deepEqual(p.visualParts, ir[tag].cssParts.map(x => x.name), `${platform} ${tag} parts`);
    for (const kind of ['properties', 'methods', 'events', 'slots']) assert.deepEqual(p[kind], ir[tag][kind].map(x => x.name), `${platform} ${tag} ${kind}`);
    for (const kind of ['unsupportedProperties', 'unsupportedMethods', 'unsupportedEvents', 'unsupportedSlots']) assert.deepEqual(p[kind] ?? [], [], `${platform} ${tag} ${kind}`);
  }
  for (const [tag, type, key, modifier, groups] of [['md-navigation-rail', 'AWCNavigationRailAppearance', 'navigationRailAppearance', 'awcNavigationRailAppearance', NAVIGATION_RAIL_APPEARANCE_GROUPS],
    ['md-navigation-rail-tab', 'AWCNavigationRailTabAppearance', 'navigationRailTabAppearance', 'awcNavigationRailTabAppearance', NAVIGATION_RAIL_TAB_APPEARANCE_GROUPS]]) {
    const registry = componentAppearance(tag);
    assert.equal(registry.nativeType, type); assert.equal(registry.key, key); assert.equal(registry.swiftModifier, modifier);
    assert.deepEqual(groups.flatMap(([, n]) => n).sort(), FIELDS[tag].map(f => f.name).sort(), tag);
  }
});

test('rail hook values normalize, render as CSS and round-trip through the inputs', () => {
  const v = { containerColor: '#E0F2F1', containerWidth: 96, expandedWidth: 260, gap: 20, paddingBlock: 24, horizontalHeight: 72, logoIconSize: 32 };
  const css = navigationRailAppearance.css(v);
  assert.equal(css['--md-navigation-rail-container-width'], '96px'); assert.equal(css['--md-navigation-rail-horizontal-height'], '72px');
  for (const [name, value] of Object.entries(v)) assert.deepEqual(navigationRailAppearance.parseInput(name, navigationRailAppearance.formatInput(name, value)), value, name);
  const t = { indicatorColor: '#FFCC80', indicatorShape: 8, caretDuration: 100, focusStateLayerOpacity: 0.2, labelTypography: '600 13px/18px Roboto' };
  const tcss = navigationRailTabAppearance.css(t);
  assert.equal(tcss['--md-navigation-rail-tab-caret-duration'], '100ms'); assert.equal(tcss['--md-navigation-rail-tab-indicator-shape'], '8px');
  for (const bad of [{ containerColor: 'red' }, { gap: -1 }, { bogus: 1 }]) assert.throws(() => navigationRailAppearance.normalize(bad), { code: 'INVALID_NAVIGATION_RAIL_APPEARANCE' }, JSON.stringify(bad));
  assert.throws(() => navigationRailTabAppearance.normalize({ focusStateLayerOpacity: 2 }), { code: 'INVALID_NAVIGATION_RAIL_TAB_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ navigationRailAppearance: { gap: 8 }, navigationRailTabAppearanceDefaults: { indicatorWidth: 64 } }),
    { navigationRailAppearance: { gap: 8 }, navigationRailTabAppearanceDefaults: { indicatorWidth: 64 } });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-navigation-rail', properties: {}, navigationRailAppearance: { containerColor: '#E0F2F1' } }, new Set(['md-navigation-rail'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-navigation-rail-tab', properties: {}, navigationRailTabAppearance: { iconSize: -2 } }, new Set(['md-navigation-rail-tab'])));
});

test('retained updates of every source property', () => {
  assert.deepEqual([...NAVIGATION_RAIL_UPDATE_PROPERTIES].sort(), ir['md-navigation-rail'].properties.map(p => p.name).sort());
  assert.deepEqual([...NAVIGATION_RAIL_TAB_UPDATE_PROPERTIES].sort(), ir['md-navigation-rail-tab'].properties.map(p => p.name).sort());
  for (const tag of ['md-navigation-rail', 'md-navigation-rail-tab']) for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component(tag), platform), `${tag} ${platform}`);
  for (const [key, value] of Object.entries({ variant: 'expanded', modal: true, alignment: 'middle', labelVisibility: 'selected', activeIndex: 2, density: -2, orientation: 'horizontal', maxVisible: 3, overflowLabel: 'More', label: 'Mail' }))
    assert.deepEqual(nativePropertyUpdate('md-navigation-rail', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of Object.entries({ label: 'Inbox', icon: 'inbox', active: true, badge: true, badgeValue: '12', href: '#inbox', labelVisibility: 'none', density: -1 }))
    assert.deepEqual(nativePropertyUpdate('md-navigation-rail-tab', { [key]: value }), { command: 'update', properties: { [key]: value } }, key);
  for (const [key, value] of [['variant', 'mini'], ['alignment', 'center'], ['density', -5], ['orientation', 'diagonal'], ['modal', 'yes'], ['bogus', 1]])
    assert.throws(() => nativePropertyUpdate('md-navigation-rail', { [key]: value }), undefined, `${key} ${value}`);
  assert.throws(() => nativePropertyUpdate('md-navigation-rail-tab', { active: 1 }));
});

test('methods through AWCNavigationRailController and their examples', () => {
  for (const name of ['expand', 'collapse', 'toggle']) {
    assert.equal(nativeMethodSupported('md-navigation-rail', name, ios['md-navigation-rail']), true, name);
    assert.deepEqual(nativeMethodCommand('md-navigation-rail', name, []), { command: 'method', method: name, arguments: [] });
    assert.throws(() => nativeMethodCommand('md-navigation-rail', name, [1]));
  }
  assert.deepEqual(nativeMethodCommand('md-navigation-rail', 'focusTab', [2]), { command: 'method', method: 'focusTab', arguments: [2] });
  for (const bad of [[], [1.5], ['1'], [1, 2]]) assert.throws(() => nativeMethodCommand('md-navigation-rail', 'focusTab', bad), undefined, JSON.stringify(bad));
  assert.equal(nativeMethodSupported('md-navigation-rail-tab', 'clearSubmenuSelection', android['md-navigation-rail-tab']), true);
  assert.deepEqual(nativeMethodCommand('md-navigation-rail-tab', 'clearSubmenuSelection', []), { command: 'method', method: 'clearSubmenuSelection', arguments: [] });
  for (const platform of ['swift', 'android']) {
    for (const [tag, name, call] of [['md-navigation-rail', 'expand', /controller\.expand\(\)/], ['md-navigation-rail', 'focusTab', /controller\.focusTab\(1\)/],
      ['md-navigation-rail-tab', 'clearSubmenuSelection', platform === 'swift' ? /controller\.clearSubmenuSelection\(tabIndex: 1\)/ : /controller\.clearSubmenuSelection\(1\)/]]) {
      const example = nativeApiExample(component(tag), 'method', name, platform);
      assert.equal(example.status, 'supported', `${platform} ${name}`);
      assert.match(example.code, call, `${platform} ${name}`);
      assert.match(example.code, platform === 'swift' ? /\.awcNavigationRailController\(controller\)/ : /AWCNavigationRailControllerScope\(controller\)/, `${platform} ${name}`);
    }
  }
});

test('every exported part has a typed native part appearance example with the fields it honours', () => {
  for (const [tag, honoured] of [['md-navigation-rail', RAIL_PART_FIELDS], ['md-navigation-rail-tab', RAIL_TAB_PART_FIELDS]]) {
    assert.deepEqual(Object.keys(honoured).sort(), ir[tag].cssParts.map(p => p.name).sort(), tag);
    for (const platform of ['swift', 'android']) for (const part of ir[tag].cssParts.map(p => p.name)) {
      const example = nativeApiExample(component(tag), 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', `${tag} ${part} ${platform}`);
      const swiftCase = part.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), kotlinCase = swiftCase[0].toUpperCase() + swiftCase.slice(1);
      const re = tag === 'md-navigation-rail'
        ? (platform === 'swift' ? new RegExp(`\\.awcNavigationRailPartAppearance\\(\\.init\\(.*\\), part: \\.${swiftCase}\\)`) : new RegExp(`AWCNavigationRailPartAppearanceScope\\(AWCNavigationRailPart\\.${kotlinCase}, AWCAccordionPartAppearance\\(`))
        : (platform === 'swift' ? new RegExp(`\\.awcNavigationRailTabPartAppearance\\(\\.init\\(.*\\), part: \\.${swiftCase}\\)`) : new RegExp(`AWCNavigationRailTabPartAppearanceScope\\(AWCNavigationRailTabPart\\.${kotlinCase}, AWCAccordionPartAppearance\\(`));
      assert.match(example.code, re, `${tag} ${part} ${platform}`);
      assert.ok(example.notes.some(n => n.includes(honoured[part].join(', '))), `${tag} ${part} notes`);
    }
  }
});
