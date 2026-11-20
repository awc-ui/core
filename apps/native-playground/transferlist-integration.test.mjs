import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { TRANSFER_LIST_APPEARANCE_FIELDS, TRANSFER_LIST_PARTS, transferListAppearance } from './transferlist-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { TRANSFER_LIST_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { nativeItemMethod, nativeMethodSupported } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
// Released native support declarations (generated from NativeSupport.json / support.json).
const list = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-transfer-list.json', import.meta.url), 'utf8'));
const sourceCSS = await readFile(new URL('../../packages/core/src/components/md-transfer-list/md-transfer-list.css', import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', length: '12px', insets: '4px 8px' })[field.kind];
const styles = Object.fromEntries(TRANSFER_LIST_APPEARANCE_FIELDS.map(f => [f.name, transferListAppearance.parseInput(f.name, sample(f))]));
const items = [{ value: 'a', label: 'Analytics', description: 'Dashboards' }, { value: 'b', label: 'Billing' }, { value: 'c', label: 'Calendar', disabled: true }];
const props = { items, value: ['b'], sourceTitle: 'Options', targetTitle: 'Picked', searchable: false, sourceSearchPlaceholder: 'Find options', targetSearchPlaceholder: 'Find picked',
  showSelectAll: true, searchIcon: 'filter_list', moveRightIcon: 'arrow_forward', moveLeftIcon: 'arrow_back', moveAllRightIcon: 'fast_forward', moveAllLeftIcon: 'fast_rewind',
  emptyIcon: 'inbox', emptyText: 'Nothing here', countTemplate: '{checked} of {total}', density: -2, disabled: false, singleStepOnly: true, moveRightLabel: 'Right',
  moveLeftLabel: 'Left', moveAllRightLabel: 'All right', moveAllLeftLabel: 'All left', selectAllLabel: 'All of {title}' };

test('Transfer list appearance exactly covers the 20 source hooks, the IR and both released policies', () => {
  const hooks = [...new Set([...sourceCSS.matchAll(/var\(\s*(--md-transfer-list-[a-z0-9-]+)/g)].map(match => match[1]))].sort();
  assert.equal(hooks.length, 20);
  assert.deepEqual(hooks, TRANSFER_LIST_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual(list.cssProperties.map(p => p.name ?? p).sort(), hooks);
  for (const platform of ['ios', 'android']) {
    const policy = list.support[platform];
    assert.deepEqual([...policy.appearance.fields].sort(), TRANSFER_LIST_APPEARANCE_FIELDS.map(f => f.name).sort(), `${platform} appearance declaration`);
    assert.match(policy.appearance.api, platform === 'ios' ? /awcTransferListAppearance/ : /AWCTransferListAppearanceScope/);
    for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual([...policy[key]].sort(), list[key].map(member => member.name).sort(), `${platform} ${key}`);
    for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots']) assert.deepEqual(policy[key] ?? [], [], `${platform} ${key}`);
    // ::part() styling is a typed native API (AWCTransferListPartAppearance): every source part name is released on both platforms.
    assert.deepEqual([...policy.visualParts].sort(), Object.keys(TRANSFER_LIST_PARTS).sort());
    assert.match(policy.notes.join(' '), /Verified against Chrome 153's ::part\(\) cases/);
  }
  assert.equal(Object.keys(transferListAppearance.css(styles)).length, 20);
});

test('typed hook kinds roundtrip CSS and native literals; the item padding is the CSS padding shorthand', () => {
  const css = transferListAppearance.css(styles);
  assert.equal(css['--md-transfer-list-container-color'], '#12345680');
  assert.equal(css['--md-transfer-list-column-min-width'], '12px');
  assert.equal(css['--md-transfer-list-item-padding'], '4px 8px 4px 8px');
  assert.deepEqual(transferListAppearance.parseInput('itemPadding', '16px'), { top: 16, right: 16, bottom: 16, left: 16 });
  assert.deepEqual(transferListAppearance.parseInput('itemPadding', '1px 2px 3px'), { top: 1, right: 2, bottom: 3, left: 2 });
  assert.equal(transferListAppearance.nativeValue('itemPadding', styles.itemPadding, 'swift'), 'AWCTransferListInsets(top: 4.0, right: 8.0, bottom: 4.0, left: 8.0)');
  assert.equal(transferListAppearance.nativeValue('itemPadding', styles.itemPadding, 'android'), 'AWCTransferListInsets(top = 4.0, right = 8.0, bottom = 4.0, left = 8.0)');
  for (const field of TRANSFER_LIST_APPEARANCE_FIELDS) {
    const text = transferListAppearance.formatInput(field.name, styles[field.name]);
    assert.deepEqual(transferListAppearance.parseInput(field.name, text), styles[field.name], `${field.name} formats to reparseable CSS`);
  }
  for (const value of [null, [], { headerColor: 'red' }, { headerColour: '#FFFFFF' }, { width: -1 }, { itemGap: Infinity }, { containerShape: '4px' }, { itemPadding: { top: 1 } }])
    assert.throws(() => transferListAppearance.normalize(value), { code: 'INVALID_TRANSFER_LIST_APPEARANCE' }, JSON.stringify(value));
});

test('panel transport retains every authored property and style; other tags reject transfer list styles', () => {
  const request = nativeRenderRequest(list.tag, props, true, { ...componentAppearanceOptions({ selected: list, transferListAppearance: styles }), direction: 'rtl' });
  const valid = validateRenderRequest(request, new Set([list.tag]));
  assert.deepEqual(valid.properties, props); assert.deepEqual(valid.transferListAppearance, styles); assert.equal(valid.direction, 'rtl');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_TRANSFER_LIST_APPEARANCE' });
  assert.throws(() => validateRenderRequest({ tag: list.tag, transferListAppearance: { itemGap: '3px' } }, new Set([list.tag])), { code: 'INVALID_TRANSFER_LIST_APPEARANCE' });
});

test('retained updates cover the 24 source properties with their source types, gated by released support', async () => {
  assert.deepEqual([...TRANSFER_LIST_UPDATE_PROPERTIES].sort(), list.properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate(list.tag, props), { command: 'update', properties: props });
  for (const value of [JSON.stringify(items), []]) assert.deepEqual(nativePropertyUpdate(list.tag, { items: value }).properties, { items: value });
  for (const patch of [{ items: 3 }, { items: null }, { value: 'b' }, { value: [1] }, { searchable: 'false' }, { disabled: 1 }, { density: -5 }, { density: 1 }, { sourceTitle: 3 }, { countTemplate: null }, { open: true }])
    assert.throws(() => nativePropertyUpdate(list.tag, patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  for (const platform of ['ios', 'android']) {
    assert.equal(supportsRetainedPropertyUpdates(list, platform), true, platform);
    const policy = list.support[platform];
    assert.equal(supportsRetainedPropertyUpdates({ ...list, support: { [platform]: { ...policy, properties: policy.properties.filter(name => name !== 'singleStepOnly') } } }, platform), false);
  }
  const edits = []; const client = { canUpdate: () => true, update: async value => edits.push(value) };
  for (const value of [true, false]) assert.equal(dispatchRetainedPropertyEdit({ component: list, platform: 'ios', client, name: 'singleStepOnly', value }), true);
  await Promise.resolve(); assert.deepEqual(edits, [{ singleStepOnly: true }, { singleStepOnly: false }]);
});

test('the two methods are native item methods released on both platforms, with controller examples', () => {
  for (const method of ['moveSelectedRight', 'moveSelectedLeft']) {
    assert.ok(nativeItemMethod(list.tag, method), method);
    for (const platform of ['ios', 'android']) assert.ok(nativeMethodSupported(list.tag, method, list.support[platform]), `${platform} ${method}`);
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample(list, 'method', method, platform);
      assert.equal(example.status, 'supported', `${platform} ${method}`); assert.match(example.code, new RegExp(`controller\\.${method}\\(\\)`));
      assert.match(example.code, platform === 'swift' ? /\.awcTransferListController\(controller, for: "md-transfer-list"\)/ : /AWCTransferListControllerScope\(controller, "md-transfer-list"\)/);
    }
  }
  assert.equal(nativeItemMethod(list.tag, 'moveAllRight'), false);
});

test('all three Styles panels expose the 20 hooks and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const state = { selected: list, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    assert.equal(document.querySelectorAll('[data-appearance-field]').length, 20, platform);
    for (const field of TRANSFER_LIST_APPEARANCE_FIELDS) {
      const input = document.querySelector(`#appearance-${field.name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
      assert.equal(input.error, false, `${field.name} accepts ${sample(field)}`);
    }
    assert.equal(Object.keys(state.transferListAppearance).length, 20);
    for (const [name, raw] of [['columnMinWidth', '40%'], ['itemPadding', '1px 2px 3px 4px 5px']]) {
      const before = structuredClone(state.transferListAppearance[name]);
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: raw }));
      assert.equal(input.error, true, `${name} rejects ${raw}`); assert.deepEqual(state.transferListAppearance[name], before);
    }
  }
  const target = document.createElement('md-transfer-list'); ui.apply(target);
  for (const field of TRANSFER_LIST_APPEARANCE_FIELDS) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
});

test('framework snippets carry every hook with the correct native types', () => {
  const profile = componentAppearance(list.tag);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(list, props, platform, { html: recipeFor(list.tag).html, transferListAppearance: styles });
    assert.doesNotMatch(code, /\[object Object\]/);
    for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${platform} ${field.name}`);
    if (platform === 'swift') assert.match(code, /\.awcTransferListAppearance\(\.init\(/);
    if (platform === 'android') assert.match(code, /AWCTransferListAppearanceScope\(appearance = AWCTransferListAppearance\(/);
    if (['swift', 'android'].includes(platform)) assert.ok(code.includes('itemPadding' + (platform === 'swift' ? ': AWCTransferListInsets(top: 4.0' : ' = AWCTransferListInsets(top = 4.0')), `${platform} item padding literal`);
  }
});

test('native API examples use both events and the twelve typed parts', () => {
  // The CEM lists nine parts; the source also names each column `column` and `column-source` / `column-target` (source review, CEM drift).
  assert.deepEqual(Object.keys(TRANSFER_LIST_PARTS).sort(), [...list.cssParts.map(p => p.name), 'column', 'column-source', 'column-target'].sort());
  for (const platform of ['swift', 'android']) {
    assert.match(nativeUsageExample(list, platform).code, /md-transfer-list/);
    for (const name of ['mdChange', 'mdMove']) {
      const example = nativeApiExample(list, 'event', name, platform);
      assert.ok(example.code, name); assert.match(example.code, /md-transfer-list/, name);
    }
    for (const part of Object.keys(TRANSFER_LIST_PARTS)) {
      const example = nativeApiExample(list, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.match(example.code, platform === 'swift' ? /\.awcTransferListPartAppearance\(\.init\(/ : /AWCTransferListPartAppearanceScope\(AWCTransferListPartAppearance\(/, part);
      assert.match(example.code, new RegExp(part.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + (platform === 'swift' ? ': \\.init\\(' : ' = AWCTransferListPartStyle\\(')), part);
      for (const field of TRANSFER_LIST_PARTS[part]) assert.match(example.code, new RegExp(field), `${part} ${field}`);
    }
  }
});
