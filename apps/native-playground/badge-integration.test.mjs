import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { BADGE_APPEARANCE_FIELDS, normalizeBadgeAppearance, badgeAppearanceCSS, parseBadgeAppearanceInput, formatBadgeAppearanceInput } from './badge-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { createButtonConfigurationUI } from './button-configuration.js';
import { componentSlotElement, nativeContentSlots } from './content-slots.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample, nativeThemeExample } from './native-api-examples.js';
import { recipeFor } from './recipes.js';
import { apiExample } from './api-examples.js';
import { componentAppearanceGuide } from './component-appearance-guide.mjs';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const policy = { status: 'native-adapter', properties: ['variant', 'value', 'max', 'icon', 'shape', 'density'], slots: ['icon'], methods: [], events: [], visualParts: ['label', 'icon'], appearance: { fields: BADGE_APPEARANCE_FIELDS.map(field => field.name) } };
const component = { tag: 'md-badge', properties: policy.properties.map(name => ({ name })), slots: [{ name: 'icon' }], methods: [], events: [], cssParts: policy.visualParts.map(name => ({ name })), support: { ios: policy, android: policy } };
const fullAppearance = { containerColor: '#123456', labelColor: '#ffffff', cornerRadius: 3, iconColor: '#abcdef', iconSize: 12, offsetX: { points: -7, fraction: 0.5 }, offsetY: { points: 2, fraction: -0.5 }, largeHeight: 20, largePadding: [1, 6, 2, 4], smallSize: 8 };

test('Badge profile covers all ten source hooks with finite structured values', async () => {
  const source = await readFile(new URL('../../packages/core/src/components/md-badge/md-badge.css', import.meta.url), 'utf8');
  assert.deepEqual(BADGE_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(source.match(/--md-badge-[a-z-]+/g))].sort());
  assert.deepEqual(normalizeBadgeAppearance(fullAppearance), { ...fullAppearance, labelColor: '#FFFFFF', iconColor: '#ABCDEF' });
  assert.deepEqual(normalizeBadgeAppearance({ offsetX: {}, offsetY: { fraction: -0.5 }, largePadding: [0, 0, 0, 0] }), { offsetX: { points: 0, fraction: 0 }, offsetY: { points: 0, fraction: -0.5 }, largePadding: [0, 0, 0, 0] });
  assert.equal(normalizeBadgeAppearance({ largeHeight: Number.MAX_VALUE }).largeHeight, Number.MAX_VALUE);
  const getter = Object.defineProperty({}, 'points', { get() { throw Error('Must not execute'); } });
  for (const value of [null, [], { extra: 1 }, { iconSize: -1 }, { iconSize: Infinity }, { offsetX: { points: '2' } }, { offsetY: { unit: 'px' } }, { offsetX: getter }, { largePadding: [0, 1, 2] }, { largePadding: [0, 1, -2, 3] }, { largePadding: new Array(4) }, { iconColor: '#fff' }]) assert.throws(() => normalizeBadgeAppearance(value), { code: 'INVALID_BADGE_APPEARANCE' });
});

test('Badge CSS preserves fractions of own size, signed offsets and physical padding', () => {
  const css = badgeAppearanceCSS(fullAppearance);
  assert.equal(css['--md-badge-offset-x'], 'calc(50% - 7px)');
  assert.equal(css['--md-badge-offset-y'], 'calc(-50% + 2px)');
  assert.equal(css['--md-badge-large-padding'], '1px 6px 2px 4px');
  assert.equal(css['--md-badge-container-shape'], '3px');
  assert.equal(badgeAppearanceCSS({ offsetX: { points: 0, fraction: 0 } })['--md-badge-offset-x'], '0px');
  assert.doesNotMatch(badgeAppearanceCSS({ offsetX: { points: Number.MAX_VALUE, fraction: Number.MAX_VALUE } })['--md-badge-offset-x'], /Infinity|NaN/);
});

test('offset and padding inputs parse bounded syntax without evaluating CSS or JavaScript', () => {
  for (const [raw, value] of [['50% + 7px', { points: 7, fraction: 0.5 }], ['-50% - 2px', { points: -2, fraction: -0.5 }], ['0', { points: 0, fraction: 0 }], ['-4.5px', { points: -4.5, fraction: 0 }]]) {
    assert.deepEqual(parseBadgeAppearanceInput('offsetX', raw), value);
    assert.deepEqual(parseBadgeAppearanceInput('offsetX', formatBadgeAppearanceInput('offsetX', value)), value);
  }
  for (const [raw, value] of [['4', [4, 4, 4, 4]], ['0 4', [0, 4, 0, 4]], ['1 2 3', [1, 2, 3, 2]], ['1px 2px 3px 4px', [1, 2, 3, 4]]]) assert.deepEqual(parseBadgeAppearanceInput('largePadding', raw), value);
  for (const raw of ['var(--offset)', 'calc(50% + 2px)', '1px; color:red', 'window.alert(1)', '{}']) assert.throws(() => parseBadgeAppearanceInput('offsetX', raw), { code: 'INVALID_BADGE_APPEARANCE' });
});

test('Badge typed options survive the public request boundary without accepting other local targets', () => {
  const request = nativeRenderRequest(component.tag, { value: '8' }, false, { badgeAppearance: fullAppearance, badgeAppearanceDefaults: { offsetX: { fraction: 0.5 }, largePadding: [0, 4, 0, 4] } });
  const result = validateRenderRequest(request, new Set([component.tag]));
  assert.deepEqual(result.badgeAppearance, normalizeBadgeAppearance(fullAppearance));
  assert.deepEqual(result.badgeAppearanceDefaults.offsetX, { points: 0, fraction: 0.5 });
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_BADGE_APPEARANCE' });
});

test('real appearance controls retain structured values, reject invalid edits and clear only that style', () => {
  const prior = globalThis.document, dom = new JSDOM('<div id="button-appearance-controls"></div>');
  globalThis.document = dom.window.document;
  try {
    let changes = 0;
    const state = { selected: component };
    const ui = createButtonAppearanceUI({ getState: () => state, onChange: () => changes++ });
    state.badgeAppearance = { ...fullAppearance };
    ui.render();
    const input = document.querySelector('#appearance-offsetX');
    assert.equal(input.value, '50% - 7px');
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { bubbles: true, detail: '25% + 2px' }));
    assert.deepEqual(state.badgeAppearance.offsetX, { points: 2, fraction: 0.25 });
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { bubbles: true, detail: 'calc(broken)' }));
    assert.equal(input.error, true);
    assert.deepEqual(state.badgeAppearance.offsetX, { points: 2, fraction: 0.25 });
    input.dispatchEvent(new dom.window.CustomEvent('mdInput', { bubbles: true, detail: '' }));
    assert.equal(Object.hasOwn(state.badgeAppearance, 'offsetX'), false);
    assert.deepEqual(state.badgeAppearance.largePadding, [1, 6, 2, 4]);
    assert.equal(changes, 2);
  } finally { globalThis.document = prior; dom.window.close(); }
});

test('Badge icon controls use only its named slot and preserve explicit blank content', () => {
  const ui = createButtonConfigurationUI({ getState: () => ({ selected: component, props: {}, docSlotValues: {} }) });
  assert.match(ui.markup(), /data-button-slot-mode="icon"/);
  assert.doesNotMatch(ui.markup(), /aria-expanded|Accessible name for this action|Circular progress/);
  assert.match(componentSlotElement(component.tag, 'icon', { kind: 'symbol', value: 'priority_high' }).attributes.style, /--md-badge-icon-size,max\(8px,calc\(10px/);
  assert.throws(() => nativeContentSlots({ icon: { kind: 'progress' } }, component.tag), { code: 'INVALID_SLOTS' });
  for (const language of ['swift', 'android']) {
    const code = usageSnippet(component, { icon: 'notifications' }, language, { html: recipeFor(component.tag).html, slots: { icon: '' } });
    assert.match(code, language === 'swift' ? /\.slotText\("", slot: "icon"\)/ : /if \(slot == "icon"\) Text\(""\)/);
  }
});

test('all frameworks preserve the real48px parent and typed native constructors', () => {
  const html = recipeFor(component.tag).html;
  const dom = new JSDOM(html);
  const parent = dom.window.document.querySelector('[data-awc-badge-context]');
  assert.equal(parent.style.width, '48px');
  assert.equal(parent.querySelector('md-icon-button').style.getPropertyValue('--md-icon-button-container-width'), '48px');
  assert.equal(parent.querySelector('md-icon-button').style.getPropertyValue('--md-icon-button-container-height'), '48px');
  assert.equal(parent.querySelector('md-badge').getAttribute('style'), null);
  dom.window.close();
  for (const language of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(component, { value: '8', shape: 'circle' }, language, { html, badgeAppearance: fullAppearance });
    assert.doesNotMatch(code, /\[object Object\]|top:-4px|right:-5px/);
    if (language === 'swift') {
      assert.match(code, /\.awcIconButtonAppearance\(\.init\(width: 48, height: 48\)\)/);
      assert.match(code, /\.awcBadgeOverlay/); assert.match(code, /\.frame\(width: 48, height: 48\)/);
      assert.match(code, /AWCBadgeOffset\(points: -7.0, fraction: 0.5\)/);
      assert.match(code, /AWCBadgePadding\(top: 1.0, right: 6.0, bottom: 2.0, left: 4.0\)/);
    } else if (language === 'android') {
      assert.match(code, /AWCIconButtonAppearance\(width = 48.0, height = 48.0\)/);
      assert.match(code, /AWCBadgeHost/); assert.match(code, /requiredSize\(48.dp, 48.dp\)/);
      assert.match(code, /import dev.awc.nativeui.AWCBadgeOffset/);
      assert.match(code, /AWCBadgePadding\(top = 1.0, right = 6.0, bottom = 2.0, left = 4.0\)/);
    } else assert.match(code, /48px/);
  }
});

test('Badge starter, theme, slot and part examples use the actual public anchor composition', () => {
  for (const language of ['swift', 'android']) for (const example of [nativeUsageExample(component, language), nativeThemeExample(component, language), nativeApiExample(component, 'slot', 'icon', language), ...['icon', 'label'].map(name => nativeApiExample(component, 'cssPart', name, language))]) {
    assert.ok(example.code);
    assert.match(example.code, language === 'swift' ? /\.awcBadgeOverlay/ : /AWCBadgeHost/);
    assert.match(example.code, /notifications/);
    assert.match(example.code, language === 'swift' ? /\.awcIconButtonAppearance\(\.init\(width: 48, height: 48\)\)/ : /AWCIconButtonAppearance\(width = 48.0, height = 48.0\)/);
    assert.doesNotMatch(example.code, /variant.*outlined/);
  }
});

test('Web slot examples retain the same anchor and native appearance guides serialize every structured field', () => {
  for (const language of ['html', 'react', 'angular', 'vue', 'svelte']) {
    const example = apiExample(component, 'slot', 'icon', language);
    assert.match(example.code, /priority_high/);
    assert.match(example.code, /48px/);
    assert.match(example.code, /md-badge-icon-size/);
    assert.ok(apiExample(component, 'cssPart', 'icon', language).notes.some(note => note.includes('fallback icon part')));
  }
  for (const platform of ['ios', 'android']) {
    const guide = componentAppearanceGuide(component, platform);
    assert.match(guide, /AWCBadgeOffset/);
    assert.match(guide, /AWCBadgePadding/);
    assert.doesNotMatch(guide, /\[object Object\]|undefined–undefined/);
  }
});
