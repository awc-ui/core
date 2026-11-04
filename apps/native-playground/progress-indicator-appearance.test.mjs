import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PROGRESS_INDICATOR_APPEARANCE_FIELDS, normalizeProgressIndicatorAppearance,
  progressIndicatorAppearanceCSS, parseProgressIndicatorAppearanceInput,
  formatProgressIndicatorAppearanceInput, progressIndicatorAppearanceNativeValue,
} from './progress-indicator-appearance.js';

test('Progress typed fields cover every actual public CSS hook in native initializer order', async () => {
  const css = await readFile(new URL('../../packages/core/src/components/md-progress-indicator/md-progress-indicator.css', import.meta.url), 'utf8');
  const declared = new Set([...css.matchAll(/var\((--md-progress-indicator-[a-z0-9-]+)/g)].map(match => match[1]));
  assert.deepEqual(new Set(PROGRESS_INDICATOR_APPEARANCE_FIELDS.map(field => field.cssProperty)), declared);
  assert.deepEqual(PROGRESS_INDICATOR_APPEARANCE_FIELDS.map(field => field.name), [
    'activeIndicatorColor', 'activeIndicatorShape', 'trackColor', 'trackShape',
    'stopIndicatorColor', 'stopIndicatorShape', 'stopIndicatorSize',
    'stopIndicatorTrailingSpace', 'trackActiveIndicatorSpace',
    'fourColor1', 'fourColor2', 'fourColor3', 'fourColor4',
  ]);
});

test('Progress retains signed source gaps, zero stops, RGBA and asymmetric physical corners', () => {
  const shape = parseProgressIndicatorAppearanceInput('trackShape', 'calc(50% - 2px) 8px / 4px 25%');
  const input = { trackShape: shape, stopIndicatorSize: 0, stopIndicatorTrailingSpace: -7, trackActiveIndicatorSpace: -9, activeIndicatorColor: '#abcdef80', fourColor4: '#123456' };
  const normalized = normalizeProgressIndicatorAppearance(input);
  assert.equal(normalized.activeIndicatorColor, '#ABCDEF80');
  assert.equal(normalized.stopIndicatorSize, 0);
  assert.equal(input.activeIndicatorColor, '#abcdef80');
  const css = progressIndicatorAppearanceCSS(input);
  assert.equal(css['--md-progress-indicator-stop-indicator-trailing-space'], '-7px');
  assert.equal(css['--md-progress-indicator-track-active-indicator-space'], '-9px');
  assert.equal(css['--md-progress-indicator-stop-indicator-size'], '0px');
  assert.deepEqual(parseProgressIndicatorAppearanceInput('trackShape', formatProgressIndicatorAppearanceInput('trackShape', shape)), shape);
  for (const platform of ['swift', 'kotlin']) {
    const code = progressIndicatorAppearanceNativeValue('trackShape', shape, platform);
    assert.match(code, /AWCCornerShape/);
    assert.match(code, /-2/);
    assert.match(code, /0\.5/);
  }
  assert.equal(progressIndicatorAppearanceNativeValue('stopIndicatorSize', 0, 'swift'), undefined);
});

test('Progress rejects malformed appearance data without invoking getters or changing accepted finite gaps', () => {
  for (const input of [null, [], { opacity: 0 }, { stopIndicatorSize: -1 }, { activeIndicatorColor: '#fff' },
    { fourColor1: 'red' }, { trackShape: null }, { trackActiveIndicatorSpace: Infinity },
    { stopIndicatorTrailingSpace: '0' }, { stopIndicatorSize: NaN }]) {
    assert.throws(() => normalizeProgressIndicatorAppearance(input), { code: 'INVALID_PROGRESS_INDICATOR_APPEARANCE' });
  }
  let calls = 0;
  assert.throws(() => normalizeProgressIndicatorAppearance({ get trackColor() { calls++; return '#123456'; } }), { code: 'INVALID_PROGRESS_INDICATOR_APPEARANCE' });
  assert.equal(calls, 0);
  assert.deepEqual(normalizeProgressIndicatorAppearance(undefined), {});
  assert.equal(normalizeProgressIndicatorAppearance({ trackActiveIndicatorSpace: -Number.MAX_VALUE }).trackActiveIndicatorSpace, -Number.MAX_VALUE);
  assert.equal(Object.is(normalizeProgressIndicatorAppearance({ stopIndicatorSize: -0 }).stopIndicatorSize, -0), false);
});
