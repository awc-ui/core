import { decimateMinMax, type Pt } from './geometry';

const run = (n: number, f: (i: number) => number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: (i / (n - 1)) * 900, y: f(i) }));

describe('decimateMinMax', () => {
  it('leaves a run alone until it exceeds 4 points per pixel', () => {
    const sparse = run(1000, (i) => i % 17);
    expect(decimateMinMax(sparse, 900)).toBe(sparse); // same reference — no copy, no work
  });

  it('bounds a dense run to a few points per pixel column', () => {
    const dense = run(500_000, (i) => Math.sin(i) * 50 + 50);
    const out = decimateMinMax(dense, 900);
    expect(out.length).toBeLessThan(900 * 4);
    expect(out.length).toBeGreaterThan(900); // still one+ point per column
  });

  it('preserves the vertical envelope of a noisy run', () => {
    const dense = run(200_000, (i) => (i % 1000 === 0 ? 999 : (i * 37) % 100));
    const out = decimateMinMax(dense, 900);
    // Spread would blow the stack at this size — fold instead.
    const hi = (ps: Pt[]) => ps.reduce((m, p) => (p.y > m ? p.y : m), -Infinity);
    const lo = (ps: Pt[]) => ps.reduce((m, p) => (p.y < m ? p.y : m), Infinity);
    // The spikes are what a dense series reads as — they must survive.
    expect(hi(out)).toBe(hi(dense));
    expect(lo(out)).toBe(lo(dense));
  });

  it('keeps x monotonically non-decreasing', () => {
    const dense = run(120_000, (i) => Math.cos(i * 0.7) * 20);
    const out = decimateMinMax(dense, 600);
    for (let i = 1; i < out.length; i++) expect(out[i].x).toBeGreaterThanOrEqual(out[i - 1].x);
  });

  it('keeps the first and last datapoint so the line spans the plot', () => {
    const dense = run(80_000, (i) => i * 0.001);
    const out = decimateMinMax(dense, 400);
    expect(out[0]).toEqual(dense[0]);
    expect(out[out.length - 1]).toEqual(dense[dense.length - 1]);
  });

  it('emits each column extreme once, in occurrence order', () => {
    // Two columns, x=0 and x=1, 8 points each; y rises then falls.
    const pts: Pt[] = [];
    for (const x of [0, 1]) for (let k = 0; k < 8; k++) pts.push({ x, y: k < 4 ? k : 8 - k });
    const out = decimateMinMax(pts, 1); // 16 points over 1px ⇒ decimates
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toBe(out[i - 1]);
    expect(out.length).toBeLessThanOrEqual(8);
  });
});
