import { parseColor, formatColor, parseHex, rgbaFromCssRgb, rgbaFromCssHsl, hslToRgb, hsvaToHex } from './color-utils';

describe('md-color-picker color value interchange', () => {
  it.each([
    ['#f00', '#FF0000'], ['#0f08', '#00FF0088'], ['#0000ff', '#0000FF'], ['#abcdef40', '#ABCDEF40'],
    ['rgb(255, 0, 255)', '#FF00FF'], ['rgb(0 255 255 / 50%)', '#00FFFF80'],
    ['rgba(255,255,0,0.25)', '#FFFF0040'], ['hsl(120,100%,50%)', '#00FF00'],
    ['hsla(240,100%,50%,25%)', '#0000FF40'], ['hsl(60 100% 50% / 0.5)', '#FFFF0080'],
    ['#808080', '#808080'], ['#000', '#000000'], ['#fff', '#FFFFFF'],
  ])('normalizes supported CSS value %s without losing color or alpha', (input, expected) => {
    const parsed = parseColor(input)!;
    expect(parsed).not.toBeNull();
    expect(hsvaToHex(parsed)).toBe(expected);
    for (const format of ['rgb', 'hsl'] as const) {
      const roundTrip = parseColor(formatColor(parsed, format))!;
      // Decimal alpha retains two digits. HSL serialization rounds percentage
      // channels to integers, which permits less than one saturation point of
      // round-trip quantization for the non-primary sample.
      expect(roundTrip.h).toBeCloseTo(parsed.h, 0);
      expect(Math.abs(roundTrip.s - parsed.s)).toBeLessThan(1);
      expect(roundTrip.v).toBeCloseTo(parsed.v, 0);
      expect(roundTrip.a).toBeCloseTo(parsed.a, 1);
    }
  });

  it.each(['', '#12', '#12345', '#1234567', '#ggg', 'red', 'rgb(nope)', 'hsl(nope)'])('rejects invalid value %j', (value) => {
    expect(parseColor(value)).toBeNull();
  });

  it.each([
    [0, { r: 255, g: 0, b: 0 }], [60, { r: 255, g: 255, b: 0 }],
    [120, { r: 0, g: 255, b: 0 }], [180, { r: 0, g: 255, b: 255 }],
    [240, { r: 0, g: 0, b: 255 }], [300, { r: 255, g: 0, b: 255 }],
  ])('converts the HSL color wheel hue %s to its primary/secondary RGB color', (hue, expected) => {
    expect(hslToRgb(hue as number, 100, 50)).toEqual(expected);
    expect(hslToRgb((hue as number) + 360, 100, 50)).toEqual(expected);
  });

  it('clamps out-of-range CSS channels and opacity without accepting malformed syntax', () => {
    expect(rgbaFromCssRgb('rgba(300, 10, 20, 5)')).toEqual({ r: 255, g: 10, b: 20, a: 1 });
    expect(rgbaFromCssHsl('hsla(120, 150%, 50%, 200%)')).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(parseHex('not a color')).toBeNull();
    expect(rgbaFromCssRgb('rgba()')).toBeNull();
    expect(rgbaFromCssHsl('hsla()')).toBeNull();
  });
});
