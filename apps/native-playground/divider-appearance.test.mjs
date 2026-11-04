import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIVIDER_APPEARANCE_FIELDS, normalizeDividerAppearance, dividerAppearanceCSS } from './divider-appearance.js';
import { componentAppearanceOptions } from './component-appearance.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample } from './native-api-examples.js';
import { apiExample } from './api-examples.js';
import { recipeFor } from './recipes.js';

test('divider hooks preserve signed margins and zero thickness without accepting arbitrary CSS', () => {
  const css = readFileSync(new URL('../../packages/core/src/components/md-divider/md-divider.css', import.meta.url), 'utf8');
  assert.deepEqual(DIVIDER_APPEARANCE_FIELDS.map(field => field.cssProperty).sort(), [...new Set(css.match(/--md-divider-[a-z-]+/g))].sort());
  assert.deepEqual(normalizeDividerAppearance({ color: '#aabbcc', thickness: -0, insetStart: -32.5, insetEnd: 10000 }), { color: '#AABBCC', thickness: 0, insetStart: -32.5, insetEnd: 10000 });
  assert.deepEqual(dividerAppearanceCSS({ thickness: 0, insetStart: -16, insetEnd: 12 }), { '--md-divider-thickness': '0px', '--md-divider-inset-start': '-16px', '--md-divider-inset-end': '12px' });
  const getter = Object.defineProperty({}, 'color', { get() { throw new Error('Getter must not execute'); } });
  for (const value of [null, [], new Date(), { thickness: -1 }, { thickness: '1' }, { insetStart: Infinity }, { insetEnd: NaN }, { color: '#abc' }, { padding: 16 }, getter, { [Symbol('unknown')]: 1 }]) {
    assert.throws(() => normalizeDividerAppearance(value), { code: 'INVALID_DIVIDER_APPEARANCE' });
  }
});

test('divider appearance is transported independently and copied into all seven framework examples', () => {
  const fields = { color: '#123abc', thickness: 0, insetStart: -12.5, insetEnd: 24 };
  const options = componentAppearanceOptions({ selected: { tag: 'md-divider' }, dividerAppearance: fields, dividerAppearanceDefaults: { thickness: 2 }, fabAppearance: { iconSize: 32 } });
  const request = nativeRenderRequest('md-divider', { inset: true, vertical: true }, true, options);
  assert.deepEqual(validateRenderRequest(request, new Set(['md-divider'])).dividerAppearance, normalizeDividerAppearance(fields));
  assert.equal(Object.hasOwn(request, 'fabAppearance'), false);
  assert.throws(() => validateRenderRequest({ ...request, tag: 'md-button' }, new Set(['md-button'])), { code: 'INVALID_DIVIDER_APPEARANCE' });
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet({ tag: 'md-divider', properties: [{ name: 'inset' }] }, { inset: true }, platform, { html: '<md-divider></md-divider>', ...options });
    assert.match(code, platform === 'swift' ? /\.awcDividerAppearance/ : platform === 'android' ? /AWCDividerAppearanceScope/ : /--md-divider-inset-start/);
    assert.match(code, /-12\.5/);
    assert.doesNotMatch(code, /AWCButtonAppearance|awcButtonAppearance|AWCFabAppearance/);
  }
});

test('divider part examples address the real line and only expose declared native appearance support', () => {
  const policy = { status: 'native-adapter', properties: ['inset', 'insetStart', 'insetEnd', 'vertical'], events: [], slots: [], methods: [], cssParts: ['divider'], visualParts: ['divider'], appearance: { fields: DIVIDER_APPEARANCE_FIELDS.map(field => field.name) } };
  const component = { tag: 'md-divider', cssParts: [{ name: 'divider' }], support: { ios: policy, android: policy } };
  for (const platform of ['swift', 'android']) {
    const example = nativeApiExample(component, 'cssPart', 'divider', platform);
    assert.equal(example.status, 'native-equivalent');
    assert.match(example.code, /AWCDividerAppearance|awcDividerAppearance/);
    assert.match(example.code, /"inset"/);
    assert.doesNotMatch(example.code, /Continue|onEvent|slot ->/);
    assert.match(example.notes.join(' '), /insetEnd takes precedence/);
    const unavailable = nativeApiExample({ ...component, support: { ios: { ...policy, visualParts: [] }, android: { ...policy, visualParts: [] } } }, 'cssPart', 'divider', platform);
    assert.doesNotMatch(unavailable.code || '', /AWCDividerAppearance|awcDividerAppearance/);
  }
  const web = apiExample(component, 'cssPart', 'divider', 'html');
  assert.match(web.code, /md-divider::part\(divider\)/);
  assert.match(web.code, /background-color: #006a6a/);
  assert.match(web.notes.join(' '), /inner painted line, not the host/);
});

test('divider preview and copied examples share a fixed context without forcing the vertical cross axis', () => {
  const html = recipeFor('md-divider').html;
  assert.match(html, /width:300px;height:96px/);
  assert.doesNotMatch(html, /<p|md-divider[^>]*style=/);
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(styles, /\.demo md-divider/);
  for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
    const code = usageSnippet({ tag: 'md-divider' }, { vertical: true }, platform, { html });
    assert.match(code, platform === 'swift' ? /\.frame\(width: 300, height: 96\)/ : platform === 'android' ? /requiredSize\(300\.dp, 96\.dp\)/ : /300px/);
    assert.match(code, /vertical/);
  }
});
