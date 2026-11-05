import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { AVATAR_APPEARANCE_FIELDS, AVATAR_PARTS, normalizeAvatarAppearance, avatarAppearanceCSS, parseAvatarAppearanceInput, formatAvatarAppearanceInput, avatarAppearanceNativeValue } from './avatar-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { AVATAR_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates, dispatchRetainedPropertyEdit } from './native-property-updates.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample } from './native-api-examples.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
// Released native support declarations (generated from NativeSupport.json / support.json).
const avatar = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-avatar.json', import.meta.url), 'utf8'));
const sourceCSS = await readFile(new URL('../../packages/core/src/components/md-avatar/md-avatar.css', import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', corners: '12px 4px / 6px 2px', affine: 'calc(1em + 8px)', font: '"Roboto Flex", sans-serif', weight: '600' })[field.kind];
const styles = Object.fromEntries(AVATAR_APPEARANCE_FIELDS.map(f => [f.name, parseAvatarAppearanceInput(f.name, sample(f))]));
const props = { src: '', alt: 'Portrait', name: 'Ada Lovelace', initials: 'AL', size: 'large', shape: 'rounded', label: 'Ada', colorFromName: false, loading: 'eager', crossorigin: 'anonymous', density: -3 };
const palette = [1, 2, 3, 4, 5, 6, 7].flatMap(n => [`--md-avatar-palette-${n}-container`, `--md-avatar-palette-${n}-label`]);

test('Avatar appearance exactly covers the 25 source hooks (palette included), the IR and both released policies', () => {
  // Every hook the stylesheet reads; the TSX writes --md-avatar-size inline for custom sizes.
  const hooks = [...new Set([...sourceCSS.matchAll(/var\(\s*(--md-avatar-[a-z0-9-]+)/g)].map(match => match[1]))].sort();
  assert.equal(hooks.length, 25);
  assert.deepEqual(hooks, AVATAR_APPEARANCE_FIELDS.map(f => f.cssProperty).sort());
  // CEM drift (recorded in docs/native-parity/md-avatar-source-review.md): the IR lists the eleven
  // documented hooks; the fourteen palette hooks are implemented but missing from the CEM.
  const documented = avatar.cssProperties.map(p => p.name).sort();
  assert.equal(documented.length, 11);
  assert.deepEqual([...documented, ...palette].sort(), hooks);
  for (const platform of ['ios', 'android']) {
    const policy = avatar.support[platform];
    assert.deepEqual([...policy.appearance.fields].sort(), AVATAR_APPEARANCE_FIELDS.map(f => f.name).sort(), `${platform} appearance declaration`);
    for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual([...policy[key]].sort(), avatar[key].map(member => member.name).sort(), `${platform} ${key}`);
    for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedSlots']) assert.deepEqual(policy[key] ?? [], [], `${platform} ${key}`);
    assert.deepEqual(policy.visualParts, avatar.cssParts.map(part => part.name));
    assert.deepEqual(policy.visualParts, [...AVATAR_PARTS]);
    assert.match(policy.notes.join(' '), /name palette/);
  }
  assert.equal(Object.keys(avatarAppearanceCSS(styles)).length, 25);
});

test('typed hook kinds roundtrip CSS, native data and native literals; percentages and ch are rejected', () => {
  const generated = avatarAppearanceCSS(styles);
  assert.equal(generated['--md-avatar-size'], 'calc(8px + 1em)');
  assert.equal(generated['--md-avatar-container-shape'], '12px 4px / 6px 2px');
  assert.equal(generated['--md-avatar-label-font-weight'], '600');
  assert.equal(generated['--md-avatar-label-font-family'], '"Roboto Flex", sans-serif');
  assert.equal(generated['--md-avatar-palette-7-label'], '#12345680');
  assert.deepEqual(styles.outlineWidth, { points: 8, fraction: 0, em: 1, rem: 0, ch: 0 });
  for (const field of AVATAR_APPEARANCE_FIELDS) {
    const text = formatAvatarAppearanceInput(field.name, styles[field.name]);
    assert.deepEqual(parseAvatarAppearanceInput(field.name, text), styles[field.name], `${field.name} formats to reparseable CSS`);
  }
  for (const platform of ['swift', 'android']) {
    const separator = platform === 'swift' ? ': ' : ' = ';
    assert.equal(avatarAppearanceNativeValue('size', styles.size, platform), `AWCSkeletonLength(points${separator}8.0, fraction${separator}0.0, em${separator}1.0, rem${separator}0.0, ch${separator}0.0)`);
    assert.match(avatarAppearanceNativeValue('containerShape', styles.containerShape, platform), /^AWCCornerShape\(/);
  }
  assert.equal(avatarAppearanceNativeValue('labelFontWeight', 600, 'swift'), undefined, 'scalar fields use the shared literal path');
  for (const value of [null, [], { containerColor: '#FFF' }, { palette8Container: '#FFFFFF' }, { labelFontWeight: 0 }, { labelFontWeight: 1001 }, { size: { points: 1, vw: 1 } }, { size: '40px' },
    { size: { points: 0, fraction: 0.5, em: 0, rem: 0, ch: 0 } }, { iconSize: { points: 0, fraction: 0, em: 0, rem: 0, ch: 2 } }, { labelFontFamily: 'a;b' }])
    assert.throws(() => normalizeAvatarAppearance(value), { code: 'INVALID_AVATAR_APPEARANCE' }, JSON.stringify(value));
  for (const [name, raw] of [['size', '50%'], ['iconSize', '2ch'], ['size', '10vw'], ['labelFontWeight', 'bold'], ['labelFontWeight', '0'], ['palette3Container', 'red'], ['outlineWidth', 'min(1px, 2px)']])
    assert.throws(() => normalizeAvatarAppearance({ [name]: parseAvatarAppearanceInput(name, raw) }), /./, `${name}: ${raw}`);
});

test('panel transport retains every authored property and style; other tags reject avatar styles', () => {
  const request = nativeRenderRequest(avatar.tag, props, true, { ...componentAppearanceOptions({ selected: avatar, avatarAppearance: styles }), direction: 'rtl' });
  const valid = validateRenderRequest(request, new Set([avatar.tag]));
  assert.deepEqual(valid.properties, props); assert.deepEqual(valid.avatarAppearance, styles); assert.equal(valid.direction, 'rtl');
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_AVATAR_APPEARANCE' });
  assert.throws(() => validateRenderRequest({ tag: 'md-avatar', avatarAppearance: { size: 'big' } }, new Set(['md-avatar'])), { code: 'INVALID_AVATAR_APPEARANCE' });
});

test('retained updates cover the eleven source properties with their source types, gated by released support', async () => {
  assert.deepEqual([...AVATAR_UPDATE_PROPERTIES].sort(), avatar.properties.map(p => p.name).sort());
  assert.deepEqual(nativePropertyUpdate('md-avatar', props), { command: 'update', properties: props });
  assert.deepEqual(nativePropertyUpdate('md-avatar', { size: 'clamp(28px, 4vw, 72px)' }).properties, { size: 'clamp(28px, 4vw, 72px)' });
  assert.deepEqual(nativePropertyUpdate('md-avatar', { size: 72 }).properties, { size: 72 });
  for (const patch of [{ shape: 'oval' }, { density: -5 }, { density: 1 }, { colorFromName: 'true' }, { loading: 'auto' }, { crossorigin: 'true' }, { size: Infinity }, { size: null }, { name: 3 }, { open: true }]) {
    assert.throws(() => nativePropertyUpdate('md-avatar', patch), { code: 'INVALID_PROPERTY_UPDATE' }, JSON.stringify(patch));
  }
  for (const platform of ['ios', 'android']) {
    assert.equal(supportsRetainedPropertyUpdates(avatar, platform), true, platform);
    const policy = avatar.support[platform];
    assert.equal(supportsRetainedPropertyUpdates({ ...avatar, support: { [platform]: { ...policy, properties: policy.properties.filter(name => name !== 'crossorigin') } } }, platform), false);
  }
  const edits = []; const client = { canUpdate: () => true, update: async value => edits.push(value) };
  for (const value of ['small', 'large']) assert.equal(dispatchRetainedPropertyEdit({ component: avatar, platform: 'ios', client, name: 'size', value }), true);
  await Promise.resolve(); assert.deepEqual(edits, [{ size: 'small' }, { size: 'large' }]);
});

test('all three Styles panels expose the 25 hooks and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  const state = { selected: avatar, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
  for (const platform of ['web', 'ios', 'android']) {
    state.platform = platform; ui.render();
    assert.equal(document.querySelectorAll('[data-appearance-field]').length, 25, platform);
    for (const field of AVATAR_APPEARANCE_FIELDS) {
      const input = document.querySelector(`#appearance-${field.name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
      assert.equal(input.error, false, `${field.name} accepts ${sample(field)}`);
    }
    assert.equal(Object.keys(state.avatarAppearance).length, 25);
    for (const [name, raw] of [['size', '50%'], ['labelFontWeight', 'heavy']]) {
      const before = structuredClone(state.avatarAppearance[name]);
      const input = document.querySelector(`#appearance-${name}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: raw }));
      assert.equal(input.error, true, `${name} rejects ${raw}`); assert.deepEqual(state.avatarAppearance[name], before);
    }
  }
  const target = document.createElement('md-avatar'); ui.apply(target);
  for (const field of AVATAR_APPEARANCE_FIELDS) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
});

test('framework snippets carry every hook with the correct native types', () => {
  const profile = componentAppearance('md-avatar');
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet(avatar, props, platform, { html: recipeFor('md-avatar').html, avatarAppearance: styles });
    assert.doesNotMatch(code, /\[object Object\]/);
    for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${platform} ${field.name}`);
    if (platform === 'swift') assert.match(code, /\.awcAvatarAppearance\(\.init\(/);
    if (platform === 'android') { assert.match(code, /AWCAvatarAppearanceScope\(appearance = AWCAvatarAppearance\(/); assert.match(code, /import dev\.awc\.nativeui\.AWCSkeletonLength\n/); }
    if (['swift', 'android'].includes(platform)) for (const type of ['AWCCornerShape(', 'AWCSkeletonLength(points', 'labelFontWeight' + (platform === 'swift' ? ': 600.0' : ' = 600.0')]) assert.ok(code.includes(type), `${platform} ${type}`);
  }
});

test('native API examples use the image events, the fallback slot and the typed parts', () => {
  for (const platform of ['swift', 'android']) {
    const usage = nativeUsageExample(avatar, platform);
    assert.match(usage.code, /md-avatar/); assert.match(usage.code, platform === 'swift' ? /"size": \.string\("large"\)/ : /"size" to "large"/);
    for (const name of ['mdLoad', 'mdError']) {
      const example = nativeApiExample(avatar, 'event', name, platform);
      assert.match(example.code, platform === 'swift' ? /"src": \.string\("https:/ : /"src" to "https:/, name);
      assert.match(example.notes.join(' '), name === 'mdLoad' ? /decoded/ : /falls back/);
    }
    for (const part of AVATAR_PARTS) {
      const example = nativeApiExample(avatar, 'cssPart', part, platform);
      assert.equal(example.status, 'native-equivalent', part);
      assert.match(example.code, platform === 'swift' ? /\.awcAvatarPartAppearance\(\.init\(/ : /AWCAvatarPartAppearanceScope\(AWCAvatarPartAppearance\(/, part);
      assert.match(example.code, { image: /imageOpacity/, initials: /initialsFontSize/, icon: /iconFontSize/ }[part]);
    }
    const slot = nativeApiExample(avatar, 'slot', '', platform);
    assert.match(slot.code, /★/); assert.doesNotMatch(slot.code, /"name"/);
  }
});
