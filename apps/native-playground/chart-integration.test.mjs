import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHART_TAGS, CHART_APPEARANCES, CHART_APPEARANCE_KEYS, CHART_UPDATE_PROPERTIES, validChartUpdate, CHART_METHODS } from './chart-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand, nativeMethodValue } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// The chart elements in the Laboratory: md-line/area/bar/pie-chart and md-sparkline — typed hooks, retained updates of every
// source property except the closures, methods with results, released policies and examples.
const TAGS = CHART_TAGS;
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ios = (await read('../../packages/native-ios/NativeSupport.json')).components, android = (await read('../../packages/native-android/support.json')).components;
const irs = Object.fromEntries(await Promise.all(TAGS.map(async tag => [tag, await read(`../../packages/native-compiler/generated/ir/${tag}.json`)])));
const component = tag => ({ ...irs[tag], support: { ios: ios[tag], android: android[tag] } });
const profileOf = tag => CHART_APPEARANCES[tag];
const CLOSURES = ['valueFormatter', 'tooltipRenderer'];

test('the hooks cover each IR and both released policies', () => {
  for (const tag of TAGS) {
    const ir = irs[tag], fields = profileOf(tag).fields;
    assert.deepEqual(fields.map(f => f.cssProperty).sort(), ir.cssProperties.map(p => p.name).sort(), tag);
    for (const [platform, p] of [['ios', ios[tag]], ['android', android[tag]]]) {
      assert.deepEqual(p.appearance.fields, fields.map(f => f.name), `${platform} ${tag}`);
      for (const kind of ['properties', 'methods', 'events', 'slots']) assert.deepEqual(p[kind], ir[kind].map(x => x.name), `${platform} ${tag} ${kind}`);
    }
    const registry = componentAppearance(tag);
    assert.equal(registry.nativeType, 'AWCChartAppearance', tag);
    assert.equal(registry.key, CHART_APPEARANCE_KEYS[tag], tag);
    assert.deepEqual(registry.groups.flatMap(([, names]) => names).sort(), fields.map(f => f.name).sort(), tag);
  }
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const chart = { blockSize: 320, minBlockSize: 260, aspectRatio: '16 / 9', background: '#FFF3E0', padding: 28, shape: 2, emptyColor: '#4E342E', emptyBackground: '#FFE0B2',
    emptyFont: 'serif', emptyFontSize: 15, emptyIconSize: 40, zoomSize: 32, zoomTrackColor: '#E0E0E0', zoomWindowColor: '#FFCC80', zoomHandleColor: '#E65100', zoomBandColor: '#E6510029' };
  const css = CHART_APPEARANCES['md-line-chart'].css(chart);
  assert.equal(Object.keys(css).length, 16);
  assert.equal(css['--md-line-chart-aspect-ratio'], '16 / 9'); assert.equal(css['--md-line-chart-padding'], '28px'); assert.equal(css['--md-line-chart-zoom-band-color'], '#E6510029');
  assert.equal(CHART_APPEARANCES['md-pie-chart'].css({ centerColor: '#C62828', aspectRatio: 1.5 })['--md-pie-chart-aspect-ratio'], '1.5');
  for (const f of CHART_APPEARANCES['md-line-chart'].fields) assert.deepEqual(CHART_APPEARANCES['md-line-chart'].parseInput(f.name, CHART_APPEARANCES['md-line-chart'].formatInput(f.name, chart[f.name])), chart[f.name], f.name);
  for (const bad of [{ aspectRatio: '16:9' }, { aspectRatio: -1 }, { padding: -2 }, { background: 'red' }, { centerColor: '#FFFFFF' }, { zoomSize: Infinity }])
    assert.throws(() => CHART_APPEARANCES['md-line-chart'].normalize(bad), { code: 'INVALID_CHART_APPEARANCE' }, JSON.stringify(bad));
  assert.throws(() => CHART_APPEARANCES['md-sparkline'].normalize({ background: '#FFFFFF' }), { code: 'INVALID_CHART_APPEARANCE' });
  assert.equal(CHART_APPEARANCES['md-line-chart'].nativeValue('aspectRatio', '16 / 9', 'swift'), '"16 / 9"');
  assert.equal(CHART_APPEARANCES['md-line-chart'].nativeValue('padding', 28, 'kotlin'), '28.0');
  assert.deepEqual(nativeThemeOptions({ lineChartAppearance: { padding: 8 }, sparklineAppearanceDefaults: { blockSize: 30 } }), { lineChartAppearance: { padding: 8 }, sparklineAppearanceDefaults: { blockSize: 30 } });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-pie-chart', properties: {}, pieChartAppearance: { centerColor: '#C62828' } }, new Set(['md-pie-chart'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-bar-chart', properties: {}, pieChartAppearance: { centerColor: '#C62828' } }, new Set(['md-bar-chart'])));
});

test('retained updates of every source property except the closures', () => {
  for (const tag of TAGS) {
    assert.deepEqual([...CHART_UPDATE_PROPERTIES[tag]].sort(), irs[tag].properties.map(p => p.name).filter(n => !CLOSURES.includes(n)).sort(), tag);
    for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component(tag), platform), `${platform} ${tag}`);
  }
  const ok = [['md-line-chart', { series: [{ label: 'A', data: [1, null, { y: 3 }] }], curve: 'step', zoom: 'slider', stack: 'percent', density: -2, subtitle: null, legend: 'bottom-start' }],
    ['md-bar-chart', { categoryGap: '20%', barGap: 4, layout: 'horizontal', polar: true }], ['md-pie-chart', { innerRadius: '60%', data: [{ label: 'x', value: 2 }], highlight: 'series' }],
    ['md-sparkline', { variant: 'bar', showMarks: 'extremes', data: [1, 2, 3] }]];
  for (const [tag, values] of ok) for (const [key, value] of Object.entries(values)) assert.deepEqual(nativePropertyUpdate(tag, { [key]: value }), { command: 'update', properties: { [key]: value } }, `${tag} ${key}`);
  for (const [tag, key, value] of [['md-line-chart', 'curve', 'bezier'], ['md-line-chart', 'valueFormatter', 'x'], ['md-line-chart', 'series', 'x'], ['md-pie-chart', 'tooltipRenderer', 'x'],
    ['md-pie-chart', 'data', [() => 1]], ['md-bar-chart', 'density', -5], ['md-sparkline', 'min', '1']])
    assert.throws(() => nativePropertyUpdate(tag, { [key]: value }), undefined, `${tag} ${key}`);
  assert.equal(validChartUpdate('md-line-chart', 'subtitle', undefined), false);
});

test('methods with results and their examples', () => {
  for (const tag of TAGS) for (const method of irs[tag].methods.map(m => m.name)) {
    const supported = method !== 'getInstance';
    assert.equal(nativeMethodSupported(tag, method, ios[tag]), supported, `${tag} ${method}`);
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample(component(tag), 'method', method, platform);
      assert.equal(example.status, supported ? 'supported' : 'unsupported', `${platform} ${tag} ${method}`);
      if (supported) assert.match(example.code, new RegExp(`controller\\.${method}\\(`), `${platform} ${tag} ${method}`);
    }
  }
  assert.deepEqual(Object.keys(CHART_METHODS).sort(), [...CHART_TAGS].sort());
  assert.deepEqual(nativeMethodCommand('md-line-chart', 'setZoom', [1, 4]), { command: 'method', method: 'setZoom', arguments: [1, 4] });
  assert.deepEqual(nativeMethodCommand('md-pie-chart', 'drill', [0, 'up']), { command: 'method', method: 'drill', arguments: [0, 'up'] });
  for (const [tag, method, args] of [['md-line-chart', 'setZoom', [1]], ['md-bar-chart', 'drill', [-1]], ['md-pie-chart', 'drill', [0, 'left']], ['md-line-chart', 'replay', [1]], ['md-sparkline', 'replay', []]])
    assert.throws(() => nativeMethodCommand(tag, method, args), undefined, `${tag} ${method}`);
  assert.equal(nativeMethodValue('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  assert.throws(() => nativeMethodValue('javascript:alert(1)'));
});
