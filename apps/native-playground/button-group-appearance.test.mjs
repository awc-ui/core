import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUTTON_GROUP_APPEARANCE_FIELDS, normalizeButtonGroupAppearance, buttonGroupAppearanceCSS } from './button-group-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';

test('group editor covers all seven public source hooks and excludes the internal unset sentinel', () => {
  const source = readFileSync(new URL('../../packages/core/src/components/md-button-group/md-button-group.css', import.meta.url), 'utf8');
  const hooks = [...new Set(source.match(/--md-button-group-[a-z_-]+/g))].filter(name => !name.includes('-_')).sort();
  assert.deepEqual(BUTTON_GROUP_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), hooks);
  assert.equal(hooks.length, 7);
  const profile = componentAppearance('md-button-group');
  assert.deepEqual(profile.groups.flatMap(([, names]) => names).sort(), profile.fields.map(field => field.name).sort());
  assert.equal(profile.nativeType, 'AWCButtonGroupAppearance');
  assert.equal(profile.swiftModifier, 'awcButtonGroupAppearance');
});

test('group dimensions accept finite zero and fractional lengths without mutation or executing accessors', () => {
  const source = { gap: -0, width: 500.25, maxWidth: 2400, minHeight: 0 };
  assert.deepEqual(normalizeButtonGroupAppearance(source), { ...source, gap: 0 });
  assert.equal(Object.is(source.gap, -0), true);
  const invalid = value => assert.throws(() => normalizeButtonGroupAppearance(value), { code: 'INVALID_BUTTON_GROUP_APPEARANCE' });
  for (const value of [null, [], new Date(), { gap: '8px' }, { width: -1 }, { width: Infinity }, { gap: NaN }, { width: 2400.1 }, { _unset: 1 }, { iconSize: 20 }, { [Symbol('width')]: 1 }, JSON.parse('{"__proto__":1}')]) invalid(value);
  invalid(Object.defineProperty({}, 'gap', { get() { throw Error('Must not execute'); } }));
  assert.deepEqual(buttonGroupAppearanceCSS({ gap: 0, minWidth: 12.5, maxHeight: 60 }), { '--md-button-group-gap': '0px', '--md-button-group-min-width': '12.5px', '--md-button-group-max-height': '60px' });
});

test('group appearance and ordered child states cross transport independently of source properties', () => {
  const options = componentAppearanceOptions({ selected: { tag: 'md-button-group' }, buttonAppearance: { width: 99 }, buttonGroupAppearance: { gap: 8, width: 500 }, buttonGroupAppearanceDefaults: { minHeight: 40 } });
  const request = nativeRenderRequest('md-button-group', { selectionMode: 'multi-select', required: false }, true, { ...options, buttonGroupSelection: [false, true, false] });
  const accepted = validateRenderRequest(request, new Set(['md-button-group']));
  assert.deepEqual(accepted.buttonGroupSelection, [false, true, false]);
  assert.deepEqual(accepted.buttonGroupAppearance, { gap: 8, width: 500 });
  assert.deepEqual(accepted.buttonGroupAppearanceDefaults, { minHeight: 40 });
  assert.deepEqual(accepted.properties, { selectionMode: 'multi-select', required: false });
  assert.equal(Object.hasOwn(accepted, 'buttonAppearance'), false);
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_BUTTON_GROUP_APPEARANCE' });
  assert.throws(() => nativeRenderRequest('md-button', {}, false, { buttonGroupSelection: [] }), { code: 'INVALID_BUTTON_GROUP_SELECTION' });
});

test('all seven shared lengths use the public group API in Web and native examples', async () => {
  const { usageSnippet } = await import('./usage-snippets.js');
  const { recipeFor } = await import('./recipes.js');
  const component = { tag: 'md-button-group', properties: [] };
  const values = Object.fromEntries(BUTTON_GROUP_APPEARANCE_FIELDS.map((field, index) => [field.name, index + 1]));
  for (const platform of ['html', 'swift', 'android']) {
    const code = usageSnippet(component, {}, platform, { html: recipeFor(component.tag).html, buttonGroupAppearance: values, buttonGroupAppearanceDefaults: { gap: 12 } });
    for (const field of BUTTON_GROUP_APPEARANCE_FIELDS) assert.ok(code.includes(platform === 'html' ? field.cssProperty : field.name));
    assert.doesNotMatch(code, /--md-button-group-_unset|AWCButtonAppearanceScope|\.awcButtonAppearance\(/);
    if (platform === 'swift') assert.match(code, /\.awcButtonGroupAppearance\(/);
    if (platform === 'android') assert.match(code, /AWCButtonGroupAppearanceScope\(appearance = AWCButtonGroupAppearance\(/);
  }
});
