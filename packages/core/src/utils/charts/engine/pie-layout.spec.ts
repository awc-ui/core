import { computePieLayout, SELECT_OFFSET, type PieChartSpec } from './pie-layout';
import { easeScene, revealScene, splitScene } from './animate';
import type { EngineTheme } from './layout';

const theme: EngineTheme = {
  background: 'transparent',
  textColor: '#1C1B1F',
  textColorMuted: '#49454F',
  axisLineColor: '#79747E',
  gridLineColor: '#CAC4D0',
  surface: '#FFFBFE',
  fontFamily: 'Roboto',
  labelSize: 11,
  titleSize: 14,
};

const baseSpec = (over: Partial<PieChartSpec> = {}): PieChartSpec => ({
  data: [
    { label: 'A', value: 50, color: '#6750A4' },
    { label: 'B', value: 30, color: '#B3261E' },
    { label: 'C', value: 20, color: '#7D5260' },
  ],
  innerRadius: '0%',
  outerRadius: '80%',
  startAngleDeg: 90,
  endAngleDeg: -270,
  paddingAngleDeg: 0,
  cornerRadius: 0,
  showLabels: false,
  highlight: 'none',
  legend: 'none',
  valueFormatter: (v) => String(v),
  ...over,
});

const sweep = (s: { startAngle: number; endAngle: number }) => Math.abs(s.endAngle - s.startAngle);

describe('chart engine — pie layout', () => {
  it('emits one slice per datum, angular size proportional to value', () => {
    const s = computePieLayout(baseSpec(), theme, 400, 400);
    expect(s.slices.length).toBe(3);
    // full circle split 50/30/20 → the first sweep is ~2.5× the third
    expect(sweep(s.slices[0]) / sweep(s.slices[2])).toBeCloseTo(50 / 20, 1);
    // the three sweeps sum to a full turn (no padding)
    const total = s.slices.reduce((sum, sl) => sum + sweep(sl), 0);
    expect(total).toBeCloseTo(Math.PI * 2, 2);
  });

  it('produces a donut ring when innerRadius > 0', () => {
    const pie = computePieLayout(baseSpec(), theme, 400, 400);
    const donut = computePieLayout(baseSpec({ innerRadius: '60%' }), theme, 400, 400);
    // A solid pie keeps a hub of a couple of px (the radius at which its
    // constant-width gaps close on themselves) — nothing like a ring.
    expect(pie.slices[0].innerR).toBeLessThan(pie.slices[0].outerR * 0.07);
    expect(donut.slices[0].innerR).toBeGreaterThan(donut.slices[0].outerR * 0.5);
    expect(donut.slices[0].innerR).toBeLessThan(donut.slices[0].outerR);
  });

  it('spans only a half turn for a semi-circle (180 → 0)', () => {
    const s = computePieLayout(baseSpec({ startAngleDeg: 180, endAngleDeg: 0 }), theme, 400, 200);
    const total = s.slices.reduce((sum, sl) => sum + sweep(sl), 0);
    expect(total).toBeCloseTo(Math.PI, 2); // half circle
  });

  it('inserts gaps between slices for a padding angle', () => {
    const noPad = computePieLayout(baseSpec(), theme, 400, 400);
    const padded = computePieLayout(baseSpec({ paddingAngleDeg: 6 }), theme, 400, 400);
    const noPadTotal = noPad.slices.reduce((sum, sl) => sum + sweep(sl), 0);
    const padTotal = padded.slices.reduce((sum, sl) => sum + sweep(sl), 0);
    expect(padTotal).toBeLessThan(noPadTotal); // padding eats into the arc
  });

  it('explodes a selected slice outward from the ring centre', () => {
    const s = computePieLayout(baseSpec({ data: [
      { label: 'A', value: 50, color: '#6750A4', selected: true },
      { label: 'B', value: 50, color: '#B3261E' },
    ] }), theme, 400, 400);
    const cx = 200;
    const cy = 200;
    const distA = Math.hypot(s.slices[0].cx - cx, s.slices[0].cy - cy);
    const distB = Math.hypot(s.slices[1].cx - cx, s.slices[1].cy - cy);
    expect(distA).toBeGreaterThan(distB); // selected slice offset outward
  });

  it('a selected PARENT carries its child slices AND their labels out as one wedge', () => {
    const nested = (chromeSelected: boolean): PieChartSpec =>
      baseSpec({
        innerRadius: '40%',
        outerRadius: '90%',
        showLabels: true,
        highlight: 'slice',
        data: [
          { label: 'Chrome', value: 62, color: '#6750A4', level: 0, selected: chromeSelected },
          { label: 'Firefox', value: 38, color: '#B3261E', level: 0 },
          { label: 'v97', value: 40, color: '#7E67B8', level: 1, parent: 0 },
          { label: 'v96', value: 22, color: '#9B86C9', level: 1, parent: 0 },
          { label: 'vFF', value: 38, color: '#C2564F', level: 1, parent: 1 },
        ],
      });
    const base = computePieLayout(nested(false), theme, 500, 500);
    const sel = computePieLayout(nested(true), theme, 500, 500);
    const delta = (di: number) => {
      const b = base.slices.find((s) => s.dataIndex === di)!;
      const s = sel.slices.find((x) => x.dataIndex === di)!;
      return { dx: s.cx - b.cx, dy: s.cy - b.cy };
    };
    const chrome = delta(0);
    // Chrome explodes out of the ring...
    expect(Math.hypot(chrome.dx, chrome.dy)).toBeGreaterThan(SELECT_OFFSET * 0.8);
    // ...and its version children move by the SAME vector — one rigid wedge, not a
    // parent sliding out from under a ring that stayed put.
    expect(delta(2).dx).toBeCloseTo(chrome.dx, 3);
    expect(delta(2).dy).toBeCloseTo(chrome.dy, 3);
    expect(delta(3).dx).toBeCloseTo(chrome.dx, 3);
    // ...the OTHER family (and its child) doesn't move.
    expect(Math.hypot(delta(1).dx, delta(1).dy)).toBeCloseTo(0, 3);
    expect(Math.hypot(delta(4).dx, delta(4).dy)).toBeCloseTo(0, 3);
    // ...and v97's leader label rides along with its slice.
    const lbl = (scene: typeof base) => scene.texts.find((t) => t.key === 'pl-2')!;
    expect(lbl(sel).x - lbl(base).x).toBeCloseTo(chrome.dx, 3);
    expect(lbl(sel).y - lbl(base).y).toBeCloseTo(chrome.dy, 3);
  });

  it('spreads adjacent OUTER-ring leader labels apart so they do not overlap', () => {
    const s = computePieLayout(
      baseSpec({
        innerRadius: '40%',
        outerRadius: '80%',
        showLabels: true,
        highlight: 'none',
        data: [
          { label: 'Safari', value: 100, color: '#6750A4', level: 0 },
          { label: 'v15.1 · 2.29%', value: 70, color: '#7E67B8', level: 1, parent: 0 },
          { label: 'v15.2 · 2.01%', value: 8, color: '#8B77BF', level: 1, parent: 0 },
          { label: 'Other · 7.15%', value: 7, color: '#9B86C9', level: 1, parent: 0 },
          { label: 'v95.0 · 0.54%', value: 6, color: '#AC97D4', level: 1, parent: 0 },
          { label: 'v96.0 · 0.5%', value: 5, color: '#BCA8DF', level: 1, parent: 0 },
        ],
      }),
      theme,
      500,
      500,
    );
    const lineH = theme.labelSize * 1.45;
    // The four thin versions all get an outer leader label...
    const outer = ([2, 3, 4, 5].map((di) => s.texts.find((t) => t.key === `pl-${di}`)).filter(Boolean) as {
      x: number;
      y: number;
      align?: string;
    }[]);
    expect(outer.length).toBe(4);
    // ...and on each side, consecutive labels sit at least a line-height apart —
    // without the relaxation the crowded thin slices would print over each other.
    for (const right of [true, false]) {
      const col = outer.filter((l) => (l.align === 'start') === right).sort((a, b) => a.y - b.y);
      for (let k = 1; k < col.length; k++) {
        expect(col[k].y - col[k - 1].y).toBeGreaterThanOrEqual(lineH - 0.5);
      }
    }
  });

  it('drops zero/hidden data from the ring', () => {
    const s = computePieLayout(baseSpec({ data: [
      { label: 'A', value: 50, color: '#6750A4' },
      { label: 'B', value: 0, color: '#B3261E' },
      { label: 'C', value: 30, color: '#7D5260', hidden: true },
      { label: 'D', value: 20, color: '#625B71' },
    ] }), theme, 400, 400);
    expect(s.slices.length).toBe(2); // only A + D
  });

  it('populates a legend unless legend is "none"', () => {
    expect(computePieLayout(baseSpec({ legend: 'right' }), theme, 400, 400).legend.length).toBe(3);
    expect(computePieLayout(baseSpec({ legend: 'none' }), theme, 400, 400).legend.length).toBe(0);
  });
});

describe('slice separation and hover treatment', () => {
  const data = [
    { label: 'A', value: 60, color: '#6750A4' },
    { label: 'B', value: 40, color: '#B3261E' },
  ];
  const spec = (over: Partial<PieChartSpec> = {}): PieChartSpec => ({
    data,
    innerRadius: 0,
    outerRadius: '80%',
    startAngleDeg: 90,
    endAngleDeg: -270,
    paddingAngleDeg: 0,
    cornerRadius: 0,
    showLabels: false,
    highlight: 'slice',
    legend: 'none',
    valueFormatter: (v: number) => String(v),
    ...over,
  });

  it('separates flush slices with a radial hairline, not a gap', () => {
    const scene = computePieLayout(spec(), theme, 300, 300);
    // The slices' own angles still MEET — the separation is taken out of each
    // wedge when it is drawn, so no value is lost to it the way a padding angle
    // would lose one.
    expect(scene.slices[0].endAngle).toBeCloseTo(scene.slices[1].startAngle, 5);
    expect(scene.slices[0].gap).toBeGreaterThan(0);
  });

  it('keeps the separator radial, so the circumference stays clean', () => {
    const scene = computePieLayout(spec(), theme, 300, 300);
    const cx = scene.plot.x + scene.plot.width / 2;
    const cy = scene.plot.y + scene.plot.height / 2;
    for (const l of scene.lines) {
      const [a, b] = l.points;
      // Collinear with the centre — an arc segment would ring the pie in
      // surface colour and soften its edge. A cross product rather than an
      // angle comparison, because on a pie the inner end IS the centre, where
      // an angle is undefined.
      const cross = (a.x - cx) * (b.y - cy) - (a.y - cy) * (b.x - cx);
      const r = Math.hypot(b.x - cx, b.y - cy);
      expect(Math.abs(cross) / (r * r)).toBeLessThan(0.01);
      expect(l.points).toHaveLength(2);
    }
  });

  it('draws no separator for a single slice', () => {
    const scene = computePieLayout(spec({ data: [{ label: 'Solo', value: 1, color: '#6750A4' }] }), theme, 300, 300);
    // One wedge has no neighbour; a lone radial line at 12 o'clock is a scar.
    expect(scene.lines).toHaveLength(0);
  });

  it('does not move the hovered slice', () => {
    const rest = computePieLayout(spec(), theme, 300, 300);
    const hovered = computePieLayout(spec({ highlightIndex: 0 }), theme, 300, 300);
    const at = (sc: typeof rest, i: number) => sc.slices.filter((s) => s.dataIndex === i).pop()!;
    // Displacing what the pointer is on makes the pointer leave it, and breaks
    // the ring the eye reads proportions from.
    expect(at(hovered, 0).cx).toBeCloseTo(at(rest, 0).cx, 5);
    expect(at(hovered, 0).cy).toBeCloseTo(at(rest, 0).cy, 5);
  });

  it('gives the hovered slice a pill band just outside the ring', () => {
    const scene = computePieLayout(spec({ highlightIndex: 0 }), theme, 300, 300);
    const rim = scene.slices.find((s) => s.pill)!;
    const face = scene.slices.find((s) => s.dataIndex === 0 && !s.pill)!;
    expect(rim).toBeTruthy();
    // A band clear of the face, not a wedge behind it: drawn behind, it showed
    // through wherever the face's rounded corners curved away, so it appeared
    // to wrap around the slice's ends.
    expect(rim.innerR).toBeGreaterThan(face.outerR);
    expect(rim.outerR).toBeGreaterThan(rim.innerR);
    expect(rim.pill).toBe(true);
  });

  it('leaves a gap between the slice and its band', () => {
    const scene = computePieLayout(spec({ highlightIndex: 0 }), theme, 300, 300);
    const rim = scene.slices.find((s) => s.pill)!;
    const face = scene.slices.find((s) => s.dataIndex === 0 && !s.pill)!;
    // Touching, the band read as the slice's own edge thickening rather than a
    // separate marker.
    expect(rim.innerR - face.outerR).toBeGreaterThan(1);
  });

  it('scales the gap with the tween so it does not pop in', () => {
    const at = (t: number) => {
      const sc = computePieLayout(spec({ highlightIndex: 0, highlightT: t }), theme, 300, 300);
      const rim = sc.slices.find((s) => s.pill)!;
      const face = sc.slices.find((s) => s.dataIndex === 0 && !s.pill)!;
      return rim.innerR - face.outerR;
    };
    expect(at(0.5)).toBeCloseTo(at(1) / 2, 5);
  });

  it('insets the band so its rounded caps finish with the slice', () => {
    const scene = computePieLayout(spec({ highlightIndex: 0 }), theme, 300, 300);
    const rim = scene.slices.find((s) => s.pill)!;
    const face = scene.slices.find((s) => s.dataIndex === 0 && !s.pill)!;
    // Sharing the face's angles would overshoot twice over: the band sits at a
    // larger radius, so the same sweep is physically longer, and its round caps
    // add half a thickness beyond each end.
    const inside = (a: number, lo: number, hi: number) => a > Math.min(lo, hi) && a < Math.max(lo, hi);
    expect(inside(rim.startAngle, face.startAngle, face.endAngle)).toBe(true);
    expect(inside(rim.endAngle, face.startAngle, face.endAngle)).toBe(true);
  });

  it('fades the slices the pointer is not on', () => {
    const rest = computePieLayout(spec(), theme, 300, 300);
    const hovered = computePieLayout(spec({ highlightIndex: 0 }), theme, 300, 300);
    const other = (sc: typeof rest) => sc.slices.find((s) => s.dataIndex === 1)!;
    expect(other(hovered).color).not.toBe(other(rest).color);
    // ...and the hovered one keeps its own colour.
    expect(hovered.slices.filter((s) => s.dataIndex === 0).pop()!.color).toBe('#6750A4');
  });

  it('leaves everything alone when highlight is off', () => {
    const scene = computePieLayout(spec({ highlight: 'none', highlightIndex: 0 }), theme, 300, 300);
    expect(scene.slices.filter((s) => s.dataIndex === 0)).toHaveLength(1);
    expect(scene.slices.find((s) => s.dataIndex === 1)!.color).toBe('#B3261E');
  });

  it('still explodes a selected slice — a pinned state, not a pointer one', () => {
    const scene = computePieLayout(
      spec({ data: [{ ...data[0], selected: true }, data[1]] }),
      theme,
      300,
      300,
    );
    const rest = computePieLayout(spec(), theme, 300, 300);
    const moved = scene.slices.find((s) => s.dataIndex === 0)!;
    const still = rest.slices.find((s) => s.dataIndex === 0)!;
    expect(Math.hypot(moved.cx - still.cx, moved.cy - still.cy)).toBeGreaterThan(1);
  });
});

describe('separators during the intro animation', () => {
  const scene = () =>
    computePieLayout(
      {
        data: [
          { label: 'A', value: 60, color: '#6750A4' },
          { label: 'B', value: 40, color: '#B3261E' },
        ],
        innerRadius: 0,
        outerRadius: '80%',
        startAngleDeg: 90,
        endAngleDeg: -270,
        paddingAngleDeg: 0,
        cornerRadius: 0,
        showLabels: false,
        highlight: 'slice',
        legend: 'none',
        valueFormatter: (v: number) => String(v),
      },
      theme,
      300,
      300,
    );

  it('grows the separators with the ring instead of sliding them up the plot', () => {
    const target = scene();
    const mid = easeScene(target, 0.4);
    const cx = target.plot.x + target.plot.width / 2;
    const cy = target.plot.y + target.plot.height / 2;
    expect(mid.lines).toHaveLength(target.lines.length);
    mid.lines.forEach((l, i) => {
      l.points.forEach((p, k) => {
        const t = target.lines[i].points[k];
        // Same DIRECTION from the centre — the lift bug moved them off their
        // own radius, so they travelled in from elsewhere and settled.
        const cross = (p.x - cx) * (t.y - cy) - (p.y - cy) * (t.x - cx);
        const r = Math.hypot(t.x - cx, t.y - cy);
        if (r > 1) expect(Math.abs(cross) / (r * r)).toBeLessThan(0.01);
        // ...but shorter, because the ring itself is still growing.
        expect(Math.hypot(p.x - cx, p.y - cy)).toBeLessThanOrEqual(r + 0.001);
      });
    });
    // ...and the slices genuinely are mid-grow (smaller radius), so this is not
    // just the animation doing nothing.
    expect(mid.slices[0].outerR).toBeLessThan(target.slices[0].outerR);
  });

  it('grows every wedge from the centre by the same factor (no petal stagger)', () => {
    const target = scene();
    const early = easeScene(target, 0.3);
    const reach = (i: number) => early.slices[i].outerR / target.slices[i].outerR;
    // The whole ring scales up from the centre in lockstep — the unified
    // grow-and-fade entrance, not a staggered bloom.
    expect(reach(0)).toBeGreaterThan(0);
    expect(reach(0)).toBeLessThan(1);
    expect(reach(0)).toBeCloseTo(reach(1), 6);
  });

  it('holds each wedge at full angular width while the radius grows', () => {
    const target = scene();
    const early = easeScene(target, 0.3);
    const widthFrac =
      Math.abs(early.slices[0].endAngle - early.slices[0].startAngle) /
      Math.abs(target.slices[0].endAngle - target.slices[0].startAngle);
    const reachFrac = early.slices[0].outerR / target.slices[0].outerR;
    // Angles are already final and only the radius is partway: the donut scales
    // up as one rather than sweeping open.
    expect(widthFrac).toBeCloseTo(1, 6);
    expect(reachFrac).toBeLessThan(1);
  });

  it('scales all slices together rather than staggering them around the ring', () => {
    const target = scene();
    const early = easeScene(target, 0.25);
    const reachFrac = (sc: typeof target, i: number) => sc.slices[i].outerR / target.slices[i].outerR;
    // No wedge leads or lags — every slice is at the same radius fraction.
    expect(reachFrac(early, 0)).toBeCloseTo(reachFrac(early, 1), 6);
  });

  it('lands every slice fully swept at the end', () => {
    const target = scene();
    const done = easeScene(target, 1);
    done.slices.forEach((s, i) => {
      expect(s.endAngle).toBeCloseTo(target.slices[i].endAngle, 6);
      expect(s.outerR).toBeCloseTo(target.slices[i].outerR, 6);
    });
  });

  it('does not trim them by x either', () => {
    const target = scene();
    const half = revealScene(target, 0.5);
    half.lines.forEach((l, i) => expect(l.points).toHaveLength(target.lines[i].points.length));
  });

  it('carries the separation on the slice, not as a line over it', () => {
    const s = scene();
    // Nothing is painted over the joins at all now — the gap is cut out of each
    // wedge's own geometry, so there is no stroke to blend with the two
    // antialiased shapes it used to sit between.
    expect(s.lines).toHaveLength(0);
    for (const sl of s.slices) {
      expect(sl.gap).toBeGreaterThan(0);
      expect(sl.gapColor).toBeTruthy();
      // A constant-width gap closes on itself before the centre, so the wedges
      // stop on a small hub circle instead of running to a point.
      expect(sl.innerR).toBeGreaterThan(0);
    }
  });

  it('needs no hub on a donut — the hole already ends every edge', () => {
    const s = computePieLayout(baseSpec({ innerRadius: '50%' }), theme, 300, 300);
    expect(s.lines).toHaveLength(0);
    const hole = Math.min(...s.slices.map((sl) => sl.innerR));
    expect(hole).toBeGreaterThan(20);
    for (const sl of s.slices) expect(sl.innerR).toBeCloseTo(hole, 6);
  });

  it('sizes the hub off the NARROWEST slice, and shares it', () => {
    const s = computePieLayout(
      baseSpec({
        data: [
          { label: 'A', value: 90, color: '#6750A4' },
          { label: 'B', value: 8, color: '#B3261E' },
          { label: 'C', value: 2, color: '#7D5260' },
        ],
      }),
      theme,
      300,
      300,
    );
    // Slices ending at three different radii is the ragged middle this avoids.
    const radii = s.slices.map((sl) => sl.innerR);
    expect(Math.max(...radii)).toBeCloseTo(Math.min(...radii), 6);
    expect(radii[0]).toBeGreaterThan(0);
  });
});

describe('animated hover strength', () => {
  const base = {
    data: [
      { label: 'A', value: 60, color: '#6750A4' },
      { label: 'B', value: 40, color: '#B3261E' },
    ],
    innerRadius: 0,
    outerRadius: '80%',
    startAngleDeg: 90,
    endAngleDeg: -270,
    paddingAngleDeg: 0,
    cornerRadius: 0,
    showLabels: false,
    highlight: 'slice' as const,
    legend: 'none' as const,
    valueFormatter: (v: number) => String(v),
    highlightIndex: 0,
  };
  const rimOf = (t?: number) => {
    const sc = computePieLayout({ ...base, highlightT: t }, theme, 300, 300);
    // The band is appended after every ring, so it is found by `pill`, not by
    // sitting next to the face it belongs to.
    const band = sc.slices.find((s) => s.pill);
    return band ? band.outerR - band.innerR : 0;
  };

  it('scales the rim with the tween, so the state change is not a jump', () => {
    const full = rimOf(1);
    expect(full).toBeGreaterThan(0);
    expect(rimOf(0.5)).toBeCloseTo(full / 2, 5);
    expect(rimOf(0)).toBe(0);
  });

  it('emits no rim at all once the tween has fully unwound', () => {
    const sc = computePieLayout({ ...base, highlightT: 0 }, theme, 300, 300);
    // One slice per datum: a leftover zero-height band would still cost a fill.
    expect(sc.slices.filter((s) => s.pill)).toHaveLength(0);
    expect(sc.slices).toHaveLength(2);
  });

  it('defaults to fully applied when no strength is given', () => {
    expect(rimOf(undefined)).toBeCloseTo(rimOf(1), 5);
  });

  it('fades the other slices by the same strength', () => {
    const at = (t: number) =>
      computePieLayout({ ...base, highlightT: t }, theme, 300, 300).slices.find((s) => s.dataIndex === 1)!.color;
    // Untouched at 0, and progressively faded as the tween runs.
    expect(at(0)).toBe('#B3261E');
    expect(at(1)).not.toBe(at(0.5));
  });

  it('carries the corner radius onto the slice', () => {
    const sc = computePieLayout({ ...base, cornerRadius: 6, highlightIndex: -1 }, theme, 300, 300);
    expect(sc.slices.every((s) => s.cornerRadius === 6)).toBe(true);
  });
});

describe('fade travelling around the ring', () => {
  const four = [
    { label: 'A', value: 25, color: '#6750A4' },
    { label: 'B', value: 25, color: '#7D5260' },
    { label: 'C', value: 25, color: '#625B71' },
    { label: 'D', value: 25, color: '#B3261E' },
  ];
  const at = (t: number) =>
    computePieLayout(
      {
        data: four,
        innerRadius: 0,
        outerRadius: '80%',
        startAngleDeg: 90,
        endAngleDeg: -270,
        paddingAngleDeg: 0,
        cornerRadius: 0,
        showLabels: false,
        highlight: 'slice',
        legend: 'none',
        valueFormatter: String,
        highlightIndex: 0,
        highlightT: t,
      },
      theme,
      300,
      300,
    );
  const colourOf = (t: number, idx: number) =>
    at(t).slices.filter((s) => s.dataIndex === idx).pop()!.color;

  it('fades a neighbour before the far side', () => {
    // Mid-tween the ring should be part-way through, not switched wholesale:
    // B (next to the hovered A) has started fading while C (opposite) has not
    // gone as far.
    const b = colourOf(0.35, 1);
    const c = colourOf(0.35, 2);
    expect(b).not.toBe('#7D5260');
    expect(c).toBe('#625B71');
  });

  it('lands every slice on the same state once settled', () => {
    // The stagger exists only during the transition — at rest nothing should
    // be left half-faded.
    const full = at(1);
    // The hover BAND is not one of them: it is the highlight itself, drawn in
    // the hovered slice's own colour, and it was only ever matching this by
    // accident of having been translucent.
    const faded = full.slices.filter((s) => !s.pill && s.dataIndex !== 0).map((s) => s.color);
    expect(faded.every((c) => c.startsWith('rgba('))).toBe(true);
    // ...and at zero strength every slice is its own colour again.
    expect(colourOf(0, 1)).toBe('#7D5260');
    expect(colourOf(0, 2)).toBe('#625B71');
  });

  it('does not stagger when nothing is hovered', () => {
    const none = computePieLayout(
      {
        data: four, innerRadius: 0, outerRadius: '80%', startAngleDeg: 90, endAngleDeg: -270,
        paddingAngleDeg: 0, cornerRadius: 0, showLabels: false, highlight: 'slice',
        legend: 'none', valueFormatter: String, highlightIndex: -1, highlightT: 0.5,
      },
      theme, 300, 300,
    );
    expect(none.slices.map((s) => s.color)).toEqual(four.map((d) => d.color));
  });
});

describe('labelMode', () => {
  const build = (over: Record<string, unknown>) =>
    computePieLayout(
      {
        data: [
          { label: 'US', value: 60, color: '#6750A4' },
          { label: 'UK', value: 40, color: '#7D5260' },
        ],
        innerRadius: '60%', outerRadius: '85%', startAngleDeg: 90, endAngleDeg: -270,
        paddingAngleDeg: 0, cornerRadius: 0, showLabels: true, highlight: 'none',
        valueFormatter: (v: number) => `${v} TWh`, ...over,
      } as never,
      theme, 300, 300,
    );
  const labels = (sc: ReturnType<typeof build>) =>
    sc.texts.filter((t) => t.key?.startsWith('pl-')).map((t) => t.text);

  it('defaults to the value when a legend already names the slices', () => {
    expect(labels(build({ legend: 'bottom' }))).toEqual(['60 TWh', '40 TWh']);
  });

  it('defaults to both when there is no legend to name them', () => {
    expect(labels(build({ legend: 'none' }))).toEqual(['US · 60 TWh', 'UK · 40 TWh']);
  });

  it('takes the name alone when asked — for a race, where a changing value is unreadable', () => {
    expect(labels(build({ legend: 'none', labelMode: 'name' }))).toEqual(['US', 'UK']);
  });

  it('overrides the placement default in either direction', () => {
    expect(labels(build({ legend: 'bottom', labelMode: 'both' }))).toEqual(['US · 60 TWh', 'UK · 40 TWh']);
    expect(labels(build({ legend: 'none', labelMode: 'value' }))).toEqual(['60 TWh', '40 TWh']);
  });
});

describe('nested rings', () => {
  // Flattened as the component flattens it: level + parent, not nesting.
  const nested = [
    { label: 'Chrome', value: 60, color: '#6750A4', level: 0 },
    { label: 'Safari', value: 40, color: '#7D5260', level: 0 },
    { label: 'v97', value: 45, color: '#8A7BC0', level: 1, parent: 0 },
    { label: 'v96', value: 15, color: '#A99AD4', level: 1, parent: 0 },
    { label: 'v15', value: 40, color: '#9A7480', level: 1, parent: 1 },
  ];
  const build = (over: Record<string, unknown> = {}) =>
    computePieLayout(
      {
        data: nested, innerRadius: '30%', outerRadius: '90%', startAngleDeg: 90, endAngleDeg: -270,
        paddingAngleDeg: 0, cornerRadius: 0, showLabels: false, highlight: 'slice',
        legend: 'none', valueFormatter: String, ...over,
      } as never,
      theme, 400, 400,
    );
  const at = (sc: ReturnType<typeof build>, i: number) => sc.slices.filter((s) => s.dataIndex === i && !s.pill).pop()!;
  const sweep = (sc: ReturnType<typeof build>, i: number) => Math.abs(at(sc, i).endAngle - at(sc, i).startAngle);

  it("gives children exactly their parent's arc, split between them", () => {
    const sc = build();
    // v97 + v96 fill Chrome's arc precisely — an outer ring that disagreed with
    // the ring inside it would be reporting two different totals.
    expect(sweep(sc, 2) + sweep(sc, 3)).toBeCloseTo(sweep(sc, 0), 6);
    expect(at(sc, 2).startAngle).toBeCloseTo(at(sc, 0).startAngle, 6);
    expect(at(sc, 3).endAngle).toBeCloseTo(at(sc, 0).endAngle, 6);
  });

  it('splits children in proportion to each other, not to the parent value', () => {
    // Safari is 40 and its single child is 40, but the ratio is what matters:
    // one child takes the whole arc regardless of the number it carries.
    const sc = build();
    expect(sweep(sc, 4)).toBeCloseTo(sweep(sc, 1), 6);
    // Chrome's 45:15 children split its arc 3:1.
    expect(sweep(sc, 2) / sweep(sc, 3)).toBeCloseTo(3, 4);
  });

  it('puts each level in its own radial band, innermost first', () => {
    const sc = build();
    expect(at(sc, 2).innerR).toBeGreaterThan(at(sc, 0).outerR);
    expect(at(sc, 0).innerR).toBeLessThan(at(sc, 0).outerR);
    expect(at(sc, 2).outerR).toBeGreaterThan(at(sc, 2).innerR);
  });

  it("keeps a hovered child's family lit", () => {
    const sc = build({ highlightIndex: 2, highlightT: 1 });
    // Chrome (the parent) and v97 (hovered) keep their colour; the unrelated
    // family fades. Dimming the parent would say the two were unrelated.
    expect(at(sc, 0).color).toBe('#6750A4');
    expect(at(sc, 2).color).toBe('#8A7BC0');
    expect(at(sc, 1).color).not.toBe('#7D5260');
  });

  it('leaves a single-level pie as one unbroken band', () => {
    const flat = build({ data: [{ label: 'A', value: 60, color: '#6750A4' }, { label: 'B', value: 40, color: '#7D5260' }] });
    const faces = flat.slices.filter((s) => !s.pill);
    expect(faces).toHaveLength(2);
    // No level gap is taken when there is only one level to separate.
    const nestedOuter = build().slices.filter((s) => !s.pill && s.dataIndex === 0)[0];
    expect(faces[0].outerR - faces[0].innerR).toBeGreaterThan(nestedOuter.outerR - nestedOuter.innerR);
  });

  it('leaves a gap between the rings', () => {
    const sc = build();
    // Flush, the two levels merge into one thick ring and the hierarchy the
    // nesting exists to show is lost.
    expect(at(sc, 2).innerR - at(sc, 0).outerR).toBeGreaterThan(2);
  });

  it('still reaches the outer radius that was asked for', () => {
    const sc = build();
    // The gaps come out of the space BETWEEN rings, never off the outside.
    const flat = build({ data: [{ label: 'A', value: 1, color: '#6750A4' }] });
    expect(at(sc, 2).outerR).toBeCloseTo(flat.slices.filter((s) => !s.pill)[0].outerR, 4);
  });
});

describe('a slice with no breakdown', () => {
  const mixed = [
    { label: 'Chrome', value: 60, color: '#6750A4', level: 0 },
    { label: 'Other', value: 40, color: '#7D5260', level: 0 },
    { label: 'v97', value: 60, color: '#8A7BC0', level: 1, parent: 0 },
  ];
  const sc = () =>
    computePieLayout(
      {
        data: mixed, innerRadius: '30%', outerRadius: '90%', startAngleDeg: 90, endAngleDeg: -270,
        paddingAngleDeg: 0, cornerRadius: 0, showLabels: false, highlight: 'none',
        legend: 'none', valueFormatter: String,
      } as never,
      theme, 400, 400,
    );
  const face = (i: number) => sc().slices.filter((s) => s.dataIndex === i && !s.pill).pop()!;

  it('reaches the outer radius instead of leaving a hole in the ring', () => {
    // Without this the outer ring is drawn with a gap wherever a category has
    // no children, and the chart looks like it lost a slice.
    expect(face(1).outerR).toBeCloseTo(face(2).outerR, 6);
    expect(face(1).outerR).toBeGreaterThan(face(0).outerR);
  });

  it('still starts on the inner ring, so the hierarchy reads', () => {
    expect(face(1).innerR).toBeCloseTo(face(0).innerR, 6);
  });
});

describe('chart engine — pie layout: partial sweeps and variable radius', () => {
  const radiusOf = (s: { cx: number; cy: number; outerR: number }) => s.outerR;

  it('fits a half-donut to the sector it paints, not to a whole circle', () => {
    // A wide, short box is where it shows: a full circle is capped by the
    // height, while the top half only needs half as much of it.
    const full = computePieLayout(baseSpec({ innerRadius: '55%' }), theme, 600, 300);
    const half = computePieLayout(
      baseSpec({ innerRadius: '55%', startAngleDeg: 180, endAngleDeg: 0 }),
      theme,
      600,
      300,
    );
    expect(radiusOf(half.slices[0])).toBeGreaterThan(radiusOf(full.slices[0]) * 1.5);
  });

  it('puts the half-donut ring centre on its flat side', () => {
    const s = computePieLayout(
      baseSpec({ innerRadius: '55%', startAngleDeg: 180, endAngleDeg: 0 }),
      theme,
      400,
      400,
    );
    // Nothing is painted below the centre, so the centre sits well below the
    // middle of the box rather than at it.
    expect(s.slices[0].cy).toBeGreaterThan(200);
  });

  it('anchors the centre slot inside the hole, above a half-donut centre', () => {
    const s = computePieLayout(
      baseSpec({ innerRadius: '55%', startAngleDeg: 180, endAngleDeg: 0 }),
      theme,
      400,
      400,
    );
    expect(s.pieCenterSlot!.y).toBeLessThan(s.slices[0].cy);
    // …and the usable box is the inscribed rectangle: as wide as a full
    // circle's inscribed square, half as tall.
    expect(s.pieHoleSize).toBeGreaterThan(0);
    expect(s.pieHoleHeight).toBeCloseTo(s.pieHoleSize! / 2, 5);
  });

  it('leaves a full circle centred, with the slot at the ring centre', () => {
    const s = computePieLayout(baseSpec({ innerRadius: '50%' }), theme, 400, 400);
    expect(s.pieCenterSlot!.x).toBeCloseTo(s.slices[0].cx, 5);
    expect(s.pieCenterSlot!.y).toBeCloseTo(s.slices[0].cy, 5);
    expect(s.pieHoleHeight).toBeCloseTo(s.pieHoleSize!, 5);
  });

  it('reports no usable centre box for a solid pie', () => {
    const s = computePieLayout(baseSpec(), theme, 400, 400);
    expect(s.pieHoleSize).toBe(0);
  });

  it('scales a slice’s outer radius by its own `radius`', () => {
    const s = computePieLayout(
      baseSpec({
        data: [
          { label: 'A', value: 1, color: '#6750A4', radius: 1 },
          { label: 'B', value: 1, color: '#B3261E', radius: 0.5 },
          { label: 'C', value: 1, color: '#7D5260' },
        ],
      }),
      theme,
      400,
      400,
    );
    const [a, b, c] = s.slices;
    expect(b.outerR).toBeCloseTo(a.outerR / 2, 5);
    // Omitted means full radius, so a chart where only some slices carry the
    // second dimension still reads.
    expect(c.outerR).toBeCloseTo(a.outerR, 5);
  });

  it('floors a tiny radius so the slice stays distinguishable from missing data', () => {
    const s = computePieLayout(
      baseSpec({
        data: [
          { label: 'A', value: 1, color: '#6750A4', radius: 1 },
          { label: 'B', value: 1, color: '#B3261E', radius: 0 },
        ],
      }),
      theme,
      400,
      400,
    );
    expect(s.slices[1].outerR).toBeCloseTo(s.slices[0].outerR * 0.15, 5);
  });

  it('fills slices with an outward gradient only when asked', () => {
    const plain = computePieLayout(baseSpec(), theme, 400, 400);
    expect(plain.slices[0].gradient).toBeUndefined();
    const grad = computePieLayout(baseSpec({ gradient: true }), theme, 400, 400);
    expect(grad.slices[0].gradient).toEqual({ from: expect.any(String), to: '#6750A4' });
  });
});

describe('chart engine — drill transition', () => {
  const level = (values: number[]) =>
    computePieLayout(
      baseSpec({ data: values.map((v, i) => ({ label: `s${i}`, value: v, color: '#6750A4' })) }),
      theme,
      400,
      400,
    );
  const parent = () => level([50, 30, 20]);
  const child = () => level([60, 25, 15]);
  const spans = (s: ReturnType<typeof parent>) =>
    s.slices.map((sl) => Math.abs(sl.endAngle - sl.startAngle));
  const totalSpan = (s: ReturnType<typeof parent>) => spans(s).reduce((a, b) => a + b, 0);

  it('is the outer level exactly at p=0', () => {
    const a = parent();
    const split = splitScene(a, child(), 1, 0)!;
    // The wedge that is about to open still has its own span, and its siblings
    // still have theirs — nothing has moved yet.
    const byIndex = new Map(split.base.slices.map((sl) => [sl.dataIndex, sl]));
    // Siblings are laid out FOLLOWING the pivot, so the one that came before it
    // wraps a full turn round — the same place on the ring, a different number.
    const turn = (x: number) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    a.slices.forEach((sl) => {
      expect(turn(byIndex.get(sl.dataIndex)!.startAngle)).toBeCloseTo(turn(sl.startAngle), 6);
      expect(turn(byIndex.get(sl.dataIndex)!.endAngle)).toBeCloseTo(turn(sl.endAngle), 6);
    });
    expect(split.overAlpha).toBe(0);
  });

  it('is the inner level exactly at p=1', () => {
    const c = child();
    const split = splitScene(parent(), c, 1, 1)!;
    c.slices.forEach((sl, i) => {
      expect(split.over.slices[i].startAngle).toBeCloseTo(sl.startAngle, 6);
      expect(split.over.slices[i].endAngle).toBeCloseTo(sl.endAngle, 6);
    });
    expect(split.overAlpha).toBe(1);
  });

  it('opens the pivot toward the whole ring while its siblings close', () => {
    const a = parent();
    const full = totalSpan(a);
    const pivotSpan = Math.abs(a.slices[1].endAngle - a.slices[1].startAngle);
    const half = splitScene(a, child(), 1, 0.5)!;
    const opened = half.base.slices.find((sl) => sl.dataIndex === 1)!;
    const w = Math.abs(opened.endAngle - opened.startAngle);
    expect(w).toBeGreaterThan(pivotSpan);
    expect(w).toBeLessThan(full);
    // Whatever the pivot took, the siblings gave up — the ring stays whole.
    const rest = half.base.slices.filter((sl) => sl.dataIndex !== 1);
    const restSpan = rest.reduce((acc, sl) => acc + Math.abs(sl.endAngle - sl.startAngle), 0);
    expect(w + restSpan).toBeCloseTo(full, 4);
  });

  it('keeps the inner level filling exactly the span the pivot has opened', () => {
    const a = parent();
    for (const p of [0, 0.3, 0.7, 1]) {
      const split = splitScene(a, child(), 1, p)!;
      const opened = split.base.slices.find((sl) => sl.dataIndex === 1)!;
      const inner = split.over.slices;
      expect(inner[0].startAngle).toBeCloseTo(opened.startAngle, 4);
      expect(inner[inner.length - 1].endAngle).toBeCloseTo(opened.endAngle, 4);
    }
  });

  it('touches no radius — the split is angular, so nothing blooms', () => {
    const a = parent();
    const c = child();
    for (const p of [0.2, 0.5, 0.9]) {
      const split = splitScene(a, c, 1, p)!;
      for (const sl of split.base.slices) {
        const src = a.slices.find((o) => o.dataIndex === sl.dataIndex)!;
        expect(sl.outerR).toBe(src.outerR);
        expect(sl.innerR).toBe(src.innerR);
        expect(sl.cx).toBe(src.cx);
      }
      split.over.slices.forEach((sl, i) => {
        expect(sl.outerR).toBe(c.slices[i].outerR);
        expect(sl.cx).toBe(c.slices[i].cx);
      });
    }
  });

  it('rotates the opening span onto the ring start, so the inner level lands square', () => {
    // Pivot on the LAST slice, which starts three-quarters of the way round.
    const a = parent();
    const c = child();
    const split = splitScene(a, c, 2, 1)!;
    expect(split.over.slices[0].startAngle).toBeCloseTo(c.slices[0].startAngle, 6);
  });

  it('drops the labels and leaders it would otherwise misplace', () => {
    const split = splitScene(parent(), child(), 1, 0.5)!;
    expect(split.base.texts).toHaveLength(0);
    expect(split.over.gridlines).toHaveLength(0);
  });
});

describe('chart engine — slice label contrast while dimmed', () => {
  const spec = (over = {}) =>
    baseSpec({
      showLabels: true,
      legend: 'bottom',
      highlight: 'slice' as const,
      data: [
        { label: 'A', value: 50, color: '#21005D' },
        { label: 'B', value: 50, color: '#21005D' },
      ],
      ...over,
    });

  it('re-contrasts a dimmed slice’s label against what is actually painted', () => {
    const lit = computePieLayout(spec(), theme, 400, 400);
    // Undimmed, a dark slice takes a white label.
    expect(lit.texts.find((t) => t.key === 'pl-1')!.color).toBe('#ffffff');
    // Hovering slice 0 fades slice 1 toward the (pale) surface. A label colour
    // read off the ORIGINAL fill would stay white and disappear.
    const dimmed = computePieLayout(spec({ highlightIndex: 0, highlightT: 1 }), theme, 400, 400);
    const other = dimmed.slices.find((s) => s.dataIndex === 1)!;
    expect(other.color).not.toBe('#21005D');
    expect(dimmed.texts.find((t) => t.key === 'pl-1')!.color).not.toBe('#ffffff');
  });
});

describe('chart engine — picking a slice out of the ring', () => {
  const at = (over: Record<string, unknown>) =>
    computePieLayout(
      baseSpec({
        data: [
          { label: 'A', value: 50, color: '#6750A4', ...over },
          { label: 'B', value: 50, color: '#B3261E' },
        ],
      }),
      theme,
      400,
      400,
    );
  const offset = (s: ReturnType<typeof at>) => {
    const c = s.pieCenter!;
    return Math.hypot(s.slices[0].cx - c.x, s.slices[0].cy - c.y);
  };

  it('sits a picked slice out along its own mid-angle', () => {
    expect(offset(at({}))).toBeCloseTo(0, 6);
    expect(offset(at({ selected: true }))).toBeCloseTo(SELECT_OFFSET, 6);
  });

  it('takes a part-way offset from `selectT`, so it can slide rather than jump', () => {
    expect(offset(at({ selected: true, selectT: 0.5 }))).toBeCloseTo(SELECT_OFFSET / 2, 6);
    // Mid-flight BACK: the flag is already off, but it has not arrived yet.
    expect(offset(at({ selected: false, selectT: 0.4 }))).toBeCloseTo(SELECT_OFFSET * 0.4, 6);
  });
});

describe('chart engine — how the band is split between rings', () => {
  const nested = (over: Record<string, unknown> = {}) =>
    computePieLayout(
      baseSpec({
        innerRadius: '30%',
        data: [
          { label: 'A', value: 60, color: '#6750A4' },
          { label: 'B', value: 40, color: '#B3261E' },
          { label: 'a1', value: 30, color: '#7D5260', parent: 0, level: 1 },
          { label: 'a2', value: 30, color: '#7D5260', parent: 0, level: 1 },
          { label: 'b1', value: 40, color: '#7D5260', parent: 1, level: 1 },
        ],
        ...over,
      }),
      theme,
      400,
      400,
    );
  const band = (s: ReturnType<typeof nested>, level: number) => {
    const sl = s.slices.find((x) => (level === 0 ? x.dataIndex < 2 : x.dataIndex >= 2))!;
    return sl.outerR - sl.innerR;
  };

  it('gives the inner ring more room than the outer by default', () => {
    const s = nested();
    // It labels INSIDE its own band and so has to hold a word; the outermost
    // labels on leaders and needs no more than its arc.
    expect(band(s, 0)).toBeGreaterThan(band(s, 1) * 1.2);
  });

  it('takes explicit weights, innermost first', () => {
    const s = nested({ ringWidths: [3, 1] });
    expect(band(s, 0) / band(s, 1)).toBeCloseTo(3, 1);
  });

  it('still ends the outermost ring exactly at the radius asked for', () => {
    for (const w of [undefined, [3, 1], [1, 4]]) {
      const s = nested(w ? { ringWidths: w } : {});
      const outer = Math.max(...s.slices.map((sl) => sl.outerR));
      const plain = computePieLayout(baseSpec({ innerRadius: '30%' }), theme, 400, 400);
      expect(outer).toBeCloseTo(plain.slices[0].outerR, 4);
    }
  });

  it('falls back per level, so a short array is not a cliff', () => {
    const s = nested({ ringWidths: [3] });
    expect(band(s, 0) / band(s, 1)).toBeCloseTo(3, 1);
  });
});

describe('chart engine — the paths only some configurations take', () => {
  const rows = [
    { label: 'Alpha', value: 40, color: '#6750A4' },
    { label: 'Beta', value: 35, color: '#B3261E' },
    { label: 'Gamma', value: 25, color: '#7D5260' },
  ];

  it('reserves the band ABOVE the ring for a top legend, not below it', () => {
    const bottom = computePieLayout(baseSpec({ data: rows, legend: 'bottom' }), theme, 400, 400);
    const top = computePieLayout(baseSpec({ data: rows, legend: 'top' }), theme, 400, 400);
    // Same band, opposite side: the ring sits lower when the legend is above it.
    expect(top.plot.y).toBeGreaterThan(bottom.plot.y);
    expect(top.plot.height).toBeCloseTo(bottom.plot.height, 4);
  });

  it('estimates the legend band by packing rows when nothing has measured it', () => {
    // Before the overlay reports back, the layout has to guess how many rows
    // the chips will wrap into — long labels take more than short ones.
    const short = computePieLayout(baseSpec({ data: rows, legend: 'bottom' }), theme, 300, 300);
    const long = computePieLayout(
      baseSpec({
        data: rows.map((d) => ({ ...d, label: `${d.label} a rather longer name than that` })),
        legend: 'bottom',
      }),
      theme,
      300,
      300,
    );
    expect(long.plot.height).toBeLessThan(short.plot.height);
    // …and a measured extent wins over the estimate.
    const measured = computePieLayout(baseSpec({ data: rows, legend: 'bottom', legendExtent: 120 }), theme, 300, 300);
    expect(measured.plot.height).toBeLessThan(short.plot.height);
  });

  it('pushes colliding outside labels apart', () => {
    // Two slivers side by side have nearly the same mid-angle, so their labels
    // land on the same spot unless something separates them.
    const s = computePieLayout(
      baseSpec({
        showLabels: true,
        legend: 'none',
        data: [
          { label: 'Big', value: 96, color: '#6750A4' },
          { label: 'Thin one', value: 2, color: '#B3261E' },
          { label: 'Thin two', value: 2, color: '#7D5260' },
        ],
      }),
      theme,
      400,
      400,
    );
    const ys = s.texts.filter((t) => t.key.startsWith('pl-')).map((t) => t.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(theme.labelSize);
  });

  it('gives the OUTER ring of a nested chart labels on leaders', () => {
    const s = computePieLayout(
      baseSpec({
        showLabels: true,
        legend: 'none',
        data: [
          { label: 'A', value: 60, color: '#6750A4' },
          { label: 'B', value: 40, color: '#B3261E' },
          { label: 'a1', value: 30, color: '#7D5260', parent: 0, level: 1 },
          { label: 'a2', value: 30, color: '#7D5260', parent: 0, level: 1 },
          { label: 'b1', value: 40, color: '#7D5260', parent: 1, level: 1 },
        ],
      }),
      theme,
      500,
      500,
    );
    // Three children, each with a leader from its own rim out to its label.
    const outer = s.texts.filter((t) => /^pl-[234]$/.test(t.key));
    expect(outer).toHaveLength(3);
    expect(s.gridlines.length).toBeGreaterThanOrEqual(3);
    // The inner ring names itself INSIDE its band instead.
    expect(s.texts.filter((t) => /^pl-[01]$/.test(t.key)).every((t) => t.align === 'center')).toBe(true);
  });

  it('places a subtitle under the title, and reserves room for both', () => {
    const titleOnly = computePieLayout(baseSpec({ data: rows, title: 'Sales' }), theme, 400, 400);
    const withSub = computePieLayout(baseSpec({ data: rows, title: 'Sales', subtitle: 'by region' }), theme, 400, 400);
    const sub = withSub.texts.find((t) => t.key === 'subtitle')!;
    const title = withSub.texts.find((t) => t.key === 'title')!;
    expect(sub).toBeDefined();
    expect(sub.y).toBeGreaterThan(title.y);
    // The ring gives up the room rather than being drawn over.
    expect(withSub.plot.y).toBeGreaterThan(titleOnly.plot.y);
  });
});

describe('chart engine — the awkward inputs', () => {
  const two = [
    { label: 'A', value: 60, color: '#6750A4' },
    { label: 'B', value: 40, color: '#B3261E' },
  ];
  const build = (over: Record<string, unknown> = {}, w = 400, h = 400) =>
    computePieLayout(baseSpec({ data: two, ...over }), theme, w, h);

  it('takes a radius as a number, a percentage, or refuses it', () => {
    // px, not a fraction of anything.
    expect(build({ outerRadius: 90 }).slices[0].outerR).toBeCloseTo(90, 4);
    // Nonsense falls back to 0 rather than propagating NaN through the geometry.
    for (const bad of [-10, Number.NaN, '-5%', 'wide']) {
      const s = build({ innerRadius: bad as never });
      expect(s.slices[0].innerR).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(s.slices[0].outerR)).toBe(true);
    }
  });

  it('reserves the gutter on the correct side for a left legend', () => {
    const left = build({ legend: 'left' });
    const right = build({ legend: 'right' });
    expect(left.plot.x).toBeGreaterThan(right.plot.x);
    // A measured extent is preferred over the estimate, on either side.
    expect(build({ legend: 'left', legendExtent: 60 }).plot.x).not.toBe(left.plot.x);
  });

  it('survives a padding angle wider than the ring itself', () => {
    // Capped at 90% of the sweep: past that the slices would run backwards.
    const s = build({ paddingAngleDeg: 240 });
    for (const sl of s.slices) {
      expect(Number.isFinite(sl.startAngle)).toBe(true);
      expect(sl.endAngle - sl.startAngle).toBeGreaterThan(0);
    }
  });

  it('draws nothing rather than dividing by zero when every value is zero', () => {
    const s = computePieLayout(
      baseSpec({ data: [{ label: 'A', value: 0, color: '#6750A4' }, { label: 'B', value: 0, color: '#B3261E' }] }),
      theme,
      400,
      400,
    );
    for (const sl of s.slices) expect(Number.isFinite(sl.startAngle)).toBe(true);
  });

  it('is unfazed by a parent index that points nowhere', () => {
    // A child whose parent was filtered out (or never existed) must not hang the
    // ancestor walk or land in a ring of its own.
    const s = computePieLayout(
      baseSpec({
        data: [
          { label: 'A', value: 60, color: '#6750A4' },
          { label: 'orphan', value: 40, color: '#B3261E', parent: 99, level: 1 },
        ],
        highlight: 'slice',
        highlightIndex: 0,
        highlightT: 1,
      }),
      theme,
      400,
      400,
    );
    expect(s.slices.length).toBeGreaterThan(0);
  });

  it('shortens a label that cannot fit, and shifts a column that runs off an edge', () => {
    // A narrow box with long names: the labels have to be both moved and cut.
    const s = computePieLayout(
      baseSpec({
        showLabels: true,
        legend: 'none',
        data: [
          { label: 'An extremely long category name here', value: 25, color: '#6750A4' },
          { label: 'Another extremely long category name', value: 25, color: '#B3261E' },
          { label: 'A third extremely long category name', value: 25, color: '#7D5260' },
          { label: 'A fourth extremely long category name', value: 25, color: '#625B71' },
        ],
      }),
      theme,
      220,
      220,
    );
    const labels = s.texts.filter((t) => t.key.startsWith('pl-'));
    expect(labels.some((t) => t.text.endsWith('…'))).toBe(true);
    // …and every one of them stays inside the box it was drawn for.
    for (const t of labels) {
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThan(220);
    }
  });

  it('keeps a hovered slice and its family lit across the rings', () => {
    const s = computePieLayout(
      baseSpec({
        highlight: 'slice',
        highlightIndex: 0,
        highlightT: 1,
        data: [
          { label: 'A', value: 60, color: '#6750A4' },
          { label: 'B', value: 40, color: '#B3261E' },
          { label: 'a1', value: 60, color: '#7D5260', parent: 0, level: 1 },
          { label: 'b1', value: 40, color: '#625B71', parent: 1, level: 1 },
        ],
      }),
      theme,
      400,
      400,
    );
    const by = (i: number) => s.slices.find((sl) => !sl.pill && sl.dataIndex === i)!;
    // A's child stays its own colour — a version and its browser are one answer.
    expect(by(2).color).toBe('#7D5260');
    // B's does not.
    expect(by(3).color).toMatch(/^rgba\(/);
  });
});
