/*
 * Chart engine — pie layout (spec → RenderScene)
 * ===========================================================
 * The polar sibling of layout.ts / bar-layout.ts. Turns a pie/donut
 * spec + theme + size into a RenderScene of annular-sector `slices`,
 * plus outside labels + leader lines, a legend, and (optionally) an
 * exploded hovered slice. Angles follow the component's convention
 * (90° = 12-o'clock, positive = counter-clockwise) and are converted
 * to screen radians (y-down) here. Pure — no DOM.
 * ===========================================================
 */

import type { MdChartAnimation, MdChartLegendPosition, MdChartTitleAlign } from '../types';
import { parseColor, mixColor, withAlpha } from './color';
import { LEGEND_SIDE_MAX_FRACTION } from './scene';
import type { LegendItem, RenderScene, SceneSegment, SceneSlice, TextItem } from './scene';
import { titlePlacement, type EngineTheme } from './layout';

export interface PieDatum {
  label: string;
  value: number;
  color: string;
  hidden?: boolean;
  /** Exploded outward (selected slice). */
  selected?: boolean;
  /**
   * How far out the slice currently sits, 0..1 of the full offset — the tween
   * behind `selected`, so a slice being picked slides out rather than jumping.
   * Absent falls back to `selected`, which is what a consumer sets.
   */
  selectT?: number;
  /** Fraction of the outer radius this slice reaches (a second dimension). */
  radius?: number;
  /**
   * Ring this slice belongs to: 0 is innermost. The tree is FLATTENED before it
   * reaches the layout so that `data` stays a plain indexable list — tooltips,
   * legend toggles, click events and the screen-reader table all address slices
   * by index, and a nested shape would have broken every one of them.
   */
  level?: number;
  /** Index of this slice's parent in the same array, for levels above 0. */
  parent?: number;
}

/** A slice's decorative gradient: lighter at the centre, its own colour at the rim. */
function gradientFor(color: string, theme: EngineTheme): { from: string; to: string } {
  return { from: mixColor(color, theme.surface, 0.3), to: color };
}

/**
 * The bounding box, in units of the outer radius, of an annular sector spanning
 * `[a0, a0 + sweep]` with a hole of `holeFrac`.
 *
 * A pie that sweeps less than a full turn paints only part of its circle, so
 * sizing it as if it were a whole one wastes the rest of the box: a half-donut
 * ends up half the size it could be, floating in the middle with empty space
 * under it. Fitting the SECTOR instead lets it fill the width.
 *
 * The extent is the arc's two ends, plus the inner corners (the hole's own ends,
 * or the centre when there is no hole), plus each axis-crossing (0 / 90 / 180 /
 * 270°) that falls inside the span — those are where the arc reaches furthest
 * and they are not endpoints, so sampling only the ends would clip them.
 */
function sectorBox(a0: number, sweep: number, holeFrac: number) {
  const a1 = a0 + sweep;
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const a of [lo, hi]) {
    for (const r of [1, holeFrac]) {
      xs.push(Math.cos(a) * r);
      ys.push(Math.sin(a) * r);
    }
  }
  // Quadrant extremes inside the span. `k` walks the quarter-turns at or after
  // `lo`; each contributes ±1 on one axis.
  const q = Math.PI / 2;
  for (let k = Math.ceil(lo / q); k * q <= hi; k++) {
    xs.push(Math.cos(k * q));
    ys.push(Math.sin(k * q));
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/**
 * Are these two slices in the same family — one the other's ancestor, or the
 * same slice?
 *
 * Both directions. A browser and one of its versions are the same answer to
 * the same question whichever of them the pointer is on, so dimming one when
 * the other is hovered tells the reader they are unrelated. Asking it in one
 * direction only lit a hovered child's parent while a hovered parent's children
 * went grey.
 */
function sameFamily(data: PieDatum[], a: number, b: number): boolean {
  return isAncestor(data, a, b) || isAncestor(data, b, a);
}

/** Is `idx` an ancestor of `of` (or the same slice)? */
function isAncestor(data: PieDatum[], idx: number, of: number): boolean {
  let cur = of;
  let guard = 0;
  while (cur >= 0 && guard++ < 32) {
    if (cur === idx) return true;
    cur = data[cur]?.parent ?? -1;
  }
  return false;
}

/** A slice's label text, honouring `labelMode` over the placement default. */
function sliceLabel(d: PieDatum, spec: PieChartSpec, fallback: 'value' | 'both' | 'name'): string {
  const mode = spec.labelMode ?? fallback;
  const value = spec.valueFormatter(d.value);
  if (mode === 'name') return d.label;
  if (mode === 'both') return `${d.label} · ${value}`;
  return value;
}

/** How far the hovered slice's band extends, in px. */
/** How far a picked slice sits out from the ring, in px. */
export const SELECT_OFFSET = 12;

/**
 * Rough width of one label character, as a fraction of the font size.
 *
 * The layout has no text metrics — measuring in the DOM here would mean a
 * reflow per frame — so the room reserved for a label and the point at which it
 * has to be shortened are both estimated from its length. ONE constant for
 * both: reserving with one number and shortening against another leaves labels
 * cut off in charts that gave up radius precisely so they would fit.
 */
const LABEL_CHAR_W = 0.52;

/**
 * Default width of a ring that labels inside itself, relative to the outermost
 * one (which labels on leaders and needs only its arc).
 */
const INNER_RING_WEIGHT = 1.45;

/** Narrowest slice (radians) that can hold a label INSIDE itself. */
const LABEL_MIN_SWEEP_INSIDE = 0.12;

/** …and on a leader line, where only a hairline slice has nothing to point at. */
const LABEL_MIN_SWEEP_LEADER = 0.02;

const HOVER_RIM = 7;

/** Clear background left between the slice and its band, in px. */
const HOVER_GAP = 3;

/** How far the rings outside an emphasised one step out to clear its rim. */
const RIM_ROOM = HOVER_RIM + HOVER_GAP;

/**
 * Clear background between one ring of a nested chart and the next, in px.
 * Enough to read as a division, not so much that the rings stop looking like
 * one chart.
 */
const LEVEL_GAP = 3;

/**
 * How much of the tween the far side of the ring lags behind the hovered
 * slice's neighbours. Small: it should read as the fade travelling, not as the
 * chart taking noticeably longer to settle.
 */
const FADE_STAGGER = 0.45;


export interface PieChartSpec {
  data: PieDatum[];
  title?: string;
  /** Sub-title, drawn under the title in the muted text colour. */
  subtitle?: string;
  /** Horizontal alignment of the title over the chart. Default 'start'. */
  titleAlign?: MdChartTitleAlign;
  innerRadius: string | number;
  outerRadius: string | number;
  startAngleDeg: number;
  endAngleDeg: number;
  paddingAngleDeg: number;
  cornerRadius: number;
  showLabels: boolean;
  highlight: 'slice' | 'series' | 'none';
  legend?: MdChartLegendPosition | 'none';
  valueFormatter: (v: number) => string;
  /** Data index of the hovered slice, or -1. */
  highlightIndex?: number;
  /**
   * How far the hover treatment is applied, 0..1. The engine tweens it so the
   * rim grows and the other slices fade rather than snapping — MD3 asks for
   * motion on a state change, and an instant jump on a shape this large reads
   * as a glitch. Omitted → 1 (fully applied).
   */
  highlightT?: number;
  /** Fill slices with a gradient running outward, for depth. Decorative. */
  gradient?: boolean;
  /**
   * What a slice's label says: its `value` (the default inside the ring, where
   * a legend already names the slices), its `name`, or `both`. Outside labels
   * default to `both`, since there is no legend to name them.
   */
  labelMode?: 'value' | 'name' | 'both';
  /** Hairline between adjacent slices. Omitted → the theme surface. */
  sliceStroke?: string;
  /** Hairline width in px. Default 1.5. */
  sliceStrokeWidth?: number;
  /**
   * How the radial band is divided between the levels of a nested chart —
   * relative weights, innermost first. `[2, 1]` gives the inner ring twice the
   * width of the outer. Short arrays fall back to the default per level.
   */
  ringWidths?: number[];
  /**
   * Measured legend extent in px (height for top/bottom, width for left/right).
   * The engine fills this in on a second pass so the ring never overlaps a
   * legend whose real (wrapped) size can't be predicted from text length.
   */
  legendExtent?: number;
  /** Entry-animation variant played on first render. Default 'expressive'. */
  animation?: MdChartAnimation;
  /** Entry-animation duration override (ms); ≤ 0 disables. */
  animationDuration?: number;
  /** Legacy on/off flag (pre-variant). `false` → no animation. */
  animate?: boolean;
}

const DEG = Math.PI / 180;

function approxWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.58;
}

/** Black or white label, whichever contrasts better with the slice fill. */
function labelColorFor(fill: string): string {
  const [r, g, b] = parseColor(fill);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 0.62 ? 'rgba(0, 0, 0, 0.82)' : '#ffffff';
}

function resolveRadius(r: string | number, baseR: number): number {
  if (typeof r === 'number') return Number.isFinite(r) && r >= 0 ? r : 0;
  const s = r.trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return s.endsWith('%') ? (n / 100) * baseR : n;
}

export function computePieLayout(spec: PieChartSpec, theme: EngineTheme, width: number, height: number): RenderScene {
  // Only the innermost ring drives the ring's own proportions; deeper levels
  // subdivide their parent's arc.
  const visible = spec.data
    .map((d, i) => ({ d, i }))
    .filter((x) => !x.d.hidden && x.d.value > 0 && (x.d.level ?? 0) === 0);
  const total = visible.reduce((sum, x) => sum + x.d.value, 0);
  const depth = spec.data.reduce((m, d) => Math.max(m, (d.level ?? 0) + 1), 1);

  // ── gutters (title + legend) ──
  const titleH = spec.title ? theme.titleSize + 12 + (spec.subtitle ? theme.labelSize + 4 : 0) : 0;
  // Only reserve legend space for >1 slice — the overlay suppresses a 1-entry
  // legend, so reserving a gutter for it would shrink/off-centre the ring.
  const legendPos = spec.legend && spec.legend !== 'none' && spec.data.length > 1 ? spec.legend : null;
  const maxLegendW = legendPos ? Math.max(0, ...spec.data.map((d) => approxWidth(d.label, theme.labelSize))) : 0;

  let padL = 8;
  let padR = 8;
  let padT = 8 + titleH;
  let padB = 8;
  if (legendPos) {
    const side = legendPos === 'left' || legendPos === 'right';
    if (side) {
      // Prefer the engine-measured width; else estimate from the widest label.
      // Capped at a third of the box. A side legend takes its width from the
      // longest label, so the same chart in a language with longer words gets a
      // visibly smaller ring — an Arabic "التواصل الاجتماعي المدفوع" runs three
      // times its English label, and unbounded it took the whole box and left
      // the chart a speck. Past the cap the chips ellipsise, which costs the
      // tail of a name rather than the chart.
      const want = spec.legendExtent != null ? spec.legendExtent + 16 : maxLegendW + 30;
      const w = Math.min(want, width * LEGEND_SIDE_MAX_FRACTION);
      if (legendPos === 'left') padL += w;
      else padR += w;
    } else {
      // Prefer the engine-measured height; else greedily pack rows as a first
      // guess (refined to the real wrapped height on the reflow pass).
      let band = spec.legendExtent != null ? spec.legendExtent + 8 : 0;
      if (spec.legendExtent == null) {
        const availW = Math.max(60, width * 0.86);
        let rows = 1;
        let rowW = 0;
        for (const d of spec.data) {
          const iw = approxWidth(d.label, theme.labelSize) + 28;
          if (rowW > 0 && rowW + iw > availW) { rows++; rowW = iw; } else rowW += iw;
        }
        band = rows * (theme.labelSize + 8) + 6;
      }
      if (legendPos.startsWith('bottom')) padB += band;
      else padT += band;
    }
  }

  const plot = {
    x: padL,
    y: padT,
    width: Math.max(1, width - padL - padR),
    height: Math.max(1, height - padT - padB),
  };

  // Angles first: a partial sweep changes how much room the ring needs.
  const startRad = -spec.startAngleDeg * DEG;
  const sweepTotal = -(spec.endAngleDeg - spec.startAngleDeg) * DEG;
  // inner/outer as a ratio. Both resolve against the same base, so the base
  // cancels — which matters because the base is what we are about to compute.
  const holeFrac = (() => {
    const inner = resolveRadius(spec.innerRadius, 100);
    const outer = resolveRadius(spec.outerRadius, 100);
    return outer > 0 ? Math.max(0, Math.min(0.95, inner / outer)) : 0;
  })();
  // A near-full sweep keeps the plain inscribed-circle fit — the sector box is
  // the full circle anyway, and going through it would only add rounding noise.
  const partial = Math.abs(sweepTotal) < Math.PI * 2 - 0.02;
  const box = partial ? sectorBox(startRad, sweepTotal, holeFrac) : { x0: -1, x1: 1, y0: -1, y1: 1 };
  const baseR = Math.max(
    1,
    Math.min(plot.width / Math.max(0.01, box.x1 - box.x0), plot.height / Math.max(0.01, box.y1 - box.y0)),
  );
  // Centre the SECTOR in the plot, then place the ring centre relative to it.
  const cx = plot.x + plot.width / 2 - ((box.x0 + box.x1) / 2) * baseR;
  const cy = plot.y + plot.height / 2 - ((box.y0 + box.y1) / 2) * baseR;
  /**
   * Room reserved outside the ring for the labels.
   *
   * An outside label is a whole word (or two) sitting beyond the rim, so a flat
   * margin is the wrong reservation: it is right for "80" and far too small for
   * "Organic search · 240", which then ran off the edge of the card and was
   * clipped mid-word. Sized from the longest label the chart will actually
   * draw, estimated from its length — the layout has no text metrics, and
   * measuring in the DOM here would mean a reflow per frame. Capped at half the
   * radius, since past that the ring has given up more than the labels are
   * worth. Inside labels (the legend case) need none of it.
   */
  const labelRoom = (() => {
    if (!spec.showLabels || legendPos) return 6;
    const longest = visible.reduce((m, v) => Math.max(m, sliceLabel(v.d, spec, 'both').length), 0);
    // Only what OVERFLOWS. The ring usually asks for less than the full radius
    // (80% by default), which often leaves enough room for the labels already —
    // reserving the label's width unconditionally shrank charts that had no
    // problem, for nothing.
    const want = resolveRadius(spec.outerRadius, baseR);
    const textW = 12 + longest * theme.labelSize * LABEL_CHAR_W;
    // Solved, not guessed: the ring shrinks WITH the room given up, so taking
    // the raw overflow back reserves too little and the label still runs off.
    // With `f` the fraction of the radius the ring asks for, room r has to
    // satisfy f·(baseR − r) + textW ≤ baseR.
    const f = Math.max(0.05, want / Math.max(1, baseR));
    return Math.max(6, Math.min(baseR * 0.45, (want + textW - baseR) / f));
  })();
  // What is left for the ring after that. BOTH radii resolve against it, so a
  // chart that gives up room to its labels keeps its proportions: resolving the
  // hole against the full radius while the rim gave way collapsed a donut's
  // band to a hairline.
  const ringR = Math.max(8, baseR - labelRoom);
  const outerR = Math.max(1, Math.min(resolveRadius(spec.outerRadius, ringR), ringR));
  const innerR = Math.max(0, Math.min(resolveRadius(spec.innerRadius, ringR), outerR - 2));
  // Each level gets an equal share of the radial band, innermost first, with a
  // gap between them — flush, the levels merge into one thick ring and the
  // hierarchy the nesting exists to show is lost.
  /**
   * How the radial band is split between the levels — relative weights,
   * innermost first.
   *
   * An equal split is the wrong default for a nested chart, because the levels
   * do not carry the same thing. Every ring but the outermost labels INSIDE
   * itself, so its band has to hold a word; the outermost puts its labels on
   * leaders and needs no more than the arc. Splitting evenly left the inner
   * ring, the one with text in it, exactly as thin as the one without.
   */
  const ringWeights = Array.from({ length: depth }, (_, level) => {
    const w = spec.ringWidths?.[level];
    return Number.isFinite(w) && (w as number) > 0 ? (w as number) : level < depth - 1 ? INNER_RING_WEIGHT : 1;
  });
  const weightSum = ringWeights.reduce((a, w) => a + w, 0) || 1;
  const bandSpan = outerR - innerR;
  const levelGap = depth > 1 ? Math.min(LEVEL_GAP, (bandSpan / depth) * 0.3) : 0;
  const bandable = Math.max(1, bandSpan - levelGap * (depth - 1));
  const bandAt = (level: number) => (bandable * ringWeights[level]) / weightSum;
  // Cumulative, so the gaps sit BETWEEN the rings and the outermost still ends
  // exactly at the radius that was asked for.
  const ringStarts = (() => {
    const out: number[] = [];
    let acc = innerR;
    for (let level = 0; level < depth; level++) {
      out.push(acc);
      acc += bandAt(level) + (level < depth - 1 ? levelGap : 0);
    }
    return out;
  })();
  const ringInner = (level: number) => ringStarts[level] ?? innerR;
  // Only the gaps BETWEEN rings are taken; the outermost still reaches the
  // radius that was asked for.
  const ringOuter = (level: number) => ringInner(level) + bandAt(level);
  /** Angular span of each slice, by index — children read their parent's. */
  const span = new Map<number, { a0: number; a1: number }>();
  /** Indices that something else points at as its parent. */
  const hasKids = new Set<number>();
  for (const d of spec.data) if (d.parent != null && d.parent >= 0) hasKids.add(d.parent);
  /**
   * A slice with no breakdown of its own reaches the OUTER radius rather than
   * stopping at its own ring. Otherwise the outer ring is drawn with a hole
   * wherever a category has no children — the chart looks like it lost a slice
   * rather than like that slice simply has nothing inside it.
   */
  const outerFor = (level: number, i: number) => {
    const full = hasKids.has(i) ? ringOuter(level) : outerR;
    const r = spec.data[i]?.radius;
    if (r == null) return full;
    // Floor at 15%: a slice drawn at (or near) zero radius is indistinguishable
    // from missing data, and the angle it still occupies would look like a bug.
    const base = ringInner(level);
    return base + (full - base) * Math.max(0.15, Math.min(1, r));
  };

  // ── slice angles (screen radians; y-down flips the sign) ──
  const sign = sweepTotal >= 0 ? 1 : -1;
  // Cap the total inter-slice padding at 90% of the ring sweep so a large
  // paddingAngle collapses the slices to slivers rather than driving availSweep
  // negative (which would flip every slice's direction and scatter the arcs).
  const totalPad = visible.length ? Math.min(spec.paddingAngleDeg * DEG * visible.length, Math.abs(sweepTotal) * 0.9) : 0;
  const perPad = visible.length ? totalPad / visible.length : 0;
  const availSweep = sweepTotal - sign * totalPad;

  const slices: SceneSlice[] = [];
  const texts: TextItem[] = [];
  const leaders: SceneSegment[] = [];
  /** Outside labels, held back until they can be spread apart (see below). */
  const outside: { key: string; text: string; x1: number; y1: number; x: number; y: number; right: boolean }[] = [];

  let cursor = startRad;
  // A single slice has no neighbour to be separated from, and a full ring of
  // one would get a stray radial line at 12 o'clock.
  const sepColor = spec.sliceStroke ?? theme.surface;
  // 1px rather than something heavier: the gap is a constant width, so it also
  // fixes where the wedges have to stop — the hub is (gap/2) / sin(narrowest
  // sweep / 2), and every extra half-pixel of separation is nearly a whole one
  // of hub. A hairline reads as a division without opening a hole at the
  // centre. See `hubCut`.
  const sepWidth = visible.length > 1 ? spec.sliceStrokeWidth ?? 1 : 0;
  /**
   * Where a solid pie's wedges stop, short of the centre.
   *
   * The separation between two slices is a constant WIDTH, so it reads the same
   * at the hub as at the rim — which means each pair of inset edges closes on
   * itself at `g / sin(sweep/2)` and there is no wedge past that point. Running
   * them to the centre anyway would either pinch the gaps shut there (the
   * spacing stops matching) or fold each wedge through itself.
   *
   * So every slice stops on ONE small circle, sized by the slice that needs the
   * most room — the narrowest, whose edges converge soonest. A common radius
   * rather than each slice's own, because slices ending at five different radii
   * is exactly the ragged middle this is meant to avoid. Capped, so that a
   * sliver too narrow to hold a gap can't hollow out the whole chart.
   */
  const hubCut = (() => {
    if (innerR > 0 || sepWidth <= 0 || visible.length < 2) return 0;
    const g = sepWidth / 2;
    const total = visible.reduce((acc, v) => acc + Math.max(0, v.d.value), 0) || 1;
    const fullSweep = Math.abs(-(spec.endAngleDeg - spec.startAngleDeg) * DEG);
    let worst = 0;
    for (const v of visible) {
      const sw = (Math.max(0, v.d.value) / total) * fullSweep;
      if (sw > 0.001) worst = Math.max(worst, g / Math.sin(Math.min(sw, Math.PI) / 2));
    }
    // Kept small in absolute terms as well as relative: one very narrow slice
    // would otherwise set a hub big enough to read as a donut hole. A slice
    // whose gap closes above the cap simply comes to a point there instead.
    return Math.min(worst, outerR * 0.04, 4);
  })();
  /**
   * Hover bands, kept apart from the ring slices and appended at the very end.
   * A band drawn in ring order is painted BEFORE the ring outside it, which
   * then covers it — on a nested chart the highlight for an inner slice
   * disappeared under the next ring entirely.
   */
  const hoverBands: SceneSlice[] = [];
  const pushBand = (bx: number, by: number, rOut: number, a0: number, a1: number, color: string) => {
    const rimH = HOVER_RIM * hi;
    const gap = HOVER_GAP * hi;
    const midR = rOut + gap + rimH / 2;
    const dArc = (midR > 0 ? rimH / 2 / midR : 0) * sweepSign;
    hoverBands.push({
      cx: bx,
      cy: by,
      innerR: rOut + gap,
      outerR: rOut + gap + rimH,
      startAngle: a0 + dArc,
      endAngle: a1 - dArc,
      // OPAQUE. The band is painted last, so it is already on top — but a
      // translucent one takes the colour of whatever it covers, and over the
      // next ring out that reads as passing behind it rather than over it.
      // Against the background there is nothing to blend with, so the two cases
      // looked the same until a ring appeared underneath.
      color,
      dataIndex: -1,
      pill: true,
    });
  };
  /** +1 for a clockwise ring, -1 for anticlockwise — corner offsets follow it. */
  const sweepSign = sign;
  // Strength of the hover treatment this frame.
  const hi = Math.max(0, Math.min(1, spec.highlightT ?? 1));
  const hovering = spec.highlight !== 'none' && spec.highlightIndex != null && spec.highlightIndex >= 0;

  // Where each visible slice's middle sits as a fraction of the ring, so the
  // fade can travel AROUND it instead of switching every slice at once.
  const midFrac: number[] = [];
  {
    let acc = 0;
    for (const { d } of visible) {
      const frac = total > 0 ? d.value / total : 0;
      midFrac.push(acc + frac / 2);
      acc += frac;
    }
  }
  const hoveredPos = visible.findIndex((v) => v.i === spec.highlightIndex);
  /** Which ring the pointer is on — the ones outside it step out of its way. */
  const hoveredLevel = hovering ? spec.data[spec.highlightIndex ?? -1]?.level ?? 0 : Infinity;

  /**
   * How far this slice fades, given the tween.
   *
   * The dimming is staggered by distance around the RING from the slice under
   * the pointer: its neighbours start giving way immediately, the far side a
   * moment later. Switching every slice at the same instant reads as the chart
   * changing state; letting it travel reads as attention moving to one slice.
   * At rest (`hi` of 0 or 1) every slice still lands on the same value, so the
   * stagger only exists during the transition.
   */
  const fadeFor = (pos: number): number => {
    if (hoveredPos < 0) return hi;
    const diff = Math.abs(midFrac[pos] - midFrac[hoveredPos]);
    // Ring distance: 0 next to the hovered slice, 1 diametrically opposite.
    const dist = Math.min(diff, 1 - diff) * 2;
    const lag = dist * FADE_STAGGER;
    return Math.max(0, Math.min(1, (hi - lag) / (1 - lag || 1)));
  };

  // Each slice's cumulative EXPLODE offset (its own + every selected ancestor's),
  // so a picked parent carries its whole radial wedge — the outer child slices AND
  // their labels — out with it, instead of sliding out from under them.
  const offOf = new Map<number, { x: number; y: number }>();
  visible.forEach(({ d, i }, pos) => {
    const fade = fadeFor(pos);
    const frac = total > 0 ? d.value / total : 0;
    const sliceSweep = availSweep * frac;
    const a0 = cursor + (sign * perPad) / 2;
    const a1 = a0 + sliceSweep;
    cursor = a1 + (sign * perPad) / 2;

    const mid = (a0 + a1) / 2;
    // Hover does NOT displace the slice. Moving the thing under the pointer
    // makes the pointer leave it, and on a pie it also breaks the ring the eye
    // is reading proportions from. Instead the hovered slice gains a raised
    // outer ring and the others fade back, so the emphasis is unmistakable and
    // the geometry never moves. `selected` still explodes — that is a pinned
    // state a consumer sets, not a transient pointer one.
    const isHovered = hovering && (spec.highlightIndex === i || spec.highlight === 'series');
    // The BAND marks the slice the pointer is on; the fade spares its family
    // too. A version and the browser it belongs to are the same answer, so
    // dimming the parent would tell the reader they were unrelated.
    const litByFamily = hovering && sameFamily(spec.data, i, spec.highlightIndex ?? -1);
    const ex = (d.selectT ?? (d.selected ? 1 : 0)) * SELECT_OFFSET;
    const scx = cx + Math.cos(mid) * ex;
    const scy = cy + Math.sin(mid) * ex;
    offOf.set(i, { x: scx - cx, y: scy - cy });

    // Everything the pointer is not on fades toward the surface, so the hovered
    // slice reads as the answer without changing size. `hi > 0` so a fully
    // untweened frame hands back the ORIGINAL colour rather than an equal-but-
    // reserialised one. Held in a variable because the LABEL that sits on this
    // slice has to be contrasted against what is actually painted: read off
    // `d.color`, a white label stayed white while its slice faded to near the
    // surface, and every dimmed slice lost its number.
    const fill = hovering && !isHovered && !litByFamily && fade > 0 ? mixColor(d.color, theme.surface, 0.62 * fade) : d.color;

    // The ring goes in FIRST so the slice paints over its inner edge, leaving
    // only the band that extends past the radius — a lifted rim, not an outline.
    if (isHovered && hi > 0) pushBand(scx, scy, outerFor(0, i), a0, a1, d.color);
    slices.push({
      cx: scx,
      cy: scy,
      // Stops on the hub circle rather than at the centre — see `hubCut`.
      innerR: Math.max(ringInner(0), hubCut),
      outerR: outerFor(0, i),
      startAngle: a0,
      endAngle: a1,
      color: fill,
      dataIndex: i,
      cornerRadius: spec.cornerRadius,
      // The separation from the neighbouring wedges is part of THIS wedge's
      // shape, not a line drawn over the join afterwards. See `SceneSlice.gap`.
      gap: sepWidth,
      gapColor: sepColor,
      gradient: spec.gradient ? gradientFor(d.color, theme) : undefined,
    });
    span.set(i, { a0, a1 });

    // Two different questions of "is there room". An INSIDE label has to fit
    // within the wedge, so a thin one cannot carry it; an OUTSIDE label sits
    // clear of the chart on a leader line, and a leader can point at a sliver
    // as well as at anything else — holding both to the inside threshold left
    // the small slices unnamed for no reason.
    // Every level-0 slice of a nested chart names itself INSIDE its own band,
    // including one with no breakdown — whose wedge runs on to the outer radius
    // (see `outerFor`). Giving that one the outer ring's leader treatment
    // instead is defensible, since its wedge IS out there, but it reads as a
    // category that wandered out of the inner ring rather than one that simply
    // has nothing inside it.
    const inside = !!legendPos || depth > 1;
    if (spec.showLabels && Math.abs(sliceSweep) > (inside ? LABEL_MIN_SWEEP_INSIDE : LABEL_MIN_SWEEP_LEADER)) {
      // Inside when something else already names the slices (a legend), and
      // ALWAYS when there is a ring outside this one: an inner name placed
      // outside has to reach past the outer ring's own labels, and the two
      // collide into an unreadable stack.
      if (inside) {
        // A legend already names the slices → put a compact value label *inside*
        // the slice (never overflows), with a contrast-aware colour.
        const r0 = ringInner(0);
        const r1 = outerFor(0, i);
        const labelR = r0 > 0 ? (r0 + r1) / 2 : r1 * 0.62;
        texts.push({
          x: scx + Math.cos(mid) * labelR,
          y: scy + Math.sin(mid) * labelR,
          // A nested chart's inner ring is a category, not a quantity — the
          // outer ring carries the numbers, and repeating them inside just
          // crowds a band that is already the narrower of the two.
          text: sliceLabel(d, spec, depth > 1 ? 'name' : 'value'),
          color: labelColorFor(fill),
          fontSize: theme.labelSize,
          align: 'center',
          baseline: 'middle',
          key: `pl-${i}`,
        });
      } else {
        // No legend → outside `name · value` label with a leader line (there's
        // full horizontal room without a legend gutter).
        //
        // The leader leaves THIS slice's rim, not the chart's. On a chart where
        // the radius carries a second dimension the two are different for every
        // slice but the longest, and anchoring at the chart's left every short
        // one with a line starting out in open space, pointing back at a wedge
        // it never touched.
        // The leader LEAVES this slice's own rim but the label sits outside the
        // whole chart. Both halves matter where the radius carries a second
        // dimension: anchored at the chart's rim, a short slice's line starts
        // out in open space pointing back at a wedge it never touched; stopped
        // just past its own rim, the label lands on a taller neighbour.
        // Collected rather than emitted, so labels that land on each other can
        // be spread apart before any of them is placed.
        outside.push({
          key: `pl-${i}`,
          text: sliceLabel(d, spec, 'both'),
          x1: scx + Math.cos(mid) * outerFor(0, i),
          y1: scy + Math.sin(mid) * outerFor(0, i),
          x: scx + Math.cos(mid) * (outerR + 12),
          y: scy + Math.sin(mid) * (outerR + 12),
          right: Math.cos(mid) >= 0,
        });
      }
    }
  });

  // Outside leader labels (level-0 here, outer rings below) are spread + placed
  // together AFTER every ring has contributed — see `placeOutsideLabels` below.

  // ── outer rings ──────────────────────────────────────────────
  // Each deeper level subdivides its PARENT's arc, so a child ring can never
  // disagree with the ring inside it. Children are taken in proportion to each
  // other rather than to the parent's own value: a parent whose children fall
  // short would otherwise be redrawn smaller than the number it reports.
  for (let level = 1; level < depth; level++) {
    const here = spec.data.map((d, i) => ({ d, i })).filter((x) => (x.d.level ?? 0) === level && !x.d.hidden);
    const byParent = new Map<number, { d: PieDatum; i: number }[]>();
    for (const x of here) {
      const p = x.d.parent ?? -1;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(x);
    }
    for (const [parentIdx, kids] of byParent) {
      const pSpan = span.get(parentIdx);
      if (!pSpan) continue;
      const sum = kids.reduce((a, k) => a + Math.max(0, k.d.value), 0);
      if (sum <= 0) continue;
      const sweepAll = pSpan.a1 - pSpan.a0;
      let cur = pSpan.a0;
      for (const { d, i } of kids) {
        const a0 = cur;
        const a1 = a0 + sweepAll * (Math.max(0, d.value) / sum);
        cur = a1;
        span.set(i, { a0, a1 });
        // Rings OUTSIDE the emphasised one step outward to make room for its
        // rim, rather than having the rim laid over them. The rim is the answer
        // to "which slice", and a highlight that has to cover its neighbour to
        // be seen reads as damage to the neighbour.
        //
        // Taken from the margin that is already there rather than reserved up
        // front: the ring stops `labelRoom` (≥6px) short of the plot edge and
        // the plot itself is inset 8px, so stepping out ten costs nothing at
        // rest and still cannot reach the edge of the box.
        const shove = level > hoveredLevel ? RIM_ROOM * hi : 0;
        const rIn = ringInner(level) + shove;
        const rOut = outerFor(level, i) + shove;
        // Hovering a slice keeps its own family lit: a version and the browser
        // it belongs to are the same answer, so dimming one of them would be
        // telling the reader they are unrelated.
        const related = hoveredPos < 0 || spec.highlightIndex === i || sameFamily(spec.data, i, spec.highlightIndex ?? -1);
        // Picked slices slide out of their ring at every level, not just the
        // innermost — a chart you can pick a slice on should not stop
        // responding once you reach the ring the detail lives in.
        const kex = (d.selectT ?? (d.selected ? 1 : 0)) * SELECT_OFFSET;
        const kmid = (a0 + a1) / 2;
        // Inherit the whole selected ancestry's explode, then add this slice's own,
        // so a picked parent moves this child AND its label out as one rigid wedge
        // rather than sliding the parent out from under a ring that stayed put.
        const pOff = offOf.get(parentIdx) ?? { x: 0, y: 0 };
        const ox = pOff.x + Math.cos(kmid) * kex;
        const oy = pOff.y + Math.sin(kmid) * kex;
        offOf.set(i, { x: ox, y: oy });
        slices.push({
          cx: cx + ox,
          cy: cy + oy,
          innerR: rIn,
          outerR: rOut,
          startAngle: a0,
          endAngle: a1,
          color: hovering && !related && hi > 0 ? mixColor(d.color, theme.surface, 0.62 * hi) : d.color,
          dataIndex: i,
          cornerRadius: spec.cornerRadius,
          gap: sepWidth,
          gapColor: sepColor,
          gradient: spec.gradient ? gradientFor(d.color, theme) : undefined,
        });
        // From the slice's OWN centre, which is not the ring's once it (or an
        // ancestor) has been picked out of it — anchored at the ring's, the rim
        // stayed behind while the slice it belongs to slid away from under it.
        if (hovering && spec.highlightIndex === i && hi > 0) {
          pushBand(cx + ox, cy + oy, rOut, a0, a1, d.color);
        }
        // Outer-ring labels go OUTSIDE with a leader line: the band is a
        // fraction of the radius by the time it is the third ring, and a name
        // inside it would not fit. They ride the wedge's offset too.
        const mid = (a0 + a1) / 2;
        if (spec.showLabels && Math.abs(a1 - a0) > LABEL_MIN_SWEEP_LEADER && level === depth - 1) {
          // Collected, not emitted, so outer labels that land on each other are
          // spread apart with the rest before any is placed (see `outside`).
          outside.push({
            key: `pl-${i}`,
            text: sliceLabel(d, spec, 'both'),
            x1: cx + ox + Math.cos(mid) * rOut,
            y1: cy + oy + Math.sin(mid) * rOut,
            x: cx + ox + Math.cos(mid) * (rOut + 12),
            y: cy + oy + Math.sin(mid) * (rOut + 12),
            right: Math.cos(mid) >= 0,
          });
        }
      }
    }
  }

  /**
   * placeOutsideLabels — spread every outside leader label apart, then place them.
   *
   * Two narrow slices side by side (an inner one AND its outer version) have
   * nearly the same mid-angle, so their labels land on the same spot and print
   * over each other — precisely on the small slices, the ones a label is most
   * needed for. Run over ALL rings' labels at once (level-0 + outer), it walks
   * each side top to bottom, pushes anything closer than a line-height down, then
   * shifts the whole column back if that ran it off an edge. The leader still
   * starts at its own slice's rim, so a label that moved is still tied to the
   * wedge it names.
   */
  if (outside.length) {
    const lineH = theme.labelSize * 1.45;
    for (const right of [true, false]) {
      const col = outside.filter((l) => l.right === right).sort((a, b) => a.y - b.y);
      if (!col.length) continue;
      for (let k = 1; k < col.length; k++) {
        if (col[k].y - col[k - 1].y < lineH) col[k].y = col[k - 1].y + lineH;
      }
      const over = col[col.length - 1].y - (height - lineH / 2);
      if (over > 0) for (const l of col) l.y -= over;
      const under = lineH / 2 - col[0].y;
      if (under > 0) for (const l of col) l.y += under;
    }
    for (const l of outside) {
      // What is left between the label's anchor and the edge of the chart. A
      // box can simply be too narrow for a long name beside a ring of any size,
      // and a label cut off mid-glyph by the edge reads as a rendering fault —
      // an ellipsis reads as a label that did not fit.
      const room = l.right ? width - 6 - l.x : l.x - 6;
      const fits = Math.max(3, Math.floor(room / (theme.labelSize * LABEL_CHAR_W)));
      const text = l.text.length > fits ? `${l.text.slice(0, fits - 1)}…` : l.text;
      leaders.push({ x1: l.x1, y1: l.y1, x2: l.x, y2: l.y, color: theme.gridLineColor, width: 1 });
      texts.push({
        x: l.x + (l.right ? 3 : -3),
        y: l.y,
        text,
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: l.right ? 'start' : 'end',
        baseline: 'middle',
        key: l.key,
      });
    }
  }

  // Bands go on TOP of every ring, never in ring order.
  slices.push(...hoverBands);

  if (spec.title) {
    // Title spans the full chart width (the ring is centred below it), so align
    // within a 12px-inset band rather than the ring's plot box.
    const tt = titlePlacement(spec.titleAlign, 12, width - 24);
    texts.push({ x: tt.x, y: 6, text: spec.title, color: theme.textColor, fontSize: theme.titleSize, fontWeight: 600, align: tt.align, baseline: 'top', key: 'title' });
    if (spec.subtitle) {
      texts.push({
        x: tt.x,
        y: 6 + theme.titleSize + 4,
        text: spec.subtitle,
        color: theme.textColorMuted,
        fontSize: theme.labelSize,
        align: tt.align,
        baseline: 'top',
        key: 'subtitle',
      });
    }
  }

  const legend: LegendItem[] = legendPos
    ? spec.data.map((d, i) => ({ label: d.label, color: d.color, seriesIndex: i, hidden: !!d.hidden, x: 0, y: 0 }))
    : [];

  return {
    width,
    height,
    plot,
    background: theme.background === 'transparent' ? undefined : theme.background,
    // Leader lines ride the gridlines channel (both backends draw it as segments).
    gridlines: leaders,
    axisLines: [],
    areas: [],
    bars: [],
    slices,
    lines: [],
    markers: [],
    texts,
    legend,
    legendPosition: legendPos ?? undefined,
    // Middle of the HOLE, not of the ring. On a full donut they are the same
    // point; on a half-donut the hole is a half-disc sitting above the ring
    // centre, and anchoring at the centre lays the caption across the arc.
    pieCenter: { x: cx, y: cy },
    ...(() => {
      // The usable box inside the hole is the largest RECTANGLE that fits it,
      // not the hole's bounding box: text laid out to the full diameter runs
      // past the arc near the top and bottom, where the circle has curved back
      // in. Scaling the hole's unit box by 1/√2 about the ring centre gives
      // exactly that rectangle — the inscribed square of a full circle, and the
      // max-area rectangle of a half-disc, which is just as wide but half as
      // tall and sits against the flat side.
      const h = partial ? sectorBox(startRad, sweepTotal, 0) : { x0: -1, x1: 1, y0: -1, y1: 1 };
      const k = innerR / Math.SQRT2;
      return {
        pieHoleSize: innerR > 0 ? (h.x1 - h.x0) * k : 0,
        pieHoleHeight: innerR > 0 ? (h.y1 - h.y0) * k : 0,
        pieCenterSlot: { x: cx + ((h.x0 + h.x1) / 2) * k, y: cy + ((h.y0 + h.y1) / 2) * k },
      };
    })(),
    xPositions: [],
    xValues: [],
    xLabels: [],
    hoverPoints: [],
  };
}
