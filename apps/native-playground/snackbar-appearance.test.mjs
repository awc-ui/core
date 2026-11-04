import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SNACKBAR_APPEARANCE_FIELDS, normalizeSnackbarAppearance, snackbarAppearanceCSS, parseSnackbarAppearanceInput, formatSnackbarAppearanceInput, snackbarAppearanceNativeValue } from './snackbar-appearance.js';

test('Snackbar shares exactly seven source hooks without narrowing physical corners or relative widths', async () => {
  const css = await readFile(new URL('../../packages/core/src/components/md-snackbar/md-snackbar.css', import.meta.url), 'utf8');
  assert.deepEqual([...new Set(css.match(/--md-snackbar-[a-z-]+/g))].sort(), SNACKBAR_APPEARANCE_FIELDS.map(field => field.cssProperty).sort());
  const appearance = normalizeSnackbarAppearance({ containerColor: '#313033cc', messageColor: '#F4EFF4', actionColor: '#d0bcff', closeColor: '#fedcba80',
    containerShape: parseSnackbarAppearanceInput('containerShape', '12px 4px / 6px 2px'),
    minWidth: parseSnackbarAppearanceInput('minWidth', '24em'), maxWidth: parseSnackbarAppearanceInput('maxWidth', 'calc(100% - 48px)') });
  assert.deepEqual(snackbarAppearanceCSS(appearance), {
    '--md-snackbar-container-color': '#313033CC', '--md-snackbar-message-color': '#F4EFF4',
    '--md-snackbar-action-color': '#D0BCFF', '--md-snackbar-close-color': '#FEDCBA80',
    '--md-snackbar-container-shape': '12px 4px / 6px 2px', '--md-snackbar-min-width': '24em', '--md-snackbar-max-width': 'calc(-48px + 100%)',
  });
  for (const platform of ['swift', 'android']) {
    assert.match(snackbarAppearanceNativeValue('maxWidth', appearance.maxWidth, platform), /^AWCSnackbarLength\(/);
    assert.doesNotMatch(snackbarAppearanceNativeValue('maxWidth', appearance.maxWidth, platform), /AWCSkeleton/);
    assert.match(snackbarAppearanceNativeValue('containerShape', appearance.containerShape, platform), /^AWCCornerShape\(/);
  }
  assert.equal(formatSnackbarAppearanceInput('maxWidth', appearance.maxWidth), 'calc(-48px + 100%)');
});

test('Snackbar retains zero, signed calc terms and width ordering, and rejects unsupported values explicitly', () => {
  const appearance = normalizeSnackbarAppearance({ minWidth: parseSnackbarAppearanceInput('minWidth', '400px'), maxWidth: parseSnackbarAppearanceInput('maxWidth', '0') });
  assert.equal(appearance.minWidth.points, 400); assert.equal(appearance.maxWidth.points, 0);
  assert.equal(parseSnackbarAppearanceInput('minWidth', 'calc(-20px)').points, -20);
  assert.equal(parseSnackbarAppearanceInput('maxWidth', '1e310%').fraction, 1e308);
  assert.deepEqual(normalizeSnackbarAppearance(undefined), {});
  let accessed = false;
  const accessor = Object.defineProperty({}, 'containerColor', { enumerable: true, get() { accessed = true; return '#123456'; } });
  for (const value of [null, [], { minWidth: '200px' }, { maxWidth: { fraction: Infinity } }, { color: '#FFFFFF' }, { containerColor: '#fff' }, accessor, { [Symbol('extra')]: 1 }]) {
    assert.throws(() => normalizeSnackbarAppearance(value), { code: 'INVALID_SNACKBAR_APPEARANCE' });
  }
  for (const value of ['auto', 'min(100%, 200px)', 'var(--width)', '1vw']) {
    assert.throws(() => parseSnackbarAppearanceInput('maxWidth', value), { code: 'INVALID_SNACKBAR_APPEARANCE' });
  }
  assert.equal(accessed, false);
});
