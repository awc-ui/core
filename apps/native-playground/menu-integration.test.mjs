import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MENU_APPEARANCE_FIELDS, menuAppearance } from './menu-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { MENU_UPDATE_PROPERTIES, MENU_ITEM_UPDATE_PROPERTIES, SUB_MENU_ITEM_UPDATE_PROPERTIES, MENU_ITEM_GROUP_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeLifecycleMethod, nativeItemMethod, nativeMethodSupported, nativeMethodCommand, nativeMethodResultsCommand } from './native-methods.js';
import { nativeApiExample, nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { usageSnippet } from './usage-snippets.js';
import { recipeFor } from './recipes.js';

// md-menu / md-menu-item / md-menu-item-group / md-sub-menu-item in the Laboratory: the eleven md-menu hooks (five of them the
// rows' own), retained updates of all four, show/close/whenClosed with call IDs, reposition and collapse, the released policies,
// and examples and copyable snippets that present the anchored menu in an AWCMenuScope.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const TAGS = ['md-menu', 'md-menu-item', 'md-menu-item-group', 'md-sub-menu-item'];
const ir = Object.fromEntries(await Promise.all(TAGS.map(async tag => [tag, await read(`../../packages/native-compiler/generated/ir/${tag}.json`)])));
const support = { ios: (await read('../../packages/native-ios/NativeSupport.json')).components, android: (await read('../../packages/native-android/support.json')).components };
const component = tag => ({ ...ir[tag], tag, support: { ios: support.ios[tag], android: support.android[tag] } });
const names = items => items.map(i => i.name ?? i);
const internalHooks = ['--md-menu-inline-surface-color', '--md-menu-inline-fill-radius-end'];   // md-date-picker's inline embedding

test('the hooks cover the IRs and the released policies', () => {
  assert.deepEqual(MENU_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(),
    [...names(ir['md-menu'].cssProperties).filter(n => !internalHooks.includes(n)), ...names(ir['md-menu-item'].cssProperties)].sort());
  for (const platform of ['ios', 'android']) {
    for (const tag of TAGS) {
      const policy = support[platform][tag];
      assert.deepEqual(policy.properties, names(ir[tag].properties), `${tag} ${platform}`);
      assert.deepEqual(policy.events, names(ir[tag].events), `${tag} ${platform}`);
      assert.deepEqual(policy.slots, names(ir[tag].slots), `${tag} ${platform}`);
      if (platform === 'ios') { assert.equal(policy.status, 'native-adapter'); assert.deepEqual(policy.unsupportedProperties, []); assert.deepEqual(policy.unsupportedSlots, []); }
    }
    assert.deepEqual(support[platform]['md-menu'].methods, ['getScrollViewport', 'show', 'reposition', 'whenClosed', 'close'], platform);
    assert.deepEqual(support[platform]['md-sub-menu-item'].methods, ['collapse'], platform);
    assert.deepEqual(support[platform]['md-menu'].appearance.fields, MENU_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.equal(support[platform]['md-menu-item'].appearance, undefined);
    assert.match(support[platform]['md-menu'].notes.join(' '), /setComboboxElement\(\) and setVirtualProvider\(\)/);
  }
  assert.deepEqual(support.ios['md-menu'].unsupportedMethods, ['setComboboxElement', 'setVirtualProvider']);
  const registry = componentAppearance('md-menu');
  assert.equal(registry.key, 'menuAppearance'); assert.equal(registry.swiftModifier, 'awcMenuAppearance'); assert.equal(registry.nativeType, 'AWCMenuAppearance');
  assert.deepEqual(registry.groups.flatMap(([, fields]) => fields), MENU_APPEARANCE_FIELDS.map(f => f.name));
  assert.equal(componentAppearance('md-menu-item'), undefined);
});

test('menu appearance values are px lengths and native CSS text', () => {
  assert.deepEqual(menuAppearance.normalize({ minWidth: 260, itemHeight: 56 }), { minWidth: 260, itemHeight: 56 });
  assert.deepEqual(menuAppearance.css({ maxBlockSize: 320, itemGap: 8 }), { '--md-menu-max-block-size': '320px', '--md-menu-item-gap': '8px' });
  assert.equal(menuAppearance.nativeValue('itemHeight', 56, 'swift'), '"56px"');
  assert.equal(menuAppearance.nativeValue('minWidth', 112.5, 'kotlin'), '"112.5px"');
  for (const bad of [{ itemHeight: -1 }, { itemHeight: '56px' }, { groupContainerShape: 12 }, { inlineSurfaceColor: '#FFFFFF' }, { bogus: 1 }]) {
    assert.throws(() => menuAppearance.normalize(bad), error => error.code === 'INVALID_MENU_APPEARANCE', JSON.stringify(bad));
  }
  assert.deepEqual(nativeThemeOptions({ menuAppearance: { itemHeight: 56 }, menuAppearanceDefaults: { minWidth: 200 } }), { menuAppearanceDefaults: { minWidth: 200 }, menuAppearance: { itemHeight: 56 } });
});

test('retained updates of the four tags follow the source types', () => {
  for (const [tag, list] of [['md-menu', MENU_UPDATE_PROPERTIES], ['md-menu-item', MENU_ITEM_UPDATE_PROPERTIES], ['md-sub-menu-item', SUB_MENU_ITEM_UPDATE_PROPERTIES], ['md-menu-item-group', MENU_ITEM_GROUP_UPDATE_PROPERTIES]]) {
    assert.deepEqual([...list].sort(), names(ir[tag].properties).sort(), tag);
    for (const platform of ['ios', 'android']) assert.equal(supportsRetainedPropertyUpdates(component(tag), platform), true, `${tag} ${platform}`);
  }
  assert.deepEqual(nativePropertyUpdate('md-menu', { open: true, placement: 'top-end', maxHeight: '50vh', density: -2 }).properties, { open: true, placement: 'top-end', maxHeight: '50vh', density: -2 });
  assert.deepEqual(nativePropertyUpdate('md-menu', { maxHeight: 240 }).properties, { maxHeight: 240 });
  assert.deepEqual(nativePropertyUpdate('md-menu-item', { type: 'radio', checkPosition: 'start', presentation: 'option', roleOverride: 'option' }).command, 'update');
  assert.deepEqual(nativePropertyUpdate('md-sub-menu-item', { openDelay: 0, closeDelay: 300 }).properties, { openDelay: 0, closeDelay: 300 });
  for (const [tag, bad] of [['md-menu', { placement: 'left' }], ['md-menu', { open: 'yes' }], ['md-menu', { density: -5 }], ['md-menu', { maxHeight: -1 }], ['md-menu', { variant: 'tonal' }],
    ['md-menu-item', { type: 'switch' }], ['md-menu-item', { anchor: 'x' }], ['md-sub-menu-item', { openDelay: -1 }], ['md-sub-menu-item', { trailingText: '⌘' }], ['md-menu-item-group', { label: 3 }]]) {
    assert.throws(() => nativePropertyUpdate(tag, bad), error => error.code === 'INVALID_PROPERTY_UPDATE', `${tag} ${JSON.stringify(bad)}`);
  }
});

test('show, close and whenClosed use call IDs; reposition and collapse are synchronous', () => {
  const policy = support.ios['md-menu'], row = support.ios['md-sub-menu-item'];
  for (const method of ['show', 'close', 'whenClosed']) {
    assert.ok(nativeLifecycleMethod('md-menu', method)); assert.ok(nativeMethodSupported('md-menu', method, policy));
    assert.deepEqual(nativeMethodCommand('md-menu', method, [], { callId: 'c1', target: 'component' }), { command: 'method', target: 'component', callId: 'c1', method, arguments: [] });
  }
  assert.deepEqual(nativeMethodCommand('md-menu', 'show', [{ autoFocus: false }], { callId: 'c2', target: 'component' }).arguments, [{ autoFocus: false }]);
  assert.deepEqual(nativeMethodCommand('md-menu', 'show', [{}], { callId: 'c3', target: 'component' }).arguments, [{}]);
  for (const args of [[{ autoFocus: 'yes' }], [{ focus: true }], [true], [{ autoFocus: true }, 1]]) {
    assert.throws(() => nativeMethodCommand('md-menu', 'show', args, { callId: 'c4', target: 'component' }), error => error.code === 'INVALID_METHOD', JSON.stringify(args));
  }
  assert.throws(() => nativeMethodCommand('md-menu', 'close', [1], { callId: 'c5', target: 'component' }), error => error.code === 'INVALID_METHOD');
  assert.ok(nativeItemMethod('md-menu', 'reposition')); assert.ok(nativeMethodSupported('md-menu', 'reposition', policy));
  assert.deepEqual(nativeMethodCommand('md-menu', 'reposition', []), { command: 'method', method: 'reposition', arguments: [] });
  assert.throws(() => nativeMethodCommand('md-menu', 'reposition', [1]), error => error.code === 'INVALID_METHOD');
  assert.ok(nativeMethodSupported('md-sub-menu-item', 'collapse', row));
  assert.deepEqual(nativeMethodCommand('md-sub-menu-item', 'collapse', []), { command: 'method', method: 'collapse', arguments: [] });
  // getScrollViewport() returns geometry natively, not an element: it is a native API, not a Laboratory invocation.
  for (const method of ['getScrollViewport', 'setComboboxElement', 'setVirtualProvider']) assert.equal(nativeMethodSupported('md-menu', method, policy), false, method);
  assert.deepEqual(nativeMethodResultsCommand('md-menu', ['c1'], []), { command: 'method-results', callIds: ['c1'], acknowledged: [] });
});

test('examples present the anchored menu in an AWCMenuScope with its handle', () => {
  for (const platform of ['swift', 'android']) {
    const swift = platform === 'swift';
    const usage = nativeUsageExample(component('md-menu'), platform);
    assert.equal(usage.status, 'supported');
    assert.match(usage.code, swift ? /AWCMenuScope\(state: menus\)/ : /AWCMenuScope\(menus, Modifier\.requiredSize\(360\.dp, 480\.dp\)\)/);
    assert.match(usage.code, /"demo-menu-trigger"/); assert.match(usage.code, /"anchor"/); assert.match(usage.code, /"Export"/);
    for (const [method, call] of [['show', swift ? /\.show\(autoFocus: true\)/ : /\.show\(autoFocus = true\)/], ['close', /\.close\(\)/], ['whenClosed', /\.whenClosed\(\)/], ['reposition', /\.reposition\(\)/], ['getScrollViewport', /getScrollViewport\(\)/]]) {
      const example = nativeApiExample(component('md-menu'), 'method', method, platform);
      assert.equal(example.status, 'supported', method); assert.match(example.code, call, method);
    }
    assert.match(nativeApiExample(component('md-menu'), 'method', 'getScrollViewport', platform).notes.join(' '), /geometry/);
    const collapse = nativeApiExample(component('md-sub-menu-item'), 'method', 'collapse', platform);
    assert.equal(collapse.status, 'supported'); assert.match(collapse.code, swift ? /collapse\(row: "demo-menu-export"\)/ : /collapse\("demo-menu-export"\)/);
    for (const method of ['setComboboxElement', 'setVirtualProvider']) assert.equal(nativeApiExample(component('md-menu'), 'method', method, platform).status, 'unsupported', method);
    const event = nativeApiExample(component('md-menu'), 'event', 'mdClose', platform);
    assert.match(event.code, /"mdClose"/); assert.match(event.code, /AWCMenuScope/);
    assert.match(nativeApiExample(component('md-menu-item'), 'event', 'mdClick', platform).code, /"mdClick"/);
    assert.match(nativeThemeExample(component('md-menu'), platform).code, swift ? /\.awcTheme\(\.generated/ : /AWCTheme\(tokenOverrides/);
    // Copyable snippets of the recipe: the scope, the toggle and the menu ID.
    for (const tag of TAGS) {
      const snippet = usageSnippet(component(tag), {}, platform, { html: recipeFor(tag).html });
      assert.match(snippet, swift ? /AWCMenuScope\(state: menus\)/ : /AWCMenuScope\(menus/, tag);
      assert.match(snippet, /menus\.menu\("demo-menu"\)/, tag);
      assert.match(snippet, swift ? /@State private var menus = AWCMenuScopeState\(\)/ : /rememberAWCMenuScopeState\(\)/, tag);
    }
    const styled = usageSnippet(component('md-menu'), {}, platform, { html: recipeFor('md-menu').html, menuAppearance: { itemHeight: 56 } });
    assert.match(styled, swift ? /\.awcMenuAppearance\(\.init\(itemHeight: "56px"\)\)/ : /AWCMenuAppearanceScope\(appearance = AWCMenuAppearance\(itemHeight = "56px"\)\)/);
  }
});
