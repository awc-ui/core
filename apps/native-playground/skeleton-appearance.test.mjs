import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSkeletonLength, parseSkeletonLength, skeletonLengthCSS, skeletonLengthNativeValue } from './skeleton-length.js';
import { SKELETON_APPEARANCE_FIELDS, normalizeSkeletonAppearance, parseSkeletonAppearanceInput, skeletonAppearanceCSS, validateSkeletonLengths } from './skeleton-appearance.js';

test('Skeleton shares exactly the eleven source hooks, including three independently timed animations', async () => {
  const css = await readFile(new URL('../../packages/core/src/components/md-skeleton/md-skeleton.css', import.meta.url), 'utf8');
  assert.deepEqual([...new Set(css.match(/--md-skeleton-[a-z-]+/g))].sort(), SKELETON_APPEARANCE_FIELDS.map(field => field.cssProperty).sort());
  assert.deepEqual(SKELETON_APPEARANCE_FIELDS.map(field => field.name), [
    'color', 'highlight', 'radius', 'roundedRadius', 'width', 'height', 'size', 'lineGap', 'pulseDuration', 'waveDuration', 'bloomDuration',
  ]);
  const appearance = normalizeSkeletonAppearance({
    color: '#12345680', highlight: '#abcdef80',
    radius: parseSkeletonAppearanceInput('radius', '10px / 20px'),
    roundedRadius: parseSkeletonAppearanceInput('roundedRadius', '2px 12px 20px 5px'),
    width: parseSkeletonAppearanceInput('width', 'calc(100% - 32px)'),
    height: parseSkeletonAppearanceInput('height', '1.5em'),
    size: parseSkeletonAppearanceInput('size', '0px'),
    lineGap: parseSkeletonAppearanceInput('lineGap', '11px'),
    pulseDuration: 1.3, waveDuration: 1.7, bloomDuration: 0,
  });
  assert.deepEqual(skeletonAppearanceCSS(appearance), {
    '--md-skeleton-color': '#12345680', '--md-skeleton-highlight': '#ABCDEF80',
    '--md-skeleton-radius': '10px / 20px', '--md-skeleton-rounded-radius': '2px 12px 20px 5px',
    '--md-skeleton-width': 'calc(-32px + 100%)', '--md-skeleton-height': '1.5em',
    '--md-skeleton-size': '0px', '--md-skeleton-line-gap': '11px',
    '--md-skeleton-pulse-duration': '1.3s', '--md-skeleton-wave-duration': '1.7s', '--md-skeleton-bloom-duration': '0s',
  });
});

test('relative lengths preserve their units and finite signed coefficients instead of precomputing pixels', () => {
  const expected = { points: -32, fraction: 1, em: 1.5, rem: -2, ch: 20 };
  const parsed = parseSkeletonLength('calc(100% - 32px + 1.5em - 2rem + 20ch)');
  assert.deepEqual(parsed, expected);
  assert.deepEqual(parseSkeletonLength(skeletonLengthCSS(parsed)), expected);
  assert.equal(skeletonLengthCSS(parseSkeletonLength('20ch')), '20ch');
  assert.equal(skeletonLengthCSS(parseSkeletonLength('0')), '0px');
  assert.equal(skeletonLengthCSS(parseSkeletonLength('calc(-2px)')), 'calc(-2px)');
  assert.match(skeletonLengthNativeValue(parsed, 'swift'), /^AWCSkeletonLength\(points: -32.0, fraction: 1.0, em: 1.5, rem: -2.0, ch: 20.0\)$/);
  assert.match(skeletonLengthNativeValue(parsed, 'android'), /fraction = 1.0/);
  // Percent serialization must not overflow while its normalized coefficient is finite.
  const extreme = normalizeSkeletonLength({ fraction: 1e308, points: -1e308 });
  assert.deepEqual(parseSkeletonLength(skeletonLengthCSS(extreme)), extreme);
  assert.deepEqual(parseSkeletonLength('calc(1e3px + 2E-1em - 25%)'), normalizeSkeletonLength({ points: 1000, em: .2, fraction: -.25 }));
});

test('untranslatable CSS and malformed length data fail explicitly without executing accessors', () => {
  for (const text of ['12', '-1px', 'calc(100%-2px)', 'calc(100% -2px)', 'calc(2 * 1em)', 'calc(1px + 0)', 'var(--size)', 'min(100%, 200px)', 'auto', '1vw', 'calc(1px + 1px) trailing', 'calc((1px))', '1px + 2px', 'Infinitypx', 'calc(1e308px + 1e308px)', null]) {
    assert.throws(() => parseSkeletonLength(text), { code: 'INVALID_SKELETON_LENGTH' }, String(text));
  }
  let accessed = false;
  const accessor = Object.defineProperty({}, 'points', { enumerable: true, get() { accessed = true; return 12; } });
  for (const value of [null, [], { pixels: 12 }, { points: '12' }, { fraction: Infinity }, accessor, { [Symbol('extra')]: 1 }]) {
    assert.throws(() => normalizeSkeletonLength(value), { code: 'INVALID_SKELETON_LENGTH' });
  }
  assert.equal(accessed, false);
  assert.doesNotThrow(() => validateSkeletonLengths({ width: '', height: '50%' }));
  assert.throws(() => validateSkeletonLengths({ width: 'min(100%, 200px)' }), { code: 'UNSUPPORTED_SKELETON_LENGTH' });
  assert.throws(() => validateSkeletonLengths({ height: null }), { code: 'UNSUPPORTED_SKELETON_LENGTH' });
});

test('appearance accepts exact zero and partial defaults, rejecting unknown fields or invalid timing', () => {
  assert.deepEqual(normalizeSkeletonAppearance(undefined), {});
  for (const value of [null, [], { opacity: .2 }, { color: '#fff' }, { pulseDuration: -1 }, { waveDuration: Infinity }, { bloomDuration: '500ms' }, { width: '20px' }, { size: null }]) {
    assert.throws(() => normalizeSkeletonAppearance(value), { code: 'INVALID_SKELETON_APPEARANCE' });
  }
  assert.deepEqual(normalizeSkeletonAppearance({ bloomDuration: -0, size: {} }), {
    bloomDuration: 0, size: { points: 0, fraction: 0, em: 0, rem: 0, ch: 0 },
  });
});
