import { createCanvasInspector } from './canvas-inspector.js';

const $ = selector => document.querySelector(selector);

/** Presentation scale never changes the iframe's logical CSS viewport. */
export function canvasViewportFit({ availableWidth, viewportWidth = 'fit', viewportHeight = 310, expandedHeight } = {}) {
  const positive = value => Number.isFinite(value) && value > 0;
  const available = positive(availableWidth) ? availableWidth : positive(viewportWidth) ? viewportWidth : 1;
  const logicalWidth = positive(viewportWidth) ? viewportWidth : available;
  const scale = Math.min(1, available / logicalWidth);
  const logicalHeight = positive(expandedHeight) ? Math.max(240, expandedHeight / scale) : positive(viewportHeight) ? viewportHeight : 310;
  return { logicalWidth, logicalHeight, scale, width: logicalWidth * scale, height: logicalHeight * scale };
}

/** Coordinates the real preview viewport, rulers and expanded editing workspace. */
export function createCanvasTools({ getState, onLayoutChange, createInspector = createCanvasInspector }) {
  const inspector = createInspector({ getState });
  const workspace = $('.workspace-grid');
  let observer, queued = 0, frameDocument, ruler, rulerKey, fallback = false, transitioning = false;
  let previousOverflow, outside = [], observedViewport;
  const removers = [];
  const listen = (element, type, callback) => { element.addEventListener(type, callback); removers.push(() => element.removeEventListener(type, callback)); };
  const schedule = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; update(); }); };
  function frameEscape(event) {
    if (event.key === 'Escape' && !event.defaultPrevented && getState().layout.expanded) void exitExpanded();
  }
  function rulers(doc, enabled) {
    if (doc !== frameDocument) {
      frameDocument?.removeEventListener('keydown', frameEscape);
      ruler?.remove(); ruler = null; rulerKey = '';
      frameDocument = doc;
      frameDocument?.addEventListener('keydown', frameEscape);
    }
    if (!doc || !enabled) { ruler?.remove(); ruler = null; rulerKey = ''; return; }
    const width = doc.documentElement.clientWidth, height = doc.documentElement.clientHeight;
    const key = `${width}:${height}`;
    if (ruler && rulerKey === key) return;
    rulerKey = key;
    if (!ruler) { ruler = doc.createElement('div'); ruler.className = 'canvas-rulers'; ruler.setAttribute('aria-hidden', 'true'); doc.body.append(ruler); }
    paintRuler(ruler, doc, width, height);
  }
  function paintRuler(ruler, doc, width, height) {
    ruler.replaceChildren();
    const horizontal = doc.createElement('div'), vertical = doc.createElement('div'), origin = doc.createElement('span');
    horizontal.className = 'canvas-ruler-x'; vertical.className = 'canvas-ruler-y'; origin.className = 'canvas-ruler-origin'; origin.textContent = 'px';
    for (let x = 64; x < Math.min(width, 16384); x += 64) { const tick = doc.createElement('span'); tick.style.left = `${x}px`; tick.textContent = String(x); horizontal.append(tick); }
    for (let y = 64; y < Math.min(height, 16384); y += 64) { const tick = doc.createElement('span'); tick.style.top = `${y - 18}px`; tick.textContent = String(y); vertical.append(tick); }
    ruler.append(horizontal, vertical, origin);
  }
  function update() {
    const state = getState(), { layout } = state, stage = $('#preview-stage');
    const web = state.platform === 'web', grid = web && layout.grid, bounds = web && layout.bounds;
    stage.dataset.grid = String(grid);
    stage.dataset.bounds = String(bounds);
    const frame = $('#component-frame'), doc = state.previewDocument;
    const width = layout.width === 'fit' ? '100%' : `${layout.width}px`;
    if (frame && frame.style.width !== width) frame.style.width = width;
    let fitted;
    const shell = $('.canvas-viewport-shell'), scene = $('.canvas-viewport-scale'), content = $('#preview-content');
    if (web && frame && shell && scene && content) {
      fitted = canvasViewportFit({ availableWidth: content.clientWidth, viewportWidth: layout.width,
        viewportHeight: Number.parseFloat(frame.style.height) || frame.offsetHeight || frame.clientHeight,
        expandedHeight: layout.expanded ? content.clientHeight : undefined });
      const assign = (element, name, value) => { if (element.style[name] !== value) element.style[name] = value; };
      assign(shell, 'width', `${fitted.width}px`); assign(shell, 'height', `${fitted.height}px`);
      assign(scene, 'width', `${fitted.logicalWidth}px`); assign(scene, 'height', `${fitted.logicalHeight}px`);
      assign(scene, 'transform', `scale(${fitted.scale})`);
      shell.dataset.scale = String(fitted.scale);
    }
    if (doc) { doc.documentElement.dir = layout.direction; doc.documentElement.dataset.grid = String(grid); }
    rulers(doc, grid);
    const native = $('#preview-content > .native-snapshot');
    if (native && native.style.width !== width) native.style.width = width;
    const nativeSurface = $('#native-live-surface');
    const viewport = frame || nativeSurface || native;
    if (viewport !== observedViewport && observer) {
      if (observedViewport) observer.unobserve(observedViewport);
      observedViewport = viewport;
      if (viewport) observer.observe(viewport);
    }
    const measured = viewport?.clientWidth;
    const scaleLabel = fitted?.scale < 1 ? ` · ${Math.round(fitted.scale * 100)}%` : '';
    $('#canvas-dimensions').textContent = measured ? `${Math.round(measured)} × ${Math.round(viewport?.clientHeight || 0)} px${scaleLabel}` : 'Responsive';
    $('#canvas-direction').textContent = layout.direction === 'rtl' ? 'RTL ←' : 'LTR →';
    $('#canvas-rtl').selected = layout.direction === 'rtl';
    $('#canvas-rtl').icon = layout.direction === 'rtl' ? 'format_textdirection_r_to_l' : 'format_textdirection_l_to_r';
    for (const [selector, selected, label, description] of [
      ['#canvas-grid', grid, 'Toggle pixel grid and rulers', '8px grid with 64px pixel rulers'],
      ['#canvas-bounds', bounds, 'Inspect component measurements', 'Inspect size, padding, spacing and typography'],
    ]) {
      const button = $(selector);
      button.disabled = !web; button.selected = selected;
      button.setAttribute('aria-disabled', String(!web));
      button.setAttribute('aria-label', web ? label : `${label} — available in Web preview only`);
      const tooltip = button.closest?.('md-tooltip');
      if (tooltip) tooltip.text = web ? description : 'Available in Web preview only';
    }
    const notes = [];
    if (fitted?.scale < 1) notes.push(`Shown at ${Math.round(fitted.scale * 100)}% to fit. The Web viewport remains ${Math.round(fitted.logicalWidth)} CSS px wide; grid and measurements use its actual CSS pixels.`);
    if (layout.direction === 'rtl') notes.push('RTL is active. Start/end layout and leading/trailing content swap sides. A centered text-only button can look unchanged; add an icon in Properties to compare.');
    if (grid) notes.push('Grid: 8 CSS px · major lines and rulers: 64 px.');
    $('#canvas-help').textContent = notes.join(' '); $('#canvas-help').hidden = notes.length === 0;
    inspector.update();
  }
  function change(patch) { Object.assign(getState().layout, patch); update(); onLayoutChange(patch); }
  function changeWebOverlay(patch) { if (getState().platform === 'web') change(patch); else update(); }
  function expansionState(expanded) {
    getState().layout.expanded = expanded;
    workspace.classList.toggle('is-expanded', expanded);
    const button = $('#canvas-fullscreen');
    button.icon = expanded ? 'fullscreen_exit' : 'fullscreen';
    button.setAttribute('aria-label', expanded ? 'Exit expanded studio' : 'Expand studio with properties');
    button.setAttribute('aria-expanded', String(expanded));
    $('#canvas-expand-tooltip').text = expanded ? 'Exit expanded studio · Esc' : 'Expand canvas and properties';
    $('#canvas-expanded-label').hidden = !expanded;
    schedule();
  }
  function fallbackState(enabled) {
    fallback = enabled;
    workspace.classList.toggle('expanded-fallback', enabled);
    if (enabled) {
      previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
      outside = [...document.querySelectorAll('.app-header,.sidebar,.component-heading,#theme-sheet')].map(element => [element, element.inert]);
      outside.forEach(([element]) => { element.inert = true; });
    } else {
      if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow;
      outside.forEach(([element, inert]) => { element.inert = inert; }); outside = []; previousOverflow = undefined;
    }
  }
  async function exitExpanded() {
    if (transitioning) return;
    transitioning = true;
    try {
      if (document.fullscreenElement === workspace) await document.exitFullscreen();
      if (fallback) fallbackState(false);
      expansionState(false);
      $('#canvas-fullscreen').focus();
    } finally { transitioning = false; }
  }
  async function toggleExpanded() {
    if (getState().layout.expanded) return exitExpanded();
    if (transitioning) return;
    transitioning = true;
    try {
      // Keep the inspector and live property editors inside the full-screen root.
      try { await workspace.requestFullscreen(); } catch { fallbackState(true); }
      expansionState(true); $('#canvas-fullscreen').focus();
    } finally { transitioning = false; }
  }
  function fullscreenChanged() {
    if (!fallback) expansionState(document.fullscreenElement === workspace);
  }
  function init() {
    listen($('#canvas-width'), 'mdChange', event => { if (event.target === $('#canvas-width')) change({ width: ['360', '768', '1024'].includes(event.detail) ? Number(event.detail) : 'fit' }); });
    listen($('#canvas-rtl'), 'mdClick', event => change({ direction: event.detail.selected ? 'rtl' : 'ltr' }));
    listen($('#canvas-grid'), 'mdClick', event => changeWebOverlay({ grid: event.detail.selected }));
    listen($('#canvas-bounds'), 'mdClick', event => changeWebOverlay({ bounds: event.detail.selected }));
    listen($('#canvas-fullscreen'), 'mdClick', toggleExpanded);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('keydown', frameEscape);
    observer = new ResizeObserver(schedule); observer.observe($('#preview-stage'));
    update();
  }
  function dispose() { observer?.disconnect(); removers.splice(0).forEach(remove => remove()); cancelAnimationFrame(queued); frameDocument?.removeEventListener('keydown', frameEscape); document.removeEventListener('keydown', frameEscape); document.removeEventListener('fullscreenchange', fullscreenChanged); ruler?.remove(); if (fallback) fallbackState(false); inspector.dispose(); }
  return { init, update, dispose };
}
