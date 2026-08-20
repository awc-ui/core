import {
  autoBreaks,
  inBreak,
  makeBrokenScale,
  niceLinearTicks,
  normalizeBreaks,
  sectionedTicks,
  DEFAULT_BREAK_GAP,
} from './scale';

describe('chart engine — axis breaks', () => {
  describe('normalizeBreaks', () => {
    it('drops a cut starting at the bottom, but keeps one running off the top', () => {
      // Starting at the very bottom would just shift the axis up.
      expect(normalizeBreaks([{ from: -50, to: 20, gap: 10 }], [0, 100])).toEqual([]);
      // Reaching the top is the "one point at 1, one at 1e12" shape — the top
      // cluster is a single value AT the domain max, and the cut must survive
      // or the small value stays pinned to the axis.
      expect(normalizeBreaks([{ from: 80, to: 500, gap: 10 }], [0, 100])).toEqual([{ from: 80, to: 100, gap: 10 }]);
      expect(normalizeBreaks([{ from: 20, to: 80, gap: 10 }], [0, 100])).toEqual([{ from: 20, to: 80, gap: 10 }]);
    });

    it('rescues a lone high point sitting on the domain max', () => {
      // The literal motivating case: two points, ten orders of magnitude apart.
      const s = makeBrokenScale([0, 1e12], 400, 'value', [{ from: 1, to: 1e12, gap: 14 }]);
      expect(s.breaks).toHaveLength(1);
      expect(s.scale(1)).toBeCloseTo(193, 0); // top of the lower half, not 0
      expect(s.scale(1e12)).toBeCloseTo(400, 0); // still the axis top
    });

    it('drops zero-width cuts and accepts a reversed range', () => {
      expect(normalizeBreaks([{ from: 40, to: 40, gap: 8 }], [0, 100])).toEqual([]);
      expect(normalizeBreaks([{ from: 60, to: 30, gap: 8 }], [0, 100])).toEqual([{ from: 30, to: 60, gap: 8 }]);
    });

    it('merges overlapping and touching cuts, keeping the wider gap', () => {
      expect(
        normalizeBreaks([{ from: 10, to: 40, gap: 8 }, { from: 30, to: 60, gap: 20 }], [0, 100]),
      ).toEqual([{ from: 10, to: 60, gap: 20 }]);
    });

    it('defaults the gap when unset', () => {
      const [b] = normalizeBreaks([{ from: 10, to: 20 } as never], [0, 100]);
      expect(b.gap).toBe(DEFAULT_BREAK_GAP);
    });
  });

  describe('makeBrokenScale', () => {
    // The motivating case: a cluster near 1, another near a trillion.
    const T = 1e12;
    const scale = makeBrokenScale([0, T], 500, 'value', [{ from: 100, to: T * 0.95, gap: 14 }]);

    it('gives the small cluster real estate instead of collapsing it onto zero', () => {
      const atOne = scale.scale(1);
      const atHundred = scale.scale(100);
      // Unbroken, 1 and 100 would be 0.05px apart in 500px. Broken, the low
      // cluster owns its share of the axis.
      expect(atHundred - atOne).toBeGreaterThan(50);
    });

    it('still spans exactly the full pixel range', () => {
      expect(scale.scale(0)).toBeCloseTo(0, 6);
      expect(scale.scale(T)).toBeCloseTo(500, 6);
    });

    it('spends only the gap on the cut itself', () => {
      const before = scale.scale(100);
      const after = scale.scale(T * 0.95);
      expect(after - before).toBeCloseTo(14, 6);
    });

    it('splits the axis evenly between the sections by default', () => {
      // Two sections either side of one cut: (500 - 14) / 2 each.
      expect(scale.scale(100)).toBeCloseTo(243, 6);
      expect(scale.scale(T * 0.95)).toBeCloseTo(257, 6);
    });

    it('proportional sizing keeps one unit-per-pixel — and leaves the small end small', () => {
      const prop = makeBrokenScale([0, T], 500, 'value', [{ from: 100, to: T * 0.95, gap: 14 }], 'proportional');
      // This is the honest classic behaviour, and exactly why `equal` is the
      // default: cutting the empty middle does not rescue a 100-wide section
      // inside a 1e12 domain.
      expect(prop.scale(100) - prop.scale(1)).toBeLessThan(0.001);
      expect(prop.scale(0)).toBeCloseTo(0, 6);
      expect(prop.scale(T)).toBeCloseTo(500, 6);
    });

    it('reports where the cut sits, for drawing it', () => {
      expect(scale.breaks).toHaveLength(1);
      expect(scale.breaks[0].px).toBeCloseTo(scale.scale(100), 6);
    });

    it('round-trips values on both sides of the cut', () => {
      for (const v of [0, 1, 50, 100, T * 0.95, T * 0.97, T]) {
        expect(scale.invert(scale.scale(v))).toBeCloseTo(v, 3);
      }
    });

    it('pins a value inside the cut to its near edge', () => {
      expect(scale.scale(T / 2)).toBeCloseTo(scale.scale(100), 6);
      expect(inBreak([{ from: 100, to: T * 0.95, gap: 14 }], T / 2)).toBe(true);
      expect(inBreak([{ from: 100, to: T * 0.95, gap: 14 }], 50)).toBe(false);
    });

    it('stays monotonic across several cuts', () => {
      const multi = makeBrokenScale([0, 100], 400, 'value', [
        { from: 10, to: 40, gap: 12 },
        { from: 60, to: 90, gap: 12 },
      ]);
      const xs = [0, 5, 10, 40, 45, 55, 60, 90, 95, 100].map((v) => multi.scale(v));
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
      expect(xs[xs.length - 1]).toBeCloseTo(400, 6);
    });

    it('breaks a log axis in log space', () => {
      const log = makeBrokenScale([1, 1e9], 300, 'log', [{ from: 100, to: 1e6, gap: 10 }]);
      expect(log.scale(1)).toBeCloseTo(0, 6);
      expect(log.scale(1e9)).toBeCloseTo(300, 6);
      expect(log.scale(1e6) - log.scale(100)).toBeCloseTo(10, 6);
    });

    it('is a plain scale when nothing survives normalisation', () => {
      const plain = makeBrokenScale([0, 100], 200, 'value', []);
      expect(plain.breaks).toEqual([]);
      expect(plain.scale(50)).toBeCloseTo(100, 6);
    });
  });

  describe('autoBreaks', () => {
    it('finds the empty stretch between two clusters', () => {
      const values = [1, 2, 3, 4, 5, 1e12, 1e12 + 1, 1e12 + 2];
      const [b] = autoBreaks(values);
      expect(b).toBeTruthy();
      // Cuts exactly between the clusters, so neither loses any of its range.
      expect(b.from).toBe(5);
      expect(b.to).toBe(1e12);
    });

    it('leaves evenly-spread data alone', () => {
      expect(autoBreaks(Array.from({ length: 20 }, (_, i) => i * 5))).toEqual([]);
    });

    it('needs the gap to beat minGap× the median spacing', () => {
      const values = [0, 1, 2, 3, 20]; // 17 vs a median of 1
      expect(autoBreaks(values, { minGap: 8 })).toHaveLength(1);
      expect(autoBreaks(values, { minGap: 40 })).toHaveLength(0);
    });

    it('caps how many cuts it will make', () => {
      const values = [0, 1, 2, 500, 501, 502, 1000, 1001, 1002, 5000, 5001];
      expect(autoBreaks(values, { maxBreaks: 1 })).toHaveLength(1);
      expect(autoBreaks(values, { maxBreaks: 3 }).length).toBeGreaterThan(1);
    });

    it('ignores too-short or non-finite input', () => {
      expect(autoBreaks([1, 1e9])).toEqual([]);
      expect(autoBreaks([NaN, Infinity, 1, 2])).toEqual([]);
    });
  });
});

describe('chart engine — ticks on a broken axis', () => {
  it('gives every section its own ticks, including a rescued small one', () => {
    const ticks = sectionedTicks([0, 1.05e12], [{ from: 12, to: 9.5e11, gap: 14 }], 'value', 6);
    // The point of the break: the low cluster must be readable in absolute
    // terms, so it needs a tick of its own, not just the shared zero.
    expect(ticks.filter((t) => t <= 12).length).toBeGreaterThan(1);
    expect(ticks.some((t) => t >= 9.5e11)).toBe(true);
  });

  it('keeps a section labelled even when the cuts leave three of them', () => {
    const ticks = sectionedTicks(
      [0, 1.05e12],
      [{ from: 12, to: 8e11, gap: 14 }, { from: 8e11, to: 9.5e11, gap: 14 }],
      'value',
      6,
    );
    expect(ticks.filter((t) => t > 0 && t <= 12).length).toBeGreaterThan(0);
  });

  it('is the plain tick set when the axis has no cuts', () => {
    expect(sectionedTicks([0, 100], [], 'value', 6)).toEqual(niceLinearTicks(0, 100, 6));
  });

  it('rules BOTH sections, instead of the one tick the nice step leaves', () => {
    // The rollout case. A single pass over the whole domain leaves the low band
    // nearly empty: asked for 3 ticks, 0…18 still lands only 0 and 10, so the
    // top of that band has no gridline at all.
    expect(niceLinearTicks(0, 18, 3)).toEqual([0, 10]);

    const ticks = sectionedTicks([0, 1.1e12], [{ from: 18, to: 8.1e11, gap: 14 }], 'value', 6);
    // Round numbers in both, and neither band left with a lone line.
    expect(ticks.filter((t) => t <= 18)).toEqual([0, 5, 10, 15]);
    expect(ticks.filter((t) => t >= 8.1e11)).toEqual([9e11, 1e12, 1.1e12]);
  });

  it('ignores a cut the axis domain rejects, instead of ruling one band only', () => {
    // Hiding the low series leaves values that all sit high, so the widest gap
    // auto-detection finds runs from the stacked 0 baseline up to the cluster.
    // The axis drops that cut (it starts at the very bottom, so it would only
    // shift the axis up) — the ticks must drop it too, or the axis is ruled only
    // between 810B and 1.1T and the whole lower half of the plot has no lines.
    const domain: [number, number] = [0, 1.1e12];
    const ghost = [{ from: 0, to: 8.1e11, gap: 14 }];
    expect(normalizeBreaks(ghost, domain)).toEqual([]);
    expect(sectionedTicks(domain, ghost, 'value', 6)).toEqual(niceLinearTicks(0, 1.1e12, 6));
  });

  it('stops asking once a section is ruled, rather than subdividing forever', () => {
    // 0…100 already yields 0/20/…/100 on the first pass, so it is left alone.
    const ticks = sectionedTicks([0, 1e12], [{ from: 100, to: 9e11, gap: 14 }], 'value', 6);
    expect(ticks.filter((t) => t <= 100)).toEqual(niceLinearTicks(0, 100, 3));
  });
});
