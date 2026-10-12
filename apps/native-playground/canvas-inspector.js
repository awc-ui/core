const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const sides = ['Top', 'Right', 'Bottom', 'Left'];
const numeric = value => /^-?(?:\d+\.?\d*|\.\d+)px$/.test(value || '') ? Number.parseFloat(value) : null;
export const formatPixels = value => Number.isFinite(value) ? `${Math.round(value * 100) / 100}px` : 'Unavailable';

/** Shadow-root-aware ownership, without cross-realm instanceof checks. */
export function composedContains(host, node) {
  for (let current = node, depth = 0; current && depth < 100; depth++, current = current.parentNode || current.host) if (current === host) return true;
  return false;
}

export function inspectElement(element) {
  if (element?.nodeType !== 1 || element.isConnected === false) return null;
  const view = element.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return null;
  const style = view.getComputedStyle(element), bounds = element.getBoundingClientRect();
  const rect = Object.fromEntries(['x', 'y', 'left', 'top', 'right', 'bottom', 'width', 'height'].map(key => [key, bounds[key]]));
  if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return null;
  let transformed = false;
  for (let current = element; current?.nodeType === 1; current = current.parentElement || current.getRootNode?.().host) {
    const currentStyle = view.getComputedStyle(current);
    if (currentStyle.transform && currentStyle.transform !== 'none' || currentStyle.zoom && !['1', 'normal'].includes(currentStyle.zoom)) { transformed = true; break; }
  }
  return {
    name: `${element.localName}${element.id ? `#${element.id}` : ''}${element.getAttribute('part') ? ` ::part(${element.getAttribute('part')})` : ''}`,
    rect, transformed,
    padding: sides.map(side => style[`padding${side}`] || '0px'),
    margin: sides.map(side => style[`margin${side}`] || '0px'),
    border: sides.map(side => style[`border${side}Width`] || '0px'),
    gap: { row: style.rowGap || 'normal', column: style.columnGap || 'normal' },
    typography: { size: style.fontSize || 'Unavailable', lineHeight: style.lineHeight || 'normal', family: style.fontFamily || 'Unavailable', weight: style.fontWeight || 'normal', spacing: style.letterSpacing || 'normal' },
    display: style.display, direction: style.direction || 'ltr',
  };
}

export function hoveredPart(event, host) {
  const candidates = (event.composedPath?.() || [event.target]).filter(node => node?.nodeType === 1 && composedContains(host, node));
  return candidates.find(node => node.hasAttribute('part') && node.getBoundingClientRect().width > 0) || candidates.find(node => node.getBoundingClientRect().width > 0) || host;
}

/** Web-only geometry: native image streams intentionally do not use these values. */
export function createCanvasInspector({ getState, document: ownerDocument = globalThis.document }) {
  let frameDocument, target, selected, overlay, panel, content, heading, hoverButton, hovered = false, disposed = false, pending, snapshot = '';
  const cleanups = [], stylesheetLinks = new Set();
  const parentWindow = ownerDocument.defaultView;
  const requestFrame = callback => parentWindow.requestAnimationFrame ? parentWindow.requestAnimationFrame(callback) : parentWindow.setTimeout(callback, 16);
  const cancelFrame = id => parentWindow.cancelAnimationFrame ? parentWindow.cancelAnimationFrame(id) : parentWindow.clearTimeout(id);
  const listen = (element, type, listener, options) => { element.addEventListener(type, listener, options); cleanups.push(() => element.removeEventListener(type, listener, options)); };
  const loadStyles = doc => {
    if (doc.querySelector('link[data-canvas-inspector-style]')) return;
    const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = '/canvas-inspector.css'; link.dataset.canvasInspectorStyle = '';
    doc.head.append(link); stylesheetLinks.add(link);
  };
  function ensurePanel() {
    if (panel?.isConnected) return;
    const stage = ownerDocument.querySelector('#preview-stage');
    if (!stage) return;
    loadStyles(ownerDocument);
    panel = ownerDocument.createElement('md-card'); panel.id = 'canvas-inspector-panel'; panel.className = 'canvas-inspector-panel'; panel.setAttribute('variant', 'filled'); panel.setAttribute('full-width', '');
    panel.innerHTML = '<div class="canvas-inspector-heading"><div><strong>Measurements</strong><code data-inspector-selection></code></div><md-button id="canvas-inspector-hover" variant="text" size="xs" toggle icon="touch_app">Inspect hovered parts</md-button></div><div data-inspector-content></div>';
    stage.after(panel);
    content = panel.querySelector('[data-inspector-content]'); heading = panel.querySelector('[data-inspector-selection]'); hoverButton = panel.querySelector('#canvas-inspector-hover');
    hoverButton.addEventListener('mdClick', event => { if (event.target !== hoverButton) return; hovered = Boolean(event.detail?.selected); selected = target; snapshot = ''; draw(); });
  }
  function schedule() {
    if (disposed || pending !== undefined) return;
    pending = requestFrame(() => { pending = undefined; draw(); });
  }
  function disconnect() {
    cleanups.splice(0).forEach(cleanup => cleanup());
    for (const link of stylesheetLinks) if (link.ownerDocument === frameDocument) { link.remove(); stylesheetLinks.delete(link); }
    overlay?.remove(); overlay = undefined; frameDocument = target = selected = undefined;
    if (pending !== undefined) { cancelFrame(pending); pending = undefined; }
    snapshot = '';
  }
  function connect(doc, host) {
    disconnect(); frameDocument = doc; target = selected = host; loadStyles(doc);
    overlay = doc.createElement('div'); overlay.className = 'canvas-measure-overlay'; overlay.setAttribute('aria-hidden', 'true'); overlay.inert = true;
    Object.assign(overlay.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483646' });
    doc.body.append(overlay);
    listen(doc, 'pointermove', event => { if (!hovered) return; const next = hoveredPart(event, target); if (next !== selected) { selected = next; schedule(); } }, { capture: true, passive: true });
    listen(doc, 'focusin', event => { if (!hovered) return; selected = hoveredPart(event, target); schedule(); }, true);
    listen(doc.documentElement, 'pointerleave', () => { selected = target; schedule(); }, { passive: true });
    listen(doc, 'scroll', schedule, { capture: true, passive: true });
    listen(doc.defaultView, 'resize', schedule);
    const roots = new Set();
    const mutation = doc.defaultView.MutationObserver ? new doc.defaultView.MutationObserver(() => { observeRoots(); schedule(); }) : null;
    const resize = doc.defaultView.ResizeObserver ? new doc.defaultView.ResizeObserver(schedule) : null;
    function observeRoots() {
      const visit = element => {
        if (!roots.has(element)) { roots.add(element); resize?.observe(element); }
        if (element.shadowRoot) {
          if (!roots.has(element.shadowRoot)) { roots.add(element.shadowRoot); mutation?.observe(element.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true }); }
          for (const child of element.shadowRoot.children) visit(child);
        }
        for (const child of element.children || []) visit(child);
      };
      visit(host);
    }
    mutation?.observe(host, { subtree: true, childList: true, attributes: true, characterData: true }); observeRoots();
    cleanups.push(() => { mutation?.disconnect(); resize?.disconnect(); });
    doc.fonts?.ready?.then(() => { if (frameDocument === doc) schedule(); });
  }
  function draw() {
    if (disposed || !panel || !getState().layout?.bounds) return;
    if (getState().platform !== 'web') {
      heading.textContent = 'Native image stream'; hoverButton.hidden = true;
      content.innerHTML = '<p class="canvas-inspector-note">Element size, padding, margin, gap and typography are unavailable from the native pixel stream. Use the Web preview to inspect real CSS measurements.</p>';
      return;
    }
    hoverButton.hidden = false; hoverButton.selected = hovered;
    if (!selected?.isConnected || !composedContains(target, selected)) selected = target;
    const metrics = inspectElement(selected);
    if (!metrics) { heading.textContent = 'Web preview'; content.innerHTML = '<p class="canvas-inspector-note">Waiting for the rendered component.</p>'; return; }
    const signature = JSON.stringify([metrics, frameDocument?.defaultView.innerWidth, frameDocument?.defaultView.innerHeight]);
    if (signature === snapshot) return;
    snapshot = signature; heading.textContent = metrics.name; heading.title = metrics.name;
    const cell = (title, value, kind = '') => `<div${kind ? ` class="measure-${kind}"` : ''}><dt>${title}</dt><dd>${escape(value)}</dd></div>`;
    content.innerHTML = `<dl class="canvas-metrics">${cell('Rendered size', `${formatPixels(metrics.rect.width)} × ${formatPixels(metrics.rect.height)}`, 'size')}${cell('Padding · ↑ → ↓ ←', metrics.padding.join(' · '), 'padding')}${cell('Margin · ↑ → ↓ ←', metrics.margin.join(' · '), 'margin')}${cell('Gap · row / column', `${metrics.gap.row} / ${metrics.gap.column}`, 'gap')}${cell('Font / line height', `${metrics.typography.size} / ${metrics.typography.lineHeight}`)}${cell('Weight / letter spacing', `${metrics.typography.weight} / ${metrics.typography.spacing}`)}</dl><p class="canvas-inspector-font">${escape(metrics.typography.family)} · ${escape(metrics.direction.toUpperCase())} · ${escape(metrics.display)}</p><p class="canvas-inspector-note">CSS pixels · spacing is computed CSS${metrics.transformed ? ' · transformed element: spacing guides omitted' : ''}${hovered ? ' · hover a shadow part to inspect it; clicks remain active' : ' · component selected'}</p>`;
    paintOverlay(metrics);
  }
  function paintOverlay(metrics) {
    if (!overlay) return;
    const { rect } = metrics, width = frameDocument.defaultView.innerWidth, height = frameDocument.defaultView.innerHeight;
    const boxes = [];
    const box = (kind, x, y, w, h) => { if (w > 0 && h > 0) boxes.push(`<div class="canvas-measure-${kind}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`); };
    box('bounds', rect.left, rect.top, rect.width, rect.height);
    if (!metrics.transformed) {
      const [pt, pr, pb, pl] = metrics.padding.map(value => Math.max(0, numeric(value) || 0));
      const [bt, br, bb, bl] = metrics.border.map(value => Math.max(0, numeric(value) || 0));
      const x = rect.left + bl, y = rect.top + bt, w = Math.max(0, rect.width - bl - br), h = Math.max(0, rect.height - bt - bb);
      box('padding', x, y, w, Math.min(pt, h)); box('padding', x, y + Math.max(0, h - pb), w, Math.min(pb, h));
      box('padding', x, y + pt, Math.min(pl, w), Math.max(0, h - pt - pb)); box('padding', x + Math.max(0, w - pr), y + pt, Math.min(pr, w), Math.max(0, h - pt - pb));
      const [mt, mr, mb, ml] = metrics.margin.map(value => Math.max(0, numeric(value) || 0));
      box('margin', rect.left, rect.top - mt, rect.width, mt); box('margin', rect.right, rect.top, mr, rect.height);
      box('margin', rect.left, rect.bottom, rect.width, mb); box('margin', rect.left - ml, rect.top, ml, rect.height);
    }
    const label = `${formatPixels(rect.width)} × ${formatPixels(rect.height)}`;
    const labelX = Math.max(4, Math.min(rect.left, width - 158)), labelY = Math.max(4, Math.min(rect.top >= 25 ? rect.top - 23 : rect.bottom + 4, height - 23));
    boxes.push(`<div class="canvas-measure-label" style="left:${labelX}px;top:${labelY}px">${escape(label)}</div>`);
    if (rect.width > 0 && rect.height > 0) {
      boxes.push(`<div class="canvas-measure-guide canvas-measure-guide-x" style="left:${rect.left}px;top:${Math.max(3, rect.top - 7)}px;width:${rect.width}px"></div>`);
      boxes.push(`<div class="canvas-measure-guide canvas-measure-guide-y" style="left:${Math.max(3, rect.left - 7)}px;top:${rect.top}px;height:${rect.height}px"></div>`);
    }
    overlay.innerHTML = boxes.join('');
  }
  function update() {
    if (disposed) return;
    const state = getState(); ensurePanel(); if (!panel) return;
    panel.hidden = !state.layout?.bounds;
    if (panel.hidden) { disconnect(); return; }
    if (state.platform === 'web' && state.previewDocument && state.target?.ownerDocument === state.previewDocument) {
      if (frameDocument !== state.previewDocument || target !== state.target) connect(state.previewDocument, state.target);
    } else disconnect();
    snapshot = ''; draw();
  }
  return { update, dispose() { if (disposed) return; disposed = true; disconnect(); panel?.remove(); stylesheetLinks.forEach(link => link.remove()); stylesheetLinks.clear(); } };
}
