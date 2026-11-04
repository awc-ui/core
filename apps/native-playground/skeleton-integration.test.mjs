import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { SKELETON_APPEARANCE_FIELDS, parseSkeletonAppearanceInput } from './skeleton-appearance.js';
import { componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { apiExample } from './api-examples.js';
import { nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-skeleton.json', import.meta.url), 'utf8'));
// This fixture verifies shared integration, not an adapter implementation declaration.
const policy = { properties: source.properties.map(prop => prop.name), visualParts: ['shape', 'line', 'line-last'], events: [], slots: [], methods: [], appearance: { fields: SKELETON_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { ...source, support: { ios: policy, android: policy } };
const appearance = Object.fromEntries([
  ['color', '#12345680'], ['highlight', '#FEDCBA80'], ['radius', '10px / 20px'], ['roundedRadius', '2px 12px 20px 5px'],
  ['width', 'calc(100% - 32px)'], ['height', '1.5em'], ['size', '64px'], ['lineGap', '11px'],
  ['pulseDuration', '1.3'], ['waveDuration', '1.7'], ['bloomDuration', '0'],
].map(([name, input]) => [name, parseSkeletonAppearanceInput(name, input)]));

test('Skeleton transports relative terms and exact source strings while rejecting unsupported native CSS explicitly', () => {
  const properties = { width: '20ch', height: 'calc(1em + 2px)', lines: 2.7, fullHeight: true, announce: false };
  const options = componentAppearanceOptions({ selected: component, skeletonAppearance: appearance, skeletonAppearanceDefaults: { bloomDuration: .5 } });
  const request = nativeRenderRequest(component.tag, properties, true, options);
  const valid = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(valid.properties, properties);
  assert.deepEqual(valid.skeletonAppearance, appearance);
  assert.deepEqual(valid.skeletonAppearanceDefaults, { bloomDuration: .5 });
  assert.throws(() => validateRenderRequest({ ...request, properties: { width: 'min(100%, 260px)' } }, new Set([component.tag])), { code: 'UNSUPPORTED_SKELETON_LENGTH' });
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_SKELETON_APPEARANCE' });
  assert.doesNotThrow(() => validateRenderRequest({ ...request, properties: { width: '', height: '' } }, new Set([component.tag])));
});

test('Skeleton Styles edits all11 controls and leaves the last valid state intact on malformed relative input', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  let updates = 0;
  const state = { selected: component, platform: 'web', props: { fullWidth: false } };
  const ui = createButtonAppearanceUI({ getState: () => state, onChange() { updates++; } });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    assert.equal(document.querySelectorAll('[data-appearance-field]').length, 11);
    for (const [name, value] of [['width', 'calc(100% - 32px)'], ['height', '1.5em'], ['lineGap', '0px'], ['color', '#33669980'], ['bloomDuration', '0']]) {
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: value }));
      assert.equal(input.error, false);
    }
    const input = document.querySelector('#appearance-width');
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: 'min(100%, 260px)' }));
    assert.equal(input.error, true);
    assert.equal(state.skeletonAppearance.width.fraction, 1);
    assert.equal(state.skeletonAppearance.width.points, -32);
  }
  assert.equal(updates, 15);
  const target = document.createElement('md-skeleton'); ui.apply(target);
  assert.equal(target.style.getPropertyValue('--md-skeleton-height'), '1.5em');
  assert.equal(target.style.getPropertyValue('--md-skeleton-line-gap'), '0px');
  assert.equal(target.style.getPropertyValue('--md-skeleton-bloom-duration'), '0s');
  assert.deepEqual(state.props, { fullWidth: false });
});

test('all7 framework examples preserve the definite parent and typed source lengths', () => {
  const recipe = recipeFor(component.tag), dom = new JSDOM(recipe.html);
  const parent = dom.window.document.querySelector('[data-awc-skeleton-context]');
  assert.equal(parent.style.width, '260px'); assert.equal(parent.style.height, '160px');
  assert.equal(parent.style.fontSize, '16px'); dom.window.close();
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { ...recipe.props, fullWidth: false, width: '20ch', ariaLabelProp: 'Loading article' }, platform, { html: recipe.html, skeletonAppearance: appearance });
    assert.doesNotMatch(code, /\[object Object\]/);
    assert.match(code, /20ch/);
    if (platform === 'swift' || platform === 'android') {
      assert.match(code, platform === 'swift' ? /frame\(width: 260, height: 160, alignment: .topLeading\)/ : /requiredSize\(260.dp, 160.dp\).*Alignment.TopStart/);
      assert.match(code, platform === 'swift' ? /awcSkeletonSizingContext\(.init\(parentHeight: 160\)\)/ : /AWCSkeletonSizingContext\(parentHeight = 160.0\)/);
      assert.match(code, /AWCSkeletonLength/); assert.match(code, /AWCCornerShape/);
      for (const field of SKELETON_APPEARANCE_FIELDS) assert.match(code, new RegExp(field.name));
    } else {
      assert.match(code, /260/); assert.match(code, /160/);
      for (const field of SKELETON_APPEARANCE_FIELDS) assert.match(code, new RegExp(field.cssProperty));
    }
  }
});

test('Skeleton source documentation and public part examples keep line-last separate from all rows', () => {
  assert.deepEqual(source.cssParts.map(part => part.name).sort(), ['line', 'line-last', 'shape']);
  assert.deepEqual(source.events, []); assert.deepEqual(source.slots, []); assert.deepEqual(source.methods, []);
  for (const platform of ['swift', 'android']) {
    for (const name of ['shape', 'line', 'line-last']) {
      const example = apiExample(component, 'cssPart', name, platform);
      assert.match(example.code, /[aA][wW][cC]SkeletonPartAppearance/);
      if (name === 'line-last') {
        assert.match(example.code, /[lL]ineLast/);
        assert.match(example.code, /fraction[: =]+0.4/);
      }
    }
    assert.match(nativeUsageExample(component, platform).code, /260/);
    assert.match(nativeThemeExample(component, platform).code, /160/);
    const guide = componentAppearanceGuide(component, platform === 'swift' ? 'ios' : platform);
    assert.match(guide, /AWCSkeletonLength/);
    assert.match(guide, /unsupported CSS grammar is reported/i);
  }
  const unavailable = { ...component, support: { ios: { ...policy, visualParts: [] } } };
  assert.doesNotMatch(apiExample(unavailable, 'cssPart', 'line-last', 'swift').code || '', /awcSkeletonPartAppearance/);
});
