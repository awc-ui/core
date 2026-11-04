import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NAVIGATION_BAR_APPEARANCE_FIELDS, NAVIGATION_TAB_APPEARANCE_FIELDS, navigationBarAppearance, navigationTabAppearance } from './navbar-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { NAVIGATION_BAR_UPDATE_PROPERTIES, NAVIGATION_TAB_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeItemMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { nativeApiExample } from './native-api-examples.js';

// md-navigation-bar / md-navigation-tab in the Laboratory: the bar's 7 hooks plus the destination's 22 documented hooks,
// retained updates of both, select(index) / focusTab(index) / focusEl() through the native controllers, the released
// policies and the recipe.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const TAGS = ['md-navigation-bar', 'md-navigation-tab'];
const ir = Object.fromEntries(await Promise.all(TAGS.map(async tag => [tag, await read(`../../packages/native-compiler/generated/ir/${tag}.json`)])));
const support = { ios: (await read('../../packages/native-ios/NativeSupport.json')).components, android: (await read('../../packages/native-android/support.json')).components };
const policies = tag => ({ ios: support.ios[tag], android: support.android[tag] });
const names = items => items.map(i => i.name ?? i);

test('the hooks cover the IRs (the stylesheet documents more destination hooks than the CEM lists) and the released policies', () => {
  const bar = NAVIGATION_BAR_APPEARANCE_FIELDS.map(f => f.cssProperty), tab = NAVIGATION_TAB_APPEARANCE_FIELDS.map(f => f.cssProperty);
  for (const p of names(ir['md-navigation-bar'].cssProperties)) assert.ok(bar.includes(p), p);
  for (const p of names(ir['md-navigation-tab'].cssProperties)) assert.ok(tab.includes(p), p);
  assert.equal(NAVIGATION_TAB_APPEARANCE_FIELDS.length, 22); assert.equal(NAVIGATION_BAR_APPEARANCE_FIELDS.length, 29);
  for (const platform of ['ios', 'android']) {
    for (const tag of TAGS) {
      const policy = policies(tag)[platform];
      assert.deepEqual(policy.properties, names(ir[tag].properties), `${tag} ${platform}`);
      assert.deepEqual(policy.events, names(ir[tag].events), `${tag} ${platform}`);
      assert.deepEqual(policy.slots, names(ir[tag].slots), `${tag} ${platform}`);
      assert.deepEqual(policy.methods, names(ir[tag].methods), `${tag} ${platform}`);
      if (platform === 'ios') { assert.equal(policy.status, 'native-adapter'); assert.deepEqual(policy.unsupportedProperties, []); assert.deepEqual(policy.unsupportedMethods, []); }
    }
    assert.deepEqual(policies('md-navigation-bar')[platform].appearance.fields, NAVIGATION_BAR_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(policies('md-navigation-tab')[platform].appearance.fields, NAVIGATION_TAB_APPEARANCE_FIELDS.map(f => f.name), platform);
  }
  for (const [tag, key, modifier, type] of [['md-navigation-bar', 'navigationBarAppearance', 'awcNavigationBarAppearance', 'AWCNavigationBarAppearance'],
    ['md-navigation-tab', 'navigationTabAppearance', 'awcNavigationTabAppearance', 'AWCNavigationTabAppearance']]) {
    const registry = componentAppearance(tag);
    assert.equal(registry.key, key); assert.equal(registry.swiftModifier, modifier); assert.equal(registry.nativeType, type);
  }
});

test('hook values normalize, render as CSS and as native literals', () => {
  const value = { containerColor: '#E8F5E9', containerHeight: 72, dividerColor: '#2E7D32', dividerWidth: 2, zIndex: 7, activeIndicatorColor: '#FFCC80',
    activeIndicatorWidth: 64, activeIndicatorHeight: 28, activeIndicatorShape: 8, activeIconColor: '#E65100', labelFontSize: 13, labelFontWeight: 800,
    iconSize: 28, paddingBlockStart: 8, focusStateLayerOpacity: 0.2, badgeColor: '#1565C0', disabledOpacity: 0.5 };
  const css = navigationBarAppearance.css(value);
  assert.equal(css['--md-navigation-bar-container-height'], '72px'); assert.equal(css['--md-navigation-bar-z-index'], '7');
  assert.equal(css['--md-navigation-tab-active-indicator-width'], '64px'); assert.equal(css['--md-navigation-tab-label-font-weight'], '800');
  assert.equal(css['--md-navigation-tab-focus-state-layer-opacity'], '0.2'); assert.equal(css['--md-navigation-tab-disabled-opacity'], '0.5');
  for (const [k, v] of Object.entries(value)) assert.deepEqual(navigationBarAppearance.parseInput(k, navigationBarAppearance.formatInput(k, v)), v, k);
  assert.deepEqual(navigationTabAppearance.css({ labelFont: '500 12px/16px Roboto, sans-serif' }), { '--md-navigation-tab-label-font': '500 12px/16px Roboto, sans-serif' });
  assert.throws(() => navigationBarAppearance.normalize({ containerHeight: -1 }), { code: 'INVALID_NAVIGATION_BAR_APPEARANCE' });
  assert.throws(() => navigationBarAppearance.normalize({ disabledOpacity: 2 }), { code: 'INVALID_NAVIGATION_BAR_APPEARANCE' });
  assert.throws(() => navigationTabAppearance.normalize({ containerColor: '#FFFFFF' }), { code: 'INVALID_NAVIGATION_TAB_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ navigationBarAppearance: { containerHeight: 72 } }).navigationBarAppearance, { containerHeight: 72 });
  assert.deepEqual(nativeThemeOptions({ navigationTabAppearance: { iconSize: 28 } }).navigationTabAppearance, { iconSize: 28 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-navigation-bar', properties: {}, navigationBarAppearance: { containerColor: '#E8F5E9', zIndex: 7 } }, new Set(['md-navigation-bar'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-navigation-tab', properties: {}, navigationTabAppearance: { containerHeight: 70 } }, new Set(['md-navigation-tab'])));
});

test('retained updates, methods, examples and the recipe', () => {
  assert.deepEqual([...NAVIGATION_BAR_UPDATE_PROPERTIES], ['activeIndex', 'labelBehavior', 'manualActivation', 'density']);
  assert.deepEqual([...NAVIGATION_TAB_UPDATE_PROPERTIES], ['active', 'disabled', 'softDisabled', 'label', 'icon', 'activeIcon', 'badge', 'badgeValue', 'badgeMax', 'href', 'target', 'labelBehavior', 'density']);
  for (const tag of TAGS) for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates({ ...ir[tag], tag, support: policies(tag) }, platform), `${tag} ${platform}`);
  assert.deepEqual(nativePropertyUpdate('md-navigation-bar', { activeIndex: 2, labelBehavior: 'selected', manualActivation: true }).properties, { activeIndex: 2, labelBehavior: 'selected', manualActivation: true });
  assert.deepEqual(nativePropertyUpdate('md-navigation-tab', { softDisabled: true, badgeValue: '12', badgeMax: 9, labelBehavior: 'none' }).properties, { softDisabled: true, badgeValue: '12', badgeMax: 9, labelBehavior: 'none' });
  assert.throws(() => nativePropertyUpdate('md-navigation-bar', { labelBehavior: 'hidden' }));
  assert.throws(() => nativePropertyUpdate('md-navigation-bar', { activeIndex: '1' }));
  assert.throws(() => nativePropertyUpdate('md-navigation-tab', { badge: 'yes' }));
  assert.throws(() => nativePropertyUpdate('md-navigation-tab', { badgeMax: 'x' }));
  for (const name of ['select', 'focusTab']) {
    assert.ok(nativeItemMethod('md-navigation-bar', name)); assert.ok(nativeMethodSupported('md-navigation-bar', name, policies('md-navigation-bar').ios));
    assert.deepEqual(nativeMethodCommand('md-navigation-bar', name, [2]), { command: 'method', method: name, arguments: [2] });
    assert.throws(() => nativeMethodCommand('md-navigation-bar', name, [])); assert.throws(() => nativeMethodCommand('md-navigation-bar', name, [0.5]));
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample({ ...ir['md-navigation-bar'], tag: 'md-navigation-bar', support: policies('md-navigation-bar') }, 'method', name, platform);
      assert.equal(example.status, 'supported', `${platform} ${name}`); assert.match(example.code, /AWCNavigationBarController/); assert.match(example.code, new RegExp(`controller\\.${name}\\(2\\)`));
    }
  }
  assert.ok(nativeItemMethod('md-navigation-tab', 'focusEl'));
  assert.deepEqual(nativeMethodCommand('md-navigation-tab', 'focusEl', []), { command: 'method', method: 'focusEl', arguments: [] });
  for (const platform of ['swift', 'android']) assert.match(nativeApiExample({ ...ir['md-navigation-tab'], tag: 'md-navigation-tab', support: policies('md-navigation-tab') }, 'method', 'focusEl', platform).code, /controller\.focusEl\(\)/);
  const html = recipeFor('md-navigation-bar').html;
  assert.match(html, /<md-navigation-tab icon="home" label="Home"><\/md-navigation-tab><md-navigation-tab icon="explore" label="Explore"><\/md-navigation-tab><md-navigation-tab icon="bookmark" label="Saved">/);
  assert.equal(recipeFor('md-navigation-tab').html, html);
});
