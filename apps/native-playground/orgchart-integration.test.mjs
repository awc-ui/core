import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { ORG_CHART_APPEARANCE_FIELDS, orgChartAppearance } from './orgchart-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { ORG_CHART_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
// Released native support declarations (generated from NativeSupport.json / support.json).
const chart = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-organization-chart.json', import.meta.url), 'utf8'));
const sourceCSS = await readFile(new URL('../../packages/core/src/components/md-organization-chart/md-organization-chart.css', import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', length: '12px', duration: '450ms' })[field.kind];
const styles = Object.fromEntries(ORG_CHART_APPEARANCE_FIELDS.map(f => [f.name, orgChartAppearance.parseInput(f.name, sample(f))]));
const nodes = [{ id: 'lead', name: 'Alex Morgan', title: 'Product lead', children: [{ id: 'design', name: 'Sam Lee', title: 'Design', accent: '#2E7D32' }, { id: 'eng', name: 'Robin Chen', selectable: false }] }];
const props = { nodes, selectionMode: 'multiple', selectedIds: ['design'], collapsible: true, orientation: 'horizontal', label: 'Team', expandLabel: 'Show reports', collapseLabel: 'Hide reports', density: -2 };

test('Organization chart appearance exactly covers the 15 source hooks, the IR and both released policies', () => {
  // Every hook the stylesheet reads (--md-org-chart-*); the CEM generator collects that prefix for this tag (R5-08), so the
  // IR lists the same 15.
  const hooks = [...new Set([...sourceCSS.matchAll(/var\(\s*(--md-org-chart-[a-z0-9-]+)/g)].map(match => match[1]))].sort();
  assert.equal(hooks.length, 15);
  assert.deepEqual(hooks, ORG_CHART_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual(chart.cssProperties.map(property => property.name).sort(), hooks);
  for (const platform of ['ios', 'android']) {
    const policy = chart.support[platform];
    assert.deepEqual([...policy.appearance.fields].sort(), ORG_CHART_APPEARANCE_FIELDS.map(f => f.name).sort(), `${platform} appearance declaration`);
    assert.match(policy.appearance.api, platform === 'ios' ? /awcOrgChartAppearance/ : /AWCOrgChartAppearanceScope/);
    for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual([...policy[key]].sort(), chart[key].map(member => member.name).sort(), `${platform} ${key}`);
    for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedSlots']) assert.deepEqual(policy[key] ?? [], [], `${platform} ${key}`);
    // ::part(): the 14 exported parts have typed native appearance APIs (AWCOrgChartPart + AWCPartStyle, R5-06).
    assert.deepEqual([...policy.visualParts].sort(), chart.cssParts.map(part => part.name).sort(), `${platform} visualParts`);
    assert.equal(policy.visualParts.length, 14, `${platform} visualParts`);
    assert.doesNotMatch(policy.notes.join(' '), /no native equivalent/);
    assert.match(policy.notes.join(' '), platform === 'ios' ? /awcOrgChartPartAppearance/ : /AWCOrgChartPartAppearanceScope/);
    assert.match(policy.notes.join(' '), /WAI-ARIA tree keys/);
  }
  assert.equal(Object.keys(orgChartAppearance.css(styles)).length, 15);
});

test('typed hook kinds roundtrip CSS and native literals; relative lengths and bad colours are rejected', () => {
  const css = orgChartAppearance.css(styles);
  assert.equal(css['--md-org-chart-connector-color'], '#12345680');
  assert.equal(css['--md-org-chart-node-min-width'], '12px');
  assert.equal(css['--md-org-chart-duration'], '450ms');
  assert.equal(orgChartAppearance.parseInput('duration', '1.2s'), 1200);
  for (const field of ORG_CHART_APPEARANCE_FIELDS) {
    const text = orgChartAppearance.formatInput(field.name, styles[field.name]);
    assert.deepEqual(orgChartAppearance.parseInput(field.name, text), styles[field.name], `${field.name} formats to reparseable CSS`);
  }
  for (const value of [null, [], { nodeColor: 'red' }, { nodeColour: '#FFFFFF' }, { connectorWidth: -1 }, { duration: -5 }, { toggleSize: Infinity }, { nodeShape: '4px' }])
    assert.throws(() => orgChartAppearance.normalize(value), { code: 'INVALID_ORG_CHART_APPEARANCE' }, JSON.stringify(value));
  for (const [name, raw] of [['nodeMinWidth', '50%'], ['levelGap', '2em'], ['duration', '300'], ['selectedColor', 'rgb(1,2,3)'], ['siblingGap', 'calc(1px + 2px)']])
    assert.throws(() => orgChartAppearance.normalize({ [name]: orgChartAppearance.parseInput(name, raw) }), /./, `${name}: ${raw}`);
});

test('panel transport retains every authored property and style; other tags reject organization chart styles', () => {
  const request = nativeRenderRequest(chart.tag, props, true, { ...componentAppearanceOptions({ selected: chart, orgChartAppearance: styles }), direction: 'rtl' });
  const valid = validateRenderRequest(request, new Set([chart.tag]));
  assert.deepEqual(valid.properties, props); assert.deepEqual(valid.orgChartAppearance, styles); assert.equal(valid.direction, 'rtl');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_ORG_CHART_APPEARANCE' });
  assert.throws(() => validateRenderRequest({ tag: chart.tag, orgChartAppearance: { connectorWidth: '3px' } }, new Set([chart.tag])), { code: 'INVALID_ORG_CHART_APPEARANCE' });
});

test('retained updates cover the nine source properties with their source types, gated by released support', async () => {
  assert.deepEqual([...ORG_CHART_UPDATE_PROPERTIES].sort(), chart.properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate(chart.tag, props), { command: 'update', properties: props });
  // nodes: an array, one node object or their JSON string (the source parses all three).
  for (const value of [nodes[0], JSON.stringify(nodes), []]) assert.deepEqual(nativePropertyUpdate(chart.tag, { nodes: value }).properties, { nodes: value });
  for (const patch of [{ nodes: 3 }, { nodes: null }, { selectedIds: 'design' }, { selectedIds: [1] }, { collapsible: 'false' }, { selectionMode: 'all' }, { orientation: 'radial' },
    { density: -5 }, { density: 1 }, { label: 3 }, { open: true }]) {
    assert.throws(() => nativePropertyUpdate(chart.tag, patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  }
  for (const platform of ['ios', 'android']) {
    assert.equal(supportsRetainedPropertyUpdates(chart, platform), true, platform);
    const policy = chart.support[platform];
    assert.equal(supportsRetainedPropertyUpdates({ ...chart, support: { [platform]: { ...policy, properties: policy.properties.filter(name => name !== 'orientation') } } }, platform), false);
  }
  const edits = []; const client = { canUpdate: () => true, update: async value => edits.push(value) };
  for (const value of ['vertical', 'horizontal']) assert.equal(dispatchRetainedPropertyEdit({ component: chart, platform: 'android', client, name: 'orientation', value }), true);
  await Promise.resolve(); assert.deepEqual(edits, [{ orientation: 'vertical' }, { orientation: 'horizontal' }]);
});

test('all three Styles panels expose the 15 hooks and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const state = { selected: chart, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    assert.equal(document.querySelectorAll('[data-appearance-field]').length, 15, platform);
    for (const field of ORG_CHART_APPEARANCE_FIELDS) {
      const input = document.querySelector(`#appearance-${field.name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
      assert.equal(input.error, false, `${field.name} accepts ${sample(field)}`);
    }
    assert.equal(Object.keys(state.orgChartAppearance).length, 15);
    for (const [name, raw] of [['nodeMaxWidth', '40%'], ['duration', 'slow']]) {
      const before = structuredClone(state.orgChartAppearance[name]);
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: raw }));
      assert.equal(input.error, true, `${name} rejects ${raw}`); assert.deepEqual(state.orgChartAppearance[name], before);
    }
  }
  const target = document.createElement('md-organization-chart'); ui.apply(target);
  for (const field of ORG_CHART_APPEARANCE_FIELDS) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
});

test('framework snippets carry every hook with the correct native types', () => {
  const profile = componentAppearance(chart.tag);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(chart, props, platform, { html: recipeFor(chart.tag).html, orgChartAppearance: styles });
    assert.doesNotMatch(code, /\[object Object\]/);
    for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${platform} ${field.name}`);
    if (platform === 'swift') assert.match(code, /\.awcOrgChartAppearance\(\.init\(/);
    if (platform === 'android') assert.match(code, /AWCOrgChartAppearanceScope\(appearance = AWCOrgChartAppearance\(/);
    if (['swift', 'android'].includes(platform)) for (const literal of ['connectorColor' + (platform === 'swift' ? ': "#12345680"' : ' = "#12345680"'), 'duration' + (platform === 'swift' ? ': 450.0' : ' = 450.0')]) assert.ok(code.includes(literal), `${platform} ${literal}`);
  }
});

test('native API examples use the selection and fold events, the empty slot and the typed part appearances', () => {
  for (const platform of ['swift', 'android']) {
    const usage = nativeUsageExample(chart, platform);
    assert.match(usage.code, /md-organization-chart/);
    for (const name of ['mdSelectionChange', 'mdNodeToggle']) {
      const example = nativeApiExample(chart, 'event', name, platform);
      assert.ok(example.code, name); assert.match(example.code, /md-organization-chart/, name);
    }
    assert.ok(nativeApiExample(chart, 'slot', 'empty', platform).code, 'empty slot');
    for (const part of chart.cssParts.map(p => p.name)) {
      const example = nativeApiExample(chart, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.match(example.code, platform === 'swift' ? /\.awcOrgChartPartAppearance\(/ : /AWCOrgChartPartAppearanceScope\(/, `${platform} ${part}`);
    }
  }
});
