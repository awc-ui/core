import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTheme, ROLE_KEYS } from './theme-vendor/awc-theme.js';
import { DEFAULT_STUDIO_THEME, STUDIO_THEME_STORAGE_KEY, STUDIO_THEME_TOKEN_NAMES, normalizeStudioTheme, computeStudioTheme, applyStudioTheme, nativeThemeTokens, exportStudioTheme, loadStudioTheme, saveStudioTheme } from './studio-theme.js';

test('studio uses the real AWC theme engine and derives secondary/tertiary from primary', () => {
  const result = computeStudioTheme({ primaryHex: '#1967D2' });
  const actual = computeTheme({ primaryHex: '#1967D2' });
  assert.deepEqual(result.roles, actual.roles);
  assert.equal(result.config.secondaryHex, null);
  assert.equal(result.config.tertiaryHex, null);
  assert.equal(Object.keys(result.tokens.light).length, ROLE_KEYS.length);
  const other = computeStudioTheme({ primaryHex: '#C22B61' });
  for (const role of ['primary', 'secondary', 'tertiary']) assert.notEqual(result.roles.light[role], other.roles.light[role], role);
});

test('individual seed overrides affect the relevant palettes without replacing other seeds', () => {
  const base = computeStudioTheme();
  const secondary = computeStudioTheme({ secondaryHex: '#008844' });
  const tertiary = computeStudioTheme({ tertiaryHex: '#C04400' });
  for (const mode of ['light', 'dark']) {
    assert.equal(secondary.roles[mode].primary, base.roles[mode].primary);
    assert.equal(secondary.roles[mode].tertiary, base.roles[mode].tertiary);
    assert.notEqual(secondary.roles[mode].secondary, base.roles[mode].secondary);
    assert.equal(tertiary.roles[mode].secondary, base.roles[mode].secondary);
    assert.notEqual(tertiary.roles[mode].tertiary, base.roles[mode].tertiary);
  }
  assert.deepEqual(computeStudioTheme({ ...secondary.config, secondaryHex: null }).roles, base.roles);
});

test('light/dark and contrast changes produce actual color token maps for native hosts', () => {
  const result = computeStudioTheme();
  const light = nativeThemeTokens(result, 'light'), dark = nativeThemeTokens(result, 'dark');
  assert.deepEqual(Object.keys(light), STUDIO_THEME_TOKEN_NAMES);
  assert.notEqual(light['--md-sys-color-primary'], dark['--md-sys-color-primary']);
  assert.notEqual(light['--md-sys-color-surface'], dark['--md-sys-color-surface']);
  for (const value of Object.values(light)) assert.match(value, /^#[A-F\d]{6}$/);
  const contrast = computeStudioTheme({ contrastLevel: 1 });
  assert.notEqual(contrast.roles.light.primary, result.roles.light.primary);
  light['--md-sys-color-primary'] = '#000000';
  assert.notEqual(result.tokens.light['--md-sys-color-primary'], '#000000');
});

test('root and web preview receive the same computed palette without changing non-color tokens', () => {
  const element = () => ({ dataset: {}, style: { values: new Map([['--md-button-width', '200px']]), setProperty(name, value) { this.values.set(name, value); } } });
  const root = element(), preview = element(), result = computeStudioTheme({ mode: 'dark' });
  applyStudioTheme(result, { root, preview });
  for (const name of STUDIO_THEME_TOKEN_NAMES) assert.equal(root.style.values.get(name), preview.style.values.get(name));
  assert.equal(root.style.values.get('--primary'), result.roles.dark.primary);
  assert.equal(root.style.values.get('--ink'), result.roles.dark.onSurface);
  assert.equal(preview.style.values.get('--md-button-width'), '200px');
  assert.equal(root.dataset.theme, 'dark');
});

test('configuration validates colors, exports both schemes and persists safely', () => {
  assert.equal(normalizeStudioTheme({ primaryHex: 'abc' }).primaryHex, '#AABBCC');
  assert.equal(normalizeStudioTheme({ contrastLevel: 3 }).contrastLevel, 1);
  for (const config of [{ primaryHex: 'red' }, { primaryHex: '#123456; color:red' }, { contrastLevel: NaN }, { mode: 'auto' }, { version: 2 }]) assert.throws(() => normalizeStudioTheme(config));
  const result = computeStudioTheme({ primaryHex: '#007744', mode: 'dark' });
  assert.match(exportStudioTheme(result), /:root\s*\{/);
  assert.match(exportStudioTheme(result), /\[data-theme="dark"\]/);
  assert.deepEqual(JSON.parse(exportStudioTheme(result, 'json')).tokens, result.tokens);
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(saveStudioTheme(result.config, storage), true);
  assert.deepEqual(loadStudioTheme(storage), result.config);
  values.set(STUDIO_THEME_STORAGE_KEY, '{invalid');
  assert.deepEqual(loadStudioTheme(storage), DEFAULT_STUDIO_THEME);
  assert.equal(saveStudioTheme(result.config, { setItem() { throw new Error('unavailable'); } }), false);
});
