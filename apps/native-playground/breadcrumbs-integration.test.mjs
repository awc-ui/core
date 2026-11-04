import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BREADCRUMBS_APPEARANCE_FIELDS, BREADCRUMB_ITEM_APPEARANCE_FIELDS, breadcrumbsAppearance, breadcrumbItemAppearance } from './breadcrumbs-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { BREADCRUMBS_UPDATE_PROPERTIES, BREADCRUMB_ITEM_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeItemMethod, nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { nativeApiExample } from './native-api-examples.js';

// md-breadcrumbs / md-breadcrumb-item in the Laboratory: the twelve typed hooks (eight of them on the crumb page), the
// retained property updates, expand()/collapse() through the native controller, the released policies and the recipe.
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ir = { trail: await read('../../packages/native-compiler/generated/ir/md-breadcrumbs.json'), item: await read('../../packages/native-compiler/generated/ir/md-breadcrumb-item.json') };
const support = { ios: (await read('../../packages/native-ios/NativeSupport.json')).components, android: (await read('../../packages/native-android/support.json')).components };
const policies = tag => ({ ios: support.ios[tag], android: support.android[tag] });
const names = items => items.map(i => i.name ?? i);

test('the hooks cover both IRs and the released policies', () => {
  assert.deepEqual(BREADCRUMBS_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), [...names(ir.trail.cssProperties), ...names(ir.item.cssProperties)].sort());
  assert.deepEqual(BREADCRUMB_ITEM_APPEARANCE_FIELDS.map(f => f.cssProperty).sort(), names(ir.item.cssProperties).sort());
  for (const platform of ['ios', 'android']) {
    const trail = policies('md-breadcrumbs')[platform], item = policies('md-breadcrumb-item')[platform];
    assert.deepEqual(trail.appearance.fields, BREADCRUMBS_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(item.appearance.fields, BREADCRUMB_ITEM_APPEARANCE_FIELDS.map(f => f.name), platform);
    assert.deepEqual(trail.properties, names(ir.trail.properties), platform);
    assert.deepEqual(item.properties, names(ir.item.properties), platform);
    assert.deepEqual(trail.methods, ['expand', 'collapse'], platform);
    assert.deepEqual(trail.events, ['mdExpand'], platform); assert.deepEqual(item.events, ['mdSelect'], platform);
    assert.deepEqual(item.slots, ['', 'icon'], platform);
  }
  for (const [tag, key] of [['md-breadcrumbs', 'breadcrumbsAppearance'], ['md-breadcrumb-item', 'breadcrumbItemAppearance']]) {
    const registry = componentAppearance(tag);
    assert.equal(registry.key, key); assert.equal(registry.swiftModifier, 'awcBreadcrumbsAppearance'); assert.equal(registry.nativeType, 'AWCBreadcrumbsAppearance');
  }
});

test('hook values normalize, render as CSS and as native literals', () => {
  const value = { gap: 14, separatorColor: '#C62828', textColor: '#2E7D32', stagger: 90, linkColor: '#1565C0', currentColor: '#FFF59D', currentBackground: '#6A1B9A',
    disabledColor: '#8D6E63', hoverColor: '#D84315', stateLayerColor: '#00838F', itemGap: 12, itemPadding: { top: 4, right: 20, bottom: 4, left: 20 } };
  assert.deepEqual(breadcrumbsAppearance.css(value), { '--md-breadcrumbs-gap': '14px', '--md-breadcrumbs-separator-color': '#C62828', '--md-breadcrumbs-text-color': '#2E7D32',
    '--md-breadcrumbs-stagger': '90ms', '--md-breadcrumb-item-link-color': '#1565C0', '--md-breadcrumb-item-current-color': '#FFF59D', '--md-breadcrumb-item-current-bg': '#6A1B9A',
    '--md-breadcrumb-item-disabled-color': '#8D6E63', '--md-breadcrumb-item-hover-color': '#D84315', '--md-breadcrumb-item-state-layer-color': '#00838F',
    '--md-breadcrumb-item-gap': '12px', '--md-breadcrumb-item-padding': '4px 20px 4px 20px' });
  for (const f of BREADCRUMBS_APPEARANCE_FIELDS) assert.deepEqual(breadcrumbsAppearance.parseInput(f.name, breadcrumbsAppearance.formatInput(f.name, value[f.name])), value[f.name], f.name);
  assert.deepEqual(breadcrumbsAppearance.parseInput('itemPadding', '4px 20px'), { top: 4, right: 20, bottom: 4, left: 20 });
  assert.equal(breadcrumbsAppearance.nativeValue('itemPadding', value.itemPadding, 'swift'), '[4.0, 20.0, 4.0, 20.0]');
  assert.equal(breadcrumbsAppearance.nativeValue('itemPadding', value.itemPadding, 'kotlin'), 'listOf(4.0, 20.0, 4.0, 20.0)');
  assert.throws(() => breadcrumbsAppearance.normalize({ gap: -1 }), { code: 'INVALID_BREADCRUMBS_APPEARANCE' });
  assert.throws(() => breadcrumbsAppearance.normalize({ separatorColor: 'red' }), { code: 'INVALID_BREADCRUMBS_APPEARANCE' });
  assert.throws(() => breadcrumbItemAppearance.normalize({ gap: 4 }), { code: 'INVALID_BREADCRUMB_ITEM_APPEARANCE' });
  assert.deepEqual(nativeThemeOptions({ breadcrumbsAppearance: { gap: 14 } }).breadcrumbsAppearance, { gap: 14 });
  assert.deepEqual(nativeThemeOptions({ breadcrumbItemAppearance: { itemGap: 3 } }).breadcrumbItemAppearance, { itemGap: 3 });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-breadcrumbs', properties: {}, breadcrumbsAppearance: { gap: 14, stagger: 90 } }, new Set(['md-breadcrumbs'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-breadcrumbs', properties: {}, breadcrumbsAppearance: { gap: 'wide' } }, new Set(['md-breadcrumbs'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-breadcrumb-item', properties: {}, breadcrumbItemAppearance: { stagger: 4 } }, new Set(['md-breadcrumb-item'])));
});

test('retained updates, methods, examples and the recipe', () => {
  assert.deepEqual([...BREADCRUMBS_UPDATE_PROPERTIES], ['label', 'expandLabel', 'separator', 'maxItems', 'itemsBeforeCollapse', 'itemsAfterCollapse', 'density']);
  assert.deepEqual([...BREADCRUMB_ITEM_UPDATE_PROPERTIES], ['href', 'target', 'rel', 'current', 'icon', 'disabled', 'density']);
  for (const [tag, which] of [['md-breadcrumbs', 'trail'], ['md-breadcrumb-item', 'item']])
    for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates({ ...ir[which], tag, support: policies(tag) }, platform), `${tag} ${platform}`);
  assert.deepEqual(nativePropertyUpdate('md-breadcrumbs', { maxItems: 2, separator: '›' }).properties, { maxItems: 2, separator: '›' });
  assert.deepEqual(nativePropertyUpdate('md-breadcrumb-item', { current: true, href: '#x' }).properties, { current: true, href: '#x' });
  assert.throws(() => nativePropertyUpdate('md-breadcrumbs', { maxItems: -1 }));
  assert.throws(() => nativePropertyUpdate('md-breadcrumbs', { maxItems: 1.5 }));
  assert.throws(() => nativePropertyUpdate('md-breadcrumb-item', { current: 'yes' }));
  assert.throws(() => nativePropertyUpdate('md-breadcrumb-item', { collapsed: true }));
  for (const name of ['expand', 'collapse']) {
    assert.ok(nativeItemMethod('md-breadcrumbs', name));
    assert.ok(nativeMethodSupported('md-breadcrumbs', name, policies('md-breadcrumbs').ios));
    assert.deepEqual(nativeMethodCommand('md-breadcrumbs', name, []), { command: 'method', method: name, arguments: [] });
    assert.throws(() => nativeMethodCommand('md-breadcrumbs', name, [1]));
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample({ ...ir.trail, tag: 'md-breadcrumbs', support: policies('md-breadcrumbs') }, 'method', name, platform);
      assert.equal(example.status, 'supported', `${platform} ${name}`);
      assert.match(example.code, /AWCBreadcrumbsController/);
      assert.match(example.code, new RegExp(`controller\\.${name}\\(\\)`));
    }
  }
  const trail = recipeFor('md-breadcrumbs').html;
  assert.match(trail, /<md-breadcrumb-item href="#home" icon="home">Home<\/md-breadcrumb-item>/);
  assert.match(trail, /<md-breadcrumb-item href="#projects">Projects<\/md-breadcrumb-item>/);
  assert.match(trail, /<md-breadcrumb-item>AWC Native<\/md-breadcrumb-item>/);
});
