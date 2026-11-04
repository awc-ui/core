import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeThemeOptions } from './native-theme-options.js';
import { computeStudioTheme, nativeThemeTokens } from './studio-theme.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';

test('theme and direction retain typed props through browser and server normalization', () => {
  const themeTokens = nativeThemeTokens(computeStudioTheme({ primaryHex: '#126734' }));
  const properties = { toggle: false, value: 0 };
  const request = nativeRenderRequest('md-button', properties, false, { themeTokens, direction: 'rtl' });
  const validated = validateRenderRequest(request, new Set(['md-button']));
  assert.deepEqual(validated.themeTokens, themeTokens);
  assert.equal(validated.direction, 'rtl');
  assert.deepEqual(validated.properties, properties);
  assert.equal(Object.hasOwn(nativeRenderRequest('md-button', {}, false), 'themeTokens'), false);
  assert.equal(Object.hasOwn(validateRenderRequest({ tag: 'md-button' }, new Set(['md-button'])), 'direction'), false);
  themeTokens['--md-sys-color-primary'] = '#000000';
  assert.notEqual(request.themeTokens['--md-sys-color-primary'], '#000000');
});

test('native options accept bounded color-role data and fixed layout directions', () => {
  assert.deepEqual(nativeThemeOptions({ themeTokens: { '--md-sys-color-primary': '#aabbcc' }, direction: 'ltr' }), { themeTokens: { '--md-sys-color-primary': '#AABBCC' }, direction: 'ltr' });
  assert.deepEqual(nativeThemeOptions({ themeTokens: { '--md-sys-color-Brand': '#aabbcc80' } }), { themeTokens: { '--md-sys-color-Brand': '#AABBCC80' } });
  for (const themeTokens of [null, [], 'red', { '--bg': '#000000' }, { '--md-sys-color-primary': 'red' }, { '--md-sys-color-primary': '#0000000' }, { '--md-sys-color-primary': 'url(https://example.test)' }, { '--md-sys-color-primary': 1 }]) {
    assert.throws(() => validateRenderRequest({ tag: 'md-button', themeTokens }, new Set(['md-button'])), error => error.code === 'INVALID_THEME_TOKENS' && error.status === 400);
  }
  for (const direction of [null, true, 'auto', '<rtl>']) assert.throws(() => nativeThemeOptions({ direction }), error => error.code === 'INVALID_DIRECTION');
});
