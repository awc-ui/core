import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TABS_APPEARANCE_FIELDS, TAB_APPEARANCE_FIELDS, tabsAppearance, tabAppearance } from './tabs-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { TABS_UPDATE_PROPERTIES, TAB_UPDATE_PROPERTIES, TAB_PANELS_UPDATE_PROPERTIES, TAB_PANEL_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeItemMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { nativeApiExample } from './native-api-examples.js';

// md-tabs / md-tab / md-tab-panels / md-tab-panel in the Laboratory: the eleven tablist hooks (nine of them md-tab's own),
// the retained property updates of all four, selectTab(index) through the native controller, the released policies and the recipe.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const TAGS = ['md-tabs', 'md-tab', 'md-tab-panels', 'md-tab-panel'];
const ir = Object.fromEntries(await Promise.all(TAGS.map(async tag => [tag, await read(`../../packages/native-compiler/generated/ir/${tag}.json`)])));
const support = { ios: (await read('../../packages/native-ios/NativeSupport.json')).components, android: (await read('../../packages/native-android/support.json')).components };
const policies = tag => ({ ios: support.ios[tag], android: support.android[tag] });
const names = items => items.map(i => i.name ?? i);
const runtimeOnly = ['--md-tab-glide-x', '--md-tab-glide-scale'];   // written inline by md-tabs for every glide

test('the hooks cover the IRs and the released policies', () => {
  assert.deepEqual(TABS_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), [...names(ir['md-tabs'].cssProperties), ...names(ir['md-tab'].cssProperties).filter(n => !runtimeOnly.includes(n))].sort());
  assert.deepEqual(TAB_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), names(ir['md-tab'].cssProperties).filter(n => !runtimeOnly.includes(n)).sort());
  for (const platform of ['ios', 'android']) {
    for (const tag of TAGS) {
      const policy = policies(tag)[platform];
      assert.deepEqual(policy.properties, names(ir[tag].properties), `${tag} ${platform}`);
      assert.deepEqual(policy.events, names(ir[tag].events), `${tag} ${platform}`);
      assert.deepEqual(policy.slots, names(ir[tag].slots), `${tag} ${platform}`);
      if (platform === 'ios') { assert.equal(policy.status, 'native-adapter'); assert.deepEqual(policy.unsupportedProperties, []); assert.deepEqual(policy.unsupportedMethods, []); }
    }
    assert.deepEqual(policies('md-tabs')[platform].methods, ['selectTab'], platform);
    assert.deepEqual(policies('md-tabs')[platform].appearance.fields, TABS_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(policies('md-tab')[platform].appearance.fields, TAB_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.equal(policies('md-tab-panels')[platform].appearance, undefined);
  }
  for (const [tag, key, modifier, type] of [['md-tabs', 'tabsAppearance', 'awcTabsAppearance', 'AWCTabsAppearance'], ['md-tab', 'tabAppearance', 'awcTabAppearance', 'AWCTabAppearance']]) {
    const registry = componentAppearance(tag);
    assert.equal(registry.key, key); assert.equal(registry.swiftModifier, modifier); assert.equal(registry.nativeType, type);
  }
});

test('hook values normalize, render as CSS and as native literals', () => {
  const value = { containerColor: '#E8DEF8', dividerColor: '#7D5260', tabContainerColor: '#FFD8E4', activeLabelColor: '#B3261E', inactiveLabelColor: '#386A20',
    activeIconColor: '#006A6A', inactiveIconColor: '#8D6E63', activeIndicatorColor: '#D84315', activeIndicatorHeight: 5, tabDividerColor: '#1565C0', glideDuration: 120 };
  assert.deepEqual(tabsAppearance.css(value), { '--md-tabs-container-color': '#E8DEF8', '--md-tabs-divider-color': '#7D5260', '--md-tab-container-color': '#FFD8E4',
    '--md-tab-active-label-color': '#B3261E', '--md-tab-inactive-label-color': '#386A20', '--md-tab-active-icon-color': '#006A6A', '--md-tab-inactive-icon-color': '#8D6E63',
    '--md-tab-active-indicator-color': '#D84315', '--md-tab-active-indicator-height': '5px', '--md-tab-divider-color': '#1565C0', '--md-tab-glide-duration': '120ms' });
  for (const f of TABS_APPEARANCE_FIELDS) assert.deepEqual(tabsAppearance.parseInput(f.name, tabsAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  assert.deepEqual(tabAppearance.css({ containerColor: '#FFD8E4', dividerColor: '#1565C0', glideDuration: 0 }), { '--md-tab-container-color': '#FFD8E4', '--md-tab-divider-color': '#1565C0', '--md-tab-glide-duration': '0ms' });
  assert.throws(() => tabsAppearance.normalize({ activeIndicatorHeight: -1 }), { code: 'INVALID_TABS_APPEARANCE' });
  assert.throws(() => tabsAppearance.normalize({ containerColor: 'red' }), { code: 'INVALID_TABS_APPEARANCE' });
  assert.throws(() => tabsAppearance.normalize({ glideX: 3 }), { code: 'INVALID_TABS_APPEARANCE' });
  assert.throws(() => tabAppearance.normalize({ tabContainerColor: '#FFFFFF' }), { code: 'INVALID_TAB_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ tabsAppearance: { activeIndicatorHeight: 5 } }).tabsAppearance, { activeIndicatorHeight: 5 });
  assert.deepEqual(nativeThemeOptions({ tabAppearance: { glideDuration: 90 } }).tabAppearance, { glideDuration: 90 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-tabs', properties: {}, tabsAppearance: { containerColor: '#E8DEF8', glideDuration: 90 } }, new Set(['md-tabs'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-tabs', properties: {}, tabsAppearance: { activeIndicatorHeight: 'tall' } }, new Set(['md-tabs'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-tab', properties: {}, tabAppearance: { tabDividerColor: '#FFFFFF' } }, new Set(['md-tab'])));
});

test('retained updates, selectTab, examples and the recipe', () => {
  assert.deepEqual([...TABS_UPDATE_PROPERTIES], ['activeTabIndex', 'variant', 'divider', 'ariaLabelProp', 'tabWidth', 'width']);
  assert.deepEqual([...TAB_UPDATE_PROPERTIES], ['label', 'icon', 'active', 'disabled', 'inlineIcon', 'variant', 'badge', 'controls', 'density']);
  assert.deepEqual([...TAB_PANELS_UPDATE_PROPERTIES], ['for', 'sizing']);
  assert.deepEqual([...TAB_PANEL_UPDATE_PROPERTIES], ['active']);
  for (const tag of TAGS) for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates({ ...ir[tag], tag, support: policies(tag) }, platform), `${tag} ${platform}`);
  assert.deepEqual(nativePropertyUpdate('md-tabs', { activeTabIndex: 2, divider: 'auto', variant: 'secondary', tabWidth: '120px' }).properties, { activeTabIndex: 2, divider: 'auto', variant: 'secondary', tabWidth: '120px' });
  assert.deepEqual(nativePropertyUpdate('md-tab', { label: 'Files', inlineIcon: true, badge: '3', density: -2 }).properties, { label: 'Files', inlineIcon: true, badge: '3', density: -2 });
  assert.deepEqual(nativePropertyUpdate('md-tab-panels', { sizing: 'active' }).properties, { sizing: 'active' });
  assert.deepEqual(nativePropertyUpdate('md-tab-panel', { active: false }).properties, { active: false });
  assert.throws(() => nativePropertyUpdate('md-tabs', { divider: true }));
  assert.throws(() => nativePropertyUpdate('md-tabs', { variant: 'tertiary' }));
  assert.throws(() => nativePropertyUpdate('md-tabs', { activeTabIndex: '1' }));
  assert.throws(() => nativePropertyUpdate('md-tab', { active: 'yes' }));
  assert.throws(() => nativePropertyUpdate('md-tab', { density: -5 }));
  assert.throws(() => nativePropertyUpdate('md-tab-panels', { sizing: 'auto' }));
  assert.throws(() => nativePropertyUpdate('md-tab-panel', { label: 'x' }));
  assert.ok(nativeItemMethod('md-tabs', 'selectTab'));
  assert.ok(nativeMethodSupported('md-tabs', 'selectTab', policies('md-tabs').ios));
  assert.deepEqual(nativeMethodCommand('md-tabs', 'selectTab', [2]), { command: 'method', method: 'selectTab', arguments: [2] });
  assert.deepEqual(nativeMethodCommand('md-tabs', 'selectTab', [-1]), { command: 'method', method: 'selectTab', arguments: [-1] });
  assert.throws(() => nativeMethodCommand('md-tabs', 'selectTab', []));
  assert.throws(() => nativeMethodCommand('md-tabs', 'selectTab', [1.5]));
  assert.throws(() => nativeMethodCommand('md-tabs', 'selectTab', ['1']));
  for (const platform of ['swift', 'android']) {
    const example = nativeApiExample({ ...ir['md-tabs'], tag: 'md-tabs', support: policies('md-tabs') }, 'method', 'selectTab', platform);
    assert.equal(example.status, 'supported', platform);
    assert.match(example.code, /AWCTabsController/);
    assert.match(example.code, /controller\.selectTab\(2\)/);
  }
  const html = recipeFor('md-tabs').html;
  assert.match(html, /<md-tabs id="reference-tabs" aria-label="Workspace sections"><md-tab label="Overview"><\/md-tab><md-tab label="Activity"><\/md-tab><md-tab label="Settings"><\/md-tab><\/md-tabs>/);
  assert.match(html, /<md-tab-panels for="reference-tabs"><md-tab-panel active>/);
  for (const tag of TAGS) assert.equal(recipeFor(tag).html, html, tag);
});
