import {
  makeLinearScale,
  makeLogScale,
  makeCategoryScale,
  niceLinearTicks,
  logTicks,
  timeTicks,
  computeDomain,
  toNumeric,
} from './scale';

describe('chart engine — scale', () => {
  describe('makeLinearScale', () => {
    it('maps domain endpoints to the range endpoints', () => {
      const s = makeLinearScale([0, 100], 200);
      expect(s.scale(0)).toBe(0);
      expect(s.scale(100)).toBe(200);
      expect(s.scale(50)).toBe(100);
    });

    it('inverts back to data space (round-trip)', () => {
      const s = makeLinearScale([10, 30], 400);
      expect(s.invert(s.scale(22))).toBeCloseTo(22, 6);
    });

    it('pads a degenerate single-value domain instead of dividing by zero', () => {
      const s = makeLinearScale([5, 5], 100);
      expect(Number.isFinite(s.scale(5))).toBe(true);
      expect(s.scale(5)).toBeCloseTo(50, 6); // centered
    });
  });

  describe('makeCategoryScale', () => {
    it('centers points in their band when alignWithLabel', () => {
      const s = makeCategoryScale(4, 400, true); // band = 100
      expect(s.scale(0)).toBe(50); // half-band inset
      expect(s.scale(3)).toBe(350);
      expect(s.bandwidth).toBe(100);
    });

    it('sits at the band leading edge when not aligned (bar mode)', () => {
      const s = makeCategoryScale(4, 400, false);
      expect(s.scale(0)).toBe(0);
      expect(s.scale(1)).toBe(100);
    });

    it('inverts a pixel to the nearest category index', () => {
      const s = makeCategoryScale(4, 400, true);
      expect(s.invert(60)).toBe(0);
      expect(s.invert(140)).toBe(1);
    });
  });

  describe('makeLogScale', () => {
    it('maps decades linearly in log space', () => {
      const s = makeLogScale([1, 100], 200);
      expect(s.scale(1)).toBeCloseTo(0, 6);
      expect(s.scale(10)).toBeCloseTo(100, 6);
      expect(s.scale(100)).toBeCloseTo(200, 6);
    });

    it('survives a non-positive min without NaN', () => {
      const s = makeLogScale([0, 1000], 300);
      expect(Number.isFinite(s.scale(1000))).toBe(true);
    });
  });

  describe('niceLinearTicks', () => {
    it('produces round steps covering the range', () => {
      const ticks = niceLinearTicks(0, 95, 6);
      expect(ticks[0]).toBe(0);
      expect(ticks).toContain(20);
      expect(ticks).toContain(80);
      // step is a nice 1/2/5×10ⁿ
      const step = ticks[1] - ticks[0];
      expect([1, 2, 5, 10, 20, 25, 50].includes(step)).toBe(true);
    });

    it('handles a flat range', () => {
      expect(niceLinearTicks(7, 7)).toEqual([7]);
    });
  });

  describe('logTicks', () => {
    it('returns powers of ten within range', () => {
      expect(logTicks(1, 1000)).toEqual([1, 10, 100, 1000]);
    });
  });

  describe('timeTicks', () => {
    it('picks a consistent whole-day step across a week', () => {
      const day = 24 * 3600 * 1000;
      const t = timeTicks(0, 7 * day, 6);
      expect(t.length).toBeGreaterThan(1);
      const step = t[1] - t[0];
      expect(step % day).toBe(0); // whole days
      // evenly spaced
      for (let i = 2; i < t.length; i++) expect(t[i] - t[i - 1]).toBe(step);
    });
  });

  describe('computeDomain', () => {
    it('spans min/max of the data', () => {
      expect(computeDomain([3, 8, 5], { scale: 'value' })).toEqual([3, 8]);
    });
    it('honors explicit overrides', () => {
      expect(computeDomain([3, 8], { scale: 'value', min: 0, max: 10 })).toEqual([0, 10]);
    });
    it('anchors to zero when includeZero', () => {
      expect(computeDomain([4, 9], { scale: 'value', includeZero: true })).toEqual([0, 9]);
    });
  });

  describe('toNumeric', () => {
    it('passes numbers through for value scale', () => {
      expect(toNumeric(42, 'value')).toBe(42);
    });
    it('converts a Date to epoch ms for time', () => {
      const d = new Date('2020-01-01T00:00:00Z');
      expect(toNumeric(d, 'time')).toBe(d.getTime());
    });
    it('parses an ISO string for time', () => {
      expect(toNumeric('2020-01-01T00:00:00Z', 'time')).toBe(Date.parse('2020-01-01T00:00:00Z'));
    });
  });
});

describe('niceLinearTicks across zero', () => {
  it('labels the negative half of a domain that crosses zero', () => {
    // Monthly temperatures for a cold city: roughly -6 to 18. Deriving the step
    // from a "nice"-rounded span first inflated it to 10, and since the outer
    // nice ticks are clipped back to the data, the axis was left with 0 and 10
    // only — a chart whose whole point is crossing zero, with no negative label.
    const ticks = niceLinearTicks(-6.2, 17.6, 8);
    expect(ticks.some((t) => t < 0)).toBe(true);
    expect(ticks).toContain(0);
    expect(ticks.length).toBeGreaterThanOrEqual(5);
  });

  it('still spaces ticks on a nice 1/2/5×10ⁿ step', () => {
    for (const [lo, hi] of [
      [-6.2, 17.6],
      [0, 95],
      [-1000, 1000],
      [0.02, 0.19],
    ] as [number, number][]) {
      const t = niceLinearTicks(lo, hi, 8);
      const step = t[1] - t[0];
      const mag = Math.pow(10, Math.floor(Math.log10(step)));
      expect([1, 2, 2.5, 5, 10]).toContain(Number((step / mag).toFixed(4)));
    }
  });

  it('keeps every tick inside the domain', () => {
    const ticks = niceLinearTicks(-6.2, 17.6, 8);
    expect(Math.min(...ticks)).toBeGreaterThanOrEqual(-6.2);
    expect(Math.max(...ticks)).toBeLessThanOrEqual(17.6);
  });
});
