import { harmonicPalette, resolveSeriesColor } from './theme';


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


describe('resolveSeriesColor', () => {
  /*
   * The failure this suite pins down: canvas rejects `fillStyle =
   * 'var(--token)'` SILENTLY, and `CSS.supports('color', 'var(--x)')` is true
   * because substitution is deferred — so a token-coloured series slipped past
   * the validity guard and painted nothing. Series colours must resolve
   * var()/color-mix() against the host, exactly as axis bands always did.
   *
   * Environment stubs: mock-doc's getComputedStyle carries no `color`, and CSS
   * is undefined, so both are stubbed to the one behaviour each test needs —
   * the production code is untouched. Same approach as isolation-escape.spec.
   */
  const host = document.createElement('div');
  document.body.appendChild(host);

  const realGCS = globalThis.getComputedStyle;
  const realCSS = (globalThis as { CSS?: unknown }).CSS;
  beforeAll(() => {
    (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = (el: Element) => {
      const inline = (el as HTMLElement).style;
      // The probe span resolveComputedColor creates carries the raw value as
      // its inline colour; "resolving" it is the browser's job, so the stub
      // stands in with a fixed rgb for any token-bearing value.
      const raw = inline?.color ?? '';
      return {
        color: /var\(|color-mix\(/i.test(raw) ? 'rgb(103, 80, 164)' : raw,
        getPropertyValue: () => '',
      } as unknown as CSSStyleDeclaration;
    };
    // mock-doc guards the CSS global with an accessor, so plain assignment
    // throws — defineProperty replaces it wholesale (and restores the same way).
    Object.defineProperty(globalThis, 'CSS', {
      configurable: true,
      value: {
        supports: (_p: string, v: string) =>
          /^#|^rgb|^hsl|^var\(|^color-mix\(|^currentColor$/i.test(v),
      },
    });
  });
  afterAll(() => {
    (globalThis as unknown as { getComputedStyle: unknown }).getComputedStyle = realGCS;
    Object.defineProperty(globalThis, 'CSS', { configurable: true, value: realCSS });
  });

  it('resolves a var() token against the host instead of passing it to canvas', () => {
    expect(resolveSeriesColor(host, 'var(--md-sys-color-primary)', '#999')).toBe(
      'rgb(103, 80, 164)',
    );
  });

  it('resolves color-mix() the same way', () => {
    expect(
      resolveSeriesColor(host, 'color-mix(in srgb, var(--md-sys-color-error) 50%, white)', '#999'),
    ).toBe('rgb(103, 80, 164)');
  });

  it('passes a plain CSS colour through untouched', () => {
    expect(resolveSeriesColor(host, '#123456', '#999')).toBe('#123456');
    expect(resolveSeriesColor(host, 'rgb(1, 2, 3)', '#999')).toBe('rgb(1, 2, 3)');
  });

  it('resolves a role name through the token map, not the raw-colour path', () => {
    const computed = { getPropertyValue: () => '#ABCDEF' } as unknown as CSSStyleDeclaration;
    expect(resolveSeriesColor(host, 'primary', '#999', computed)).toBe('#ABCDEF');
  });

  it('still falls back, with a warning, on a value that is neither', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveSeriesColor(host, 'not-a-colour', '#999')).toBe('#999');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
