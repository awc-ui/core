import { distanceToLine, pickFocusSeries, HoverFocus, FOCUS_DWELL_MS, FOCUS_STICK } from './emphasis';

/** Distances (px) from the cursor to each series' point at the hovered x. */
const at = (...distances: number[]) => distances.map((distance, seriesIndex) => ({ seriesIndex, distance }));

describe('chart engine — hover emphasis focus', () => {
  it('takes the nearest series when nothing is focused yet', () => {
    expect(pickFocusSeries(at(30, 4, 18), -1)).toBe(1);
  });

  it('returns -1 when no series has a point at the hovered x', () => {
    expect(pickFocusSeries([], -1)).toBe(-1);
  });

  it('holds the focused series while a rival is only marginally nearer', () => {
    // Two lines ~5px apart, cursor drifting around their midpoint: the raw
    // nearest alternates, which used to swap vivid/dimmed on every move.
    expect(pickFocusSeries(at(2.8, 2.6), 0)).toBe(0);
    expect(pickFocusSeries(at(3.1, 2.3), 0)).toBe(0);
    expect(pickFocusSeries(at(2.4, 3.0), 1)).toBe(1);
  });

  it('follows a deliberate move onto the other line', () => {
    // Cursor sitting exactly on series 1, series 0 a full gap away.
    expect(pickFocusSeries(at(5.45, 0), 0)).toBe(1);
    expect(pickFocusSeries(at(0, 5.45), 1)).toBe(0);
  });

  it('switches immediately for a series that is far nearer', () => {
    expect(pickFocusSeries(at(60, 3), 0)).toBe(1);
  });

  it('moves on when the held series has no point here (hidden, or a data hole)', () => {
    // Series 0 is held but absent from the candidates.
    expect(pickFocusSeries([{ seriesIndex: 1, distance: 12 }], 0)).toBe(1);
  });

  it('needs a rival to beat the held series by the full margin', () => {
    const held = 0;
    // Just inside the margin → hold; just outside → switch.
    expect(pickFocusSeries(at(10, 10 - FOCUS_STICK + 0.1), held)).toBe(0);
    expect(pickFocusSeries(at(10, 10 - FOCUS_STICK - 0.1), held)).toBe(1);
  });

  describe('distanceToLine', () => {
    // A line from (0,0) to (100,100), sampled only at its ends.
    const diagonal = [
      [0, 0],
      [100, 100],
    ] as const;

    it('measures to the interpolated line, not to the nearest sample', () => {
      // Halfway along, the line is at 50 — 2px above the cursor — even though
      // the nearest actual sample is 50px away.
      expect(distanceToLine(diagonal, 50, 48)).toBeCloseTo(2);
    });

    it('is zero on the line itself', () => {
      expect(distanceToLine(diagonal, 25, 25)).toBeCloseTo(0);
    });

    it('measures to the endpoint past either end, so a finished line reads far', () => {
      // 30px beyond the last sample, level with it: 30px away, not 0.
      expect(distanceToLine(diagonal, 130, 100)).toBeCloseTo(30);
      expect(distanceToLine(diagonal, -10, 0)).toBeCloseTo(10);
    });

    it('handles a single sample and an empty series', () => {
      expect(distanceToLine([[10, 10]], 10, 14)).toBeCloseTo(4);
      expect(distanceToLine([], 0, 0)).toBe(Infinity);
    });

    it('keeps a series with sparse samples comparable to a densely sampled one', () => {
      // The whole point for irregular data: series B has no sample at x=50,
      // but its line is the nearer one there and must win.
      const dense = [
        [0, 0],
        [50, 0],
        [100, 0],
      ] as const;
      const sparse = [
        [0, 40],
        [100, 40],
      ] as const;
      expect(distanceToLine(dense, 50, 38)).toBeCloseTo(38);
      expect(distanceToLine(sparse, 50, 38)).toBeCloseTo(2);
    });
  });

  it('is stable under repeated jitter around the midpoint', () => {
    let focus = -1;
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      // Sub-pixel wobble either side of the midpoint of two lines 5px apart.
      const wobble = (i % 2 ? 1 : -1) * 0.4;
      focus = pickFocusSeries(at(2.5 + wobble, 2.5 - wobble), focus);
      seen.add(focus);
    }
    expect(seen.size).toBe(1); // picked once, never traded back and forth
  });

  describe('HoverFocus (geometry + dwell over time)', () => {
    it('adopts a series immediately on the first hover', () => {
      const f = new HoverFocus();
      expect(f.pick(at(40, 3), 0)).toBe(1);
    });

    it('ignores a rival that keeps winning and losing', () => {
      // Two lines ~5px apart, the cursor roughly still while they wander
      // across it: the nearest genuinely alternates, by the full gap each
      // time, so the px deadband alone would let it swap on every frame.
      const f = new HoverFocus();
      const seen = new Set<number>();
      let t = 0;
      seen.add(f.pick(at(0, 5.45), t));
      for (let i = 0; i < 60; i++) {
        t += 16; // ~one frame
        seen.add(i % 2 ? f.pick(at(5.45, 0), t) : f.pick(at(0, 5.45), t));
      }
      expect(seen.size).toBe(1);
    });

    it('follows a rival that stays nearest for the dwell', () => {
      const f = new HoverFocus();
      expect(f.pick(at(0, 5.45), 0)).toBe(0);
      // The dwell starts when the rival takes the lead, at t=50.
      expect(f.pick(at(5.45, 0), 50)).toBe(0); // still settling
      expect(f.pick(at(5.45, 0), 50 + FOCUS_DWELL_MS - 1)).toBe(0);
      expect(f.pick(at(5.45, 0), 50 + FOCUS_DWELL_MS)).toBe(1); // settled → moves
    });

    it('restarts the dwell when the contender changes', () => {
      const f = new HoverFocus(FOCUS_STICK, 100);
      expect(f.pick(at(0, 9, 20), 0)).toBe(0);
      expect(f.pick(at(9, 0, 20), 60)).toBe(0); // series 1 leading for 60ms
      expect(f.pick(at(9, 20, 0), 90)).toBe(0); // series 2 takes over — clock resets
      expect(f.pick(at(9, 20, 0), 150)).toBe(0); // only 60ms of series 2 so far
      expect(f.pick(at(9, 20, 0), 200)).toBe(2);
    });

    it('adopts immediately again after reset (pointer left and came back)', () => {
      const f = new HoverFocus();
      expect(f.pick(at(0, 20), 0)).toBe(0);
      f.reset();
      expect(f.pick(at(20, 0), 10)).toBe(1);
    });
  });
});
