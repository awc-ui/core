import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { LIST_APPEARANCE_FIELDS, LIST_ITEM_APPEARANCE_FIELDS, LIST_PARTS, LIST_ITEM_PARTS, normalizeListAppearance, normalizeListItemAppearance, listAppearanceCSS, listItemAppearanceCSS,
  parseListAppearanceInput, parseListItemAppearanceInput, formatListItemAppearanceInput, formatListAppearanceInput, listItemAppearanceNativeValue, listAppearanceNativeValue } from './list-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';
import { LIST_UPDATE_PROPERTIES, LIST_ITEM_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { nativeMethodCommand, nativeMethodSupported } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const ir = async tag => JSON.parse(await readFile(new URL(`../../packages/native-compiler/generated/ir/${tag}.json`, import.meta.url), 'utf8'));
// Released native support declarations (generated from NativeSupport.json / support.json).
const list = await ir('md-list'), item = await ir('md-list-item');
const css = async tag => readFile(new URL(`../../packages/core/src/components/${tag}/${tag}.css`, import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', corners: '12px 4px / 6px 2px', length: '12px', opacity: '0.5', duration: '0.25s', font: '"Roboto Flex", serif', shadow: '0px 1px 3px rgba(0, 0, 0, 0.3), inset 0 4px 8px 3px #00000026' })[field.kind];
const listStyles = Object.fromEntries(LIST_APPEARANCE_FIELDS.map(f => [f.name, parseListAppearanceInput(f.name, sample(f))]));
const itemStyles = Object.fromEntries(LIST_ITEM_APPEARANCE_FIELDS.map(f => [f.name, parseListItemAppearanceInput(f.name, sample(f))]));
const listProps = { listStyle: 'segmented', selectionMode: 'multi-select', interactionMode: 'multi-action', reorderable: true, label: 'Mail & folders', labelledby: 'heading', roleOverride: 'menu', density: -2 };
const itemProps = { type: 'button', headline: 'A & B', overline: 'New', supportingText: 'Details', trailingSupportingText: '24', leadingIcon: 'inbox', trailingIcon: 'chevron_right', leadingAvatar: '',
  leadingAvatarAlt: '', leadingAvatarName: 'Ada Lovelace', leadingAvatarLabel: '', leadingImage: '', leadingImageAlt: '', lines: 2, href: '', target: '_self', disabled: false, softDisabled: true,
  selected: true, expandable: false, expanded: false, tabbable: true, rovingFocusVisible: false, selectionMode: 'single-select', interactionMode: 'single-action', containerRole: 'listbox', reorderable: false, density: -1 };

test('List appearance exactly covers the ten list and sixty-eight item source hooks, the parts, the IR and both released policies', async () => {
  const own = [...new Set((await css('md-list')).match(/--md-list-[a-z-]+/g))].filter(name => !name.startsWith('--md-list-item-') && !name.endsWith('-')).sort();
  assert.deepEqual(own, LIST_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual([...new Set((await css('md-list-item')).match(/--md-list-item-[a-z-]+/g))].filter(name => !name.endsWith('-')).sort(), LIST_ITEM_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual([...new Set(list.cssProperties.map(p => p.name))].sort(), LIST_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  // The source documents --md-list-item-active-container-shape twice (meta-override and shared default).
  assert.deepEqual([...new Set(item.cssProperties.map(p => p.name))].sort(), LIST_ITEM_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual([...LIST_PARTS].sort(), list.cssParts.map(p => p.name).sort());
  assert.deepEqual([...LIST_ITEM_PARTS].sort(), item.cssParts.map(p => p.name).sort());
  for (const platform of ['ios', 'android']) {
    assert.deepEqual([...list.support[platform].appearance.fields], LIST_APPEARANCE_FIELDS.map(f => f.name), `${platform} list appearance declaration`);
    assert.deepEqual([...item.support[platform].appearance.fields], LIST_ITEM_APPEARANCE_FIELDS.map(f => f.name), `${platform} item appearance declaration`);
    assert.deepEqual(list.support[platform].visualParts, ['drop-placeholder']);
    // The two tooltip popup parts are styled through the shared md-tooltip appearance.
    assert.deepEqual([...item.support[platform].visualParts].sort(), LIST_ITEM_PARTS.filter(p => !p.endsWith('tooltip-popup')).sort());
  }
  assert.equal(Object.keys(listAppearanceCSS(listStyles)).length, 10);
  assert.equal(Object.keys(listItemAppearanceCSS(itemStyles)).length, 68);
});

test('typed hook kinds roundtrip CSS, native data and native literals', () => {
  const generated = listItemAppearanceCSS(itemStyles);
  assert.equal(generated['--md-list-item-dragged-container-elevation'], '0px 1px 3px 0px #0000004D, inset 0px 4px 8px 3px #00000026');
  assert.equal(generated['--md-list-item-expand-duration'], '250ms');
  assert.equal(generated['--md-list-item-container-shape'], '12px 4px / 6px 2px');
  assert.equal(generated['--md-list-item-label-text-font'], '"Roboto Flex", serif');
  assert.equal(generated['--md-list-item-hover-state-layer-opacity'], '0.5');
  assert.equal(listAppearanceCSS(listStyles)['--md-list-padding-block'], '12px');
  for (const field of LIST_ITEM_APPEARANCE_FIELDS) assert.deepEqual(parseListItemAppearanceInput(field.name, formatListItemAppearanceInput(field.name, itemStyles[field.name])), itemStyles[field.name], field.name);
  for (const field of LIST_APPEARANCE_FIELDS) assert.deepEqual(parseListAppearanceInput(field.name, formatListAppearanceInput(field.name, listStyles[field.name])), listStyles[field.name], field.name);
  assert.match(listItemAppearanceNativeValue('draggedContainerElevation', itemStyles.draggedContainerElevation, 'android'), /^listOf\(AWCBoxShadow\(x = 0\.0, y = 1\.0, blur = 3\.0, spread = 0\.0, color = "#0000004D"\), AWCBoxShadow\(.*inset = true\)\)$/);
  assert.match(listAppearanceNativeValue('dropPlaceholderShape', listStyles.dropPlaceholderShape, 'swift'), /^AWCCornerShape\(/);
  assert.equal(listItemAppearanceNativeValue('labelTextFont', itemStyles.labelTextFont, 'swift'), undefined, 'fonts use the shared string literal path');
  for (const value of [null, [], { labelTextColor: '#FFF' }, { draggedContainerElevation: [{ x: 1, blur: -1 }] }, { expandDuration: -1 }, { hoverStateLayerOpacity: 2 }, { labelTextFont: 'x;y' }, { labelTextFont: '' }, { gap: 1 }]) {
    assert.throws(() => normalizeListItemAppearance(value), { code: 'INVALID_LIST_ITEM_APPEARANCE' }, JSON.stringify(value));
  }
  for (const value of [{ dropPlaceholderOpacity: 2 }, { paddingBlock: -1 }, { containerShape: { topLeft: 'x' } }]) assert.throws(() => normalizeListAppearance(value), { code: 'INVALID_LIST_APPEARANCE' });
});

test('panel transport retains every authored value and style for both tags', () => {
  for (const [component, props, styles, key] of [[list, listProps, listStyles, 'listAppearance'], [item, itemProps, itemStyles, 'listItemAppearance']]) {
    const request = nativeRenderRequest(component.tag, props, true, { ...componentAppearanceOptions({ selected: component, [key]: styles }), direction: 'rtl' });
    const valid = validateRenderRequest(request, new Set([component.tag]));
    assert.deepEqual(valid.properties, props); assert.deepEqual(valid[key], styles); assert.equal(valid.direction, 'rtl');
    const other = component === list ? 'md-list-item' : 'md-list';
    assert.throws(() => validateRenderRequest({ ...request, tag: other }, new Set([other])), { code: component === list ? 'INVALID_LIST_APPEARANCE' : 'INVALID_LIST_ITEM_APPEARANCE' });
  }
  assert.throws(() => validateRenderRequest({ tag: 'md-list', listAppearance: { paddingBlock: 'wide' } }, new Set(['md-list'])), { code: 'INVALID_LIST_APPEARANCE' });
});

test('retained updates cover every source property with the source types, gated by released support', async () => {
  assert.deepEqual([...LIST_UPDATE_PROPERTIES].sort(), list.properties.map(p => p.name).sort());
  assert.deepEqual([...LIST_ITEM_UPDATE_PROPERTIES].sort(), item.properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate('md-list', listProps), { command: 'update', properties: listProps });
  assert.deepEqual(nativePropertyUpdate('md-list-item', itemProps), { command: 'update', properties: itemProps });
  for (const patch of [{ listStyle: 'plain' }, { selectionMode: 'single' }, { interactionMode: 'multi' }, { reorderable: 'true' }, { density: -5 }, { label: 1 }, { type: 'button' }]) {
    assert.throws(() => nativePropertyUpdate('md-list', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  }
  for (const patch of [{ type: 'menu' }, { lines: 4 }, { expanded: 1 }, { headline: 'x'.repeat(4097) }, { listStyle: 'segmented' }]) assert.throws(() => nativePropertyUpdate('md-list-item', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  for (const component of [list, item]) for (const platform of ['ios', 'android']) {
    assert.equal(supportsRetainedPropertyUpdates(component, platform), true, `${component.tag} ${platform}`);
    const policy = component.support[platform];
    assert.equal(supportsRetainedPropertyUpdates({ ...component, support: { [platform]: { ...policy, properties: policy.properties.slice(1) } } }, platform), false);
  }
  const edits = []; const client = { canUpdate: () => true, update: async value => edits.push(value) };
  for (const value of [true, false]) assert.equal(dispatchRetainedPropertyEdit({ component: item, platform: 'android', client, name: 'expanded', value }), true);
  await Promise.resolve(); assert.deepEqual(edits, [{ expanded: true }, { expanded: false }]);
});

test('methods, events, slots and pointer input use the released contract', () => {
  for (const platform of ['ios', 'android']) {
    for (const [component, key] of [[list, 'properties'], [list, 'events'], [list, 'methods'], [list, 'slots'], [item, 'properties'], [item, 'methods'], [item, 'slots']]) {
      assert.deepEqual([...component.support[platform][key]].sort(), component[key].map(member => member.name).sort(), `${platform} ${component.tag} ${key}`);
    }
    // The item-to-list protocol events stay internal natively; the list emits mdSelect/mdActivate/mdReorder.
    assert.deepEqual([...item.support[platform].events].sort(), ['mdClick', 'mdExpand']);
    assert.deepEqual([...item.support[platform].unsupportedEvents].sort(), ['mdItemClick', 'mdItemRequestReorder', 'mdItemSelect', 'mdRequestActivation']);
    for (const [component, methods] of [[list, ['activateNext', 'activatePrevious', 'selectItem', 'getSelectedIndices']], [item, ['setFocus', 'focusItem', 'toggle', 'expand', 'collapse']]]) for (const method of methods) {
      assert.equal(nativeMethodSupported(component.tag, method, component.support[platform]), true, `${component.tag}.${method}`);
      assert.equal(nativeMethodSupported(component.tag, method, { ...component.support[platform], methods: [] }), false);
    }
  }
  for (const method of ['activateNext', 'activatePrevious', 'getSelectedIndices']) assert.deepEqual(nativeMethodCommand('md-list', method, []), { command: 'method', method, arguments: [] });
  assert.deepEqual(nativeMethodCommand('md-list', 'selectItem', [2]), { command: 'method', method: 'selectItem', arguments: [2] });
  for (const args of [[], [-1], [1.5], ['1'], [1, 2]]) assert.throws(() => nativeMethodCommand('md-list', 'selectItem', args), { code: 'INVALID_METHOD' }, JSON.stringify(args));
  for (const method of ['focusItem', 'toggle', 'expand', 'collapse']) {
    assert.deepEqual(nativeMethodCommand('md-list-item', method, []), { command: 'method', method, arguments: [] });
    assert.throws(() => nativeMethodCommand('md-list-item', method, ['x']), { code: 'INVALID_METHOD' });
  }
  assert.deepEqual(nativeMethodCommand('md-list-item', 'setFocus', [{ focusVisible: true }]), { command: 'method', method: 'setFocus', arguments: [{ focusVisible: true }] });
  assert.deepEqual(nativeMethodCommand('md-list-item', 'setFocus', []), { command: 'method', method: 'setFocus', arguments: [] });
  for (const args of [[{ focusVisible: 1 }], [{ preventScroll: true }], [true], [{}, {}]]) assert.throws(() => nativeMethodCommand('md-list-item', 'setFocus', args), { code: 'INVALID_METHOD' }, JSON.stringify(args));
  assert.throws(() => nativeMethodCommand('md-list', 'toggle', []), { code: 'INVALID_METHOD' });
  for (const tag of ['md-list', 'md-list-item']) {
    const context = { tag, logicalWidth: 640, logicalHeight: 400 };
    for (const phase of ['down', 'move', 'up']) assert.deepEqual(validateLiveInput({ command: 'pointer', phase, x: 120, y: 40 }, context), { command: 'pointer', phase, x: 120, y: 40 });
  }
});

test('all three Styles panels expose every hook and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  for (const [component, fields, key, invalid] of [[list, LIST_APPEARANCE_FIELDS, 'listAppearance', ['paddingBlock', '2em']], [item, LIST_ITEM_APPEARANCE_FIELDS, 'listItemAppearance', ['draggedContainerElevation', '0 1px red']]]) {
    const state = { selected: component, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
    for (const platform of ['web', 'ios', 'android']) {
      state.platform = platform; ui.render();
      assert.equal(document.querySelectorAll('[data-appearance-field]').length, fields.length, `${component.tag} ${platform}`);
      for (const field of fields) {
        const input = document.querySelector(`#appearance-${field.name}`);
        input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
        assert.equal(input.error, false, `${field.name} accepts ${sample(field)}`);
      }
      assert.equal(Object.keys(state[key]).length, fields.length);
      const before = structuredClone(state[key][invalid[0]]);
      const input = document.querySelector(`#appearance-${invalid[0]}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: invalid[1] }));
      assert.equal(input.error, true); assert.deepEqual(state[key][invalid[0]], before);
    }
    const target = document.createElement(component.tag); ui.apply(target);
    for (const field of fields) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
  }
});

test('framework snippets carry every hook with the correct native types', () => {
  for (const [component, styles, key, props] of [[list, listStyles, 'listAppearance', { selectionMode: 'single-select' }], [item, itemStyles, 'listItemAppearance', { headline: 'Inbox' }]]) {
    const profile = componentAppearance(component.tag);
    for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
      const code = usageSnippet(component, props, platform, { html: recipeFor(component.tag).html, [key]: styles });
      assert.doesNotMatch(code, /\[object Object\]/);
      for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${component.tag} ${platform} ${field.name}`);
      if (platform === 'swift') assert.match(code, new RegExp(`\\.${profile.swiftModifier}\\(\\.init\\(`));
      if (platform === 'android') assert.match(code, new RegExp(`${profile.nativeType}Scope\\(appearance = ${profile.nativeType}\\(`));
      if (['swift', 'android'].includes(platform)) assert.match(code, /AWCCornerShape\(/);
      if (['swift', 'android'].includes(platform) && component === item) assert.match(code, /AWCBoxShadow\(/);
    }
  }
});

test('native API examples use the verified controllers, typed parts, events and slots', () => {
  for (const platform of ['swift', 'android']) {
    assert.ok(nativeUsageExample(list, platform).code); assert.ok(nativeUsageExample(item, platform).code);
    for (const [component, name] of [[list, 'mdSelect'], [list, 'mdActivate'], [list, 'mdReorder'], [item, 'mdClick'], [item, 'mdExpand']]) {
      const example = nativeApiExample(component, 'event', name, platform);
      assert.match(example.code, new RegExp(`"${name}"`)); assert.match(example.code, /lastPayload/);
    }
    assert.match(nativeApiExample(list, 'event', 'mdReorder', platform).code, platform === 'swift' ? /"reorderable": \.bool\(true\)/ : /"reorderable" to true/);
    for (const [component, methods, scope] of [[list, ['activateNext', 'activatePrevious', 'selectItem', 'getSelectedIndices'], platform === 'swift' ? /\.awcListController\(controller, for: "md-list"\)/ : /AWCListControllerScope\(controller, "md-list"\)/],
      [item, ['setFocus', 'focusItem', 'toggle', 'expand', 'collapse'], platform === 'swift' ? /\.awcListItemController\(controller, for: "md-list-item"\)/ : /AWCListItemControllerScope\(controller, "md-list-item"\)/]]) for (const method of methods) {
      const example = nativeApiExample(component, 'method', method, platform);
      assert.equal(example.status, 'supported', method); assert.match(example.code, new RegExp(`controller\\.${method}\\(`)); assert.match(example.code, scope);
    }
    for (const part of item.support.ios.visualParts) {
      const example = nativeApiExample(item, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.match(example.code, platform === 'swift' ? /\.awcListItemPartAppearance\(\.init\(/ : /AWCListItemPartAppearanceScope\(AWCListItemPart\.[A-Z]/, part);
    }
    assert.match(nativeApiExample(list, 'cssPart', 'drop-placeholder', platform).code, platform === 'swift' ? /\.awcListPlaceholderPartAppearance\(\.init\(/ : /AWCListPlaceholderPartAppearanceScope\(/);
    for (const slot of item.support.ios.slots) assert.ok(nativeApiExample(item, 'slot', slot, platform).code, `slot ${slot}`);
  }
});
