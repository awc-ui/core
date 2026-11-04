import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { FAB_MENU_APPEARANCE_FIELDS, FAB_MENU_ITEM_APPEARANCE_FIELDS, normalizeFabMenuAppearance, normalizeFabMenuItemAppearance } from './fab-menu-appearance.js';
import { componentAppearanceOptions } from './component-appearance.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { componentSlotElement, nativeContentSlots } from './content-slots.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { setFabMenuOpen, updateFabMenuState } from './fab-menu-state.js';

const menuPolicy = { status: 'native-adapter', properties: ['open', 'anchor', 'variant', 'placement', 'quick', 'menuLabel', 'density'], events: ['mdOpen', 'mdClose'], slots: [''], methods: ['show', 'close', 'whenClosed'], cssParts: [], appearance: { fields: FAB_MENU_APPEARANCE_FIELDS.map(field => field.name) } };
const itemPolicy = { status: 'native-adapter', properties: ['icon', 'label', 'disabled', 'softDisabled', 'rovingFocusVisible', 'density'], events: ['mdClick'], slots: ['', 'icon'], methods: [], cssParts: ['state-layer', 'icon', 'label'], visualParts: ['state-layer', 'icon', 'label'], appearance: { fields: FAB_MENU_ITEM_APPEARANCE_FIELDS.map(field => field.name) } };
const describe = (tag, policy) => ({ tag, properties: policy.properties.map(name => ({ name })), events: policy.events.map(name => ({ name })), slots: policy.slots.map(name => ({ name })), methods: policy.methods.map(name => ({ name, parameters: [] })), cssParts: policy.cssParts.map(name => ({ name })), support: { ios: policy, android: policy } });
const menu = describe('md-fab-menu', menuPolicy), item = describe('md-fab-menu-item', itemPolicy);
const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);

test('menu and item profiles enumerate the exact separate source hook contracts', async () => {
  for (const [tag, fields] of [['md-fab-menu', FAB_MENU_APPEARANCE_FIELDS], ['md-fab-menu-item', FAB_MENU_ITEM_APPEARANCE_FIELDS]]) {
    const source = await readFile(new URL(`../../packages/core/src/components/${tag}/${tag}.css`, import.meta.url), 'utf8');
    assert.deepEqual(fields.map(field => field.cssProperty).sort(), [...new Set(source.match(/--md-fab-menu-item-[a-z-]+/g))].sort());
  }
  assert.deepEqual(normalizeFabMenuAppearance({ itemContainerColor: '#abcdef', itemGap: 0 }), { itemContainerColor: '#ABCDEF', itemGap: 0 });
  assert.deepEqual(normalizeFabMenuItemAppearance({ iconSize: 24, cornerRadius: 0, labelColor: '#123abc' }), { iconSize: 24, cornerRadius: 0, labelColor: '#123ABC' });
  const getter = Object.defineProperty({}, 'itemGap', { get() { throw Error('Do not execute'); } });
  for (const value of [null, [], { itemGap: -1 }, { itemGap: Infinity }, { containerColor: '#123456' }, getter]) assert.throws(() => normalizeFabMenuAppearance(value), { code: 'INVALID_FAB_MENU_APPEARANCE' });
  for (const value of [{ itemGap: 8 }, { iconSize: -1 }, { iconColor: '#fff' }]) assert.throws(() => normalizeFabMenuItemAppearance(value), { code: 'INVALID_FAB_MENU_ITEM_APPEARANCE' });
});

test('menu and item request styles remain distinct and component-local', () => {
  for (const [component, key, values] of [[menu, 'fabMenuAppearance', { itemGap: 12, itemLabelColor: '#123abc' }], [item, 'fabMenuItemAppearance', { iconSize: 24, labelColor: '#123abc' }]]) {
    const options = componentAppearanceOptions({ selected: component, [key]: values });
    const request = nativeRenderRequest(component.tag, {}, false, options);
    const actual = validateRenderRequest(request, new Set([component.tag]));
    assert.equal(actual[key][component === menu ? 'itemLabelColor' : 'labelColor'], '#123ABC');
    assert.equal(Object.hasOwn(request, component === menu ? 'fabMenuItemAppearance' : 'fabMenuAppearance'), false);
    assert.throws(() => validateRenderRequest({ ...request, tag: 'md-fab' }, new Set(['md-fab'])), { code: component === menu ? 'INVALID_FAB_MENU_APPEARANCE' : 'INVALID_FAB_MENU_ITEM_APPEARANCE' });
  }
});

test('native lifecycle notifications persist actual menu state independently of method acceptance', () => {
  const state = { platform: 'ios', selected: menu, props: { open: false } };
  const event = (name, nodeID = 'component') => ({ tag: menu.tag, nodeID, name, detail: null });
  assert.equal(updateFabMenuState(state, [{ methodCall: { status: 'accepted' } }]), false);
  assert.equal(updateFabMenuState(state, [event('mdOpen', 'another-menu')]), false);
  assert.equal(updateFabMenuState(state, [event('mdOpen')]), true);
  assert.equal(state.props.open, true);
  assert.equal(state.editedProps.open, true);
  assert.equal(updateFabMenuState(state, [event('mdOpen')]), false);
  assert.equal(updateFabMenuState(state, [event('mdClose'), event('mdOpen')]), false);
  state.platform = 'android';
  assert.equal(updateFabMenuState(state, [event('mdClose')]), true);
  assert.equal(state.props.open, false);
  state.platform = 'web';
  assert.equal(updateFabMenuState(state, [event('mdOpen')]), false);
});

test('actual Web menu state survives recipe recreation without mutating unrelated state', () => {
  const state = { platform: 'web', selected: menu, props: { open: true }, editedTag: menu.tag, editedProps: { density: -2 } };
  assert.equal(setFabMenuOpen(state, true), false);
  assert.deepEqual(state.editedProps, { density: -2, open: true }, 'same value still persists the committed state');
  assert.match(usageSnippet(menu, state.editedProps, 'html', { html: recipeFor(menu.tag).html }), /"open": true/);
  assert.equal(setFabMenuOpen(state, false), true);
  assert.equal(state.editedProps.open, false);
  assert.equal(setFabMenuOpen(state, 'true'), false);
  assert.equal(state.props.open, false);
  state.nativeScenario = 'an-unrelated-composition';
  assert.equal(setFabMenuOpen(state, true), false);
  assert.equal(state.props.open, false);
});

test('menu fixture retains a real centered authored anchor and finite context across all seven frameworks', () => {
  const html = recipeFor(menu.tag).html;
  assert.match(html, /width:360px;height:480px/);
  assert.match(html, /id="demo-fab-anchor"/);
  assert.match(html, /anchor="demo-fab-anchor"/);
  const document = new JSDOM(html).window.document;
  assert.deepEqual([...document.querySelectorAll('md-fab-menu > md-fab-menu-item')].map(node => node.getAttribute('label')), ['New document', 'New folder', 'Upload image']);
  assert.equal(document.querySelector('md-fab-menu').textContent, '');
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(menu, { open: true, quick: true, density: -2 }, platform, { html, fabMenuAppearance: { itemGap: 8 } });
    assert.match(code, /New document/); assert.match(code, /New folder/); assert.match(code, /Upload image/);
    assert.match(code, /demo-fab-anchor/);
    if (platform === 'swift') {
      assert.match(code, /AWCFabMenuScope/); assert.match(code, /ZStack/);
      assert.match(code, /AWCNode\(id: "demo-fab-anchor", tag: "md-fab"/);
      assert.equal((code.match(/tag: "md-fab-menu-item"/g) || []).length, 3);
      assert.match(code, /\.frame\(width: 360, height: 480\)/);
    } else if (platform === 'android') {
      assert.match(code, /AWCFabMenuScope/);
      assert.match(code, /"id" to "demo-fab-anchor"/);
      assert.equal((code.match(/tag = "md-fab-menu-item"/g) || []).length, 3);
      assert.match(code, /requiredSize\(360\.dp, 480\.dp\)/);
      assert.match(code, /Alignment\.Center/);
    } else assert.match(code, /360px/);
  }
});

test('native method recipes call each public lifecycle method independently and retain authored anchor composition', () => {
  for (const platform of ['swift', 'android']) for (const name of ['show', 'close', 'whenClosed']) {
    const example = nativeApiExample(menu, 'method', name, platform);
    assert.equal(example.status, 'supported');
    assert.match(example.code, /AWCFabMenuScope/);
    for (const method of ['show', 'close', 'whenClosed']) assert.match(example.code, new RegExp(`controller\\.${method}\\(\\)`));
    assert.match(example.notes.join(' '), /close\(\) starts the close sequence/);
    assert.equal((example.code.match(platform === 'swift' ? /Task \{/g : /coroutineScope\.launch \{/g) || []).length, 3, 'waiting cannot serialize the close action behind whenClosed');
    assert.doesNotMatch(example.code, /value = true|value = false|data-awc-action/);
    const unavailable = nativeApiExample({ ...menu, support: { ios: { ...menuPolicy, methods: [] }, android: { ...menuPolicy, methods: [] } } }, 'method', 'whenClosed', platform);
    assert.equal(unavailable.status, 'unsupported');
    assert.equal(unavailable.code, null);
  }
});

test('menu starter, event, slot and theme recipes keep the real anchor scope', () => {
  for (const platform of ['swift', 'android']) {
    const examples = [nativeUsageExample(menu, platform), nativeThemeExample(menu, platform), nativeApiExample(menu, 'event', 'mdOpen', platform), nativeApiExample(menu, 'event', 'mdClose', platform), nativeApiExample(menu, 'slot', '', platform)];
    for (const example of examples) {
      assert.match(example.code, /AWCFabMenuScope/);
      assert.match(example.code, /demo-fab-anchor/);
      assert.match(example.code, /New folder/);
    }
  }
});

test('item slots preserve literal labels and exact icon density without enabling unrelated slot kinds', () => {
  const symbol = componentSlotElement(item.tag, 'icon', { kind: 'symbol', value: 'description' });
  assert.match(symbol.attributes.style, /--md-fab-menu-item-icon-size,max\(16px,calc\(20px/);
  assert.deepEqual(componentSlotElement(item.tag, 'icon', ''), { tag: 'span', attributes: { slot: 'icon' }, text: '' });
  assert.throws(() => nativeContentSlots({ icon: { kind: 'progress' } }, item.tag), { code: 'INVALID_SLOTS' });
  assert.throws(() => nativeContentSlots({ icon: { kind: 'symbol', value: 'edit' } }, menu.tag), { code: 'INVALID_SLOTS' });
  for (const platform of ['swift', 'android']) {
    const label = nativeApiExample(item, 'slot', '', platform);
    assert.match(label.code, platform === 'swift' ? /\.text\("New document"\)/ : /AWCSlotText\("New document"\)/);
    assert.doesNotMatch(label.code, /"label":|"label" to/);
    for (const part of item.cssParts) assert.match(nativeApiExample(item, 'cssPart', part.name, platform).code, /AWCFabMenuItemAppearance|awcFabMenuItemAppearance/);
    for (const value of ['', ' \n']) {
      const code = usageSnippet(item, {}, platform, { html: '<md-fab-menu-item icon="edit" label="New document"></md-fab-menu-item>', slots: { icon: value } });
      assert.match(code, platform === 'swift' ? /\.slotText\("[^"]*", slot: "icon"\)/ : /if \(slot == "icon"\) Text\("[^"]*"\)/);
    }
  }
});
