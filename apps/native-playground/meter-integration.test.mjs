import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { METER_APPEARANCE_FIELDS, normalizeMeterAppearance, meterAppearanceCSS, parseMeterAppearanceInput, formatMeterAppearanceInput } from './meter-appearance.js';
import { normalizeMeterFormatOptions } from './meter-format-options.js';
import { normalizeThemeColorTokens } from './theme-color-tokens.js';
import { meterThemeOptions } from './meter-configuration.js';
import { createDocumentationUI, snippetProperties } from './documentation-ui.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { propertyEditor, parsePropertyInput } from './property-controls.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { apiExample } from './api-examples.js';
import { nativeThemeExample } from './native-api-examples.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-meter.json', import.meta.url), 'utf8'));
// Tests exercise the implemented shared surface without publishing native support.
const policy = { properties: source.properties.map(prop => prop.name), visualParts: ['track', 'indicator', 'label', 'value', 'circular'], events: [], slots: [], methods: [], appearance: { fields: METER_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { ...source, support: { ios: policy, android: policy } };
const shape = parseMeterAppearanceInput('trackShape', 'calc(50% - 2px) 8px / 4px 25%');
const appearance = { indicatorColor: '#aabbcc80', trackColor: '#abcdef', trackShape: shape, height: 8, labelColor: '#123456', valueColor: '#65432180', size: 72 };
const themeTokens = { '--md-sys-color-Brand': '#33669980', '--md-sys-color-Brand-container': '#DDEEFF' };

test('Meter maps exactly seven public hooks and validates typed physical corners, alpha and zero', async () => {
  const css = await readFile(new URL('../../packages/core/src/components/md-meter/md-meter.css', import.meta.url), 'utf8');
  assert.deepEqual(METER_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(css.match(/--md-meter-[a-z-]+/g))].sort());
  assert.equal(normalizeMeterAppearance(appearance).indicatorColor, '#AABBCC80');
  assert.deepEqual(normalizeMeterAppearance({ height: 0, size: 0 }), { height: 0, size: 0 });
  assert.equal(shape.topLeft.x.points, -2);
  assert.equal(shape.bottomRight.y.points, 4);
  const serialized = formatMeterAppearanceInput('trackShape', shape);
  assert.deepEqual(parseMeterAppearanceInput('trackShape', serialized), shape);
  assert.equal(meterAppearanceCSS(appearance)['--md-meter-track-shape'], serialized);
  assert.equal(meterAppearanceCSS({ height: 0 })['--md-meter-height'], '0px');
  const huge = normalizeMeterAppearance({ trackShape: { topLeft: { x: { fraction: Number.MAX_VALUE } } } }).trackShape;
  assert.deepEqual(parseMeterAppearanceInput('trackShape', formatMeterAppearanceInput('trackShape', huge)), huge);
  const getter = Object.defineProperty({}, 'size', { enumerable: true, get() { throw Error('Getter executed'); } });
  for (const invalid of [null, [], getter, { unknown: 0 }, { height: -1 }, { size: Infinity }, { trackShape: null }, { trackShape: { topLeft: { x: null } } }, { indicatorColor: 'red' }]) {
    assert.throws(() => normalizeMeterAppearance(invalid), { code: 'INVALID_METER_APPEARANCE' });
  }
});

test('formatOptions editor preserves omitted versus empty object and validates real Intl option combinations', () => {
  const field = source.properties.find(prop => prop.name === 'formatOptions');
  const editor = propertyEditor(component, field);
  assert.equal(editor.kind, 'json'); assert.equal(editor.optional, true);
  assert.equal(parsePropertyInput(editor, ''), undefined);
  assert.deepEqual(parsePropertyInput(editor, '{}'), {});
  for (const value of [{ style: 'currency', currency: 'EUR', currencySign: 'accounting' },
    { style: 'unit', unit: 'kilometer-per-hour', unitDisplay: 'long' },
    { notation: 'compact', compactDisplay: 'long', maximumSignificantDigits: 3 },
    { minimumFractionDigits: 2, maximumFractionDigits: 2, roundingIncrement: 5, roundingMode: 'halfEven' },
    { useGrouping: false, signDisplay: 'exceptZero', trailingZeroDisplay: 'stripIfInteger' },
    { minimumSignificantDigits: 2, maximumSignificantDigits: 3, minimumFractionDigits: 5, maximumFractionDigits: 2 }]) {
    assert.deepEqual(parsePropertyInput(editor, JSON.stringify(value)), value);
  }
  for (const raw of ['null', '[]', 'false', '{"style":"currency"}', '{"minimumFractionDigits":5,"maximumFractionDigits":2}', '{"maximumSignificantDigits":22}', '{"style":"unit","unit":"invented-unit"}', '{"callback":"eval(1)"}', '{"roundingIncrement":3}', '{"useGrouping":null}']) {
    assert.throws(() => parsePropertyInput(editor, raw), undefined, raw);
  }
  const accessor = Object.defineProperty({}, 'style', { enumerable: true, get() { throw Error('Getter executed'); } });
  assert.throws(() => normalizeMeterFormatOptions(accessor), { code: 'INVALID_METER_FORMAT_OPTIONS' });
  assert.equal(normalizeMeterFormatOptions(undefined), undefined);
});

test('Meter transport retains source formatOptions objects and both appearance scopes without preformatting', () => {
  for (const options of [undefined, {}, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }]) {
    const properties = { value: 42, min: 20, max: 80, locale: 'de-DE', color: 'Brand', ...(options !== undefined ? { formatOptions: options } : {}) };
    const state = { selected: component, meterThemeTokens: themeTokens };
    const request = nativeRenderRequest(component.tag, properties, true, meterThemeOptions(state, { themeTokens: { '--md-sys-color-primary': '#6750A4' }, meterAppearance: appearance, meterAppearanceDefaults: { height: 0 } }));
    const valid = validateRenderRequest(request, new Set([component.tag]));
    assert.deepEqual(valid.properties, properties);
    assert.equal(Object.hasOwn(valid.properties, 'formatOptions'), options !== undefined);
    assert.equal(Object.hasOwn(valid.properties, 'valueText'), false);
    assert.equal(valid.themeTokens['--md-sys-color-Brand'], '#33669980');
    assert.equal(valid.themeTokens['--md-sys-color-primary'], '#6750A4');
    assert.equal(valid.meterAppearanceDefaults.height, 0);
    assert.deepEqual(valid.meterAppearance.trackShape, shape);
    assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_METER_APPEARANCE' });
  }
  // Invalid direct API input remains renderer-owned: source uses raw-number fallback.
  const invalidOptions = { style: 'unknown' };
  assert.deepEqual(validateRenderRequest(nativeRenderRequest(component.tag, { formatOptions: invalidOptions }), new Set([component.tag])).properties.formatOptions, invalidOptions);
});

test('custom role token data retains case and alpha while rejecting executable or excessive values', () => {
  assert.deepEqual(normalizeThemeColorTokens({ '--md-sys-color-Brand': '#aabbcc80', '--md-sys-color-brand': '#112233' }),
    { '--md-sys-color-Brand': '#AABBCC80', '--md-sys-color-brand': '#112233' });
  const getter = Object.defineProperty({}, '--md-sys-color-brand', { enumerable: true, get() { throw Error('Getter executed'); } });
  for (const value of [null, [], getter, { '--bg': '#FFFFFF' }, { '--md-sys-color-brand': 'var(--x)' }, { '--md-sys-color-brand': '#abc' }, { '--md-sys-color-brand': '#AABBCC; color:red' },
    Object.fromEntries(Array.from({ length: 129 }, (_, index) => [`--md-sys-color-role-${index}`, '#FFFFFF']))]) {
    assert.throws(() => normalizeThemeColorTokens(value), { code: 'INVALID_THEME_TOKENS' });
  }
  assert.deepEqual(meterThemeOptions({ selected: { tag: 'md-button' }, meterThemeTokens: themeTokens }, { direction: 'rtl' }), { direction: 'rtl' });
});

test('real Properties role editor updates all platforms, keeps valid data on error and restores inherited Web colors', async t => {
  const dom = new JSDOM('<div id="props-controls"></div><div id="usage-docs"></div><div id="button-appearance-controls"></div>');
  const previous = globalThis.document, previousWindow = globalThis.window;
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  t.after(() => { globalThis.document = previous; globalThis.window = previousWindow; dom.window.close(); });
  let updates = 0;
  const state = { selected: component, platform: 'web', props: { value: 42 }, docCssValues: {}, docSlotValues: {}, target: document.createElement('md-meter') };
  state.target.style.setProperty('--md-sys-color-Brand', '#102030');
  const ui = createDocumentationUI({ getState: () => state, notify() {}, watchEvents() {}, onAppearanceChange() { updates++; } });
  t.after(() => ui.dispose());
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform;
    document.querySelector('#props-controls').innerHTML = ui.configurationControls();
    ui.bindTextControl();
    const input = document.querySelector('#meter-theme-tokens');
    assert.equal(input.tagName, 'MD-TEXT-FIELD');
    assert.equal(input.getAttribute('multiline'), 'fixed');
    const edit = value => input.dispatchEvent(new dom.window.CustomEvent('mdInput', { bubbles: true, detail: value }));
    edit(JSON.stringify(themeTokens));
    assert.equal(input.error, false); assert.deepEqual(state.meterThemeTokens, themeTokens);
    assert.equal(updates, platform === 'web' ? 1 : platform === 'ios' ? 3 : 5);
    if (platform === 'web') assert.equal(state.target.style.getPropertyValue('--md-sys-color-Brand'), '#33669980');
    edit('{"--md-sys-color-Brand":"url(script)"}');
    assert.equal(input.error, true); assert.deepEqual(state.meterThemeTokens, themeTokens);
    edit('');
    assert.equal(input.error, false); assert.deepEqual(state.meterThemeTokens, {});
    if (platform === 'web') assert.equal(state.target.style.getPropertyValue('--md-sys-color-Brand'), '#102030');
  }
  state.editedTag = component.tag;
  state.editedProps = { formatOptions: true };
  state.props.formatOptions = {};
  assert.deepEqual(snippetProperties(state).formatOptions, {});
  state.props.formatOptions = undefined;
  assert.equal(Object.hasOwn(snippetProperties(state), 'formatOptions'), false);
});

test('Meter Styles editor applies typed corners and zero without changing property values', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const state = { selected: component, props: { thickness: 4, size: 48 } };
  const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
  ui.render();
  for (const [name, value] of [['trackShape', '50% / 4px'], ['height', '0'], ['indicatorColor', '#33669980']]) {
    const input = document.querySelector(`#appearance-${name}`);
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: value }));
    assert.equal(input.error, false);
  }
  const target = document.createElement('md-meter'); ui.apply(target);
  assert.equal(target.style.getPropertyValue('--md-meter-height'), '0px');
  assert.equal(target.style.getPropertyValue('--md-meter-track-shape'), '50% / 4px');
  assert.deepEqual(state.props, { thickness: 4, size: 48 });
});

test('all seven copyable frameworks retain actual formatting object, custom role and explicit300px parent', () => {
  const recipe = recipeFor(component.tag);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { value: 42, locale: 'de-DE', formatOptions: { style: 'currency', currency: 'EUR' }, color: 'Brand' }, platform,
      { html: recipe.html, themeTokens, meterAppearance: appearance, meterAppearanceDefaults: { height: 4 } });
    assert.match(code, /formatOptions/); assert.match(code, /EUR/); assert.match(code, /de-DE/);
    assert.match(code, /--md-sys-color-Brand/); assert.match(code, /#33669980/);
    assert.doesNotMatch(code, /valueText|\[object Object\]/);
    if (platform === 'swift' || platform === 'android') {
      assert.match(code, /AWCCornerShape/);
      assert.match(code, platform === 'swift' ? /awcMeterAppearance/ : /AWCMeterAppearanceScope/);
      assert.match(code, platform === 'swift' ? /\.frame\(width: 300\)/ : /requiredWidth\(300.dp\)/);
      assert.match(code, platform === 'swift' ? /awcTheme\(\.generated\(tokens:/ : /AWCTheme\(tokenOverrides = mapOf/);
    } else {
      assert.match(code, /width(?:\:|['"]\:)\s*(?:['"])?300/);
      assert.match(code, /--md-meter-track-shape/);
    }
    const absent = usageSnippet(component, { value: 42 }, platform, { html: recipe.html });
    const empty = usageSnippet(component, { value: 42, formatOptions: {} }, platform, { html: recipe.html });
    assert.doesNotMatch(absent, /formatOptions/); assert.match(empty, /formatOptions/);
  }
});

test('all five part recipes map implemented visuals without inventing events, slots or extra hooks', () => {
  assert.deepEqual(source.events, []); assert.deepEqual(source.slots, []); assert.deepEqual(source.methods, []);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    for (const name of policy.visualParts) {
      const example = apiExample(component, 'cssPart', name, platform);
      assert.ok(example.code, `${platform}/${name}`);
      if (platform === 'swift' || platform === 'android') assert.match(example.code, /[aA][wW][cC]MeterAppearance/);
      else assert.match(example.code, new RegExp(`md-meter::part\\(${name}\\)`));
    }
  }
  const unavailable = { ...component, support: { ios: { ...policy, visualParts: [] } } };
  assert.doesNotMatch(apiExample(unavailable, 'cssPart', 'track', 'swift').code || '', /awcMeterAppearance/);
  for (const platform of ['ios', 'android']) {
    const guide = componentAppearanceGuide(component, platform);
    for (const field of METER_APPEARANCE_FIELDS) assert.match(guide, new RegExp(field.name));
  }
  for (const platform of ['swift', 'android']) {
    const theme = nativeThemeExample(component, platform);
    assert.match(theme.code, /Brand/); assert.match(theme.code, /#006A6A80/);
  }
});
