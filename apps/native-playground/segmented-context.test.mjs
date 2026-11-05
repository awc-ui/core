import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { defaultSegmentedContext, normalizeSegmentedContext, segmentedContextOptions, segmentedSelectionOptions, segmentedParentProperties, updateSegmentedSelection, applySegmentedContext } from './segmented-context.js';
import { createSegmentedConfigurationUI } from './segmented-configuration.js';
import { SEGMENTED_BUTTON_APPEARANCE_FIELDS, normalizeSegmentedButtonAppearance } from './segmented-button-appearance.js';
import { componentContentSlots, componentSlotElement, nativeContentSlots } from './content-slots.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { usageSnippet } from './usage-snippets.js';
import { snippetProperties } from './documentation-ui.js';
import { apiExample } from './api-examples.js';
import { nativeApiExample } from './native-api-examples.js';
import { recipeFor } from './recipes.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const fields = ['value', 'selected', 'disabled', 'softDisabled', 'icon', 'label', 'noCheckmark', 'ripple', 'segmentIndex', 'segmentTotal', 'segmentDensity', 'segmentMultiselect', 'density'];
const baseComponent = { tag: 'md-segmented-button', properties: fields.map(name => ({ name })), slots: [{ name: '' }, { name: 'icon' }], events: [{ name: 'mdSegmentClick' }], cssParts: ['state-layer', 'checkmark', 'icon', 'label'].map(name => ({ name })) };
const slotPolicy = { status: 'native-adapter', slots: ['', 'icon'] };
const component = { ...baseComponent, support: { ios: slotPolicy, android: slotPolicy } };
const standalone = () => ({ mode: 'standalone', multiselect: false, density: 0, selection: [] });

test('segmented composition validates exact modes and authored identity vectors without executing accessors', () => {
  const good = defaultSegmentedContext();
  assert.deepEqual(normalizeSegmentedContext(good), good);
  assert.notEqual(normalizeSegmentedContext(good).selection, good.selection);
  assert.deepEqual(segmentedContextOptions(undefined, 'md-button'), {});
  assert.throws(() => segmentedContextOptions(good, 'md-button'), { code: 'INVALID_SEGMENTED_CONTEXT' });
  assert.throws(() => segmentedContextOptions(standalone(), 'md-segmented-button-set'), { code: 'INVALID_SEGMENTED_CONTEXT' });
  const getter = { ...good }; Object.defineProperty(getter, 'selection', { get() { throw Error('Getter must not execute'); } });
  const arrayGetter = [true, false, false]; Object.defineProperty(arrayGetter, '1', { get() { throw Error('Getter must not execute'); } });
  for (const value of [null, [], new Date(), {}, { ...good, extra: 1 }, { ...good, mode: 'other' }, { ...good, density: 1 }, { ...good, multiselect: 'false' }, { ...good, selection: [true] }, { ...good, selection: new Array(3) }, { ...good, selection: [true, 0, false] }, { ...good, selection: arrayGetter }, getter]) {
    assert.throws(() => normalizeSegmentedContext(value), { code: 'INVALID_SEGMENTED_CONTEXT' });
  }
  assert.deepEqual(segmentedSelectionOptions([false, true, true], component.tag, good), { segmentedSelection: [false, true, true] });
  assert.throws(() => segmentedSelectionOptions([], component.tag, good), { code: 'INVALID_SEGMENTED_CONTEXT' });
  assert.throws(() => segmentedSelectionOptions([true, false, false], component.tag, standalone()), { code: 'INVALID_SEGMENTED_CONTEXT' });
});

test('actual ordered selection persists separately from event proposals and ignores stale compositions', () => {
  const state = { selected: component, props: { selected: true }, segmentedContext: defaultSegmentedContext() };
  assert.equal(updateSegmentedSelection(state, [false, true, true]), true);
  assert.deepEqual(state.segmentedContext.selection, [false, true, true]);
  assert.equal(state.props.selected, false);
  assert.equal(state.editedProps.selected, false);
  assert.equal(updateSegmentedSelection(state, [false, true, true]), false);
  assert.equal(updateSegmentedSelection(state, []), false);
  assert.equal(updateSegmentedSelection(state, undefined), false);
  state.segmentedContext = standalone();
  assert.equal(updateSegmentedSelection(state, [true, false, false]), false, 'standalone proposals never commit set selection');
  state.selected = { tag: 'md-button' };
  assert.equal(updateSegmentedSelection(state, [true, false, false]), false);
});

test('set context updates actual children in source order, preserving duplicate values and authored content', t => {
  const dom = new JSDOM('<md-segmented-button-set><md-segmented-button value="same"><span>First</span></md-segmented-button><md-segmented-button value="same">Second</md-segmented-button><md-segmented-button value="">Empty</md-segmented-button></md-segmented-button-set>');
  t.after(() => dom.window.close());
  const set = dom.window.document.querySelector('md-segmented-button-set'), children = [...set.children], label = children[0].firstChild;
  const context = { mode: 'set', multiselect: true, density: -3, selection: [false, true, true] };
  applySegmentedContext(children[0], context);
  assert.equal(set.multiselect, true); assert.equal(set.density, -3);
  assert.deepEqual(children.map(child => child.selected), [false, true, true]);
  assert.deepEqual(children.map(child => child.segmentIndex), [0, 1, 2]);
  assert.ok(children.every(child => child.segmentTotal === 3 && child.segmentDensity === -3 && child.segmentMultiselect));
  assert.equal(children[0].firstChild, label);
  assert.deepEqual([...set.children], children);
  applySegmentedContext(children[0], standalone());
  assert.deepEqual(children.map(child => child.selected), [false, true, true]);
});

test('composition controls expose parent ownership, preserve independent values and round-trip all platforms', t => {
  const dom = new JSDOM('<div id="props-controls"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { dom.window.close(); if (previous) globalThis.document = previous; else delete globalThis.document; });
  const state = { selected: component, props: { selected: true, ...segmentedParentProperties(defaultSegmentedContext()) }, segmentedContext: defaultSegmentedContext() };
  const root = document.querySelector('#props-controls');
  let changes = 0;
  const ui = createSegmentedConfigurationUI({ getState: () => state, onChange: () => { changes++; render(); } });
  const render = () => { root.innerHTML = ui.markup(); ui.bind(); ui.sync(); };
  const change = (selector, key, value) => { const input = root.querySelector(selector); assert.ok(input, selector); input[key] = value; input.dispatchEvent(new dom.window.CustomEvent('mdChange', { bubbles: true })); };
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; render();
    assert.match(root.textContent, /set owns index/);
    change('[data-segment-child="1"]', 'selected', true);
    change('#segment-set-density', 'value', '-4');
    change('#segment-set-multiselect', 'selected', true);
    assert.equal(state.props.segmentDensity, -4);
    assert.equal(state.props.segmentMultiselect, true);
    assert.equal(state.segmentedContext.selection[1], true);
    change('#segment-preview-mode', 'value', 'standalone');
    assert.match(root.textContent, /does not automatically commit/);
    assert.equal(state.props.segmentTotal, platform === 'web' ? 1 : 5);
    Object.assign(state.props, { segmentIndex: 2, segmentTotal: 5, segmentDensity: -2, segmentMultiselect: true });
    change('#segment-preview-mode', 'value', 'set');
    assert.equal(state.props.segmentTotal, 3);
    assert.equal(state.segmentedContext.selection[1], true, 'temporarily standalone does not discard sibling selection');
    change('#segment-preview-mode', 'value', 'standalone');
    assert.equal(state.props.segmentTotal, 5);
    assert.equal(state.props.segmentIndex, 2);
    change('#segment-preview-mode', 'value', 'set');
  }
  assert.ok(changes > 12);
});

test('seven appearance hooks and typed icon slots match the source contract', async () => {
  const source = await readFile(new URL('../../packages/core/src/components/md-segmented-button/md-segmented-button.css', import.meta.url), 'utf8');
  assert.deepEqual(SEGMENTED_BUTTON_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(source.match(/--md-segmented-button-[a-z-]+/g))].sort());
  assert.deepEqual(normalizeSegmentedButtonAppearance({ containerColor: '#abcdef', cornerRadius: 0, iconSize: 32 }), { containerColor: '#ABCDEF', cornerRadius: 0, iconSize: 32 });
  for (const value of [{ iconSize: Infinity }, { cornerRadius: -1 }, { color: '#123456' }, { labelColor: '#abc' }]) assert.throws(() => normalizeSegmentedButtonAppearance(value), { code: 'INVALID_SEGMENTED_BUTTON_APPEARANCE' });
  assert.deepEqual(componentContentSlots(component.tag), ['icon']);
  const descriptor = componentSlotElement(component.tag, 'icon', { kind: 'symbol', value: 'favorite' });
  assert.match(descriptor.attributes.style, /max\(14px,calc\(18px \+ var\(--md-sys-density-scale,0\) \* 1px\)\)/);
  assert.doesNotMatch(descriptor.attributes.style, /(?:^|;)(?:color|transform):/);
  assert.deepEqual(componentSlotElement(component.tag, 'icon', ''), { tag: 'span', attributes: { slot: 'icon' }, text: '' });
  for (const slots of [{ icon: { kind: 'progress' } }, { selected: { kind: 'symbol', value: 'favorite' } }, { '': { kind: 'symbol', value: 'favorite' } }]) assert.throws(() => nativeContentSlots(slots, component.tag), { code: 'INVALID_SLOTS' });
});

test('native requests carry validated context and styles independently of selected component properties', () => {
  const context = { mode: 'set', multiselect: true, density: -2, selection: [false, true, true] };
  const request = nativeRenderRequest(component.tag, { value: 'same', selected: false, 'aria-label': 'Day' }, true, { segmentedContext: context, segmentedButtonAppearance: { iconSize: 20, outlineColor: '#abcdef' }, slots: { icon: { kind: 'symbol', value: 'favorite' } } });
  const actual = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(actual.segmentedContext, context);
  assert.deepEqual(actual.segmentedButtonAppearance, { iconSize: 20, outlineColor: '#ABCDEF' });
  assert.deepEqual(actual.properties, request.properties);
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_SEGMENTED_BUTTON_APPEARANCE' });
});

test('all seven usage examples retain set composition and actual selection; standalone releases parent properties', () => {
  const segmentedContext = { mode: 'set', multiselect: false, density: -2, selection: [false, true, true] };
  const properties = { label: 'Day', value: 'day', selected: true, segmentIndex: 6, segmentTotal: 8, segmentDensity: -4, segmentMultiselect: true };
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, properties, platform, { html: recipeFor(component.tag).html, segmentedContext, segmentedButtonAppearance: { iconSize: 22 }, slots: { icon: { kind: 'symbol', value: 'favorite' } } });
    assert.match(code, platform === 'react' || platform === 'vue' ? /MdSegmentedButtonSet/ : /md-segmented-button-set/);
    assert.match(code, /Week/); assert.match(code, /Month/); assert.match(code, /favorite/);
    assert.doesNotMatch(code, /segmentIndex|segmentTotal|segmentDensity|segmentMultiselect/);
    if (platform === 'swift') { assert.match(code, /"multiselect": \.bool\(false\)/); assert.match(code, /"selected": \.bool\(false\)/); }
    if (platform === 'android') { assert.match(code, /"multiselect" to false/); assert.match(code, /"selected" to false/); }
    const single = usageSnippet(component, properties, platform, { html: recipeFor(component.tag).html, segmentedContext: standalone() });
    assert.doesNotMatch(single, /md-segmented-button-set|MdSegmentedButtonSet|Week|Month/);
    assert.match(single, /segmentTotal/);
  }
  const state = { selected: component, props: properties, segmentedContext, editedTag: component.tag, editedProps: properties };
  assert.equal(Object.hasOwn(snippetProperties(state), 'segmentTotal'), false);
  state.segmentedContext = standalone();
  assert.equal(snippetProperties(state).segmentTotal, 8);
});

test('API examples distinguish standalone proposals, set commits and additional icon content', () => {
  const web = apiExample(component, 'event', 'mdSegmentClick', 'html');
  assert.doesNotMatch(web.code, /md-segmented-button-set/);
  assert.match(web.notes.join(' '), /propos|commit/);
  const policy = { status: 'native-adapter', properties: fields, events: ['mdSegmentClick'], slots: ['', 'icon'], methods: [], cssParts: component.cssParts.map(part => part.name), visualParts: component.cssParts.map(part => part.name), appearance: { fields: SEGMENTED_BUTTON_APPEARANCE_FIELDS.map(field => field.name) } };
  for (const platform of ['swift', 'android']) {
    const supported = { ...component, support: { ios: policy, android: policy } };
    const event = nativeApiExample(supported, 'event', 'mdSegmentClick', platform);
    assert.match(event.code, /selected/);
    assert.match((event.description || '') + event.notes.join(' '), /propos/);
    assert.doesNotMatch(event.code, /preventDefault|md-segmented-button-set/);
    const icon = nativeApiExample(supported, 'slot', 'icon', platform);
    assert.match(icon.code, /calendar_month/);
    assert.match(icon.code, /favorite/);
    assert.match(icon.notes.join(' '), /add|beside/);
    for (const part of component.cssParts) assert.match(nativeApiExample(supported, 'cssPart', part.name, platform).code, /AWCSegmentedButtonAppearance|awcSegmentedButtonAppearance/);
  }
});

test('native set appearance targets only the chosen segment while defaults remain inherited', () => {
  const options = { html: recipeFor(component.tag).html, segmentedContext: defaultSegmentedContext(), segmentedButtonAppearance: { labelColor: '#123456' }, segmentedButtonAppearanceDefaults: { iconSize: 20 } };
  const swift = usageSnippet(component, {}, 'swift', options);
  assert.match(swift, /AWCNode\(id: "segment-day", tag: "md-segmented-button"/);
  assert.match(swift, /\.awcSegmentedButtonAppearance\(\.init\(labelColor: "#123456"\), nodeID: "segment-day"\)/);
  assert.match(swift, /\.awcSegmentedButtonAppearance\(\.init\(iconSize: 20\.0\)\)/);
  const kotlin = usageSnippet(component, {}, 'android', options);
  assert.ok(kotlin.indexOf('AWCSegmentedButtonAppearance(iconSize = 20.0)') < kotlin.indexOf('tag = "md-segmented-button-set"'));
  assert.ok(kotlin.indexOf('AWCSegmentedButtonAppearance(labelColor = "#123456")') > kotlin.indexOf('tag = "md-segmented-button-set"'));
  assert.equal((kotlin.match(/labelColor = "#123456"/g) || []).length, 1);
  for (const tag of ['md-button-group', 'md-fab', 'md-divider', 'md-segmented-button']) for (const platform of ['ios', 'android']) {
    assert.doesNotThrow(() => componentAppearanceGuide({ tag }, platform), `${tag}/${platform} uses its own validated fields`);
  }
});

test('Kotlin literal segment slots retain source text semantics including blank content', () => {
  for (const icon of ['', ' \n', 'Favorite']) {
    const code = usageSnippet(component, { label: '', icon: 'calendar_month' }, 'android', {
      html: recipeFor(component.tag).html, slots: { icon, '': 'Custom day' }, segmentedContext: standalone(),
    });
    assert.match(code, /import dev\.awc\.nativeui\.AWCSlotText/);
    assert.ok(code.includes(`AWCSlotText(${JSON.stringify(icon)})`), 'the authored icon text is preserved verbatim');
    assert.match(code, /AWCSlotText\("Custom day"\)/);
    assert.doesNotMatch(code, /(?:^|[^\w])Text\("Custom day"\)/);
  }
  const policy = { ...slotPolicy, properties: fields, events: ['mdSegmentClick'] };
  const supported = { ...component, support: { android: policy } };
  assert.match(nativeApiExample(supported, 'slot', '', 'android').code, /AWCSlotText\(/);
});
