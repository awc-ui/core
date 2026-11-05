import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { STATUS_DOT_APPEARANCE_FIELDS, normalizeStatusDotAppearance, statusDotAppearanceCSS, parseStatusDotAppearanceInput, formatStatusDotAppearanceInput } from './status-dot-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const policy = { status: 'native-adapter', properties: ['state', 'size', 'inline', 'shape', 'live', 'label', 'density'], slots: [], events: [], methods: [], visualParts: [], appearance: { fields: STATUS_DOT_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { tag: 'md-status-dot', properties: policy.properties.map(name => ({ name })), slots: [], events: [], methods: [], cssParts: [], support: { ios: policy, android: policy } };
const appearance = { size: 16, color: '#abcdef80', pulseColor: '#12345600', outlineColor: '#FEDCBA', outlineWidth: 0.5, insetEnd: { points: -2, fraction: 0.25 }, insetBlockEnd: { points: 3, fraction: -0.125 }, pulseDuration: 0 };

test('Status Dot exposes exactly eight source hooks and preserves finite zero and RGBA values', async () => {
  const source = await readFile(new URL('../../packages/core/src/components/md-status-dot/md-status-dot.css', import.meta.url), 'utf8');
  assert.deepEqual(STATUS_DOT_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(source.match(/--md-status-dot-[a-z-]+/g))].sort());
  assert.deepEqual(normalizeStatusDotAppearance(appearance), { ...appearance, color: '#ABCDEF80' });
  assert.deepEqual(normalizeStatusDotAppearance({ size: 0, outlineWidth: 0, pulseDuration: 0, insetEnd: {} }), { size: 0, outlineWidth: 0, pulseDuration: 0, insetEnd: { points: 0, fraction: 0 } });
  const getter = Object.defineProperty({}, 'fraction', { get() { throw Error('Must not invoke getters'); } });
  for (const value of [null, [], { extra: 0 }, { size: -1 }, { pulseDuration: Infinity }, { color: '#abc' }, { color: '#ABCDEF0' }, { insetEnd: { points: '2' } }, { insetEnd: getter }, { insetBlockEnd: { percent: 25 } }]) assert.throws(() => normalizeStatusDotAppearance(value), { code: 'INVALID_STATUS_DOT_APPEARANCE' });
});

test('Status Dot serializes parent-relative insets and seconds without confusing badge offsets', () => {
  const css = statusDotAppearanceCSS(appearance);
  assert.equal(css['--md-status-dot-inset-end'], 'calc(25% - 2px)');
  assert.equal(css['--md-status-dot-inset-block-end'], 'calc(-12.5% + 3px)');
  assert.equal(css['--md-status-dot-pulse-duration'], '0s');
  assert.equal(css['--md-status-dot-outline-width'], '0.5px');
  assert.equal(css['--md-status-dot-color'], '#ABCDEF80');
  assert.doesNotMatch(statusDotAppearanceCSS({ insetEnd: { points: Number.MAX_VALUE, fraction: Number.MAX_VALUE } })['--md-status-dot-inset-end'], /Infinity|NaN/);
  for (const [raw, expected] of [['25% - 2px', { points: -2, fraction: 0.25 }], ['-4px', { points: -4, fraction: 0 }], ['0', { points: 0, fraction: 0 }]]) {
    assert.deepEqual(parseStatusDotAppearanceInput('insetEnd', raw), expected);
    assert.deepEqual(parseStatusDotAppearanceInput('insetEnd', formatStatusDotAppearanceInput('insetEnd', expected)), expected);
  }
  for (const raw of ['var(--offset)', 'calc(20% - 2px)', '0; color:red', '{}']) assert.throws(() => parseStatusDotAppearanceInput('insetEnd', raw), { code: 'INVALID_STATUS_DOT_APPEARANCE' });
});

test('the public request carries structured dot styles and rejects local styles on another component', () => {
  const request = nativeRenderRequest(component.tag, { state: 'online', inline: false, live: true }, true, { statusDotAppearance: appearance, statusDotAppearanceDefaults: { insetEnd: { fraction: 0.25 }, pulseColor: '#00000000' } });
  const actual = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(actual.statusDotAppearance, normalizeStatusDotAppearance(appearance));
  assert.deepEqual(actual.statusDotAppearanceDefaults, { insetEnd: { points: 0, fraction: 0.25 }, pulseColor: '#00000000' });
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-badge' }, new Set(['md-badge'])), { code: 'INVALID_STATUS_DOT_APPEARANCE' });
});

test('real editor accepts alpha, signed parent insets and zero duration without discarding valid state', () => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), prior = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    let changes = 0;
    const state = { selected: component };
    const ui = createButtonAppearanceUI({ getState: () => state, onChange: () => changes++ });
    ui.render();
    const input = (name, value) => {
      const element = document.querySelector(`#appearance-${name}`);
      element.dispatchEvent(new dom.window.CustomEvent('mdInput', { bubbles: true, detail: value }));
      return element;
    };
    input('color', '#00aaff80');
    input('insetEnd', '25% - 2px');
    input('pulseDuration', '0');
    assert.deepEqual(state.statusDotAppearance, { color: '#00AAFF80', insetEnd: { points: -2, fraction: 0.25 }, pulseDuration: 0 });
    assert.equal(input('pulseDuration', '-1').error, true);
    assert.equal(state.statusDotAppearance.pulseDuration, 0);
    assert.equal(changes, 3);
    ui.apply(document.createElement('md-status-dot'));
  } finally { globalThis.document = prior; dom.window.close(); }
});

test('all languages preserve the real48-unit anchor and distinguish inline flow from an overlay', () => {
  const recipe = recipeFor(component.tag), dom = new JSDOM(recipe.html);
  const parent = dom.window.document.querySelector('md-icon-button');
  assert.equal(parent.style.getPropertyValue('--md-icon-button-container-width'), '48px');
  assert.equal(parent.style.getPropertyValue('--md-icon-button-container-height'), '48px');
  assert.equal(recipe.props.inline, undefined);
  assert.equal(dom.window.document.querySelector('[data-awc-status-dot-context]').style.gap, '12px');
  dom.window.close();
  for (const language of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) for (const inline of [false, true]) {
    const code = usageSnippet(component, { ...recipe.props, inline }, language, { html: recipe.html, statusDotAppearance: appearance });
    assert.match(code, /notifications/);
    assert.doesNotMatch(code, /\[object Object\]|"success"/);
    if (language === 'swift') {
      assert.match(code, /awcIconButtonAppearance\(\.init\(width: 48, height: 48\)\)/);
      assert.match(code, /AWCStatusDotInset\(points: -2.0, fraction: 0.25\)/);
      assert.match(code, inline ? /HStack\(alignment: \.center, spacing: 12\)/ : /\.awcStatusDotOverlay/);
      if (inline) assert.doesNotMatch(code, /\.awcStatusDotOverlay/);
    } else if (language === 'android') {
      assert.match(code, /AWCIconButtonAppearance\(width = 48.0, height = 48.0\)/);
      assert.match(code, /AWCStatusDotInset\(points = -2.0, fraction = 0.25\)/);
      assert.match(code, /import dev.awc.nativeui.AWCStatusDotInset/);
      assert.match(code, inline ? /Row\(horizontalArrangement = Arrangement.spacedBy\(12.dp\)/ : /AWCStatusDotHost\(/);
      if (inline) assert.doesNotMatch(code, /AWCStatusDotHost\(/);
    } else {
      assert.match(code, /48px/);
      assert.match(code, /25% - 2px/);
    }
  }
});

test('starter and theme examples use supported online state and actual anchor; guides explain units', () => {
  for (const language of ['swift', 'android']) {
    for (const example of [nativeUsageExample(component, language), nativeThemeExample(component, language)]) {
      assert.match(example.code, /online/);
      assert.doesNotMatch(example.code, /success/);
      assert.match(example.code, language === 'swift' ? /\.awcStatusDotOverlay/ : /AWCStatusDotHost\(/);
    }
    const guide = componentAppearanceGuide(component, language === 'swift' ? 'ios' : 'android');
    assert.match(guide, /AWCStatusDotInset/);
    assert.match(guide, /seconds/);
    assert.match(guide, /#RRGGBBAA/);
    assert.doesNotMatch(guide, /\[object Object\]|undefined–undefined/);
  }
});
