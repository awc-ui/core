import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { PROGRESS_INDICATOR_APPEARANCE_FIELDS, parseProgressIndicatorAppearanceInput } from './progress-indicator-appearance.js';
import { componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { apiExample } from './api-examples.js';
import { nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';
import { PROGRESS_UPDATE_PROPERTIES, supportsRetainedPropertyUpdates } from './native-property-updates.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-progress-indicator.json', import.meta.url), 'utf8'));
// Exercise the implemented shared contract without publishing native acceptance.
const policy = { properties: source.properties.map(prop => prop.name), visualParts: ['active-indicator', 'track', 'stop-indicator'], events: ['mdComplete'], slots: [], methods: [], appearance: { fields: PROGRESS_INDICATOR_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { ...source, support: { ios: policy, android: policy } };
const corners = parseProgressIndicatorAppearanceInput('trackShape', 'calc(50% - 2px) 8px / 4px 25%');
const appearance = { activeIndicatorColor: '#006A6A80', activeIndicatorShape: corners, trackColor: '#D0E8E5', trackShape: corners, stopIndicatorColor: '#4F378B', stopIndicatorShape: corners, stopIndicatorSize: 0, stopIndicatorTrailingSpace: -7, trackActiveIndicatorSpace: -9, fourColor1: '#112233', fourColor2: '#445566', fourColor3: '#778899', fourColor4: '#AABBCC80' };

test('Progress transports all13 typed styles and signed source properties, without relaxing component scope', () => {
  assert.deepEqual(policy.properties.slice().sort(), [...PROGRESS_UPDATE_PROPERTIES].sort());
  const props = { value: -37, max: -100, thickness: -2, waveSpeed: 0, complete: false };
  const options = componentAppearanceOptions({ selected: component, progressIndicatorAppearance: appearance, progressIndicatorAppearanceDefaults: { stopIndicatorSize: 6 } });
  const request = nativeRenderRequest(component.tag, props, true, { ...options, direction: 'rtl' });
  const valid = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(valid.properties, props);
  assert.deepEqual(valid.progressIndicatorAppearance, appearance);
  assert.deepEqual(valid.progressIndicatorAppearanceDefaults, { stopIndicatorSize: 6 });
  assert.equal(valid.direction, 'rtl');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_PROGRESS_INDICATOR_APPEARANCE' });
  assert.throws(() => validateRenderRequest({ ...request, progressIndicatorAppearance: { stopIndicatorSize: -1 } }, new Set([component.tag])), { code: 'INVALID_PROGRESS_INDICATOR_APPEARANCE' });
  assert.equal(supportsRetainedPropertyUpdates(component, 'ios'), true);
  assert.equal(supportsRetainedPropertyUpdates({ ...component, support: { ios: { ...policy, unsupportedProperties: ['complete'] } } }, 'ios'), false);
});

test('Progress Styles exposes all13 fields, applies zero/signed/physical corners, and preserves state on invalid input', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document;
  globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  let updates = 0;
  const state = { selected: component, platform: 'web', props: { value: 64, complete: false } };
  const ui = createButtonAppearanceUI({ getState: () => state, onChange() { updates++; } });
  ui.render();
  assert.equal(document.querySelectorAll('[data-appearance-field]').length, 13);
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    for (const [name, value] of [['trackShape', '50% / 4px'], ['stopIndicatorSize', '0'], ['trackActiveIndicatorSpace', '-9'], ['activeIndicatorColor', '#33669980']]) {
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: value }));
      assert.equal(input.error, false);
    }
    const input = document.querySelector('#appearance-stopIndicatorSize');
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: '-1' }));
    assert.equal(input.error, true); assert.equal(state.progressIndicatorAppearance.stopIndicatorSize, 0);
  }
  assert.equal(updates, 12);
  const target = document.createElement('md-progress-indicator'); ui.apply(target);
  assert.equal(target.style.getPropertyValue('--md-progress-indicator-stop-indicator-size'), '0px');
  assert.equal(target.style.getPropertyValue('--md-progress-indicator-track-active-indicator-space'), '-9px');
  assert.equal(target.style.getPropertyValue('--md-progress-indicator-track-shape'), '50% / 4px');
  assert.deepEqual(state.props, { value: 64, complete: false });
});

test('all7 Progress usage frameworks retain300unit parent and all13 hooks without forcing circular width', async () => {
  const recipe = recipeFor(component.tag);
  const dom = new JSDOM(recipe.html), parent = dom.window.document.querySelector('[data-awc-progress-context]');
  assert.equal(parent.style.width, '300px'); assert.equal(parent.firstElementChild.style.width, ''); dom.window.close();
  const styles = await readFile(new URL('./styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(styles, /\.demo md-progress-indicator[^}]*width:280px/);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { value: 64, variant: 'circular', fourColor: true }, platform,
      { html: recipe.html, progressIndicatorAppearance: appearance, progressIndicatorAppearanceDefaults: { stopIndicatorSize: 6 } });
    assert.doesNotMatch(code, /\[object Object\]/);
    if (platform === 'swift' || platform === 'android') {
      assert.match(code, /AWCCornerShape/);
      assert.match(code, platform === 'swift' ? /\.frame\(width: 300\)/ : /requiredWidth\(300.dp\)/);
      for (const { name } of PROGRESS_INDICATOR_APPEARANCE_FIELDS) assert.match(code, new RegExp(name));
    } else {
      assert.match(code, /width(?:\:|['"]\:)\s*(?:['"])?300/);
      for (const { cssProperty } of PROGRESS_INDICATOR_APPEARANCE_FIELDS) assert.match(code, new RegExp(cssProperty));
    }
  }
});

test('Progress completion recipes trigger a mounted property change and never fabricate detail or a publicmethod', () => {
  assert.deepEqual(source.methods, []); assert.deepEqual(source.slots, []);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const example = apiExample(component, 'event', 'mdComplete', platform);
    assert.ok(example.code); assert.match(example.code, /mdComplete/); assert.match(example.code, /complete/);
    assert.doesNotMatch(example.code, /\.complete\(|detail\.(?:value|complete)|setTimeout/);
    if (platform === 'swift' || platform === 'android') {
      assert.match(example.code, /Button\(.*Finish/);
      assert.match(example.code, /complete = true/);
      assert.match(example.code, platform === 'swift' ? /\.id\(runID\)/ : /key\(runID\)/);
      assert.match(example.notes.join(' '), /Initial complete=true does not trigger/);
      assert.match(nativeUsageExample(component, platform).code, /Finish/);
    }
  }
});

test('Progress three part recipes and theme examples use actual typed APIs with implementation gating', () => {
  for (const platform of ['swift', 'android']) {
    for (const part of policy.visualParts) {
      const example = apiExample(component, 'cssPart', part, platform);
      assert.match(example.code, platform === 'swift' ? /awcProgressIndicatorAppearance/ : /AWCProgressIndicatorAppearanceScope/);
      assert.match(example.code, /linear/);
    }
    assert.match(nativeThemeExample(component, platform).code, platform === 'swift' ? /\.frame\(width: 300\)/ : /requiredWidth\(300.dp\)/);
    const guide = componentAppearanceGuide(component, platform === 'swift' ? 'ios' : platform);
    for (const { name } of PROGRESS_INDICATOR_APPEARANCE_FIELDS) assert.match(guide, new RegExp(name));
  }
  const unavailable = { ...component, support: { ios: { ...policy, visualParts: [] } } };
  assert.doesNotMatch(apiExample(unavailable, 'cssPart', 'track', 'swift').code || '', /awcProgressIndicatorAppearance/);
});
