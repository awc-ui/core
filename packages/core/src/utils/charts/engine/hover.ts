/*
 * Chart engine — hover crosshair + tooltip
 * ===========================================================
 * Builds the DOM hover UI (a plot-height crosshair, highlighted
 * per-series dots, and an MD3-styled tooltip card) for a hovered
 * x index. Lives in its own overlay layer so it updates on
 * pointermove without re-running the plot render.
 * ===========================================================
 */

import { prefersReducedMotion } from './animate';
import {
  isDomNode,
  type MdChartMissingFormatter,
  type MdChartTooltipContext,
  type MdChartTooltipRenderer,
  type MdChartTooltipSeries,
} from '../tooltip';
import type { RenderScene } from './scene';

/** Optional hover extras — kept in one bag so the positional argument list
 *  doesn't keep growing. */
export interface HoverOptions {
  /** Developer-supplied tooltip content. See {@link MdChartTooltipRenderer}. */
  render?: MdChartTooltipRenderer;
  /** Consulted for a series with no value at the hovered x; a non-empty return
   *  opts that series into a tooltip row. See {@link MdChartMissingFormatter}. */
  missingFormatter?: MdChartMissingFormatter;
  /** Host is right-to-left: the card prefers the crosshair's LEFT side, so it
   *  opens along the reading direction instead of against it. */
  rtl?: boolean;
  /**
   * `'item'` reports only the series under the cursor; `'axis'` (default) lists
   * every series at the hovered x. Item suits a chart where the pointer is
   * genuinely *on* one series — a thick stacked band, a streamgraph — where an
   * every-series list buries the one thing the user is pointing at.
   */
  trigger?: 'axis' | 'item';
}

export function clearHover(layer: HTMLElement): void {
  layer.textContent = '';
  delete layer.dataset.hoverIndex;
}

const SURFACE = 'var(--md-sys-color-surface, #FFFBFE)';
const SHAPE_KEYS = new Set(['circle', 'square', 'diamond', 'triangle', 'triangle-down']);
const SHAPE_CLIP: Record<string, string> = {
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  triangle: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  'triangle-down': 'polygon(0% 0%, 100% 0%, 50% 100%)',
};

/** Build the hover highlight for a point, matching its marker symbol:
 *  emoji → the (enlarged) glyph itself; square/diamond/triangle → a
 *  surface-outlined colour shape; otherwise the classic ringed circle.
 *  Centred on (x, y) via a -50%/-50% translate the pop animation preserves. */
function buildHoverMarker(symbol: string | undefined, color: string, x: number, y: number): HTMLElement {
  const el = document.createElement('div');
  const base = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);pointer-events:none`;

  // Emoji / text glyph → scale the glyph up; don't cover it with a circle.
  if (symbol && !SHAPE_KEYS.has(symbol)) {
    el.textContent = symbol;
    el.style.cssText = `${base};font-size:22px;line-height:1;user-select:none`;
    return el;
  }

  // Squares/diamonds fill their box so they read larger than a circle of equal
  // width — size polygons down so every symbol has similar visual weight.
  const size = symbol && symbol !== 'circle' ? 11 : 13;
  el.style.cssText = `${base};width:${size}px;height:${size}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))`;
  if (!symbol || symbol === 'circle') {
    el.style.cssText += `;box-sizing:border-box;border-radius:50%;background:${color};border:2px solid ${SURFACE}`;
    return el;
  }
  // Polygon shapes: a slightly larger surface shape behind the colour fill gives
  // the same "ring" separation the circle's border does (clip-path has no border).
  const clip = SHAPE_CLIP[symbol] ?? 'none'; // square = plain rectangle
  const outline = document.createElement('div');
  outline.style.cssText = `position:absolute;inset:-2px;background:${SURFACE};clip-path:${clip}`;
  const fill = document.createElement('div');
  fill.style.cssText = `position:absolute;inset:0;background:${color};clip-path:${clip}`;
  el.append(outline, fill);
  return el;
}

/** Expressive scale-in for a freshly-hovered point marker (base size → slight
 *  overshoot → settle), centred so the -50%/-50% translate is preserved. */
function popMarker(dot: HTMLElement): void {
  if (typeof dot.animate !== 'function') return; // WAAPI unavailable (older env / SSR)
  // MD3-expressive spatial spring: overshoot past full size, settle back with a
  // small counter-bounce, on the emphasized-decelerate curve.
  dot.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.4)', offset: 0 },
      { transform: 'translate(-50%,-50%) scale(1.25)', offset: 0.45 },
      { transform: 'translate(-50%,-50%) scale(0.94)', offset: 0.72 },
      { transform: 'translate(-50%,-50%) scale(1)', offset: 1 },
    ],
    { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  );
}

/** The MD3 card chrome shared by the built-in tooltip and a custom one, so a
 *  developer who only replaces the CONTENT still gets the surface for free.
 *  Opt out with `::part(tooltip) { background: none; box-shadow: none; … }`.
 *  Deliberately stops short of `box-sizing` / `min-width` / `white-space`: the
 *  two cards want different values, and the built-in one must keep the exact
 *  box it has always had. */
function tooltipCardCss(fontSize: number, fontFamily: string): string[] {
  return [
    'position:absolute',
    'pointer-events:none',
    'background:var(--md-sys-color-surface-container-high, #ECE6F0)',
    'color:var(--md-sys-color-on-surface, #1C1B1F)',
    'border-radius:8px',
    'padding:8px 10px',
    'box-shadow:0 2px 6px rgba(0,0,0,0.15),0 1px 2px rgba(0,0,0,0.2)',
    `font:400 ${fontSize}px ${fontFamily}`,
  ];
}

/**
 * Insert a renderer's return value into the tooltip card.
 *
 * A `Node` goes in as-is. A bare string is set as TEXT — markup inside it is
 * shown, not parsed — so untrusted values are safe by default. `innerHTML` is
 * only ever reached through the explicitly-named `{ unsafeHtml }` form, which
 * is NOT sanitised.
 */
export function appendTooltipContent(tip: HTMLElement, content: Node | string | { unsafeHtml: string }): void {
  if (isDomNode(content)) {
    tip.appendChild(content);
    return;
  }
  if (typeof content === 'object' && typeof content.unsafeHtml === 'string') {
    tip.innerHTML = content.unsafeHtml;
    return;
  }
  tip.textContent = String(content);
}

export function renderHover(
  layer: HTMLElement,
  scene: RenderScene,
  index: number,
  yFormatter: (v: number) => string,
  fontFamily: string,
  cursor: { x: number; y: number },
  orient: 'vertical' | 'horizontal' | 'none' = 'vertical',
  focusSeries = -1,
  opts: HoverOptions = {},
): void {
  // Only scale-in when the hovered point actually CHANGES — moving the pointer
  // within one point's region re-runs renderHover every frame, and re-animating
  // each time would jitter.
  const isNewPoint = layer.dataset.hoverIndex !== String(index);
  layer.textContent = '';
  if (index < 0) {
    delete layer.dataset.hoverIndex;
    return;
  }
  // For a vertical plot xPositions holds x-coords; for a horizontal
  // (bar) plot it holds the category y-coords along the main axis.
  const pos = scene.xPositions[index];
  if (pos == null) return;
  layer.dataset.hoverIndex = String(index);
  const animateDots = isNewPoint && !prefersReducedMotion();
  const plot = scene.plot;

  // ── crosshair (runs across the plot, perpendicular to the category axis) ──
  // The 1px line is centred on `pos` via a -50% translate so it can't sit half a
  // pixel off the markers.
  //
  // It reads as the pointer's position, so it has to stay legible wherever the
  // pointer goes. A muted outline at half opacity did that over an empty plot
  // and vanished completely over a filled one — on an area chart the crosshair
  // simply disappeared into the bands. So: the on-surface colour rather than
  // the outline one, and a surface-coloured halo (the box-shadow, which the
  // element's own opacity fades with it) so the line separates from a dark fill
  // and a light one alike — the same trick the point markers use.
  // 'none' skips the crosshair but keeps the tooltip: on a radial plot a
  // straight line across the chart crosses every ring at an angle that means
  // nothing, so there is no reading for it to mark.
  // Normally the crosshair is exactly the plot's span. A chevron is the
  // exception: its tip overflows the bar's rect, so the outermost segments point
  // PAST the axis extent and their markers land outside the plot. A line that
  // stopped at the plot edge would leave those end markers floating unattached,
  // so stretch it to whichever markers this index actually has.
  let lo = orient === 'horizontal' ? plot.x : plot.y;
  let hi = lo + (orient === 'horizontal' ? plot.width : plot.height);
  if (orient !== 'none') {
    for (const hp of scene.hoverPoints) {
      const pt = hp.byIndex?.[index];
      if (!pt) continue;
      const v = orient === 'horizontal' ? pt.x : pt.y;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  }

  const line = document.createElement('div');
  line.style.cssText = [
    'position:absolute',
    'box-sizing:border-box',
    orient === 'horizontal'
      ? `left:${lo}px;top:${pos}px;width:${hi - lo}px;height:1px;transform:translateY(-50%)`
      : `left:${pos}px;top:${lo}px;height:${hi - lo}px;width:1px;transform:translateX(-50%)`,
    'background:var(--md-sys-color-on-surface, #1C1B1F)',
    'box-shadow:0 0 0 1px var(--md-sys-color-surface, #FFFBFE)',
    'opacity:0.7',
  ].join(';');
  if (orient !== 'none') layer.appendChild(line);

  // ── per-series highlight markers + tooltip rows ──
  // `present` / `absent` mirror the two halves of the tooltip context: a series
  // with a real reading at this x, and one without (a null gap, or no datum at
  // all — partial and irregular data both land here). They are only filled in
  // for a custom renderer; renderHover runs on every hover frame, so the plain
  // path must not allocate a payload nobody reads.
  const wantContext = !!opts.render;
  const present: MdChartTooltipSeries[] = [];
  const absent: MdChartTooltipSeries[] = [];
  const rows: { color?: string; label: string; value: string }[] = [];
  const itemOnly = opts.trigger === 'item' && focusSeries >= 0;
  for (const hp of scene.hoverPoints) {
    // Item trigger: everything except the pointed-at series is dropped, rows
    // and highlight alike, so the card answers "what am I on" and nothing else.
    if (itemOnly && hp.seriesIndex !== focusSeries) continue;
    // Multi-axis: each series formats its value with its own axis formatter.
    const format = hp.valueFormat ?? yFormatter;
    const focused = hp.seriesIndex === focusSeries;
    const p = hp.byIndex[index];
    if (p) {
      // A fill-only series has no line and no markers, so there is nothing for a
      // dot to sit on — it would mark the band's top edge, which on a stack is a
      // cumulative total rather than this series' reading. Crosshair and row stay.
      // A bar coloured per-point (a bar race, a per-category palette) carries
      // its own colour on the point; the dot + swatch use it so they match the
      // bar under the cursor rather than the series default. Falls back to the
      // series colour for everything else (lines, ordinary bars).
      const swatch = p.color ?? hp.color;
      // A radial plot (`orient: 'none'`) has no straight reading a dot marks — a
      // ring is a band, not a point — so it shows the tooltip alone, no dots.
      if (!hp.unanchored && orient !== 'none') {
        // The highlight mirrors the point's marker (square / diamond / emoji / …)
        // rather than always a circle, so it doesn't mask the real symbol.
        const marker = buildHoverMarker(p.symbol, swatch, p.x, p.y);
        // A non-focused series is faded on the plot — fade its highlight to
        // match, and don't pop it (only the focused point gets the emphasis pop).
        const dimmed = focusSeries >= 0 && !focused;
        if (dimmed) marker.style.opacity = '0.4';
        layer.appendChild(marker);
        if (animateDots && !dimmed) popMarker(marker);
      }
      // A range series has no single value — print the band, since its `value`
      // is only the top edge and would read as a reading it never took.
      const value = p.low != null && p.high != null ? `${format(p.low)} – ${format(p.high)}` : format(p.value);
      rows.push({ color: swatch, label: hp.label, value });
      if (wantContext) present.push({ seriesIndex: hp.seriesIndex, label: hp.label, color: hp.color, value: p.value, formattedValue: value, focused, missing: false });
      continue;
    }
    // No reading here. `null` means the series HAS a datum that is null (or
    // non-finite) — "measured, no value"; `undefined` means it has no datum at
    // this x at all. The default is still to omit the series, but the chart's
    // valueFormatter can name the absence and opt it back in.
    if (!wantContext && !opts.missingFormatter) continue;
    const raw = hp.values?.[index];
    const value: null | undefined = typeof raw === 'number' ? null : raw;
    const text = opts.missingFormatter ? opts.missingFormatter(value) : '';
    if (wantContext) absent.push({ seriesIndex: hp.seriesIndex, label: hp.label, color: hp.color, value, formattedValue: text, focused, missing: true });
    // No highlight marker is drawn for it — there is no point on the plot to
    // highlight — and the row below carries no colour swatch either, so it
    // never reads as a data point.
    if (text) rows.push({ label: hp.label, value: text });
  }

  const fontSize = scene.texts[0]?.fontSize ?? 12;

  // ── custom tooltip content ──
  if (opts.render) {
    const context: MdChartTooltipContext = {
      dataIndex: index,
      axisValue: scene.xValues[index],
      axisLabel: scene.xLabels[index] ?? '',
      series: present,
      missing: absent,
      focusedSeriesIndex: focusSeries,
    };
    let content: ReturnType<MdChartTooltipRenderer>;
    try {
      content = opts.render(context);
    } catch (err) {
      // A throwing renderer must not take the whole hover loop down with it —
      // report it and fall back to the built-in card.
      console.error('[md-chart] tooltipRenderer threw; falling back to the default tooltip', err);
      content = undefined;
    }
    if (content === null) return; // explicit "no tooltip at this x"
    if (content !== undefined) {
      const custom = document.createElement('div');
      custom.setAttribute('part', 'tooltip');
      // No `min-width` / `white-space:nowrap` (they fight multi-line custom
      // layouts), and a max-width of the chart box so content far wider than the
      // default card is still narrow enough for the flip below to have somewhere
      // to put it. `border-box` so that cap includes the card's own padding.
      custom.style.cssText = [
        ...tooltipCardCss(fontSize, fontFamily),
        'z-index:2',
        'box-sizing:border-box',
        `max-width:${Math.max(0, scene.width - 8)}px`,
      ].join(';');
      appendTooltipContent(custom, content);
      positionTooltip(custom, layer, scene, cursor, orient, pos);
      return;
    }
  }

  if (!rows.length) return;

  // ── tooltip card ──
  const tip = document.createElement('div');
  tip.setAttribute('part', 'tooltip');
  tip.style.cssText = [...tooltipCardCss(fontSize, fontFamily), 'min-width:96px', 'z-index:2', 'white-space:nowrap'].join(';');

  const header = document.createElement('div');
  header.textContent = scene.xLabels[index] ?? '';
  header.style.cssText = 'font-weight:600;margin-bottom:4px';
  tip.appendChild(header);

  for (const r of rows) {
    const row = document.createElement('div');
    // A missing-value row is dimmed and its value is not bolded, so it reads as
    // an absence rather than as data.
    row.style.cssText = `display:flex;align-items:center;gap:8px;line-height:1.5${r.color ? '' : ';opacity:0.62'}`;
    const sw = document.createElement('span');
    // Missing rows keep the swatch's BOX (so labels stay in one column) but
    // never its colour — a swatch would imply a data point that isn't there.
    sw.style.cssText = r.color
      ? `width:10px;height:10px;border-radius:3px;background:${r.color};flex:none`
      : 'width:10px;height:10px;flex:none';
    const lbl = document.createElement('span');
    lbl.textContent = r.label;
    lbl.style.cssText = 'flex:1';
    const val = document.createElement(r.color ? 'strong' : 'span');
    val.textContent = r.value;
    row.append(sw, lbl, val);
    tip.appendChild(row);
  }

  positionTooltip(tip, layer, scene, cursor, orient, pos, opts.rtl);
}

/** Place a tooltip card near the crosshair, opening along the reading direction
 *  and flipping away from the far / bottom edges. Measuring needs it in the DOM,
 *  so it is appended first. */
function positionTooltip(
  tip: HTMLElement,
  layer: HTMLElement,
  scene: RenderScene,
  cursor: { x: number; y: number },
  orient: 'vertical' | 'horizontal' | 'none',
  pos: number,
  rtl = false,
): void {
  layer.appendChild(tip);
  const tw = tip.offsetWidth || 120;
  const th = tip.offsetHeight || 60;
  // A card taller than the host (a sparkline is only ~28px) cannot sit INSIDE it —
  // clamping it there just hides it under the layer's clip. Let it ESCAPE: stop
  // clipping the layer and float the card just ABOVE the host, centred on the
  // cursor but kept mostly over the host so it never wanders off on either side.
  if (th + 8 > scene.height) {
    layer.style.overflow = 'visible';
    const l = Math.max(24 - tw, Math.min(cursor.x - tw / 2, scene.width - 24));
    tip.style.left = `${Math.round(l)}px`;
    // Escaping ALWAYS upward is what a sparkline wants, but a short chart near
    // the top of the page then floats its card off the screen entirely — the
    // reading is unreachable, which is worse than the clipping this branch
    // exists to avoid. So pick the side that actually has room in the viewport,
    // preferring above (it covers the chart's own header rather than the next
    // section) and falling back to below when it would overflow the top.
    const box = layer.getBoundingClientRect();
    const roomAbove = box.top - th - 6 >= 0;
    // Below the PLOT, not below the scene: `scene.height` spans the legend and
    // axis gutter too, so clearing it parks the card a legend-height from the
    // data it describes. The card is transient and floats, so overlapping the
    // legend is the right trade for sitting next to the reading.
    const plotBottom = scene.plot ? scene.plot.y + scene.plot.height : scene.height;
    tip.style.top = roomAbove ? `${Math.round(-th - 6)}px` : `${Math.round(plotBottom + 6)}px`;
    return;
  }
  let left: number;
  let top: number;
  if (orient === 'none') {
    // Radial: there is no axis line to anchor to (`pos` is a ring radius, not a
    // screen position), so the card sits beside the POINTER — flipping to stay
    // on-screen — the way a plain cursor tooltip does.
    left = cursor.x + 14;
    if (left + tw > scene.width - 4) left = cursor.x - tw - 14;
    left = Math.max(4, Math.min(left, scene.width - tw - 4));
    top = cursor.y + 14;
    if (top + th > scene.height - 4) top = cursor.y - th - 14;
    top = Math.max(4, Math.min(top, scene.height - th - 4));
  } else if (orient === 'horizontal') {
    top = pos + 14;
    if (top + th > scene.height - 4) top = pos - th - 14;
    top = Math.max(4, top);
    left = rtl
      ? Math.max(4, Math.min(cursor.x - tw - 14, scene.width - tw - 4))
      : Math.max(4, Math.min(cursor.x + 14, scene.width - tw - 4));
  } else {
    // RTL opens to the left of the crosshair and flips right when it would run
    // off that edge; LTR is the mirror of the same rule.
    left = rtl ? pos - tw - 14 : pos + 14;
    if (rtl ? left < 4 : left + tw > scene.width - 4) left = rtl ? pos + 14 : pos - tw - 14;
    left = Math.max(4, Math.min(left, scene.width - tw - 4));
    top = Math.max(4, Math.min(cursor.y - th / 2, scene.height - th - 4));
  }
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}
