import { createCanvasInspector } from './canvas-inspector.js';

const $ = selector => document.querySelector(selector);

/** Coordinates the real preview viewport, rulers and expanded editing workspace. */
export function createCanvasTools({ getState, onLayoutChange, createInspector = createCanvasInspector }) {
  const inspector = createInspector({ getState });
  const workspace = $('.workspace-grid');
  let observer, queued = 0, frameDocument, ruler, rulerKey, fallback = false, transitioning = false;
  let previousOverflow, outside = [], observedViewport, nativeRuler, nativeRulerKey;
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
    stage.dataset.grid = String(layout.grid);
    stage.dataset.bounds = String(layout.bounds);
    const frame = $('#component-frame'), doc = state.previewDocument;
    const width = layout.width === 'fit' ? '100%' : `${layout.width}px`;
    if (frame && frame.style.width !== width) frame.style.width = width;
    if (doc) { doc.documentElement.dir = layout.direction; doc.documentElement.dataset.grid = String(layout.grid); }
    rulers(doc, layout.grid);
    const native = $('#preview-content > .native-snapshot');
    if (native && native.style.width !== width) native.style.width = width;
    const nativeSurface = $('#native-live-surface');
    if (layout.grid && state.platform !== 'web' && nativeSurface) {
      const nativeKey = `${nativeSurface.clientWidth}:${nativeSurface.clientHeight}`;
      if (nativeRuler?.parentNode !== nativeSurface) {
        nativeRuler?.remove(); nativeRuler = document.createElement('div');
        nativeRuler.className = 'canvas-rulers canvas-rulers-native'; nativeRuler.setAttribute('aria-hidden', 'true');
        nativeSurface.append(nativeRuler); nativeRulerKey = '';
      }
      if (nativeRulerKey !== nativeKey) { paintRuler(nativeRuler, document, nativeSurface.clientWidth, nativeSurface.clientHeight); nativeRulerKey = nativeKey; }
    } else { nativeRuler?.remove(); nativeRuler = null; nativeRulerKey = ''; }
    const viewport = frame || nativeSurface || native;
    if (viewport !== observedViewport && observer) {
      if (observedViewport) observer.unobserve(observedViewport);
      observedViewport = viewport;
      if (viewport) observer.observe(viewport);
    }
    const measured = viewport?.clientWidth;
    $('#canvas-dimensions').textContent = measured ? `${Math.round(measured)} × ${Math.round(viewport?.clientHeight || 0)} px` : 'Responsive';
    $('#canvas-direction').textContent = layout.direction === 'rtl' ? 'RTL ←' : 'LTR →';
    $('#canvas-rtl').selected = layout.direction === 'rtl';
    $('#canvas-rtl').icon = layout.direction === 'rtl' ? 'format_textdirection_r_to_l' : 'format_textdirection_l_to_r';
    $('#canvas-grid').selected = layout.grid;
    $('#canvas-bounds').selected = layout.bounds;
    const notes = [];
    if (layout.direction === 'rtl') notes.push('RTL is active. Start/end layout and leading/trailing content swap sides. A centered text-only button can look unchanged; add an icon in Properties to compare.');
    if (layout.grid) notes.push(state.platform === 'web' ? 'Grid: 8 CSS px · major lines and rulers: 64 px.' : 'Grid: 8 screen CSS px. Native pt/dp sizes are reported by the live stream.');
    $('#canvas-help').textContent = notes.join(' '); $('#canvas-help').hidden = notes.length === 0;
    inspector.update();
  }
  function change(patch) { Object.assign(getState().layout, patch); update(); onLayoutChange(patch); }
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
    listen($('#canvas-grid'), 'mdClick', event => change({ grid: event.detail.selected }));
    listen($('#canvas-bounds'), 'mdClick', event => change({ bounds: event.detail.selected }));
    listen($('#canvas-fullscreen'), 'mdClick', toggleExpanded);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('keydown', frameEscape);
    observer = new ResizeObserver(schedule); observer.observe($('#preview-stage'));
    update();
  }
  function dispose() { observer?.disconnect(); removers.splice(0).forEach(remove => remove()); cancelAnimationFrame(queued); frameDocument?.removeEventListener('keydown', frameEscape); document.removeEventListener('keydown', frameEscape); document.removeEventListener('fullscreenchange', fullscreenChanged); ruler?.remove(); nativeRuler?.remove(); if (fallback) fallbackState(false); inspector.dispose(); }
  return { init, update, dispose };
}
