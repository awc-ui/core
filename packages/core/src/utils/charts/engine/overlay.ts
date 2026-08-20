/*
 * Chart engine — DOM text overlay
 * ===========================================================
 * Renders the scene's text (title, tick labels, axis titles) and
 * the clickable legend as real DOM on top of the plot canvas.
 * Keeping text in the DOM (rather than baked into the canvas)
 * means it's crisp at any DPR, selectable, and — with the host's
 * a11y data table — keeps the chart accessible. Rebuilt each frame
 * (charts re-render occasionally, not per-frame) for simplicity.
 * ===========================================================
 */

import { LEGEND_SIDE_MAX_FRACTION } from './scene';
import type { EndLabel, GlyphMarker, LegendItem, RenderScene } from './scene';
import { chevronTipDepth } from './renderer-canvas';

const ALIGN_X: Record<string, string> = { start: '0', center: '-50%', end: '-100%' };
const ALIGN_Y: Record<string, string> = { top: '0', middle: '-50%', bottom: '-100%' };

export interface OverlayCallbacks {
  onLegendClick?: (item: LegendItem) => void;
}

/** `top-start` / `bottom-end` anchor to a corner; plain `top` / `bottom` centre. */
function isCorner(pos: string): boolean {
  return pos.includes('-');
}

/**
 * Reconcile the end-of-line series-name labels into a PERSISTENT layer, keyed by
 * series, so each label element survives across frames — its `opacity` then
 * CSS-transitions, fading a name IN when its slot opens and OUT when it collides
 * with a higher one. Position tracks the line end directly (no lag).
 */
export function renderEndLabels(layer: HTMLElement, labels: EndLabel[] = [], fontFamily = 'sans-serif'): void {
  const seen = new Set<string>();
  for (const e of labels) {
    seen.add(e.key);
    let el = layer.querySelector<HTMLSpanElement>(`[data-k="${e.key}"]`);
    if (!el) {
      el = document.createElement('span');
      el.dataset.k = e.key;
      el.style.cssText = 'position:absolute;white-space:nowrap;pointer-events:none;user-select:none;font-weight:500;opacity:0;transition:opacity 240ms ease';
      layer.appendChild(el);
      el.getBoundingClientRect(); // commit opacity:0 before the fade-in target
    }
    el.textContent = e.text;
    // The label hangs off the END of the line, so it extends away from the
    // data: right of the point for an LTR line, left of it once the scene is
    // mirrored (translate(-100%) right-aligns it onto that gap).
    const end = e.side === 'end';
    el.style.transform = end ? 'translate(-100%,-50%)' : 'translate(0,-50%)';
    el.style.left = `${end ? e.x - 12 : e.x + 12}px`;
    el.style.top = `${e.y}px`;
    el.style.fontSize = `${e.size}px`;
    el.style.color = e.color;
    el.style.fontFamily = fontFamily;
    el.style.opacity = e.visible ? '1' : '0';
  }
  // Series that vanished (e.g. toggled off) fade out, then are removed.
  for (const el of Array.from(layer.children) as HTMLElement[]) {
    if (!seen.has(el.dataset.k ?? '')) {
      el.style.opacity = '0';
      el.dataset.gone = '1';
      setTimeout(() => {
        if (el.dataset.gone === '1') el.remove();
      }, 280);
    } else {
      // `delete el.dataset.gone` is a silent no-op outside a real browser
      // (mock-doc keeps both the property and the attribute), which would leave
      // the pending timeout below free to remove a label that came back.
      el.removeAttribute('data-gone');
    }
  }
}

/**
 * (Re)draw the emoji / text point markers into their own layer. Kept out of
 * syncOverlay so the engine can re-render them each animation frame (they
 * rise / reveal / fade with the line) without rebuilding the static chrome.
 */
export function renderGlyphs(layer: HTMLElement, glyphs: GlyphMarker[] = [], fontFamily = 'sans-serif'): void {
  layer.textContent = '';
  for (const g of glyphs) {
    const el = document.createElement('span');
    el.textContent = g.text;
    const lbl = g.label;
    el.style.cssText = lbl
      ? [
          'position:absolute',
          `left:${g.x + lbl.dx}px`,
          `top:${g.y + lbl.dy}px`,
          `transform:translate(${lbl.anchorX},${lbl.anchorY})`,
          `font:${lbl.weight} ${g.size}px ${fontFamily}`,
          `color:${lbl.color}`,
          'line-height:1',
          'white-space:nowrap',
          'pointer-events:none',
          'user-select:none',
        ].join(';')
      : [
          'position:absolute',
          `left:${g.x}px`,
          `top:${g.y}px`,
          'transform:translate(-50%,-50%)',
          `font-size:${g.size}px`,
          'line-height:1',
          'pointer-events:none',
          'user-select:none',
        ].join(';');
    layer.appendChild(el);
  }
}

/**
 * (Re)draw the bar value labels into their own layer, positioning each from its
 * bar's CURRENT geometry so it tracks the bar's free end as the bar grows in
 * during the entry animation. Kept out of syncOverlay (which paints the static
 * chrome once) and re-called each frame like {@link renderGlyphs}. A label whose
 * bar isn't in the scene (a hidden series) is skipped.
 *
 * The bar the label belongs to may have been split into several pieces by a
 * broken value axis; the pieces share their cross-axis extent (only the value
 * axis is cut), so the label hangs off the OUTERMOST piece's free end — the
 * union of the pieces along the value axis.
 */
export function renderBarLabels(layer: HTMLElement, scene: RenderScene, fontFamily = 'sans-serif'): void {
  layer.textContent = '';
  const labels = scene.barLabels;
  if (!labels?.length) return;
  for (const bl of labels) {
    const pieces = scene.bars.filter((b) => b.seriesIndex === bl.seriesIndex && b.dataIndex === bl.dataIndex);
    if (!pieces.length) continue;
    const horizontal = !!pieces[0].horizontal;
    let loX = Infinity;
    let hiX = -Infinity;
    let loY = Infinity;
    let hiY = -Infinity;
    for (const b of pieces) {
      loX = Math.min(loX, b.x);
      hiX = Math.max(hiX, b.x + b.w);
      loY = Math.min(loY, b.y);
      hiY = Math.max(hiY, b.y + b.h);
    }
    let x: number;
    let y: number;
    let align: keyof typeof ALIGN_X;
    let baseline: keyof typeof ALIGN_Y;
    if (bl.inside) {
      // Centred within the bar (a stacked segment) — no free end to hang off.
      x = (loX + hiX) / 2;
      y = (loY + hiY) / 2;
      align = 'center';
      baseline = 'middle';
      // A chevron is not its rect: the drawn shape runs from the NOTCH APEX to
      // the TIP, both of which sit outside the rect by the tip depth. Centring
      // on the rect therefore lands the number short of the segment's visible
      // middle. Shift it along the arrow by half the two overhangs so it reads
      // as centred in the shape a reader actually sees.
      const arrow = pieces[0].arrow;
      if (arrow) {
        const tip = chevronTipDepth(horizontal ? hiY - loY : hiX - loX);
        const cut = pieces[0].notch === false ? 0 : tip;
        const shift = (arrow * (tip + cut)) / 2;
        if (horizontal) x += shift;
        else y -= shift;
      }
    } else if (horizontal) {
      // Just past the bar's free end along x; the label sits on the low side for
      // a negative bar, the high side otherwise.
      y = (loY + hiY) / 2;
      baseline = 'middle';
      x = bl.atLowEnd ? loX - 4 : hiX + 4;
      align = bl.atLowEnd ? 'end' : 'start';
    } else {
      // Vertical: past the top for a positive bar, below the bottom for a negative.
      x = (loX + hiX) / 2;
      align = 'center';
      y = bl.atLowEnd ? hiY + 4 : loY - 4;
      baseline = bl.atLowEnd ? 'top' : 'bottom';
    }
    const el = document.createElement('span');
    el.textContent = bl.text;
    el.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      `transform:translate(${ALIGN_X[align]},${ALIGN_Y[baseline]})`,
      `color:${bl.color}`,
      `font:${bl.fontWeight ?? 400} ${bl.size}px ${fontFamily}`,
      'white-space:nowrap',
      'pointer-events:none',
      'user-select:none',
    ].join(';');
    layer.appendChild(el);
  }
}

/**
 * The legend item a persistent chip currently stands for, and the live callbacks
 * for a persistent nav. Chips outlive a render (see `syncOverlay`), so the click
 * handler must read the CURRENT item/callback rather than close over the one that
 * happened to exist when the node was created.
 */
const chipItem = new WeakMap<HTMLElement, LegendItem>();
const navCallbacks = new WeakMap<HTMLElement, OverlayCallbacks>();

/** (Re)render the overlay DOM for a scene into `layer`. */
/**
 * @param layer       clipped layer holding the text items
 * @param legendLayer where the legend goes. Defaults to `layer`, but the charts
 *   pass a NON-clipping sibling: a focus ring is drawn outside the chip's box,
 *   and the legend sits flush against the plot's top edge, so inside the
 *   clipped layer the ring loses its outer pixels.
 */
export function syncOverlay(
  layer: HTMLElement,
  scene: RenderScene,
  fontFamily: string,
  cb: OverlayCallbacks = {},
  rtl = false,
  legendLayer: HTMLElement = layer,
): void {
  // The legend is PERSISTENT: a consumer that re-feeds `series` every frame (a
  // line-race) re-renders the overlay at 60fps, and a recreated <button> loses
  // the click. A human click holds ~50-150ms, so mousedown and mouseup would
  // land on different nodes and the browser would never fire `click` on either.
  // Everything else here is stateless text and is cheaper to rebuild.
  // Direct children only. Deliberately NOT `:scope > [part="legend"]` — mock-doc's
  // selector engine throws outright on `:scope` (as do older engines), which made
  // this whole function unrunnable under spec tests. Same reasoning as
  // `collectOptions` in utils/select-options.ts.
  const keptNav =
    (Array.from(legendLayer.children) as HTMLElement[]).find(
      (c) => c.getAttribute('part') === 'legend',
    ) ?? null;
  for (const child of Array.from(layer.childNodes)) {
    if (child !== keptNav) child.remove();
  }

  for (const t of scene.texts) {
    const span = document.createElement('span');
    span.textContent = t.text;
    if (t.key) span.dataset.key = t.key;
    span.style.cssText = [
      'position:absolute',
      `left:${t.x}px`,
      `top:${t.y}px`,
      `transform:translate(${ALIGN_X[t.align]},${ALIGN_Y[t.baseline]})${t.rotate ? ` rotate(${t.rotate}deg)` : ''}`,
      `color:${t.color}`,
      `font:${t.fontWeight ?? 400} ${t.fontSize}px ${fontFamily}`,
      'white-space:nowrap',
      'pointer-events:none',
    ].join(';');
    // The legend now lives in its own layer, so there is nothing to insert
    // before — and passing a node that isn't a child of `layer` would throw.
    // It still paints above the labels, because its layer is stacked after.
    layer.insertBefore(span, keptNav?.parentNode === layer ? keptNav : null);
  }

  // Legend — a wrap-flow row anchored to one corner/edge inside the plot.
  const visibleLegend = scene.legend.filter((l) => scene.legend.length > 1);
  if (visibleLegend.length) {
    const pos = scene.legendPosition ?? 'top-end';
    const isSide = pos === 'left' || pos === 'right';
    const atBottom = pos.startsWith('bottom');
    // `start`/`end` are logical: they follow the reading direction, so they swap
    // sides in RTL — as `left`/`right` (physical by name) deliberately do not.
    const logicalStart = pos.endsWith('start') || pos.endsWith('end') ? pos.endsWith('start') !== rtl : pos === 'left';
    const atStart = logicalStart;
    const nav = keptNav ?? document.createElement('div');
    nav.setAttribute('part', 'legend');
    // One delegated listener, bound once to the persistent nav. It reads the
    // chip's CURRENT item and the latest callbacks, so reused nodes never fire a
    // stale closure from an earlier render.
    if (!navCallbacks.has(nav)) {
      nav.addEventListener('click', (ev) => {
        const chip = (ev.target as HTMLElement | null)?.closest?.('button[data-series-index]') as HTMLElement | null;
        const item = chip ? chipItem.get(chip) : undefined;
        if (item) navCallbacks.get(nav)?.onLegendClick?.(item);
      });
    }
    navCallbacks.set(nav, cb);
    // Side legends (left/right) are a vertically-centred column. A corner
    // top/bottom legend anchors to that corner (max 88% wide). A PLAIN top /
    // bottom legend spans the FULL chart width so a crammed legend wraps across
    // the whole width (fewer rows) instead of a narrow centred block.
    if (isSide) {
      nav.style.cssText = [
        'position:absolute',
        'top:50%',
        pos === 'left' ? 'left:12px' : 'right:12px',
        'transform:translateY(-50%)',
        'display:flex',
        'flex-direction:column',
        'align-items:flex-start',
        'gap:6px',
        'max-height:92%',
        `max-width:${LEGEND_SIDE_MAX_FRACTION * 100}%`,
        // The clip keeps a long column from spilling over the plot, but it also
        // cut the focus ring off a chip against the edge — the ring is drawn
        // OUTSIDE the button's box, so it needs room inside the clip to land in.
        'box-sizing:border-box',
        'padding:6px',
        'overflow:hidden',
        'pointer-events:auto',
      ].join(';');
    } else if (isCorner(pos)) {
      nav.style.cssText = [
        'position:absolute',
        atBottom ? 'bottom:2px' : 'top:2px',
        atStart ? 'left:12px' : 'right:12px',
        'display:flex',
        'flex-wrap:wrap',
        'gap:4px 12px',
        atStart ? 'justify-content:flex-start' : 'justify-content:flex-end',
        'max-width:88%',
        'pointer-events:auto',
      ].join(';');
    } else {
      nav.style.cssText = [
        'position:absolute',
        atBottom ? 'bottom:2px' : 'top:2px',
        'left:12px',
        'right:12px',
        'display:flex',
        'flex-wrap:wrap',
        'gap:4px 12px',
        'justify-content:center',
        'pointer-events:auto',
      ].join(';');
    }
    // Reconcile chips by series index so each <button> survives re-renders.
    const existing = new Map<string, HTMLElement>();
    for (const el of Array.from(nav.children) as HTMLElement[]) {
      existing.set(el.dataset.seriesIndex ?? '', el);
    }
    visibleLegend.forEach((l, i) => {
      const key = String(l.seriesIndex);
      let chip = existing.get(key);
      if (!chip) {
        chip = document.createElement('button');
        (chip as HTMLButtonElement).type = 'button';
        chip.dataset.seriesIndex = key;
        chip.append(document.createElement('span'), document.createElement('span'));
      }
      existing.delete(key);
      chipItem.set(chip, l);
      chip.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'gap:6px',
        'background:none',
        'border:none',
        'padding:2px 4px',
        'cursor:pointer',
        // Keep each entry on one line + never shrink, so labels don't wrap
        // internally (which would inflate the legend's measured height).
        'white-space:nowrap',
        // A side legend is a narrow column, so a long name has nowhere to go:
        // it was clipped mid-word by the nav's overflow and read as a typo
        // ("Organic searc"). Let the chip shrink there and ellipsise instead —
        // a cut is unavoidable, but it should look deliberate.
        isSide ? 'flex:0 1 auto' : 'flex:none',
        'min-width:0',
        'max-width:100%',
        `font:400 ${scene.texts[0]?.fontSize ?? 11}px ${fontFamily}`,
        `color:${l.hidden ? 'var(--md-sys-color-outline, #79747E)' : 'var(--md-sys-color-on-surface-variant, #49454F)'}`,
        l.hidden ? 'text-decoration:line-through' : '',
      ].join(';');
      // It toggles a series, so it is a toggle button: without aria-pressed a
      // screen reader announces "button" and never says whether the series is
      // currently shown or hidden. Set every render, since that is what changes.
      chip.setAttribute('aria-pressed', String(!l.hidden));
      const [dot, txt] = Array.from(chip.children) as HTMLElement[];
      dot.style.cssText = `width:10px;height:10px;border-radius:3px;background:${l.color};opacity:${l.hidden ? 0.4 : 1};flex:none`;
      txt.style.cssText = 'overflow:hidden;text-overflow:ellipsis;min-width:0';
      if (txt.textContent !== l.label) txt.textContent = l.label;
      // The clipped text is still the full name to a screen reader, but a
      // sighted user only sees "Organic sea…" — so carry it in the tooltip too.
      if (chip.title !== l.label) chip.title = l.label;
      // Only touch the DOM when the order actually changed — re-appending a node
      // mid-gesture is pointless churn.
      if (nav.children[i] !== chip) nav.insertBefore(chip, nav.children[i] ?? null);
    });
    for (const el of existing.values()) el.remove();
    // Already-connected nav stays exactly where it is — moving it is needless
    // churn during a click.
    if (nav.parentNode !== legendLayer) legendLayer.appendChild(nav);
  } else {
    keptNav?.remove();
  }
}
