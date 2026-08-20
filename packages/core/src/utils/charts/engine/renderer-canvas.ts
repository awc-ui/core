/*
 * Chart engine — Canvas2D renderer backend
 * ===========================================================
 * The renderer:
 * paints a RenderScene onto a 2D context. Text is NOT drawn here
 * — the DOM overlay owns it — so this only strokes/fills the plot
 * geometry (gridlines, axes, area gradients, lines, markers).
 * ===========================================================
 */

import { markerPolygon } from './geometry';
import type { RenderScene, SceneArea, SceneBar, SceneSlice } from './scene';

/**
 * A bar as a chevron pointing along the value axis.
 *
 * The tip OVERFLOWS the bar's own rect by the notch depth, so that it lands
 * exactly in the notch cut out of the next segment along — that is what makes a
 * chain interlock rather than leaving a gap at every join. The depth is taken
 * from the bar's THICKNESS, not its length, so every segment in a stack shares
 * one figure and the tips and notches agree however short a segment is.
 */
export const CHEVRON_MAX_TIP = 32;

/**
 * Depth a chevron's tip overflows its own rect by, from the bar's THICKNESS.
 * Exported because the hover layer has to agree with it: a marker placed at the
 * bar's rect edge sits *behind* the drawn point, which reads as pointing at
 * nothing. Shared here rather than duplicated so the two cannot drift.
 */
export function chevronTipDepth(thickness: number): number {
  return Math.min(thickness * 0.3, CHEVRON_MAX_TIP);
}

function traceChevron(ctx: CanvasRenderingContext2D, b: SceneBar): void {
  const along = b.horizontal ?? b.w > b.h;
  const t = chevronTipDepth(along ? b.h : b.w);
  const cut = b.notch === false ? 0 : t;
  if (along) {
    const my = b.y + b.h / 2;
    if (b.arrow === 1) {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w + t, my);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.lineTo(b.x, b.y + b.h);
      if (cut) ctx.lineTo(b.x + cut, my);
    } else {
      ctx.moveTo(b.x + b.w, b.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x - t, my);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      if (cut) ctx.lineTo(b.x + b.w - cut, my);
    }
  } else {
    const mx = b.x + b.w / 2;
    if (b.arrow === 1) {
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(mx, b.y - t);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      if (cut) ctx.lineTo(mx, b.y + b.h - cut);
    } else {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x, b.y + b.h);
      ctx.lineTo(mx, b.y + b.h + t);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y);
      if (cut) ctx.lineTo(mx, b.y + cut);
    }
  }
  ctx.closePath();
}

/**
 * Trace one slice: its gap from the neighbours cut out of its own edges, and
 * the two corners where the outer arc meets them rounded — the MD3 pie shape.
 *
 * Each corner is a circle of radius `r` tangent to BOTH the outer arc and the
 * radial edge. Its centre sits at radius `R - r`, offset from the edge by
 * `asin(r / (R - r))`: that is the angle at which the perpendicular distance
 * from the centre to the edge equals `r`. Solving it rather than approximating
 * with a curve keeps the rounding even all the way round, including on the
 * narrow slices where an approximation visibly pinches.
 *
 * Both ends round. The inner corner is the same construction mirrored: its
 * circle is tangent to the hole from OUTSIDE, so the centre sits at
 * `innerR + r` and the offset is `asin(r / (innerR + r))`. A pie has no inner
 * corner to round — its edges meet at the centre — so only a donut gets them.
 */
function traceSlice(ctx: CanvasRenderingContext2D, s: SceneArc, fresh = true): void {
  const { cx, cy, innerR, outerR, startAngle: a0, endAngle: a1 } = s;
  const ccw = a1 < a0;
  const towards = ccw ? -1 : 1; // the sign that points INTO the slice from edge a0
  const sweep = Math.abs(a1 - a0);
  const at = (r: number, a: number) => ({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });

  // Half the separation from each neighbour, taken out of this slice. Clamped
  // so a narrow slice keeps a body instead of closing up, and dropped for a
  // lone full-circle slice, which has no neighbour to stand clear of.
  const lone = sweep >= Math.PI * 2 - 0.01;
  const g = lone ? 0 : Math.min((s.gap ?? 0) / 2, outerR * Math.sin(sweep / 2) * 0.4);
  // The edge is a line offset `g` from the true radial one, so at radius R it
  // has moved `asin(g / R)` round — a constant WIDTH, which is what makes the
  // separation read the same at the hub as at the rim. It closes on itself at
  // `g / sin(sweep/2)`; the layout keeps `innerR` at or above that, so the two
  // edges never cross inside the shape being drawn.
  const insetAt = (R: number) => (g > 0 && R > g ? Math.asin(Math.min(1, g / R)) : 0);
  const b0 = a0 + towards * insetAt(outerR);
  const b1 = a1 - towards * insetAt(outerR);
  if (towards * (b1 - b0) <= 0) return;
  /** The inset edge's own angle at radius R, clamped so it cannot overshoot the
   *  slice's midline (which a slice narrower than its own gap would). */
  const edgeAt = (base: number, dir: number, R: number) => {
    const mid = (a0 + a1) / 2;
    const a = base + dir * insetAt(R);
    return dir * towards > 0 ? Math.min(a * towards, mid * towards) * towards : Math.max(a * towards, mid * towards) * towards;
  };

  // Clamp: never wider than half the ring's thickness, and never so wide that
  // two corners of a thin slice would overlap. The INNER pair is the binding
  // one on a donut — the band is the same angle there but a smaller radius, so
  // the two corners have less room between them than the outer pair does.
  const span = Math.min(Math.abs(b1 - b0), Math.PI / 2) / 4;
  const maxByBand = (outerR - innerR) / 2;
  const maxBySweep = outerR * Math.tan(span);
  const maxBySweepInner = innerR > 0 ? innerR * Math.tan(span) : Infinity;
  const r = Math.max(0, Math.min(s.cornerRadius ?? 0, maxByBand, maxBySweep, maxBySweepInner));

  const n0 = edgeAt(a0, towards, Math.max(innerR, 0.01));
  const n1 = edgeAt(a1, -towards, Math.max(innerR, 0.01));

  if (fresh) ctx.beginPath();
  if (r < 0.5) {
    const from = at(innerR, n0);
    ctx.moveTo(from.x, from.y);
    const rim0 = at(outerR, b0);
    ctx.lineTo(rim0.x, rim0.y);
    ctx.arc(cx, cy, outerR, b0, b1, ccw);
    const back = at(innerR, n1);
    ctx.lineTo(back.x, back.y);
    if (innerR > 0 && towards * (n1 - n0) > 0) ctx.arc(cx, cy, innerR, n1, n0, !ccw);
    ctx.closePath();
    return;
  }

  const rhoO = outerR - r;
  const dO = Math.asin(Math.min(1, r / rhoO)) * towards;
  const footO = Math.sqrt(Math.max(0, rhoO * rhoO - r * r)); // tangent point on the radial edge
  const c0 = b0 + dO; // leading outer corner centre
  const c1 = b1 - dO; // trailing outer corner centre

  // The hole's corners, if there is a hole. Their circles sit OUTSIDE it, so
  // the centre is at innerR + r; and the edge's own inset differs at that
  // radius from what it is at the rim, so the angles are taken there.
  const donut = innerR > 0;
  const rhoI = innerR + r;
  const dI = Math.asin(Math.min(1, r / rhoI)) * towards;
  const footI = Math.sqrt(Math.max(0, rhoI * rhoI - r * r));
  const i0 = edgeAt(a0, towards, rhoI);
  const i1 = edgeAt(a1, -towards, rhoI);
  const e0 = i0 + dI; // leading inner corner centre
  const e1 = i1 - dI; // trailing inner corner centre
  // Perpendicular to each edge, pointing out of the slice — where a corner
  // circle touches the edge, at both ends of it.
  const off0 = b0 + (ccw ? Math.PI / 2 : -Math.PI / 2);
  const off1 = b1 + (ccw ? -Math.PI / 2 : Math.PI / 2);

  const from = at(donut ? footI : 0, i0);
  ctx.moveTo(from.x, from.y);
  const start = at(footO, b0);
  ctx.lineTo(start.x, start.y);
  // Leading corner: radial edge → outer arc.
  ctx.arc(at(rhoO, c0).x, at(rhoO, c0).y, r, off0, c0, ccw);
  // The outer arc between the two corners.
  ctx.arc(cx, cy, outerR, c0, c1, ccw);
  // Trailing corner: outer arc → radial edge.
  ctx.arc(at(rhoO, c1).x, at(rhoO, c1).y, r, c1, off1, ccw);
  const back = at(footO, b1);
  ctx.lineTo(back.x, back.y);
  if (donut) {
    const inner = at(footI, i1);
    ctx.lineTo(inner.x, inner.y);
    // Trailing inner corner: radial edge → the hole.
    ctx.arc(at(rhoI, e1).x, at(rhoI, e1).y, r, off1, e1 + Math.PI, ccw);
    if (towards * (e1 - e0) > 0) ctx.arc(cx, cy, innerR, e1, e0, !ccw);
    // Leading inner corner: the hole → radial edge.
    ctx.arc(at(rhoI, e0).x, at(rhoI, e0).y, r, e0 + Math.PI, off0, ccw);
  } else {
    const tip = at(0, i1);
    ctx.lineTo(tip.x, tip.y);
  }
  ctx.closePath();
}

/** The slice fields `traceSlice` needs. */
type SceneArc = Pick<
  SceneSlice,
  'cx' | 'cy' | 'innerR' | 'outerR' | 'startAngle' | 'endAngle' | 'cornerRadius' | 'gap'
>;


/**
 * The gradient for one area fill.
 *
 * The fade runs from the series' own edge toward the baseline, so the fill
 * thins out where it meets the axis instead of competing with it. Two details
 * matter:
 *
 *  • It is measured over the WHOLE painted extent, not from the line down to
 *    the baseline. A series that crosses zero paints past the baseline, and a
 *    gradient that stopped there left everything beyond it clamped to the
 *    transparent end stop — the negative half of the chart was nearly invisible.
 *  • The faint stop therefore sits AT the baseline's offset within that extent,
 *    with the solid colour at both ends. A crossing series then fades toward
 *    zero from above and from below; an all-positive or all-negative one puts
 *    the baseline at one end, which collapses back to a plain two-stop fade.
 *
 * An inverted chart fills out from a baseline X, so the same reasoning runs
 * along x (`horizontal`). A band fill — stacked layer or range — has equal
 * stops, so the geometry here makes no difference to it.
 */
function areaGradient(ctx: CanvasRenderingContext2D, a: SceneArea, hasBase: boolean): CanvasGradient {
  const horiz = !!a.horizontal;
  const at = (p: { x: number; y: number }) => (horiz ? p.x : p.y);
  const coords = a.points.map(at);
  if (hasBase) coords.push(...a.basePoints!.map(at));
  // `baselineY` carries the baseline on whichever axis the fill closes against.
  coords.push(a.baselineY);
  const lo = Math.min(...coords);
  const hi = Math.max(...coords);
  const grad = horiz ? ctx.createLinearGradient(lo, 0, hi, 0) : ctx.createLinearGradient(0, lo, 0, hi);
  const span = hi - lo;
  // Degenerate extent (a flat fill): a plain two-stop gradient is all there is.
  if (span < 1e-6) {
    grad.addColorStop(0, a.colorTop);
    grad.addColorStop(1, a.colorBottom);
    return grad;
  }
  const t = (a.baselineY - lo) / span;
  if (t <= 1e-4) {
    // Baseline at the low end: fade outward from it (an all-negative series,
    // or an upright inverted fill running left-to-right).
    grad.addColorStop(0, a.colorBottom);
    grad.addColorStop(1, a.colorTop);
  } else if (t >= 1 - 1e-4) {
    grad.addColorStop(0, a.colorTop);
    grad.addColorStop(1, a.colorBottom);
  } else {
    grad.addColorStop(0, a.colorTop);
    grad.addColorStop(t, a.colorBottom);
    grad.addColorStop(1, a.colorTop);
  }
  return grad;
}


/** An unlikely colour, used to detect a rejected `fillStyle` assignment. */
const SENTINEL = '#010203';

/**
 * Draw the scene onto a 2D context already scaled to `dpr` (so
 * coordinates are in CSS pixels). Clears first.
 */
export function drawSceneCanvas(ctx: CanvasRenderingContext2D, scene: RenderScene, clear = true): void {
  // A transition that has two levels on screen at once draws the second one
  // OVER the first, so it must not wipe what is already there.
  if (clear) ctx.clearRect(0, 0, scene.width, scene.height);

  if (scene.background) {
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, scene.width, scene.height);
  }

  // ── axis bands (furthest back — the classification the data is read against) ──
  for (const b of scene.bands ?? []) {
    // A colour the context cannot parse is REJECTED, leaving fillStyle at
    // whatever was drawn last — so a bad band colour silently paints in another
    // series' colour instead of failing. Assign a sentinel first and check it
    // actually moved.
    ctx.fillStyle = SENTINEL;
    ctx.fillStyle = b.color;
    if (ctx.fillStyle === SENTINEL) continue;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // ── gridlines (background — beneath the area fills / lines) ──
  for (const g of scene.gridlines) {
    ctx.beginPath();
    ctx.strokeStyle = g.color;
    ctx.lineWidth = g.width;
    if (g.dash) ctx.setLineDash(g.dash);
    ctx.moveTo(g.x1, g.y1);
    ctx.lineTo(g.x2, g.y2);
    ctx.stroke();
    if (g.dash) ctx.setLineDash([]);
  }

  // ── area fills (over the gridlines, under the lines) ──
  for (const a of scene.areas) {
    if (a.points.length < 2) continue;
    const hasBase = !!(a.basePoints && a.basePoints.length);
    ctx.beginPath();
    ctx.moveTo(a.points[0].x, a.points[0].y);
    for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
    if (hasBase) {
      for (let i = a.basePoints!.length - 1; i >= 0; i--) ctx.lineTo(a.basePoints![i].x, a.basePoints![i].y);
    } else {
      ctx.lineTo(a.points[a.points.length - 1].x, a.baselineY);
      ctx.lineTo(a.points[0].x, a.baselineY);
    }
    ctx.closePath();
    ctx.fillStyle = areaGradient(ctx, a, hasBase);
    ctx.fill();
  }

  // ── axis lines (dashable, like the gridlines above) ──
  for (const a of scene.axisLines) {
    ctx.beginPath();
    ctx.strokeStyle = a.color;
    ctx.lineWidth = a.width;
    if (a.dash) ctx.setLineDash(a.dash);
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
    if (a.dash) ctx.setLineDash([]);
  }

  // ── bars ──
  for (const b of scene.bars) {
    if (b.w <= 0 || b.h <= 0) continue;
    ctx.beginPath();
    ctx.fillStyle = b.color;
    if (b.arrow) {
      traceChevron(ctx, b);
      ctx.fill();
      continue;
    }
    const maxR = Math.min(b.w, b.h) / 2;
    const rr = b.radius.map((r) => Math.max(0, Math.min(r, maxR))) as [number, number, number, number];
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(b.x, b.y, b.w, b.h, rr);
    } else {
      ctx.rect(b.x, b.y, b.w, b.h);
    }
    ctx.fill();
  }


  // ── pie / donut slices ──
  // What shows through the gaps, first: every wedge at full size, as ONE path
  // filled once. One path rather than a fill per slice because two abutting
  // shapes each land half-covered pixels on their shared edge, and source-over
  // does not add those back to full — separate fills would leave a faint seam
  // down the middle of every gap.
  const backed = scene.slices.filter((s) => !s.pill && s.gap && s.gapColor && s.endAngle !== s.startAngle);
  if (backed.length) {
    ctx.beginPath();
    for (const s of backed) traceSlice(ctx, { ...s, gap: 0 }, false);
    ctx.fillStyle = backed[0].gapColor!;
    ctx.fill();
  }
  for (const s of scene.slices) {
    if (s.endAngle === s.startAngle) continue;
    if (s.pill) {
      // A stroked arc: `lineWidth` is the band's thickness and the round caps
      // ARE its rounded ends, which a filled path cannot give on the inner side.
      const mid = (s.innerR + s.outerR) / 2;
      const thickness = Math.abs(s.outerR - s.innerR);
      if (thickness <= 0 || mid <= 0) continue;
      // A band with explicit per-end caps (a polar stack segment) strokes FLAT so
      // it abuts its neighbours seamlessly, then adds a round-cap disc only where
      // the ring truly starts / ends. Without them (a lone pill / a pie's thin
      // slice) it keeps round caps on both ends as before.
      const perEnd = s.capStart !== undefined || s.capEnd !== undefined;
      ctx.beginPath();
      ctx.fillStyle = s.color;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = thickness;
      ctx.lineCap = perEnd ? 'butt' : 'round';
      ctx.arc(s.cx, s.cy, mid, s.startAngle, s.endAngle, s.endAngle < s.startAngle);
      ctx.stroke();
      if (perEnd) {
        const cap = (angle: number): void => {
          ctx.beginPath();
          ctx.arc(s.cx + mid * Math.cos(angle), s.cy + mid * Math.sin(angle), thickness / 2, 0, Math.PI * 2);
          ctx.fill();
        };
        if (s.capStart) cap(s.startAngle);
        if (s.capEnd) cap(s.endAngle);
      }
      ctx.lineCap = 'butt';
      continue;
    }
    // A gradient runs along the slice's OWN mid-angle, inner edge to outer, so
    // every wedge is lit from the middle of the ring outward. A single gradient
    // across the whole canvas would light the left of the pie differently from
    // the right, which reads as a shadow rather than as depth.
    if (s.gradient) {
      const mid = (s.startAngle + s.endAngle) / 2;
      const g = ctx.createLinearGradient(
        s.cx + Math.cos(mid) * s.innerR,
        s.cy + Math.sin(mid) * s.innerR,
        s.cx + Math.cos(mid) * s.outerR,
        s.cy + Math.sin(mid) * s.outerR,
      );
      g.addColorStop(0, s.gradient.from);
      g.addColorStop(1, s.gradient.to);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = s.color;
    }
    traceSlice(ctx, s);
    ctx.fill();
  }

  // ── press ripple (over the slice it started on, under everything else) ──
  const rip = scene.ripple;
  if (rip && rip.alpha > 0 && rip.radius > 0) {
    const host = scene.slices.find((s) => !s.pill && s.dataIndex === rip.dataIndex);
    if (host) {
      ctx.save();
      // Clipped to the wedge, so the circle reads as the SLICE responding to
      // the press rather than as a disc drawn over the chart.
      traceSlice(ctx, host);
      ctx.clip();
      // Multiplied in, not assigned: a drill in flight is already drawing this
      // level at a partial alpha and the ripple has to fade with it.
      ctx.globalAlpha *= rip.alpha;
      ctx.fillStyle = rip.color;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── series lines ──
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const line of scene.lines) {
    if (line.points.length < 2) {
      // A single point still deserves a dot.
      if (line.points.length === 1) {
        ctx.beginPath();
        ctx.fillStyle = line.color;
        ctx.arc(line.points[0].x, line.points[0].y, line.width, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.beginPath();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.width;
    // Round is right for a data line; a separator wants none, or its cap pokes
    // a half-width nub past the pie's rim.
    ctx.lineCap = line.cap ?? 'round';
    ctx.setLineDash(line.dash ?? []);
    ctx.moveTo(line.points[0].x, line.points[0].y);
    for (let i = 1; i < line.points.length; i++) ctx.lineTo(line.points[i].x, line.points[i].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineCap = 'round';

  // ── markers ──
  for (const m of scene.markers) {
    ctx.beginPath();
    const poly = markerPolygon(m.symbol, m.x, m.y, m.r);
    if (poly) {
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
    } else {
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    }
    if (m.hollow) {
      // Open marker: fill with the surface so the line is occluded, ring in colour.
      ctx.fillStyle = m.fill ?? 'rgba(0,0,0,0)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = m.color;
      ctx.stroke();
    } else {
      ctx.fillStyle = m.color;
      ctx.fill();
      // white halo so overlapping markers stay legible
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
    }
  }
}
