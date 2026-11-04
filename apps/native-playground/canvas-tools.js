import { nativeCanvasReadout, supportsNativeViewportTag } from './native-viewport.js';
import { createCanvasInspector } from './canvas-inspector.js';

const $ = selector => document.querySelector(selector);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const finiteSize = value => Number.isFinite(value) && value > 0;
const resizeLimits = () => ({ minWidth: 1, maxWidth: Infinity, minHeight: 1, maxHeight: Infinity });

/** Centered edges move half as far as the size, until the canvas overflows. */
export function canvasDragSize({ edge, width, height, availableWidth, dx = 0, dy = 0 }) {
  const patch = {};
  if (/[ew]/.test(edge) && dx !== 0) {
    const growth = edge.includes('w') ? -dx : dx;
    const available = finiteSize(availableWidth) ? availableWidth : width;
    const start = width <= available ? width / 2 : width - available / 2;
    const position = start + growth;
    patch.width = Math.max(1, Math.round(position <= available / 2 ? position * 2 : position + available / 2));
  }
  if (/[ns]/.test(edge) && dy !== 0) patch.height = Math.max(1, Math.round(height + (edge.includes('n') ? -dy : dy)));
  return patch;
}

/** Preview viewing areas use real CSS pixels; their stage handles overflow. */
export function canvasViewportFit({ availableWidth, viewportWidth = 'fit', viewportHeight = 310, expandedHeight } = {}) {
  const available = finiteSize(availableWidth) ? availableWidth : finiteSize(viewportWidth) ? viewportWidth : 1;
  const logicalWidth = finiteSize(viewportWidth) ? viewportWidth : available;
  const logicalHeight = finiteSize(expandedHeight) ? expandedHeight : finiteSize(viewportHeight) ? viewportHeight : 310;
  return { logicalWidth, logicalHeight, scale: 1, width: logicalWidth, height: logicalHeight };
}

/** Pixels per animation frame near the active edge, including outside the stage. */
export function canvasEdgeScroll({ edge, x, y, rect, horizontal = true, vertical = true }) {
  const speed = distance => Math.min(12, Math.max(0, distance) * 0.25);
  return {
    x: !horizontal ? 0 : edge.includes('e') ? speed(x - (rect.right - 32)) : edge.includes('w') ? -speed(rect.left + 32 - x) : 0,
    y: !vertical ? 0 : edge.includes('s') ? speed(y - (rect.bottom - 32)) : edge.includes('n') ? -speed(rect.top + 32 - y) : 0,
  };
}

/** Coordinates the real preview viewport, rulers and expanded editing workspace. */
export function createCanvasTools({ getState, onLayoutChange, createInspector = createCanvasInspector }) {
  const inspector = createInspector({ getState });
  const workspace = $('.workspace-grid');
  let nativeViewport, pendingLayoutPatch, observer, queued = 0, frameDocument, ruler, rulerKey, fallback = false, transitioning = false;
  let previousOverflow, outside = [], observedViewport, resizeTarget, resizeWeb, drag, nativeRuler, nativeRulerKey;
  let handles = [], handleRemovers = [], autoScrollFrame = 0, autoScrollTime;
  const assign = (element, name, value) => { if (element.style[name] !== value) element.style[name] = value; };
  const removers = [];
  const listen = (element, type, callback, options) => { element.addEventListener(type, callback, options); removers.push(() => element.removeEventListener(type, callback, options)); };
  const schedule = () => { if (!queued) queued = requestAnimationFrame(() => {
    const previous = nativeViewport;
    queued = 0; update();
    if (pendingLayoutPatch) { const patch = pendingLayoutPatch; pendingLayoutPatch = null; onLayoutChange(patch); }
    else if (!drag && previous && nativeViewport && previous.target === nativeViewport.target
      && previous.selection === nativeViewport.selection && previous.platform === nativeViewport.platform
      && (previous.width !== nativeViewport.width || previous.height !== nativeViewport.height)) {
      onLayoutChange({ viewport: true });
    }
  }); };
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
  function nativeRulers(target, enabled, width, height) {
    if (nativeRuler && (nativeRuler.parentNode !== target || !enabled)) {
      nativeRuler.remove(); nativeRuler = null; nativeRulerKey = '';
    }
    if (!target || !enabled) return;
    const key = `${width}:${height}`;
    if (!nativeRuler) {
      nativeRuler = document.createElement('div'); nativeRuler.className = 'canvas-rulers canvas-rulers-native';
      nativeRuler.setAttribute('aria-hidden', 'true'); target.append(nativeRuler);
    }
    if (key !== nativeRulerKey) { paintRuler(nativeRuler, document, width, height); nativeRulerKey = key; }
  }
  function syncNativeDots() {
    if (getState().platform === 'web') return;
    const viewport = $('#native-render-frame'), image = $('#native-live-surface img');
    if (!viewport) return;
    const frame = viewport.getBoundingClientRect(), capture = image?.getBoundingClientRect();
    // Native renderers anchor a dot at the capture center. The CSS tile's dot
    // sits 12px from its origin, so follow that center through fitting/scrolling.
    const x = capture && capture.left - frame.left - (viewport.clientLeft || 0) + capture.width / 2 - 12;
    const y = capture && capture.top - frame.top - (viewport.clientTop || 0) + capture.height / 2 - 12;
    assign(viewport, 'backgroundPosition', Number.isFinite(x) && Number.isFinite(y) && capture.width > 0 && capture.height > 0
      ? `${x}px ${y}px` : 'center');
  }
  function clearDrag(commit, render = true) {
    if (!drag) return;
    const completed = drag; drag = null;
    cancelAnimationFrame(autoScrollFrame); autoScrollFrame = 0; autoScrollTime = undefined;
    delete $('#preview-stage').dataset.resizing;
    if (!commit) Object.assign(completed.layout, completed.before);
    if (completed.handle.hasPointerCapture?.(completed.pointerId)) completed.handle.releasePointerCapture(completed.pointerId);
    if (render) update();
    if (!commit) { const stage = $('#preview-stage'); stage.scrollLeft = completed.scrollX; stage.scrollTop = completed.scrollY; }
    if (commit) {
      const patch = {};
      for (const key of ['width', 'height']) if (completed.layout[key] !== completed.before[key]) patch[key] = completed.layout[key];
      if (Object.keys(patch).length) onLayoutChange(patch);
    }
  }
  function clearHandles() {
    clearDrag(false, false);
    handleRemovers.splice(0).forEach(remove => remove());
    handles.splice(0).forEach(handle => handle.remove());
    resizeTarget = null;
  }
  function availableSpace() {
    const stage = $('#preview-stage'), content = $('#preview-content');
    const style = document.defaultView.getComputedStyle?.(stage);
    const padding = side => Number.parseFloat(style?.[side]) || 0;
    return { width: Math.max(1, stage.clientWidth ? stage.clientWidth - padding('paddingLeft') - padding('paddingRight') : content.clientWidth),
      height: Math.max(1, stage.clientHeight ? stage.clientHeight - padding('paddingTop') - padding('paddingBottom') : content.clientHeight) };
  }
  function previewSize(web) {
    const state = getState(), frame = $('#component-frame'), available = availableSpace();
    const autoHeight = web ? Number(frame?.dataset.autoHeight) || 310 : supportsNativeViewportTag(state.selected?.tag) ? 310 : Math.max(310, state.liveFrame?.logicalHeight || 0);
    return canvasViewportFit({ availableWidth: available.width, viewportWidth: state.layout.width,
      viewportHeight: finiteSize(state.layout.height) ? state.layout.height : autoHeight,
      expandedHeight: state.layout.expanded && !finiteSize(state.layout.height) ? available.height : undefined });
  }
  function applyDrag() {
    if (!drag) return;
    const stage = $('#preview-stage');
    Object.assign(drag.layout, drag.before, canvasDragSize({ ...drag, availableWidth: drag.availableWidth,
      dx: drag.lastX - drag.x + stage.scrollLeft - drag.scrollX + drag.virtualX,
      dy: drag.lastY - drag.y + stage.scrollTop - drag.scrollY + drag.virtualY }));
    update();
  }
  function scrollVelocity() {
    if (!drag) return { x: 0, y: 0 };
    const stage = $('#preview-stage'), rect = stage.getBoundingClientRect();
    return canvasEdgeScroll({ edge: drag.edge, x: drag.lastX, y: drag.lastY, rect, horizontal: drag.autoX, vertical: drag.autoY });
  }
  function autoScroll(time) {
    autoScrollFrame = 0;
    if (!drag) return;
    const velocity = scrollVelocity(), interval = autoScrollTime === undefined ? 1 : Math.min(2, Math.max(0, (time - autoScrollTime) / 16));
    autoScrollTime = time;
    if (!velocity.x && !velocity.y) { autoScrollTime = undefined; return; }
    const stage = $('#preview-stage'), dx = velocity.x * interval, dy = velocity.y * interval;
    const oldX = stage.scrollLeft, oldY = stage.scrollTop;
    // Grow first so trailing edges create scrollable room. At leading bounds,
    // retain unconsumed travel so captured dragging can keep growing the canvas.
    drag.virtualX += dx; drag.virtualY += dy; applyDrag();
    if (!drag) return;
    stage.scrollLeft = oldX + dx; stage.scrollTop = oldY + dy;
    drag.virtualX -= stage.scrollLeft - oldX; drag.virtualY -= stage.scrollTop - oldY;
    autoScrollFrame = requestAnimationFrame(autoScroll);
  }
  function scheduleAutoScroll() {
    if (autoScrollFrame || !drag) return;
    const velocity = scrollVelocity();
    if (velocity.x || velocity.y) autoScrollFrame = requestAnimationFrame(autoScroll);
  }
  function syncHandles(target, web) {
    if (target !== resizeTarget || web !== resizeWeb) {
      clearHandles(); resizeTarget = target; resizeWeb = web;
      if (target) for (const edge of ['e', 's', 'se', 'w', 'n', 'ne', 'nw', 'sw']) {
        const handle = document.createElement('button'); handle.type = 'button';
        handle.className = 'canvas-resize-handle'; handle.dataset.resize = edge;
        handle.setAttribute('aria-describedby', 'canvas-resize-help');
        handle.setAttribute('aria-keyshortcuts', /^[ew]$/.test(edge) ? 'ArrowLeft ArrowRight Home' : /^[ns]$/.test(edge) ? 'ArrowUp ArrowDown Home' : 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
        const listenHandle = (type, listener) => { handle.addEventListener(type, listener); handleRemovers.push(() => handle.removeEventListener(type, listener)); };
        listenHandle('pointerdown', event => {
          if (event.button !== 0 || event.isPrimary === false || drag) return;
          event.preventDefault(); handle.focus({ preventScroll: true });
          const { layout } = getState(), size = previewSize(web), stage = $('#preview-stage');
          drag = { handle, edge, web, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
            width: size.logicalWidth, height: size.logicalHeight, scale: size.scale, availableWidth: availableSpace().width,
            lastX: event.clientX, lastY: event.clientY, scrollX: stage.scrollLeft, scrollY: stage.scrollTop, virtualX: 0, virtualY: 0, autoX: false, autoY: false,
            layout, platform: getState().platform, selection: getState().selected, frame: $('#component-frame'), before: { width: layout.width, height: layout.height ?? 'auto' } };
          $('#preview-stage').dataset.resizing = 'true';
          try { handle.setPointerCapture(event.pointerId); } catch { clearDrag(false); }
        });
        listenHandle('pointermove', event => {
          if (!drag || drag.handle !== handle || drag.pointerId !== event.pointerId) return;
          event.preventDefault();
          if (event.clientX !== drag.lastX) drag.autoX = edge.includes('e') ? event.clientX > drag.lastX : edge.includes('w') && event.clientX < drag.lastX;
          if (event.clientY !== drag.lastY) drag.autoY = edge.includes('s') ? event.clientY > drag.lastY : edge.includes('n') && event.clientY < drag.lastY;
          drag.lastX = event.clientX; drag.lastY = event.clientY; applyDrag(); scheduleAutoScroll();
        });
        listenHandle('pointerup', event => { if (drag?.handle === handle && drag.pointerId === event.pointerId) clearDrag(true); });
        for (const type of ['pointercancel', 'lostpointercapture']) listenHandle(type, event => {
          if (drag?.handle === handle && drag.pointerId === event.pointerId) clearDrag(false);
        });
        listenHandle('keydown', event => {
          if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); clearDrag(false); return; }
          if (drag || event.altKey || event.ctrlKey || event.metaKey) return;
          const { layout } = getState(), size = previewSize(web), limits = resizeLimits(web), step = event.shiftKey ? 50 : 10;
          let patch;
          if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); resetSize(); return; }
          if (/[ew]/.test(edge) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) patch = { width: clamp(Math.round(size.logicalWidth) + ((event.key === 'ArrowRight') !== edge.includes('w') ? step : -step), limits.minWidth, limits.maxWidth) };
          else if (/[ns]/.test(edge) && ['ArrowUp', 'ArrowDown'].includes(event.key)) patch = { height: clamp(Math.round(size.logicalHeight) + ((event.key === 'ArrowDown') !== edge.includes('n') ? step : -step), limits.minHeight, limits.maxHeight) };
          if (!patch) return;
          event.preventDefault(); event.stopPropagation();
          if (Object.keys(patch).some(key => patch[key] !== layout[key])) change(patch);
        });
        target.append(handle); handles.push(handle);
      }
    }
    if (!target) return;
    const size = previewSize(web);
    for (const handle of handles) {
      const edge = handle.dataset.resize, axis = /^[ew]$/.test(edge) ? 'width' : /^[ns]$/.test(edge) ? 'height' : 'width and height';
      const dimensions = /^[ew]$/.test(edge) ? `${Math.round(size.logicalWidth)} pixels` : /^[ns]$/.test(edge) ? `${Math.round(size.logicalHeight)} pixels` : `${Math.round(size.logicalWidth)} by ${Math.round(size.logicalHeight)} pixels`;
      const position = { e: 'right edge', w: 'left edge', n: 'top edge', s: 'bottom edge', ne: 'top-right corner', nw: 'top-left corner', se: 'bottom-right corner', sw: 'bottom-left corner' }[edge];
      handle.setAttribute('aria-label', `Resize preview from ${position}, ${axis} ${dimensions}`);
      handle.title = `Resize ${axis} · Arrow keys · Shift for 50px · Home to reset`;
    }
  }
  function update() {
    const state = getState(), { layout } = state, stage = $('#preview-stage');
    const web = state.platform === 'web', grid = layout.grid, bounds = layout.bounds;
    const frame = $('#component-frame'), doc = state.previewDocument;
    const shell = $('.canvas-viewport-shell'), scene = $('.canvas-viewport-scale'), content = $('#preview-content');
    const native = $('#preview-content > .native-snapshot');
    if (drag && (drag.platform !== state.platform || drag.selection !== state.selected || drag.frame !== frame)) clearDrag(false, false);
    syncHandles(web && frame ? shell : native, web);
    stage.dataset.grid = String(grid);
    stage.dataset.bounds = String(bounds);
    const width = layout.width === 'fit' ? '100%' : `${layout.width}px`;
    if (frame && frame.style.width !== width) frame.style.width = width;
    let fitted;
    if (web && frame && shell && scene && content) {
      fitted = previewSize(true);
      assign(frame, 'height', `${fitted.logicalHeight}px`);
      assign(shell, 'width', `${fitted.width}px`); assign(shell, 'height', `${fitted.height}px`);
      assign(scene, 'width', `${fitted.logicalWidth}px`); assign(scene, 'height', `${fitted.logicalHeight}px`);
      assign(scene, 'transform', `scale(${fitted.scale})`);
      shell.dataset.scale = String(fitted.scale);
    }
    if (doc) { doc.documentElement.dir = layout.direction; doc.documentElement.dataset.grid = String(web && grid); }
    rulers(web ? doc : null, web && grid);
    if (native) {
      fitted = previewSize(false);
      assign(native, 'width', `${fitted.width}px`); assign(native, 'height', `${fitted.height}px`);
      native.dataset.scale = '1';
    }
    nativeViewport = !web && native && supportsNativeViewportTag(state.selected?.tag) && fitted
      ? { target: native, selection: state.selected, platform: state.platform, width: fitted.width, height: fitted.height } : null;
    nativeRulers(web ? null : native, !web && grid, fitted?.width, fitted?.height);
    syncNativeDots();
    const viewport = web ? frame : native;
    if (viewport !== observedViewport && observer) {
      if (observedViewport) observer.unobserve(observedViewport);
      observedViewport = viewport;
      if (viewport) observer.observe(viewport);
    }
    const measured = viewport?.clientWidth;
    const dimensions = viewport && Number.isFinite(measured)
      ? nativeCanvasReadout(state.selected?.tag, state.platform, state.liveFrame, measured, viewport.clientHeight || 0)
      : { label: '— × — px', title: 'Canvas dimensions', notice: '' };
    $('#canvas-dimensions').textContent = dimensions.label;
    $('#canvas-dimensions').setAttribute('title', dimensions.title);
    $('#canvas-dimensions').setAttribute('aria-label', dimensions.title);
    const directionLabel = layout.direction === 'rtl' ? 'RTL ←' : 'LTR →';
    const directionAnnouncement = layout.direction === 'rtl' ? 'Right-to-left layout' : 'Left-to-right layout';
    if ($('#canvas-direction').textContent !== directionLabel) $('#canvas-direction').textContent = directionLabel;
    if ($('#canvas-direction-announcement').textContent !== directionAnnouncement) $('#canvas-direction-announcement').textContent = directionAnnouncement;
    $('#canvas-rtl').selected = layout.direction === 'rtl';
    $('#canvas-rtl').icon = layout.direction === 'rtl' ? 'format_textdirection_r_to_l' : 'format_textdirection_l_to_r';
    for (const [selector, selected, label, description] of [
      ['#canvas-grid', grid, 'Toggle pixel grid and rulers', '8px grid with 64px pixel rulers'],
      ['#canvas-bounds', bounds, 'Inspect component measurements', web ? 'Inspect size, padding, spacing and typography' : 'Inspect measured native size, spacing and typography'],
    ]) {
      const button = $(selector);
      button.disabled = false; button.selected = selected;
      button.setAttribute('aria-disabled', 'false');
      button.setAttribute('aria-label', label);
      const tooltip = button.closest?.('md-tooltip');
      if (tooltip) tooltip.text = description;
    }
    const notes = dimensions.notice ? [dimensions.notice] : [];
    if (layout.direction === 'rtl') notes.push('RTL is active. Start/end layout and leading/trailing content swap sides. A centered text-only button can look unchanged; add an icon in Properties to compare.');
    if (grid) notes.push(web ? 'Grid: 8 CSS px · major lines and rulers: 64 px.' : 'Viewing area grid: 8 CSS px · major lines and rulers: 64 px.');
    $('#canvas-help').textContent = notes.join(' '); $('#canvas-help').hidden = notes.length === 0;
    inspector.update();
  }
  function change(patch) { Object.assign(getState().layout, patch); update(); onLayoutChange(patch); }
  function resetSize() {
    clearDrag(false, false);
    const { layout } = getState(), patch = {};
    if (layout.width !== 'fit') patch.width = 'fit';
    if (layout.height !== 'auto') patch.height = 'auto';
    Object.assign(layout, { width: 'fit', height: 'auto' }); update();
    const stage = $('#preview-stage'); stage.scrollLeft = 0; stage.scrollTop = 0;
    const nativeFrame = $('#native-render-frame');
    if (nativeFrame) { nativeFrame.scrollLeft = 0; nativeFrame.scrollTop = 0; }
    syncNativeDots();
    if (Object.keys(patch).length) onLayoutChange(patch);
  }
  function expansionState(expanded) {
    const changed = getState().layout.expanded !== expanded;
    getState().layout.expanded = expanded;
    workspace.classList.toggle('is-expanded', expanded);
    const button = $('#canvas-fullscreen');
    button.icon = expanded ? 'fullscreen_exit' : 'fullscreen';
    button.setAttribute('aria-label', expanded ? 'Exit expanded studio' : 'Expand studio with properties');
    button.setAttribute('aria-expanded', String(expanded));
    $('#canvas-expand-tooltip').text = expanded ? 'Exit expanded studio · Esc' : 'Expand canvas and properties';
    $('#canvas-expanded-label').hidden = !expanded;
    if (changed) pendingLayoutPatch = { expanded };
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
    listen($('#canvas-reset-size'), 'mdClick', resetSize);
    listen($('#canvas-rtl'), 'mdClick', event => change({ direction: event.detail.selected ? 'rtl' : 'ltr' }));
    listen($('#canvas-grid'), 'mdClick', event => change({ grid: event.detail.selected }));
    listen($('#canvas-bounds'), 'mdClick', event => change({ bounds: event.detail.selected }));
    listen($('#canvas-fullscreen'), 'mdClick', toggleExpanded);
    listen($('#preview-content'), 'scroll', event => { if (event.target === $('#native-render-frame')) syncNativeDots(); }, { capture: true, passive: true });
    listen(document.defaultView, 'blur', () => clearDrag(false));
    document.addEventListener('fullscreenchange', fullscreenChanged);
    document.addEventListener('keydown', frameEscape);
    observer = new ResizeObserver(schedule); observer.observe($('#preview-stage'));
    update();
  }
  function dispose() { nativeViewport = null; pendingLayoutPatch = null; clearHandles(); observer?.disconnect(); removers.splice(0).forEach(remove => remove()); cancelAnimationFrame(queued); frameDocument?.removeEventListener('keydown', frameEscape); document.removeEventListener('keydown', frameEscape); document.removeEventListener('fullscreenchange', fullscreenChanged); ruler?.remove(); nativeRuler?.remove(); if (fallback) fallbackState(false); inspector.dispose(); }
  return { init, update, dispose };
}
