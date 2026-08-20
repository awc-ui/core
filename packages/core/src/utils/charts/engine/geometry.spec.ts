import { interpolate, splitRuns, stackSeries, type Pt } from './geometry';

const P = (x: number, y: number): Pt => ({ x, y });

describe('chart engine — geometry', () => {
  describe('interpolate', () => {
    const pts = [P(0, 0), P(10, 10), P(20, 0), P(30, 10)];

    it('linear returns the input points unchanged', () => {
      expect(interpolate(pts, 'linear')).toEqual(pts);
    });

    it('smooth passes through the original data points and adds samples', () => {
      const out = interpolate(pts, 'smooth');
      expect(out.length).toBeGreaterThan(pts.length);
      expect(out[0]).toEqual(pts[0]); // starts at first
      expect(out[out.length - 1]).toEqual(pts[pts.length - 1]); // ends at last
    });

    it('monotone never overshoots a monotonic run', () => {
      const rising = [P(0, 0), P(1, 5), P(2, 20), P(3, 21)];
      const out = interpolate(rising, 'monotone');
      const ys = out.map((p) => p.y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1e-9); // no dip below start
      expect(Math.max(...ys)).toBeLessThanOrEqual(21 + 1e-9); // no peak above end
      // y is non-decreasing (monotone preserved)
      for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
    });

    it('step-after holds then jumps (inserts the corner)', () => {
      const out = interpolate([P(0, 0), P(10, 10)], 'step');
      expect(out).toEqual([P(0, 0), P(10, 0), P(10, 10)]);
    });

    it('step-before jumps then holds', () => {
      const out = interpolate([P(0, 0), P(10, 10)], 'step-before');
      expect(out).toEqual([P(0, 0), P(0, 10), P(10, 10)]);
    });
  });

  describe('splitRuns', () => {
    it('breaks the line at null gaps', () => {
      const runs = splitRuns([1, 2, null, 4, 5], false);
      expect(runs.length).toBe(2);
      expect(runs[0].map((r) => r.index)).toEqual([0, 1]);
      expect(runs[1].map((r) => r.index)).toEqual([3, 4]);
    });

    it('bridges gaps when connectNulls', () => {
      const runs = splitRuns([1, null, 3], true);
      expect(runs.length).toBe(1);
      expect(runs[0].map((r) => r.value)).toEqual([1, 3]);
    });
  });

  describe('stackSeries', () => {
    it('non-stacked series get [0, value] bands', () => {
      const out = stackSeries([[3, 5]], 'none', [undefined]);
      expect(out[0]).toEqual([[0, 3], [0, 5]]);
    });

    it('normal stacking accumulates bases', () => {
      const out = stackSeries([[2, 4], [3, 1]], 'normal', ['a', 'a']);
      expect(out[0]).toEqual([[0, 2], [0, 4]]); // first series from 0
      expect(out[1]).toEqual([[2, 5], [4, 5]]); // second stacked on top
    });

    it('percentage rescales each column to sum 100', () => {
      const out = stackSeries([[1], [3]], 'percentage', ['a', 'a']);
      expect(out[0]![0]).toEqual([0, 25]);
      expect(out[1]![0]).toEqual([25, 100]);
    });

    it('preserves nulls as null bands', () => {
      const out = stackSeries([[null, 2]], 'normal', ['a']);
      expect(out[0][0]).toBeNull();
      expect(out[0][1]).toEqual([0, 2]);
    });
  });
});
