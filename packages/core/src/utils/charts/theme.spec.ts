import { harmonicPalette } from './theme';


describe('harmonicPalette', () => {
  const anchors = ['#6750A4', '#7D5260', '#625B71'];

  it('spreads across the whole ramp rather than taking the first n', () => {
    // Two categories deserve the two most separated accents, not two adjacent
    // ones — and an entry that lands on an anchor keeps its own notation.
    expect(harmonicPalette(anchors, 2)).toEqual(['#6750A4', '#625B71']);
    expect(harmonicPalette(anchors, 3)).toEqual(anchors);
  });

  it('blends between them for more categories than anchors', () => {
    const p = harmonicPalette(anchors, 5);
    expect(p).toHaveLength(5);
    expect(new Set(p).size).toBe(5);
  });

  it('separates neighbours by lightness when hue alone runs out', () => {
    // An MD3 scheme's three accents sit close together, so five steps between
    // them leave adjacent entries nearly identical without this.
    const flat = harmonicPalette(anchors, 5);
    const stepped = harmonicPalette(anchors, 5, { light: '#FFFBFE', dark: '#1C1B1F' });
    expect(stepped[1]).not.toBe(flat[1]);
    // Even entries keep the pure hue ramp; the shift lands on the odd ones.
    expect(stepped[0]).toBe(flat[0]);
    expect(stepped[2]).toBe(flat[2]);
  });

  it('degrades safely', () => {
    expect(harmonicPalette([], 4)).toEqual([]);
    expect(harmonicPalette(['#6750A4'], 3)).toEqual(['#6750A4', '#6750A4', '#6750A4']);
    expect(harmonicPalette(anchors, 0)).toEqual([]);
  });
});
