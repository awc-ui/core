import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { CARD_APPEARANCE_FIELDS, normalizeCardAppearance, cardAppearanceCSS, parseCardAppearanceInput, formatCardAppearanceInput, cardAppearanceNativeValue } from './card-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';
import { CARD_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
// Released native support declarations (generated from NativeSupport.json / support.json).
const card = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-card.json', import.meta.url), 'utf8'));
const sourceCSS = await readFile(new URL('../../packages/core/src/components/md-card/md-card.css', import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', corners: '12px 4px / 6px 2px', length: '3px', affine: 'calc(100% - 32px + 1em)', insets: '8px 16px 12px', shadow: '0px 1px 3px rgba(0, 0, 0, 0.3), inset 0 4px 8px 3px #00000026' })[field.kind];
const styles = Object.fromEntries(CARD_APPEARANCE_FIELDS.map(f => [f.name, parseCardAppearanceInput(f.name, sample(f))]));
const props = { variant: 'outlined', interactive: true, dragEnabled: true, disabled: false, softDisabled: true, ripple: false, fullWidth: true, fullHeight: false, density: -3 };

test('Card appearance exactly covers the fourteen source hooks, the IR and both released policies', () => {
  const hooks = [...new Set(sourceCSS.match(/--md-card-[a-z]+(?:-[a-z]+)*\b(?!-)/g))].filter(name => !name.endsWith('-')).sort();
  assert.deepEqual(hooks, CARD_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  assert.deepEqual(card.cssProperties.map(p => p.name).sort(), hooks);
  for (const platform of ['ios', 'android']) {
    const policy = card.support[platform];
    assert.deepEqual([...policy.appearance.fields].sort(), CARD_APPEARANCE_FIELDS.map(f => f.name).sort(), `${platform} appearance declaration`);
    for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual([...policy[key]].sort(), card[key].map(member => member.name).sort(), `${platform} ${key}`);
    assert.deepEqual(policy.visualParts, card.cssParts.map(part => part.name));
    assert.deepEqual(policy.visualParts, ['state-layer', 'outline']);
    assert.match(policy.notes.join(' '), /only among the siblings of its container/);
  }
  assert.equal(Object.keys(cardAppearanceCSS(styles)).length, 14);
});

test('typed hook kinds roundtrip CSS, native data and native literals', () => {
  const generated = cardAppearanceCSS(styles);
  assert.equal(generated['--md-card-container-elevation'], '0px 1px 3px 0px #0000004D, inset 0px 4px 8px 3px #00000026');
  assert.equal(generated['--md-card-padding'], '8px 16px 12px 16px');
  assert.equal(generated['--md-card-width'], 'calc(-32px + 100% + 1em)');
  assert.equal(generated['--md-card-container-shape'], '12px 4px / 6px 2px');
  assert.equal(generated['--md-card-outline-width'], '3px');
  assert.equal(cardAppearanceCSS({ containerElevation: [] })['--md-card-container-elevation'], 'none');
  assert.deepEqual(styles.padding, { top: 8, right: 16, bottom: 12, left: 16 });
  assert.deepEqual(styles.maxHeight, { points: -32, fraction: 1, em: 1, rem: 0, ch: 0 });
  for (const field of CARD_APPEARANCE_FIELDS) {
    const text = formatCardAppearanceInput(field.name, styles[field.name]);
    assert.deepEqual(parseCardAppearanceInput(field.name, text), styles[field.name], `${field.name} formats to reparseable CSS`);
  }
  for (const platform of ['swift', 'android']) {
    const separator = platform === 'swift' ? ': ' : ' = ';
    assert.equal(cardAppearanceNativeValue('padding', styles.padding, platform), `AWCCardInsets(top${separator}8.0, right${separator}16.0, bottom${separator}12.0, left${separator}16.0)`);
    assert.equal(cardAppearanceNativeValue('minWidth', styles.minWidth, platform), `AWCCardLength(points${separator}-32.0, fraction${separator}1.0, em${separator}1.0, rem${separator}0.0, ch${separator}0.0)`);
    assert.match(cardAppearanceNativeValue('containerShape', styles.containerShape, platform), /^AWCCornerShape\(/);
    assert.match(cardAppearanceNativeValue('containerElevation', styles.containerElevation, platform), /AWCBoxShadow\(.*inset/);
  }
  assert.equal(cardAppearanceNativeValue('gap', 3, 'swift'), undefined, 'scalar fields use the shared literal path');
  let accessed = false; const accessor = Object.defineProperty({}, 'containerColor', { get() { accessed = true; return '#FFFFFF'; } });
  for (const value of [null, [], { containerColor: '#FFF' }, { padding: { top: -1 } }, { containerElevation: [{ x: 1, blur: -1 }] }, { gap: -1 }, { outlineWidth: Infinity }, { width: { points: 1, vw: 1 } }, { width: '100%' }, accessor, { [Symbol('bad')]: 1 }]) {
    assert.throws(() => normalizeCardAppearance(value), { code: 'INVALID_CARD_APPEARANCE' }, JSON.stringify(value));
  }
  assert.equal(accessed, false);
  for (const [name, raw] of [['containerElevation', '1px'], ['padding', '1px 2px 3px 4px 5px'], ['width', 'min(100%, 300px)'], ['width', '100vw'], ['gap', '1em'], ['containerColor', 'red']]) {
    assert.throws(() => normalizeCardAppearance({ [name]: parseCardAppearanceInput(name, raw) }), /./, `${name}: ${raw}`);
  }
});

test('panel transport retains every authored property and style; other tags reject card styles', () => {
  const request = nativeRenderRequest(card.tag, props, true, { ...componentAppearanceOptions({ selected: card, cardAppearance: styles }), direction: 'rtl' });
  const valid = validateRenderRequest(request, new Set([card.tag]));
  assert.deepEqual(valid.properties, props); assert.deepEqual(valid.cardAppearance, styles); assert.equal(valid.direction, 'rtl');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_CARD_APPEARANCE' });
  assert.throws(() => validateRenderRequest({ tag: 'md-card', cardAppearance: { gap: 'wide' } }, new Set(['md-card'])), { code: 'INVALID_CARD_APPEARANCE' });
});

test('retained updates cover the nine source properties with their source types, gated by released support', async () => {
  assert.deepEqual([...CARD_UPDATE_PROPERTIES].sort(), card.properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate('md-card', props), { command: 'update', properties: props });
  for (const patch of [{ variant: 'tonal' }, { density: -5 }, { density: 1 }, { interactive: 'true' }, { ripple: 1 }, { fullWidth: null }, { width: 100 }, { open: true }]) {
    assert.throws(() => nativePropertyUpdate('md-card', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  }
  for (const platform of ['ios', 'android']) {
    assert.equal(supportsRetainedPropertyUpdates(card, platform), true, platform);
    const policy = card.support[platform];
    assert.equal(supportsRetainedPropertyUpdates({ ...card, support: { [platform]: { ...policy, properties: policy.properties.filter(name => name !== 'dragEnabled') } } }, platform), false);
  }
  const edits = []; const client = { canUpdate: () => true, update: async value => edits.push(value) };
  for (const value of [true, false]) assert.equal(dispatchRetainedPropertyEdit({ component: card, platform: 'android', client, name: 'dragEnabled', value }), true);
  await Promise.resolve(); assert.deepEqual(edits, [{ dragEnabled: true }, { dragEnabled: false }]);
  const context = { tag: 'md-card', logicalWidth: 640, logicalHeight: 400 };
  for (const phase of ['down', 'move', 'up', 'cancel', 'leave']) assert.equal(validateLiveInput({ command: 'pointer', phase, x: 120, y: 40 }, context).command, 'pointer');
});

test('all three Styles panels expose the fourteen hooks and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const state = { selected: card, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    assert.equal(document.querySelectorAll('[data-appearance-field]').length, 14, platform);
    for (const field of CARD_APPEARANCE_FIELDS) {
      const input = document.querySelector(`#appearance-${field.name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
      assert.equal(input.error, false, `${field.name} accepts ${sample(field)}`);
    }
    assert.equal(Object.keys(state.cardAppearance).length, 14);
    for (const [name, raw] of [['width', 'min(100%, 300px)'], ['containerElevation', '0 1px red']]) {
      const before = structuredClone(state.cardAppearance[name]);
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: raw }));
      assert.equal(input.error, true, `${name} rejects ${raw}`); assert.deepEqual(state.cardAppearance[name], before);
    }
  }
  const target = document.createElement('md-card'); ui.apply(target);
  for (const field of CARD_APPEARANCE_FIELDS) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
});

test('framework snippets carry every hook with the correct native types', () => {
  const profile = componentAppearance('md-card');
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(card, props, platform, { html: recipeFor('md-card').html, cardAppearance: styles });
    assert.doesNotMatch(code, /\[object Object\]/);
    for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${platform} ${field.name}`);
    if (platform === 'swift') assert.match(code, /\.awcCardAppearance\(\.init\(/);
    if (platform === 'android') { assert.match(code, /AWCCardAppearanceScope\(appearance = AWCCardAppearance\(/); assert.match(code, /import dev\.awc\.nativeui\.AWCCardLength\n/); }
    if (['swift', 'android'].includes(platform)) for (const type of ['AWCBoxShadow(', 'AWCCornerShape(', 'AWCCardInsets(top', 'AWCCardLength(points']) assert.ok(code.includes(type), `${platform} ${type}`);
  }
});

test('native API examples use the verified drag gesture, activation payloads and typed parts', () => {
  for (const platform of ['swift', 'android']) {
    const usage = nativeUsageExample(card, platform);
    assert.match(usage.code, /md-card/); assert.match(usage.code, platform === 'swift' ? /"interactive": \.bool\(true\)/ : /"interactive" to true/);
    const click = nativeApiExample(card, 'event', 'mdClick', platform);
    assert.match(click.code, platform === 'swift' ? /"interactive": \.bool\(true\)/ : /"interactive" to true/); assert.match(click.notes.join(' '), /untrusted with detail 0/);
    for (const name of ['mdDragStart', 'mdDragMove', 'mdDragEnd']) {
      const example = nativeApiExample(card, 'event', name, platform);
      assert.match(example.code, platform === 'swift' ? /"dragEnabled": \.bool\(true\)/ : /"dragEnabled" to true/, name);
      assert.match(example.notes.join(' '), name === 'mdDragEnd' ? /no mdClick/ : /offsetX/);
    }
    for (const part of ['state-layer', 'outline']) {
      const example = nativeApiExample(card, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.match(example.code, platform === 'swift' ? /\.awcCardPartAppearance\(\.init\(/ : /AWCCardPartAppearanceScope\(AWCCardPartAppearance\(/, part);
      assert.match(example.code, part === 'outline' ? /outlineWidth/ : /stateLayerColor/);
    }
    assert.ok(nativeApiExample(card, 'slot', '', platform).code, 'default slot');
  }
});
