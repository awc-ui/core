import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { LOADING_INDICATOR_APPEARANCE_FIELDS, normalizeLoadingIndicatorAppearance, loadingIndicatorAppearanceCSS, parseLoadingIndicatorAppearanceInput, formatLoadingIndicatorAppearanceInput } from './loading-indicator-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { apiExample } from './api-examples.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';
import { validateNativeInspection } from './native-inspection.mjs';
import { inspectNativeFrame } from './canvas-inspector.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-loading-indicator.json', import.meta.url), 'utf8'));
const policy = { properties: ['variant', 'label', 'density'], events: [], methods: [], slots: [], visualParts: ['shape'], appearance: { fields: LOADING_INDICATOR_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { ...source, support: { ios: policy, android: policy } };
const shape = parseLoadingIndicatorAppearanceInput('containerShape', 'calc(50% - 2px) 7px 15% 0 / 10px 20px');
const appearance = { color: '#aabbcc80', size: 64, shapeSize: 80, containerColor: '#abcdef', containerShape: shape };

test('Loading Indicator maps exactly five source hooks and validates all nested corner data', async () => {
  const css = await readFile(new URL('../../packages/core/src/components/md-loading-indicator/md-loading-indicator.css', import.meta.url), 'utf8');
  assert.deepEqual(LOADING_INDICATOR_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(css.match(/--md-loading-indicator-[a-z-]+/g))].sort());
  assert.deepEqual(normalizeLoadingIndicatorAppearance(appearance), { ...appearance, color: '#AABBCC80', containerColor: '#ABCDEF' });
  assert.deepEqual(normalizeLoadingIndicatorAppearance({ size: 0, shapeSize: 0 }), { size: 0, shapeSize: 0 });
  assert.deepEqual(normalizeLoadingIndicatorAppearance({ containerShape: {} }).containerShape.topLeft, { x: { points: 0, fraction: 0 }, y: { points: 0, fraction: 0 } });
  const accessor = Object.defineProperty({}, 'points', { get() { throw Error('Getter invoked'); } });
  for (const value of [null, [], { extra: 0 }, { size: -1 }, { shapeSize: Infinity }, { color: '#abc' },
    { containerShape: null }, { containerShape: { topLeft: null } }, { containerShape: { topLeft: { x: null } } },
    { containerShape: { topLeft: { x: { points: null } } } }, { containerShape: { topLeft: { x: { points: NaN } } } },
    { containerShape: { topLeft: { x: accessor } } }, { containerShape: { logicalStart: 2 } }]) {
    assert.throws(() => normalizeLoadingIndicatorAppearance(value), { code: 'INVALID_LOADING_INDICATOR_APPEARANCE' });
  }
});

test('radius shorthand preserves physical corners, both axes and signed mixed units through CSS roundtrips', () => {
  assert.deepEqual(shape.topLeft, { x: { points: -2, fraction: 0.5 }, y: { points: 10, fraction: 0 } });
  assert.deepEqual(shape.bottomLeft, { x: { points: 0, fraction: 0 }, y: { points: 20, fraction: 0 } });
  for (const raw of ['0', '25%', '150%', '4px 12px', '2px 4px 8px', '1px 2px 3px 4px / 5% 6% 7% 8%',
    '10px / 20px', 'calc(50% - 2px)', 'calc(-2px)', 'calc(3px + 25%)']) {
    const value = parseLoadingIndicatorAppearanceInput('containerShape', raw);
    const normalized = normalizeLoadingIndicatorAppearance({ containerShape: value }).containerShape;
    const serialized = formatLoadingIndicatorAppearanceInput('containerShape', value);
    assert.deepEqual(parseLoadingIndicatorAppearanceInput('containerShape', serialized), normalized, raw);
    assert.equal(loadingIndicatorAppearanceCSS({ containerShape: value })['--md-loading-indicator-container-shape'], serialized);
  }
  for (const raw of ['', '10px /', '/ 10px', '1px / 2px / 3px', '1px 2px 3px 4px 5px', 'var(--radius)', '-2px', 'calc(10px * 2)', '10px;color:red']) {
    assert.throws(() => parseLoadingIndicatorAppearanceInput('containerShape', raw), { code: 'INVALID_LOADING_INDICATOR_APPEARANCE' }, raw);
  }
  assert.doesNotMatch(loadingIndicatorAppearanceCSS({ containerShape: { topLeft: { x: { fraction: Number.MAX_VALUE } } } })['--md-loading-indicator-container-shape'], /Infinity|NaN/);
});

test('native requests retain typed corner objects and reject cross-component local appearance', () => {
  const request = nativeRenderRequest(component.tag, { variant: 'contained' }, true, {
    loadingIndicatorAppearance: appearance, loadingIndicatorAppearanceDefaults: { size: 0, containerShape: {} },
  });
  const actual = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(actual.loadingIndicatorAppearance, normalizeLoadingIndicatorAppearance(appearance));
  assert.equal(actual.loadingIndicatorAppearanceDefaults.size, 0);
  assert.deepEqual(actual.loadingIndicatorAppearance.containerShape.bottomRight.x, { points: 0, fraction: 0.15 });
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_LOADING_INDICATOR_APPEARANCE' });
});

test('native Loading zero geometry remains measured and a hidden root never falls back to the frame', () => {
  for (const platform of ['macos', 'android']) {
    const inspection = {
      version: 1, unit: platform === 'macos' ? 'pt' : 'dp', source: platform === 'macos' ? 'SwiftUI layout' : 'Compose layout',
      nodes: [{ id: 'component', name: component.tag, bounds: { x: 32, y: 32, width: 0, height: 0 } },
        { id: 'component.shape', parentId: 'component', name: 'Shape', bounds: { x: 32, y: 32, width: 0, height: 0 } }],
    };
    const checked = validateNativeInspection(inspection, platform);
    assert.deepEqual(checked, inspection);
    const frame = { logicalWidth: 640, logicalHeight: 100, inspection: checked };
    const visible = inspectNativeFrame(frame, platform === 'macos' ? 'ios' : platform);
    assert.equal(visible.bounds.width, 0); assert.equal(visible.nodes[1].bounds.height, 0);
    frame.inspection.nodes = [];
    assert.equal(inspectNativeFrame(frame, platform === 'macos' ? 'ios' : platform), null);
  }
});

test('real shared editor accepts elliptical shorthand, preserves valid state after errors and restores defaults', () => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), prior = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    let changes = 0;
    const state = { selected: component }, ui = createButtonAppearanceUI({ getState: () => state, onChange: () => changes++ });
    ui.render();
    const input = (name, value) => {
      const element = document.querySelector(`#appearance-${name}`);
      element.dispatchEvent(new dom.window.CustomEvent('mdInput', { bubbles: true, detail: value }));
      return element;
    };
    input('containerShape', '10px / 20px'); input('color', '#aabbcc80'); input('size', '0');
    assert.equal(changes, 3);
    assert.equal(state.loadingIndicatorAppearance.containerShape.bottomRight.y.points, 20);
    assert.equal(input('containerShape', 'var(--radius)').error, true);
    assert.equal(changes, 3); assert.equal(state.loadingIndicatorAppearance.size, 0);
    const target = document.createElement(component.tag);
    target.style.setProperty('--md-loading-indicator-size', '48px');
    ui.apply(target);
    assert.equal(target.style.getPropertyValue('--md-loading-indicator-container-shape'), '10px / 20px');
    assert.equal(target.style.getPropertyValue('--md-loading-indicator-size'), '0px');
    document.querySelector('#appearance-reset').dispatchEvent(new dom.window.CustomEvent('mdClick'));
    ui.apply(target);
    assert.deepEqual(state.loadingIndicatorAppearance, {});
    assert.equal(target.style.getPropertyValue('--md-loading-indicator-size'), '48px');
    assert.equal(target.style.getPropertyValue('--md-loading-indicator-container-shape'), '');
  } finally { globalThis.document = prior; dom.window.close(); }
});

test('all seven usage languages preserve the same typed shape and keep the accessibility label invisible', () => {
  const recipe = recipeFor(component.tag);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { variant: 'contained', label: 'Loading workspace' }, platform,
      { html: recipe.html, loadingIndicatorAppearance: appearance });
    assert.match(code, /Loading workspace/);
    assert.doesNotMatch(code, /\[object Object\]/);
    if (platform === 'swift' || platform === 'android') {
      assert.match(code, /AWCCornerShape/); assert.match(code, /AWCCornerRadius/); assert.match(code, /AWCCornerLength/);
      assert.match(code, platform === 'swift' ? /fraction: 0.5/ : /fraction = 0.5/);
      assert.match(code, platform === 'swift' ? /points: -2.0/ : /points = -2.0/);
      assert.match(code, platform === 'swift' ? /awcLoadingIndicatorAppearance/ : /AWCLoadingIndicatorAppearanceScope/);
      assert.doesNotMatch(code, /Text\("Loading workspace"\)/);
    } else {
      assert.match(code, /--md-loading-indicator-container-shape/);
      assert.match(code, /calc\(50% - 2px\)/);
      assert.doesNotMatch(code, />Loading workspace</);
    }
  }
});

test('shape part examples use the actual20×30 visual override without adding nonexistent source hooks', () => {
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const example = apiExample(component, 'cssPart', 'shape', platform);
    assert.ok(example.code, platform);
    if (platform === 'swift' || platform === 'android') {
      assert.match(example.code, platform === 'swift' ? /awcLoadingIndicatorShapeAppearance/ : /AWCLoadingIndicatorShapeAppearanceScope/);
      assert.match(example.code, platform === 'swift' ? /width: 20, height: 30/ : /width = 20.0, height = 30.0/);
    } else assert.match(example.code, /width: 20px;\n.*height: 30px;/);
  }
  const unavailable = { ...component, support: { ios: { ...policy, visualParts: [] } } };
  assert.doesNotMatch(apiExample(unavailable, 'cssPart', 'shape', 'swift').code || '', /awcLoadingIndicatorShapeAppearance/);
  const guide = componentAppearanceGuide(component, 'ios');
  for (const field of LOADING_INDICATOR_APPEARANCE_FIELDS) assert.match(guide, new RegExp(field.name));
});
