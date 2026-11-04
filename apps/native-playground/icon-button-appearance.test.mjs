import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICON_BUTTON_APPEARANCE_FIELDS, normalizeIconButtonAppearance, iconButtonAppearanceCSS } from './icon-button-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';

test('all actual icon-button public CSS hooks have a portable editor field', () => {
  const css = readFileSync(new URL('../../packages/core/src/components/md-icon-button/md-icon-button.css', import.meta.url), 'utf8');
  const hooks = [...new Set(css.match(/--md-icon-button-[a-z-]+/g))].sort();
  assert.deepEqual(ICON_BUTTON_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), hooks);
  const profile = componentAppearance('md-icon-button');
  assert.deepEqual(profile.groups.flatMap(([, names]) => names).sort(), profile.fields.map(field => field.name).sort());
  assert.equal(profile.nativeType, 'AWCIconButtonAppearance');
  assert.equal(profile.swiftModifier, 'awcIconButtonAppearance');
});

test('icon overrides preserve zero/fractional dimensions and reject invalid native input without invoking getters', () => {
  const input = { width: 0, height: 55.5, iconSize: 0, cornerRadius: -0, outlineWidth: 16, iconColor: '#ab12cd' };
  assert.deepEqual(normalizeIconButtonAppearance(input), { ...input, cornerRadius: 0, iconColor: '#AB12CD' });
  assert.equal(input.iconColor, '#ab12cd');
  const rejects = value => assert.throws(() => normalizeIconButtonAppearance(value), { code: 'INVALID_ICON_BUTTON_APPEARANCE' });
  for (const value of [null, [], new Date(), { width: '40px' }, { width: NaN }, { width: Infinity },
    { width: -1 }, { height: 2401 }, { outlineWidth: 17 }, { iconColor: 'red' }, { iconColor: '#fff' },
    { labelColor: '#ffffff' }, { width: undefined }, { [Symbol('width')]: 40 }, JSON.parse('{"__proto__":{}}')]) rejects(value);
  rejects(Object.defineProperty({}, 'width', { get() { throw Error('Getter executed'); } }));
  for (const field of ICON_BUTTON_APPEARANCE_FIELDS.filter(field => field.kind === 'number')) {
    assert.equal(normalizeIconButtonAppearance({ [field.name]: field.max })[field.name], field.max);
    rejects({ [field.name]: field.max + .1 });
  }
});

test('icon CSS stays source-specific: stroke does not invent button-only outline behavior', () => {
  assert.deepEqual(iconButtonAppearanceCSS({ outlineWidth: 2, width: 0, iconColor: '#123abc' }), {
    '--md-icon-button-icon-color': '#123ABC', '--md-icon-button-outline-width': '2px', '--md-icon-button-container-width': '0px',
  });
  assert.equal(Object.keys(iconButtonAppearanceCSS()).length, 0);
});

test('appearance transport switches profiles without leaking button overrides into another component', () => {
  const state = { selected: { tag: 'md-icon-button' }, buttonAppearance: { width: 240 }, iconButtonAppearance: { width: 60, iconColor: '#aabbcc' } };
  const options = componentAppearanceOptions(state);
  assert.deepEqual(Object.keys(options).sort(), ['iconButtonAppearance', 'iconButtonAppearanceDefaults']);
  const request = nativeRenderRequest('md-icon-button', { toggle: true, selected: false, buttonWidth: 'wide' }, true, options);
  const accepted = validateRenderRequest(request, new Set(['md-icon-button']));
  assert.equal(accepted.iconButtonAppearance.width, 60);
  assert.equal(accepted.iconButtonAppearance.iconColor, '#AABBCC');
  assert.equal(accepted.properties.selected, false);
  assert.equal(Object.hasOwn(accepted, 'buttonAppearance'), false);
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_ICON_BUTTON_APPEARANCE' });
  assert.deepEqual(componentAppearanceOptions({ ...state, selected: { tag: 'md-table-head' } }), {});
});

test('icon preview accepts held pointer interaction and cancels an outside release', () => {
  const frame = { tag: 'md-icon-button', logicalWidth: 320, logicalHeight: 120 };
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'down', x: 20, y: 30 }, frame), { command: 'pointer', phase: 'down', x: 20, y: 30 });
  const release = validateLiveInput({ command: 'pointer', phase: 'up', x: 400, y: 30 }, frame);
  assert.equal(release.phase, 'cancel');
  assert.ok(release.x < 320);
});
