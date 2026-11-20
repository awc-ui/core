import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SLIDER_APPEARANCE_FIELDS, sliderAppearance, RATING_APPEARANCE_FIELDS, ratingAppearance, SR_UPDATE_PROPERTIES, validSrUpdate, SR_METHODS } from './sr-appearance.js';
import { componentAppearance } from './component-appearance.js';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateRenderRequest } from './native-render.mjs';
import { nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodSupported, nativeMethodCommand } from './native-methods.js';
import { nativeApiExample } from './native-api-examples.js';

// md-slider and md-rating in the Laboratory: typed hooks, retained updates of every source property except getLabel,
// focusRating() with its examples, the released policies.
const TAGS = ['md-slider', 'md-rating'];
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ios = (await read('../../packages/native-ios/NativeSupport.json')).components, android = (await read('../../packages/native-android/support.json')).components;
const irs = Object.fromEntries(await Promise.all(TAGS.map(async tag => [tag, await read(`../../packages/native-compiler/generated/ir/${tag}.json`)])));
const component = tag => ({ ...irs[tag], support: { ios: ios[tag], android: android[tag] } });
const profileOf = tag => tag === 'md-slider' ? sliderAppearance : ratingAppearance;

// Hooks the stylesheet reads that the CEM does not list (R6-11: the labeled host's value-indicator reserve, oracle case
// hook-value-indicator-reserve) — typed natively and in the Laboratory as well.
const STYLESHEET_HOOKS = { 'md-slider': [], 'md-rating': [] };
test('the hooks cover each IR and both released policies', () => {
  for (const tag of TAGS) {
    const ir = irs[tag], fields = profileOf(tag).fields;
    assert.deepEqual(fields.map(f => f.cssProperty).sort(), [...ir.cssProperties.map(p => p.name), ...STYLESHEET_HOOKS[tag]].sort(), tag);
    for (const [platform, p] of [['ios', ios[tag]], ['android', android[tag]]]) {
      assert.deepEqual(p.appearance.fields, fields.map(f => f.name), `${platform} ${tag}`);
      for (const kind of ['properties', 'methods', 'events', 'slots']) assert.deepEqual(p[kind], ir[kind].map(x => x.name), `${platform} ${tag} ${kind}`);
    }
    const registry = componentAppearance(tag);
    assert.equal(registry.nativeType, tag === 'md-slider' ? 'AWCSliderAppearance' : 'AWCRatingAppearance', tag);
    assert.equal(registry.key, tag === 'md-slider' ? 'sliderAppearance' : 'ratingAppearance', tag);
    assert.deepEqual(registry.groups.flatMap(([, names]) => names).sort(), fields.map(f => f.name).sort(), tag);
  }
  // R6-04: the inset-icon slot is rendered natively; R6-03: typed parts.
  assert.deepEqual(ios['md-slider'].unsupportedSlots, []);
  assert.deepEqual(android['md-slider'].unsupportedSlots ?? [], []);
  for (const policy of [ios, android]) {
    assert.deepEqual(policy['md-slider'].visualParts, ['surface', 'track', 'track-active', 'track-inactive', 'thumb-knob', 'value-indicator', 'inset']);
    assert.deepEqual(policy['md-rating'].visualParts, ['items', 'item', 'icon-filled', 'icon-empty', 'state-layer', 'value-label']);
  }
});

test('hook values normalize, render as CSS and round-trip through the inputs', () => {
  const slider = { trackHeight: 24, activeColor: '#C62828', valueFontWeight: 700, valueFontFamily: 'Roboto Flex', thumbWidth: 6 };
  assert.deepEqual(sliderAppearance.css(slider), { '--md-slider-active-color': '#C62828', '--md-slider-track-height': '24px', '--md-slider-thumb-width': '6px', '--md-slider-value-font-family': 'Roboto Flex', '--md-slider-value-font-weight': '700' });
  for (const f of SLIDER_APPEARANCE_FIELDS) if (slider[f.name] !== undefined) assert.deepEqual(sliderAppearance.parseInput(f.name, sliderAppearance.formatInput(f.name, slider[f.name])), slider[f.name], f.name);
  assert.equal(SLIDER_APPEARANCE_FIELDS.length, 24);
  for (const bad of [{ trackHeight: -1 }, { activeColor: 'red' }, { bogus: 1 }]) assert.throws(() => sliderAppearance.normalize(bad), { code: 'INVALID_SLIDER_APPEARANCE' }, JSON.stringify(bad));
  const rating = { itemSize: 32, focusRingOffset: -2, valueLabelFont: '500 16px/24px Roboto', popScale: 1.3, duration: 300, activeColor: '#FFB300' };
  const rc = ratingAppearance.css(rating);
  assert.equal(rc['--md-rating-focus-ring-offset'], '-2px'); assert.equal(rc['--md-rating-pop-scale'], '1.3'); assert.equal(rc['--md-rating-duration'], '300ms'); assert.equal(rc['--md-rating-value-label-font'], '500 16px/24px Roboto');
  for (const f of RATING_APPEARANCE_FIELDS) if (rating[f.name] !== undefined) assert.deepEqual(ratingAppearance.parseInput(f.name, ratingAppearance.formatInput(f.name, rating[f.name])), rating[f.name], f.name);
  for (const bad of [{ valueLabelFont: 'Roboto' }, { popScale: -1 }, { focusRingOffset: '2px' }, { itemSize: -1 }]) assert.throws(() => ratingAppearance.normalize(bad), { code: 'INVALID_RATING_APPEARANCE' }, JSON.stringify(bad));
  assert.equal(ratingAppearance.nativeValue('focusRingOffset', -2, 'kotlin'), '-2.0');
  assert.deepEqual(nativeThemeOptions({ sliderAppearance: { trackHeight: 24 }, ratingAppearanceDefaults: { itemSize: 30 } }), { sliderAppearance: { trackHeight: 24 }, ratingAppearanceDefaults: { itemSize: 30 } });
  assert.doesNotThrow(() => validateRenderRequest({ tag: 'md-slider', properties: {}, sliderAppearance: { activeColor: '#C62828' } }, new Set(['md-slider'])));
  assert.throws(() => validateRenderRequest({ tag: 'md-rating', properties: {}, sliderAppearance: { activeColor: '#C62828' } }, new Set(['md-rating'])));
});

test('retained updates of every source property except getLabel', () => {
  for (const tag of TAGS) {
    assert.deepEqual([...SR_UPDATE_PROPERTIES[tag]].sort(), irs[tag].properties.map(p => p.name).filter(n => n !== 'getLabel').sort(), tag);
    for (const platform of ['ios', 'android']) assert.ok(supportsRetainedPropertyUpdates(component(tag), platform), `${platform} ${tag}`);
  }
  for (const [tag, values] of [['md-slider', { value: 40, range: true, size: 'xl', orientation: 'vertical', min: 10, max: 90, controlled: true, density: -2 }],
    ['md-rating', { value: 2.5, precision: 0.5, hover: 'off', size: 'lg', max: 7, readonly: true }]])
    for (const [key, value] of Object.entries(values)) assert.deepEqual(nativePropertyUpdate(tag, { [key]: value }), { command: 'update', properties: { [key]: value } }, `${tag} ${key}`);
  for (const [tag, key, value] of [['md-slider', 'size', 'xxl'], ['md-slider', 'value', '1'], ['md-slider', 'density', 2], ['md-rating', 'precision', 0.25], ['md-rating', 'getLabel', 'x'], ['md-rating', 'hover', 'on']])
    assert.throws(() => nativePropertyUpdate(tag, { [key]: value }), undefined, `${tag} ${key}`);
  assert.equal(validSrUpdate('md-slider', 'value', Infinity), false);
});

test('focusRating() with its examples', () => {
  for (const tag of TAGS) for (const method of irs[tag].methods.map(m => m.name)) {
    assert.equal(nativeMethodSupported(tag, method, ios[tag]), true, `${tag} ${method}`);
    for (const platform of ['swift', 'android']) {
      const example = nativeApiExample(component(tag), 'method', method, platform);
      assert.equal(example.status, 'supported', `${platform} ${tag} ${method}`);
      assert.match(example.code, new RegExp(`controller\\.${method}\\(`), `${platform} ${tag} ${method}`);
    }
  }
  assert.deepEqual(Object.keys(SR_METHODS), ['md-rating']);
  assert.deepEqual(nativeMethodCommand('md-rating', 'focusRating', []), { command: 'method', method: 'focusRating', arguments: [] });
  assert.throws(() => nativeMethodCommand('md-rating', 'focusRating', [1]));
});
