const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const sides = ['Top', 'Right', 'Bottom', 'Left'];
const numeric = value => /^-?(?:\d+\.?\d*|\.\d+)px$/.test(value || '') ? Number.parseFloat(value) : null;
export const formatPixels = value => Number.isFinite(value) ? `${Math.round(value * 100) / 100}px` : 'Unavailable';
const formatNative = (value, unit) => Number.isFinite(value) && unit ? `${Math.round(value * 100) / 100}${unit}` : 'Unavailable';
const cell = (title, value, kind = '') => `<div${kind ? ` class="measure-${kind}"` : ''}><dt>${title}</dt><dd>${escape(value)}</dd></div>`;
const measuredNumber = (value, minimum = -Infinity, maximum = Infinity) => Number.isFinite(value) && value >= minimum && value <= maximum ? value : undefined;
const measuredString = value => typeof value === 'string' && value.trim() ? value : undefined;
function nativeMetrics(metrics, platform) {
  const values = metrics && typeof metrics === 'object' ? metrics : {};
  const spacing = (key, minimum) => Array.isArray(values[key]) && values[key].length === 4 &&
    values[key].every(value => measuredNumber(value, minimum) !== undefined) ? [...values[key]] : undefined;
  const typography = values.typography, typographyUnit = platform === 'ios' ? 'pt' : 'sp';
  return {
    padding: spacing('padding', 0), margin: spacing('margin', -Infinity), border: spacing('border', 0),
    gap: { row: measuredNumber(values.gap?.row, 0), column: measuredNumber(values.gap?.column, 0) },
    typography: typography?.unit === typographyUnit ? {
      size: measuredNumber(typography.size, Number.MIN_VALUE), lineHeight: measuredNumber(typography.lineHeight, Number.MIN_VALUE),
      weight: measuredNumber(typography.weight, 1, 1000), spacing: measuredNumber(typography.spacing),
      family: measuredString(typography.family), unit: typographyUnit,
    } : {},
    display: measuredString(values.display), direction: ['ltr', 'rtl'].includes(values.direction) ? values.direction : undefined,
  };
}

/** Native component metrics come only from the host's measured layout report. */
export function inspectNativeFrame(frame, platform) {
  const inspection = frame?.inspection, unit = platform === 'ios' ? 'pt' : platform === 'android' ? 'dp' : null;
  if (!unit || inspection?.version !== 1 || inspection.unit !== unit ||
      inspection.source !== (platform === 'ios' ? 'SwiftUI layout' : 'Compose layout') ||
      ![frame.logicalWidth, frame.logicalHeight].every(value => Number.isFinite(value) && value > 0) ||
      !Array.isArray(inspection.nodes)) return null;
  const nodes = [], ids = new Set();
  for (const item of inspection.nodes) {
    const bounds = item?.bounds;
    if (!measuredString(item?.id) || ids.has(item.id) || !measuredString(item.name) || !bounds ||
        !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key])) || bounds.width < 0 || bounds.height < 0) continue;
    ids.add(item.id);
    nodes.push({ id: item.id, name: item.name, parentId: measuredString(item.parentId),
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, metrics: nativeMetrics(item.metrics, platform) });
  }
  const root = nodes.find(node => node.id === 'component');
  return root ? { ...root, unit, source: inspection.source, nodes, frame: { width: frame.logicalWidth, height: frame.logicalHeight } } : null;
}

/** Native hover selects a reported part; no DOM hit target substitutes for it. */
export function nativeNodeAtPoint(inspection, image, clientX, clientY) {
  if (!inspection || !image || ![clientX, clientY, image.left, image.top, image.width, image.height].every(Number.isFinite) ||
      image.width <= 0 || image.height <= 0 || clientX < image.left || clientY < image.top ||
      clientX >= image.left + image.width || clientY >= image.top + image.height) return 'component';
  const x = (clientX - image.left) * inspection.frame.width / image.width;
  const y = (clientY - image.top) * inspection.frame.height / image.height;
  const contains = bounds => bounds.width > 0 && bounds.height > 0 &&
    x >= bounds.x && y >= bounds.y && x < bounds.x + bounds.width && y < bounds.y + bounds.height;
  // Button content is clipped by its surface, but native layout reports retain
  // the intrinsic size of overflowing text/icons. Restrict picking only; those
  // measurements must remain intact. Other components may allow overflow.
  if (inspection.name === 'md-button' && !contains(inspection.bounds)) return 'component';
  const depth = node => {
    const seen = new Set([node.id]); let count = 0, parentId = node.parentId;
    while (parentId && !seen.has(parentId) && count < inspection.nodes.length) {
      const parent = inspection.nodes.find(item => item.id === parentId);
      if (!parent) break;
      seen.add(parentId); count++; parentId = parent.parentId;
    }
    return count;
  };
  const partPriority = node => node.id.endsWith('.label') ? 2 : node.id.endsWith('.content') ? -1 : node.id === 'component' ? -2 : 0;
  return inspection.nodes.filter(({ bounds }) => contains(bounds))
    .sort((a, b) => depth(b) - depth(a) || a.bounds.width * a.bounds.height - b.bounds.width * b.bounds.height ||
      partPriority(b) - partPriority(a) || a.id.localeCompare(b.id))[0]?.id || 'component';
}

/** Map host units to the displayed image; CSS never supplies component metrics. */
export function nativeOverlayGeometry(metrics, image, viewport, parent) {
  if (!metrics || ![image, viewport, parent].every(box => box && ['left', 'top', 'width', 'height'].every(key => Number.isFinite(box[key]))) ||
      image.width <= 0 || image.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return null;
  const scaleX = image.width / metrics.frame.width, scaleY = image.height / metrics.frame.height;
  return {
    viewport: { left: viewport.left - parent.left, top: viewport.top - parent.top, width: viewport.width, height: viewport.height },
    image: { left: image.left - viewport.left, top: image.top - viewport.top, width: image.width, height: image.height },
    bounds: { left: metrics.bounds.x * scaleX, top: metrics.bounds.y * scaleY, width: metrics.bounds.width * scaleX, height: metrics.bounds.height * scaleY },
  };
}

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

/** Web computed styles and native host measurements keep separate provenance. */
export function createCanvasInspector({ getState, document: ownerDocument = globalThis.document }) {
  let frameDocument, nativeFrame, target, selected, overlay, panel, content, heading, hoverButton, hovered = false, disposed = false, pending, snapshot = '';
  let nativeSelected = 'component', nativeContext;
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
    hoverButton.addEventListener('mdClick', event => { if (event.target !== hoverButton) return; hovered = Boolean(event.detail?.selected); selected = target; nativeSelected = 'component'; snapshot = ''; draw(); });
  }
  function schedule() {
    if (disposed || pending !== undefined) return;
    pending = requestFrame(() => { pending = undefined; draw(); });
  }
  function disconnect() {
    cleanups.splice(0).forEach(cleanup => cleanup());
    for (const link of stylesheetLinks) if (link.ownerDocument === frameDocument) { link.remove(); stylesheetLinks.delete(link); }
    overlay?.remove(); overlay = undefined; frameDocument = nativeFrame = target = selected = undefined;
    nativeSelected = 'component'; nativeContext = undefined;
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
  function connectNative(frame) {
    disconnect(); nativeFrame = frame;
    overlay = ownerDocument.createElement('div'); overlay.className = 'canvas-measure-overlay canvas-measure-native';
    overlay.setAttribute('aria-hidden', 'true'); overlay.inert = true;
    Object.assign(overlay.style, { position: 'absolute', pointerEvents: 'none', zIndex: '4' });
    frame.parentElement.append(overlay);
    listen(frame, 'pointermove', event => {
      if (!hovered) return;
      const state = getState(), image = frame.querySelector('#native-live-surface img'), viewport = frame.getBoundingClientRect();
      const inside = event.clientX >= viewport.left && event.clientX < viewport.right && event.clientY >= viewport.top && event.clientY < viewport.bottom;
      const next = inside && image ? nativeNodeAtPoint(inspectNativeFrame(state.liveFrame, state.platform), image.getBoundingClientRect(), event.clientX, event.clientY) : 'component';
      if (next !== nativeSelected) { nativeSelected = next; schedule(); }
    }, { capture: true, passive: true });
    listen(frame, 'pointerleave', () => { if (nativeSelected !== 'component') { nativeSelected = 'component'; schedule(); } }, { passive: true });
    listen(ownerDocument, 'scroll', schedule, { capture: true, passive: true });
    listen(parentWindow, 'resize', schedule);
    const resize = parentWindow.ResizeObserver ? new parentWindow.ResizeObserver(schedule) : null;
    resize?.observe(frame); resize?.observe(frame.parentElement);
    // Native animation replaces the image frequently. Presence changes need a
    // redraw; measured size/position changes arrive through update() with the
    // frame metadata, so unchanged animation frames do not redraw inspection.
    let hasImage = Boolean(frame.querySelector('#native-live-surface img'));
    const mutation = parentWindow.MutationObserver ? new parentWindow.MutationObserver(() => {
      const nextHasImage = Boolean(frame.querySelector('#native-live-surface img'));
      if (nextHasImage !== hasImage) { hasImage = nextHasImage; if (!hasImage) nativeSelected = 'component'; schedule(); }
    }) : null;
    mutation?.observe(frame, { childList: true, subtree: true });
    cleanups.push(() => { resize?.disconnect(); mutation?.disconnect(); });
  }
  function drawNative() {
    const state = getState(), image = nativeFrame?.querySelector('#native-live-surface img');
    const context = JSON.stringify([state.platform, state.selected?.tag, state.liveFrame?.sessionId]);
    if (context !== nativeContext) { nativeSelected = 'component'; nativeContext = context; }
    const inspection = image?.isConnected ? inspectNativeFrame(state.liveFrame, state.platform) : null;
    const node = inspection?.nodes.find(item => item.id === nativeSelected) || inspection;
    if (node?.id !== nativeSelected) nativeSelected = node?.id || 'component';
    const metrics = inspection && { ...inspection, ...node };
    hoverButton.hidden = !(inspection?.nodes.length > 1); hoverButton.selected = hovered;
    heading.textContent = metrics?.name || (state.platform === 'ios' ? 'SwiftUI preview' : 'Android preview');
    heading.title = heading.textContent;
    if (!metrics) {
      const waiting = !state.liveFrame || !image;
      content.innerHTML = `<p class="canvas-inspector-note">${waiting ? 'Waiting for a rendered native frame and measured component bounds.' : 'This native frame does not include valid component bounds. Measurements are unavailable.'}</p>`;
      if (overlay) { overlay.hidden = true; overlay.replaceChildren(); }
      snapshot = ''; return;
    }
    const signature = JSON.stringify(metrics);
    if (signature !== snapshot) {
      snapshot = signature;
      const unit = metrics.unit, bounds = metrics.bounds, measured = metrics.metrics, typography = measured.typography;
      const spacing = value => value ? value.map(side => formatNative(side, unit)).join(' · ') : 'Unavailable';
      const unavailable = !measured.padding || !measured.margin || [measured.gap.row, measured.gap.column, typography.size,
        typography.lineHeight, typography.weight, typography.spacing, typography.family, measured.direction, measured.display].includes(undefined);
      content.innerHTML = `<dl class="canvas-metrics">${cell('Rendered size', `${formatNative(bounds.width, unit)} × ${formatNative(bounds.height, unit)}`, 'size')}${cell('Padding · ↑ → ↓ ←', spacing(measured.padding), 'padding')}${cell('Margin · ↑ → ↓ ←', spacing(measured.margin), 'margin')}${cell('Gap · row / column', `${formatNative(measured.gap.row, unit)} / ${formatNative(measured.gap.column, unit)}`, 'gap')}${cell('Font / line height', `${formatNative(typography.size, typography.unit)} / ${formatNative(typography.lineHeight, typography.unit)}`)}${cell('Weight / letter spacing', `${typography.weight ?? 'Unavailable'} / ${formatNative(typography.spacing, typography.unit)}`)}</dl><p class="canvas-inspector-font">${escape(typography.family || 'Unavailable')} · ${escape(measured.direction?.toUpperCase() || 'Unavailable')} · ${escape(measured.display || 'Unavailable')}</p><p class="canvas-inspector-note">${escape(metrics.source)} · ${unit === 'pt' ? 'points' : 'density-independent pixels'} · position: ${formatNative(bounds.x, unit)} / ${formatNative(bounds.y, unit)} · native frame: ${formatNative(metrics.frame.width, unit)} × ${formatNative(metrics.frame.height, unit)}${hovered && !hoverButton.hidden ? ' · hover a measured part to inspect it; clicks remain active' : ' · component selected'}.${unavailable ? ' Some measurements are unavailable for this part.' : ''}</p>`;
    }
    paintNativeOverlay(metrics, image);
  }
  function paintNativeOverlay(metrics, image) {
    if (!overlay || !nativeFrame?.isConnected) return;
    const frameRect = nativeFrame.getBoundingClientRect();
    const viewport = { left: frameRect.left + nativeFrame.clientLeft, top: frameRect.top + nativeFrame.clientTop,
      width: nativeFrame.clientWidth, height: nativeFrame.clientHeight };
    const geometry = nativeOverlayGeometry(metrics, image.getBoundingClientRect(), viewport, nativeFrame.parentElement.getBoundingClientRect());
    overlay.hidden = !geometry;
    if (!geometry) { overlay.replaceChildren(); return; }
    const styles = box => Object.entries(box).map(([key, value]) => `${key}:${value}px`).join(';');
    Object.assign(overlay.style, Object.fromEntries(Object.entries(geometry.viewport).map(([key, value]) => [key, `${value}px`])));
    const bounds = geometry.bounds, boxes = [];
    const box = (kind, left, top, width, height) => {
      if (width > 0 && height > 0) boxes.push(`<div class="canvas-measure-${kind}" style="${styles({ left, top, width, height })}"></div>`);
    };
    box('bounds', bounds.left, bounds.top, bounds.width, bounds.height);
    const scaleX = geometry.image.width / metrics.frame.width, scaleY = geometry.image.height / metrics.frame.height;
    const spacing = values => values?.map((value, index) => Math.max(0, value) * (index % 2 ? scaleX : scaleY));
    const padding = spacing(metrics.metrics.padding), margin = spacing(metrics.metrics.margin);
    if (padding) {
      // Split Button halves reserve their reported border inside the layout.
      // Other native controls use overlaid strokes, so keep their padding at
      // the measured outer edge rather than applying a global border inset.
      const splitHalf = metrics.nodes.some(node => node.id === 'component' && node.name === 'md-split-button') &&
        metrics.parentId === 'component' && ['component.leading', 'component.trailing'].includes(metrics.id);
      const [bt, br, bb, bl] = splitHalf ? spacing(metrics.metrics.border) || [0, 0, 0, 0] : [0, 0, 0, 0];
      const [top, right, bottom, left] = padding, x = bounds.left + bl, y = bounds.top + bt;
      const w = Math.max(0, bounds.width - bl - br), h = Math.max(0, bounds.height - bt - bb);
      box('padding', x, y, w, Math.min(top, h)); box('padding', x, y + Math.max(0, h - bottom), w, Math.min(bottom, h));
      box('padding', x, y + top, Math.min(left, w), Math.max(0, h - top - bottom));
      box('padding', x + Math.max(0, w - right), y + top, Math.min(right, w), Math.max(0, h - top - bottom));
    }
    if (margin) {
      const [top, right, bottom, left] = margin, { left: x, top: y, width: w, height: h } = bounds;
      box('margin', x, y - top, w, top); box('margin', x + w, y, right, h);
      box('margin', x, y + h, w, bottom); box('margin', x - left, y, left, h);
    }
    // The outer layer clips to the scrollport; the inner layer clips to the
    // captured image, including partially off-screen native component bounds.
    const left = geometry.image.left + bounds.left, top = geometry.image.top + bounds.top, right = left + bounds.width, bottom = top + bounds.height;
    const visible = Math.min(right, geometry.image.left + geometry.image.width, viewport.width) > Math.max(left, geometry.image.left, 0) &&
      Math.min(bottom, geometry.image.top + geometry.image.height, viewport.height) > Math.max(top, geometry.image.top, 0);
    const labelX = Math.max(4, Math.min(left, viewport.width - 158)), labelY = Math.max(4, Math.min(top >= 25 ? top - 23 : bottom + 4, viewport.height - 23));
    const label = visible ? `<div class="canvas-measure-label" style="left:${labelX}px;top:${labelY}px">${escape(`${formatNative(metrics.bounds.width, metrics.unit)} × ${formatNative(metrics.bounds.height, metrics.unit)}`)}</div>` : '';
    overlay.innerHTML = `<div class="canvas-measure-native-image" style="${styles(geometry.image)}">${boxes.join('')}</div>${label}`;
  }
  function draw() {
    if (disposed || !panel || !getState().layout?.bounds) return;
    if (getState().platform !== 'web') { drawNative(); return; }
    hoverButton.hidden = false; hoverButton.selected = hovered;
    if (!selected?.isConnected || !composedContains(target, selected)) selected = target;
    const metrics = inspectElement(selected);
    if (!metrics) { heading.textContent = 'Web preview'; content.innerHTML = '<p class="canvas-inspector-note">Waiting for the rendered component.</p>'; return; }
    const signature = JSON.stringify([metrics, frameDocument?.defaultView.innerWidth, frameDocument?.defaultView.innerHeight]);
    if (signature === snapshot) return;
    snapshot = signature; heading.textContent = metrics.name; heading.title = metrics.name;
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
    overlay.innerHTML = boxes.join('');
  }
  function update() {
    if (disposed) return;
    const state = getState(); ensurePanel(); if (!panel) return;
    panel.hidden = !state.layout?.bounds;
    if (panel.hidden) { disconnect(); return; }
    if (state.platform === 'web' && state.previewDocument && state.target?.ownerDocument === state.previewDocument) {
      if (frameDocument !== state.previewDocument || target !== state.target) connect(state.previewDocument, state.target);
    } else if (state.platform === 'ios' || state.platform === 'android') {
      const frame = ownerDocument.querySelector('#native-render-frame');
      if (frame && (nativeFrame !== frame || !overlay?.isConnected)) connectNative(frame);
      else if (!frame) disconnect();
    } else disconnect();
    snapshot = ''; draw();
  }
  return { update, dispose() { if (disposed) return; disposed = true; disconnect(); panel?.remove(); stylesheetLinks.forEach(link => link.remove()); stylesheetLinks.clear(); } };
}
