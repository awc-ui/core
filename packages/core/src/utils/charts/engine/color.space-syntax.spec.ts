import { parseColor, withAlpha } from './color';

/**
 * CSS Color 4's space-separated `rgb()` — what `getComputedStyle` hands back
 * for `color(srgb …)`, what design tokens increasingly ship as, and the form
 * the spec now prefers. Split on commas alone it threw ("Cannot read properties
 * of undefined"), and every caller (hover dimming, slice labels, the sparkline's
 * reference-band tint) broke with it.
 */
describe('chart engine — parseColor, space-separated rgb()', () => {
  it('parses rgb(r g b)', () => {
    expect(parseColor('rgb(255 99 71)')).toEqual([1, 99 / 255, 71 / 255, 1]);
  });
  it('parses rgb(r g b / a) with a number or a percentage alpha', () => {
    expect(parseColor('rgb(0 0 255 / 0.5)')).toEqual([0, 0, 1, 0.5]);
    expect(parseColor('rgb(0 0 255 / 25%)')).toEqual([0, 0, 1, 0.25]);
  });
  it('parses percentage channels in the space form', () => {
    expect(parseColor('rgb(100% 0% 50%)')).toEqual([1, 0, 0.5, 1]);
  });
  it('still parses the comma forms, with or without spaces', () => {
    expect(parseColor('rgb(103,80,164)')).toEqual([103 / 255, 80 / 255, 164 / 255, 1]);
    expect(parseColor('rgba(0, 0, 0, 0.35)')).toEqual([0, 0, 0, 0.35]);
  });
  it('falls back instead of throwing on an rgb() with too few channels', () => {
    expect(() => parseColor('rgb(1 2)')).not.toThrow();
    expect(parseColor('rgb(1 2)')).toEqual([0.5, 0.5, 0.5, 1]);
  });
  it('re-alphas a space-separated colour', () => {
    expect(withAlpha('rgb(46 125 50)', 0.18)).toBe('rgba(46, 125, 50, 0.18)');
  });
});
