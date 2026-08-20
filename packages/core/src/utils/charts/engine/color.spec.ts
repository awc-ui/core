import { parseColor } from './color';

describe('chart engine — parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#6750A4')).toEqual([0x67 / 255, 0x50 / 255, 0xa4 / 255, 1]);
  });
  it('parses shorthand #rgb', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1, 1]);
  });
  it('parses #rrggbbaa alpha', () => {
    const [, , , a] = parseColor('#00000080');
    expect(a).toBeCloseTo(0x80 / 255, 5);
  });
  it('parses rgb()', () => {
    expect(parseColor('rgb(103, 80, 164)')).toEqual([103 / 255, 80 / 255, 164 / 255, 1]);
  });
  it('parses rgba() with alpha', () => {
    expect(parseColor('rgba(0, 0, 0, 0.35)')).toEqual([0, 0, 0, 0.35]);
  });
  it('falls back to grey for unknown', () => {
    expect(parseColor('cornflowerblue')).toEqual([0.5, 0.5, 0.5, 1]);
  });
});
