import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasViewportFit, canvasDragSize, canvasEdgeScroll, createCanvasTools } from './canvas-tools.js';
import { nativeImagePoint } from './contracts.js';

// Controller boundaries only: real CSS geometry and fullscreen rendering are
// verified in the browser. The inspector has its own measurement tests.
class ElementStub {
  constructor() {
    this.listeners = new Map(); this.attributes = new Map(); this.children = []; this.capturedPointers = new Set();
    this.dataset = {}; this.style = {}; this.clientWidth = 0; this.clientHeight = 0;
    this.hidden = false; this.inert = false; this.scrollLeft = 0; this.scrollTop = 0; this.rect = { left: 0, top: 0, right: 1000, bottom: 800 };
    this.getBoundingClientRect = () => this.rect;
    const classes = new Set();
    this.classList = { contains: name => classes.has(name), toggle(name, force) {
      const enabled = force ?? !classes.has(name);
      if (enabled) classes.add(name); else classes.delete(name);
      return enabled;
    } };
  }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  async emit(name, detail = {}) { const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...detail }; for (const listener of [...this.listeners.get(name) || []]) await listener(event); return event; }
  setPointerCapture(id) { this.capturedPointers.add(id); }
  hasPointerCapture(id) { return this.capturedPointers.has(id); }
  releasePointerCapture(id) { this.capturedPointers.delete(id); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  closest(selector) { return selector === 'md-tooltip' ? this.tooltip : null; }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  focus(options) { this.focusOptions = options; globalThis.document.activeElement = this; }
}

function frameDocument(width = 384, height = 256) {
  const doc = new ElementStub();
  doc.documentElement = new ElementStub(); doc.body = new ElementStub(); doc.defaultView = new ElementStub();
  Object.assign(doc.documentElement, { clientWidth: width, clientHeight: height });
  doc.createElement = () => new ElementStub();
  return doc;
}

function fixture(t, options = {}) {
  const selectors = ['.workspace-grid', '#preview-stage', '#preview-content', '.canvas-viewport-shell', '.canvas-viewport-scale', '#component-frame', '#canvas-dimensions', '#canvas-direction', '#canvas-direction-announcement', '#canvas-help', '#canvas-rtl', '#canvas-grid', '#canvas-bounds', '#canvas-fullscreen', '#canvas-reset-size', '#canvas-expand-tooltip', '#canvas-expanded-label'];
  const nodes = new Map(selectors.map(selector => [selector, new ElementStub()]));
  for (const selector of ['#canvas-grid', '#canvas-bounds']) nodes.get(selector).tooltip = new ElementStub();
  const doc = frameDocument(), frame = nodes.get('#component-frame'), workspace = nodes.get('.workspace-grid');
  const preview = frameDocument();
  frame.clientWidth = preview.documentElement.clientWidth; frame.clientHeight = preview.documentElement.clientHeight;
  Object.assign(nodes.get('#preview-content'), { clientWidth: frame.clientWidth, clientHeight: frame.clientHeight });
  frame.contentDocument = preview;
  const outside = [new ElementStub(), new ElementStub()]; outside[1].inert = true;
  doc.body.style.overflow = 'clip';
  doc.querySelector = selector => nodes.get(selector) || null;
  doc.querySelectorAll = () => outside;
  doc.fullscreenElement = null;
  workspace.requestFullscreen = async () => { doc.fullscreenElement = workspace; await doc.emit('fullscreenchange'); };
  doc.exitFullscreen = async () => { doc.fullscreenElement = null; await doc.emit('fullscreenchange'); };
  const pending = new Map(), observers = []; let nextFrame = 0;
  class ResizeObserverStub {
    constructor(callback) { this.callback = callback; this.elements = new Set(); observers.push(this); }
    observe(element) { this.elements.add(element); }
    unobserve(element) { this.elements.delete(element); }
    disconnect() { this.elements.clear(); this.disconnected = true; }
  }
  const globals = { document: doc, ResizeObserver: ResizeObserverStub, requestAnimationFrame: callback => { const id = ++nextFrame; pending.set(id, callback); return id; }, cancelAnimationFrame: id => pending.delete(id) };
  const descriptors = Object.fromEntries(Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, configurable: true });
  const state = { platform: 'web', layout: { direction: 'ltr', width: 'fit', height: 'auto', grid: false, bounds: false, expanded: false }, props: { icon: 'arrow_forward', label: 'Continue' }, previewDocument: preview, ...options };
  const changes = [], inspector = { updates: 0, disposals: 0, update() { this.updates++; }, dispose() { this.disposals++; } };
  const ui = createCanvasTools({ getState: () => state, onLayoutChange: patch => changes.push({ ...patch }), createInspector: () => inspector });
  t.after(() => {
    ui.dispose();
    for (const [name, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  });
  let timestamp = 0;
  const flush = () => { timestamp += 16; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(timestamp)); };
  return { ui, state, doc, preview, nodes, frame, workspace, outside, changes, inspector, observers, pending, flush };
}

function nativeFixture(t, platform = 'ios') {
  const context = fixture(t, { platform, previewDocument: null });
  const { nodes } = context;
  nodes.delete('#component-frame');
  const native = new ElementStub(), nativeFrame = new ElementStub(), surface = new ElementStub(), image = new ElementStub();
  native.clientWidth = 384; native.clientHeight = 310;
  surface.clientWidth = 320; surface.clientHeight = 180;
  image.style.width = '320px'; image.naturalWidth = 640; image.naturalHeight = 360;
  nodes.set('#preview-content > .native-snapshot', native);
  nodes.set('#native-render-frame', nativeFrame); nodes.set('#native-live-surface', surface);
  nodes.set('#native-live-surface img', image);
  native.append(nativeFrame); nativeFrame.append(surface); surface.append(image);
  return { ...context, native, nativeFrame, surface, image };
}

for (const platform of ['ios', 'android']) test(`${platform} dotted background follows capture center through overflow and scrolling`, async t => {
  const { ui, nodes, nativeFrame, image, state } = nativeFixture(t, platform);
  nativeFrame.rect = { left: 100, top: 80, width: 800, height: 400 };
  image.rect = { left: 180, top: 180, width: 640, height: 200 };
  ui.init();
  assert.equal(nativeFrame.style.backgroundPosition, '388px 188px', 'a fitting capture shares the viewport center');
  nativeFrame.rect = { left: 100, top: 80, width: 300, height: 120 };
  image.rect = { left: 100, top: 80, width: 640, height: 200 };
  ui.update();
  assert.equal(nativeFrame.style.backgroundPosition, '308px 88px', 'overflow remains anchored to the image, not the smaller viewport');
  image.rect = { ...image.rect, left: 60, top: 20 };
  await nodes.get('#preview-content').emit('scroll', { target: nativeFrame });
  assert.equal(nativeFrame.style.backgroundPosition, '268px 28px', 'both axes include the image displacement from scrolling');
  await nodes.get('#canvas-grid').emit('mdClick', { detail: { selected: true } });
  assert.equal(state.layout.grid, true);
  assert.equal(nodes.get('#preview-stage').dataset.grid, 'true', 'dot alignment does not change grid state or rendering');
  nodes.delete('#native-live-surface img'); ui.update();
  assert.equal(nativeFrame.style.backgroundPosition, 'center', 'a reconnect does not retain the previous image offset');
  ui.dispose();
  assert.equal(nodes.get('#preview-content').listeners.get('scroll').size, 0);
});

test('web viewports retain actual pixels and overflow rather than scaling', () => {
  const desktop = canvasViewportFit({ availableWidth: 614, viewportWidth: 1024, viewportHeight: 310 });
  assert.equal(desktop.logicalWidth, 1024);
  assert.equal(desktop.scale, 1);
  assert.equal(desktop.width, 1024);
  assert.equal(desktop.height, 310);
  assert.equal(canvasViewportFit({ availableWidth: 1400, viewportWidth: 1024 }).scale, 1, 'large cards do not upscale components');
  assert.equal(canvasViewportFit({ availableWidth: 614, viewportWidth: 'fit' }).logicalWidth, 614);
  const expanded = canvasViewportFit({ availableWidth: 512, viewportWidth: 1024, viewportHeight: 310, expandedHeight: 400 });
  assert.equal(expanded.logicalHeight, 400);
  assert.equal(expanded.height, 400, 'expanded mode fills the available height after scaling');
});

test('wide web previews remain unscaled, keep CSS rulers truthful, and reset without replacing the iframe', async t => {
  const { ui, state, frame, preview, nodes, observers, flush } = fixture(t);
  const content = nodes.get('#preview-content'), shell = nodes.get('.canvas-viewport-shell'), scene = nodes.get('.canvas-viewport-scale');
  content.clientWidth = 614; frame.clientWidth = 1024; preview.documentElement.clientWidth = 1024;
  frame.style.height = '310px'; frame.clientHeight = 310;
  state.layout.width = 1024; state.layout.grid = true; ui.init();
  assert.equal(frame.style.width, '1024px');
  assert.equal(scene.style.width, '1024px');
  assert.equal(scene.style.transform, 'scale(1)');
  assert.equal(shell.style.width, '1024px');
  assert.equal(shell.style.height, '310px');
  assert.equal(nodes.get('#canvas-dimensions').textContent, '1024 × 310 px');
  assert.doesNotMatch(nodes.get('#canvas-help').textContent, /Shown at/);
  assert.equal(preview.body.children[0].children[0].children.at(-1).textContent, '960');
  content.clientWidth = 1200;
  for (const observer of observers) observer.callback([{ target: nodes.get('#preview-stage') }]);
  flush();
  assert.equal(scene.style.transform, 'scale(1)'); assert.equal(shell.style.width, '1024px');
  assert.equal(nodes.get('#canvas-dimensions').textContent, '1024 × 310 px');
  frame.clientWidth = 1200; preview.documentElement.clientWidth = 1200;
  await nodes.get('.canvas-viewport-shell').children[0].emit('keydown', { key: 'Home' });
  assert.equal(frame.style.width, '100%'); assert.equal(scene.style.width, '1200px');
  assert.equal(nodes.get('#component-frame'), frame, 'scaling must not replace or reparent a mounted iframe');
  assert.equal(state.previewDocument, preview);
});

test('direction and viewport controls update the preview without rewriting component props', async t => {
  const { ui, state, preview, nodes, changes, frame } = fixture(t);
  const props = structuredClone(state.props);
  ui.init();
  assert.equal(preview.documentElement.dir, 'ltr');
  assert.equal(nodes.get('#canvas-direction-announcement').textContent, 'Left-to-right layout');
  await nodes.get('#canvas-rtl').emit('mdClick', { detail: { selected: true } });
  assert.equal(preview.documentElement.dir, 'rtl');
  assert.equal(nodes.get('#canvas-direction').textContent, 'RTL ←');
  assert.equal(nodes.get('#canvas-direction-announcement').textContent, 'Right-to-left layout');
  assert.equal(nodes.get('#canvas-rtl').selected, true);
  assert.match(nodes.get('#canvas-help').textContent, /centered text-only.*can look unchanged/);
  assert.deepEqual(state.props, props);
  assert.deepEqual(changes, [{ direction: 'rtl' }]);
  const widthHandle = nodes.get('.canvas-viewport-shell').children.find(child => child.dataset.resize === 'e');
  await widthHandle.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(frame.style.width, '374px');
  await widthHandle.emit('keydown', { key: 'Home' });
  assert.equal(frame.style.width, '100%');
  await nodes.get('#canvas-rtl').emit('mdClick', { detail: { selected: false } });
  assert.equal(preview.documentElement.dir, 'ltr');
  assert.deepEqual(state.props, props);
});

test('rulers use physical viewport coordinates, refresh on size changes, and follow replacement documents', t => {
  const { ui, state, preview, nodes } = fixture(t);
  state.layout.grid = true; state.layout.direction = 'rtl'; ui.init();
  const ruler = preview.body.children[0];
  assert.equal(ruler.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(ruler.children[0].children.map(tick => [tick.textContent, tick.style.left]), ['64', '128', '192', '256', '320'].map(value => [value, `${value}px`]));
  assert.deepEqual(ruler.children[1].children.map(tick => Number.parseFloat(tick.style.top) + 18), [64, 128, 192], 'vertical rail starts 18px below the viewport origin');
  const unchangedAxis = ruler.children[0]; ui.update();
  assert.equal(ruler.children[0], unchangedAxis, 'unchanged dimensions preserve ruler nodes');
  preview.documentElement.clientWidth = 200; ui.update();
  assert.deepEqual(ruler.children[0].children.map(tick => tick.textContent), ['64', '128', '192']);
  const next = frameDocument(512, 320); state.previewDocument = next; nodes.get('#component-frame').contentDocument = next; ui.update();
  assert.equal(preview.body.children.length, 0);
  assert.equal(preview.listeners.get('keydown')?.size, 0);
  assert.equal(next.listeners.get('keydown')?.size, 1);
  assert.equal(next.documentElement.dir, 'rtl');
  state.layout.grid = false; ui.update();
  assert.equal(next.body.children.length, 0);
});

test('actual surface resizing refreshes dimensions and rulers after a width transition', t => {
  const { ui, state, frame, preview, nodes, observers, flush } = fixture(t);
  state.layout.grid = true; ui.init();
  assert.ok(observers.some(observer => observer.elements.has(frame)), 'the iframe itself must be observed, not only its unchanged parent');
  frame.clientWidth = 768; preview.documentElement.clientWidth = 768;
  for (const observer of observers) if (observer.elements.has(frame)) observer.callback([{ target: frame }]);
  flush();
  assert.equal(nodes.get('#canvas-dimensions').textContent, '768 × 256 px');
  assert.equal(preview.body.children[0].children[0].children.at(-1).textContent, '704');
  const native = new ElementStub(); native.clientWidth = 426; native.clientHeight = 420;
  const nativeSurface = new ElementStub(); nativeSurface.clientWidth = 426; nativeSurface.clientHeight = 180;
  nodes.delete('#component-frame'); nodes.set('#preview-content > .native-snapshot', native);
  nodes.set('#native-live-surface', nativeSurface);
  state.previewDocument = null; state.platform = 'android'; ui.update();
  assert.ok(observers.every(observer => !observer.elements.has(frame)), 'old frames are unobserved');
  assert.ok(observers.some(observer => observer.elements.has(native)));
  assert.equal(nodes.get('#canvas-dimensions').textContent, '426 × 420 px', 'native measurements describe the viewing area, independently of intrinsic capture size');
  assert.match(nodes.get('#canvas-help').textContent, /Viewing area grid/);
  assert.equal(nativeSurface.children.length, 0, 'rulers belong to the viewing area, not the native input surface');
});

for (const platform of ['ios', 'android']) test(`${platform} viewing area retains actual pixels without rewriting native capture dimensions`, async t => {
  const { ui, state, nodes, changes, native, surface, image } = nativeFixture(t, platform);
  nodes.get('#preview-content').clientWidth = 622;
  image.style.width = '1024px'; image.naturalWidth = 2048; image.naturalHeight = 200;
  state.layout.width = 2400; state.layout.height = 900;
  state.liveFrame = { width: 2048, height: 200, logicalWidth: 1024, logicalHeight: 100 };
  ui.init();
  assert.equal(native.style.width, '2400px'); assert.equal(native.style.height, '900px');
  assert.equal(native.dataset.scale, '1');
  assert.equal(image.style.width, '1024px', 'native capture width is independent of the unrestricted viewing area');
  assert.equal(state.layout.width, 2400); assert.equal(state.liveFrame.logicalWidth, 1024);
  assert.deepEqual(changes, [], 'Presentation containment must not restart or reconfigure the native session');
  for (const viewportWidth of [622, 100, 1024]) {
    state.layout.width = viewportWidth; ui.update();
    const rect = { left: -120, top: -30, width: 1024, height: 100 };
    assert.deepEqual(nativeImagePoint(rect, image.naturalWidth, image.naturalHeight, 1024, 100,
      rect.left + rect.width / 2, rect.top + rect.height / 2), { x: 512, y: 50 });
    assert.equal(image.style.width, '1024px'); assert.equal(native.style.width, `${viewportWidth}px`);
    assert.equal(image.parentNode, surface, 'resizing never reparents the live image or input surface');
  }
  await resizeHandle(nodes, 'e', true).emit('keydown', { key: 'Home' });
  assert.equal(native.style.width, '622px'); assert.equal(native.style.height, '310px');
});

for (const platform of ['ios', 'android']) test(`${platform} shares grid and inspection preferences with Web`, async t => {
  const { ui, state, preview, nodes, changes } = fixture(t);
  const stage = nodes.get('#preview-stage'), grid = nodes.get('#canvas-grid'), bounds = nodes.get('#canvas-bounds');
  ui.init();
  await grid.emit('mdClick', { detail: { selected: true } });
  await bounds.emit('mdClick', { detail: { selected: true } });
  assert.equal(preview.body.children.length, 1);
  const originalChanges = changes.length;
  state.platform = platform;
  const native = new ElementStub(), surface = new ElementStub();
  nodes.set('#preview-content > .native-snapshot', native); nodes.set('#native-live-surface', surface);
  ui.update();
  assert.equal(grid.disabled, false); assert.equal(grid.selected, true);
  assert.equal(bounds.disabled, false); assert.equal(bounds.selected, true);
  assert.equal(bounds.getAttribute('aria-disabled'), 'false');
  assert.equal(bounds.getAttribute('aria-label'), 'Inspect component measurements');
  assert.equal(bounds.tooltip.text, 'Inspect measured native size, spacing and typography');
  await bounds.emit('mdClick', { detail: { selected: false } });
  assert.equal(changes.length, originalChanges + 1);
  assert.equal(stage.dataset.bounds, 'false');
  await bounds.emit('mdClick', { detail: { selected: true } });
  assert.equal(state.layout.grid, true); assert.equal(state.layout.bounds, true);
  assert.equal(stage.dataset.grid, 'true'); assert.equal(stage.dataset.bounds, 'true');
  assert.equal(preview.documentElement.dataset.grid, 'false');
  assert.equal(preview.body.children.length, 0); assert.equal(surface.children.length, 0);
  const ruler = native.children.find(child => child.className === 'canvas-rulers canvas-rulers-native');
  assert.ok(ruler); assert.equal(ruler.getAttribute('aria-hidden'), 'true');
  assert.equal(ruler.children[0].children.at(-1).textContent, '320');
  assert.match(nodes.get('#canvas-help').textContent, /Viewing area/);
  ui.update(); assert.equal(ruler.parentNode, native, 'repeated updates retain the same ruler');
  await grid.emit('mdClick', { detail: { selected: false } });
  assert.equal(state.layout.grid, false); assert.equal(ruler.parentNode, null);
  await grid.emit('mdClick', { detail: { selected: true } });
  state.platform = 'web'; ui.update();
  for (const button of [grid, bounds]) {
    assert.equal(button.disabled, false); assert.equal(button.selected, true);
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.doesNotMatch(button.getAttribute('aria-label'), /only/);
  }
  assert.equal(grid.tooltip.text, '8px grid with 64px pixel rulers');
  assert.equal(stage.dataset.grid, 'true'); assert.equal(stage.dataset.bounds, 'true');
  assert.equal(preview.body.children.length, 1);
  assert.ok(native.children.every(child => child.className !== 'canvas-rulers canvas-rulers-native'));
});

test('native fullscreen enters the complete workspace and handles explicit or browser exit', async t => {
  const { ui, state, doc, workspace, nodes } = fixture(t); ui.init();
  const toggle = nodes.get('#canvas-fullscreen');
  await toggle.emit('mdClick');
  assert.equal(doc.fullscreenElement, workspace);
  assert.equal(state.layout.expanded, true);
  assert.equal(workspace.classList.contains('is-expanded'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(doc.activeElement, toggle);
  await toggle.emit('mdClick');
  assert.equal(doc.fullscreenElement, null); assert.equal(state.layout.expanded, false);
  await toggle.emit('mdClick');
  doc.fullscreenElement = null; await doc.emit('fullscreenchange');
  assert.equal(state.layout.expanded, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('fullscreen denial falls back locally and iframe Escape restores prior page state', async t => {
  const { ui, state, doc, preview, workspace, nodes, outside } = fixture(t);
  workspace.requestFullscreen = async () => { throw new Error('Fullscreen unavailable'); };
  ui.init(); await nodes.get('#canvas-fullscreen').emit('mdClick');
  assert.equal(state.layout.expanded, true); assert.equal(workspace.classList.contains('expanded-fallback'), true);
  assert.equal(doc.body.style.overflow, 'hidden'); assert.deepEqual(outside.map(node => node.inert), [true, true]);
  await preview.emit('keydown', { key: 'Escape', defaultPrevented: true });
  assert.equal(state.layout.expanded, true, 'component Escape handlers take precedence');
  await preview.emit('keydown', { key: 'Escape' });
  assert.equal(state.layout.expanded, false); assert.equal(workspace.classList.contains('expanded-fallback'), false);
  assert.equal(doc.body.style.overflow, 'clip'); assert.deepEqual(outside.map(node => node.inert), [false, true]);
});

test('dispose removes toolbar/document observers, queued work and fallback page restrictions', async t => {
  const { ui, state, doc, preview, workspace, nodes, outside, observers, pending, changes } = fixture(t);
  workspace.requestFullscreen = async () => { throw new Error('Unavailable'); };
  state.layout.grid = true; ui.init(); await nodes.get('#canvas-fullscreen').emit('mdClick');
  assert.ok(pending.size > 0);
  ui.dispose();
  assert.equal(pending.size, 0);
  assert.ok(observers.every(observer => observer.disconnected));
  assert.equal(preview.body.children.length, 0);
  assert.equal(doc.listeners.get('keydown')?.size, 0); assert.equal(preview.listeners.get('keydown')?.size, 0);
  assert.equal(doc.listeners.get('fullscreenchange')?.size, 0);
  assert.equal(doc.body.style.overflow, 'clip'); assert.deepEqual(outside.map(node => node.inert), [false, true]);
  await nodes.get('#canvas-rtl').emit('mdClick', { detail: { selected: true } });
  assert.equal(state.layout.direction, 'ltr'); assert.deepEqual(changes, []);
});

const resizeHandle = (nodes, edge = 'e', native = false) => nodes.get(native ? '#preview-content > .native-snapshot' : '.canvas-viewport-shell').children.find(child => child.dataset.resize === edge);
const pointer = (x, y = 0, id = 7) => ({ button: 0, pointerId: id, isPrimary: true, clientX: x, clientY: y });

test('drag geometry crosses centered and overflow layouts continuously with no web upper cap', () => {
  assert.deepEqual(canvasDragSize({ edge: 'e', width: 600, height: 310, availableWidth: 900, dx: -40 }), { width: 520 });
  assert.deepEqual(canvasDragSize({ edge: 'se', width: 600, height: 310, availableWidth: 900, dx: 1000, dy: 1000 }), { width: 1750, height: 1310 });
  assert.deepEqual(canvasDragSize({ edge: 'se', width: 600, height: 310, availableWidth: 900, dx: -1000, dy: -1000 }), { width: 1, height: 1 });
  assert.deepEqual(canvasDragSize({ edge: 'e', width: 2000, height: 310, availableWidth: 3000, dx: 3000 }), { width: 5500 });
  assert.deepEqual(canvasDragSize({ edge: 'w', width: 600, height: 310, availableWidth: 900, dx: -150 }), { width: 900 });
  assert.deepEqual(canvasDragSize({ edge: 'w', width: 600, height: 310, availableWidth: 900, dx: -151 }), { width: 901 }, 'growth switches continuously to 1:1 once overflow starts');
  assert.deepEqual(canvasDragSize({ edge: 'e', width: 1000, height: 310, availableWidth: 900, dx: -150 }), { width: 800 }, 'shrinking crosses back to centered movement');
  assert.deepEqual(canvasDragSize({ edge: 'nw', width: 1000, height: 400, availableWidth: 500, dx: -40, dy: -40 }), { width: 1040, height: 440 });
  assert.deepEqual(canvasDragSize({ edge: 'se', width: 600, height: 310, availableWidth: 900 }), {}, 'no movement preserves automatic sizing');
});

test('handles resize a mounted iframe continuously and commit the final patch once', async t => {
  const { ui, state, nodes, frame, changes } = fixture(t);
  nodes.get('#preview-content').clientWidth = 800;
  state.layout.width = 600; ui.init();
  const shell = nodes.get('.canvas-viewport-shell'), scene = nodes.get('.canvas-viewport-scale');
  scene.append(frame);
  assert.deepEqual(shell.children.map(child => child.dataset.resize), ['e', 's', 'se', 'w', 'n', 'ne', 'nw', 'sw']);
  const east = resizeHandle(nodes);
  assert.match(east.getAttribute('aria-label'), /Resize preview from right edge, width 600 pixels/);
  assert.equal(east.getAttribute('aria-describedby'), 'canvas-resize-help');
  ui.update(); assert.equal(shell.children.length, 8, 'layout refreshes do not duplicate handles');
  await east.emit('pointerdown', pointer(700));
  assert.equal(nodes.get('#preview-stage').dataset.resizing, 'true');
  assert.equal(east.hasPointerCapture(7), true);
  assert.deepEqual(east.focusOptions, { preventScroll: true });
  await east.emit('pointermove', pointer(680, 0, 8));
  assert.equal(state.layout.width, 600, 'unrelated pointers are ignored');
  await east.emit('pointermove', pointer(680));
  assert.equal(state.layout.width, 560); assert.equal(frame.style.width, '560px');
  assert.equal(changes.length, 0, 'dragging does not trigger session restarts');
  frame.clientWidth = 560; frame.clientHeight = 310; ui.update();
  assert.equal(nodes.get('#canvas-dimensions').textContent, '560 × 310 px');
  await east.emit('pointermove', pointer(690));
  assert.equal(state.layout.width, 580);
  await east.emit('pointerup', pointer(690));
  assert.deepEqual(changes, [{ width: 580 }]);
  assert.equal(nodes.get('#preview-stage').dataset.resizing, undefined);
  assert.equal(east.hasPointerCapture(7), false);
  assert.equal(frame.parentNode, scene, 'resize must not reparent or reload the iframe');
  assert.equal(nodes.get('#component-frame'), frame);
  await east.emit('lostpointercapture', pointer(690));
  assert.deepEqual(changes, [{ width: 580 }], 'release-generated capture loss cannot undo or repeat a commit');
});

test('bottom and corner handles change height, and returning to the start preserves automatic sizing', async t => {
  const { ui, state, nodes, frame, changes } = fixture(t);
  nodes.get('#preview-content').clientWidth = 800;
  frame.dataset.autoHeight = '420'; ui.init();
  const south = resizeHandle(nodes, 's');
  await south.emit('pointerdown', pointer(0, 500));
  await south.emit('pointermove', pointer(0, 550));
  assert.equal(state.layout.height, 470); assert.equal(frame.style.height, '470px');
  assert.equal(state.layout.width, 'fit');
  await south.emit('pointermove', pointer(0, 500));
  assert.equal(state.layout.height, 'auto');
  await south.emit('pointerup', pointer(0, 500));
  assert.deepEqual(changes, []);
  const corner = resizeHandle(nodes, 'se');
  await corner.emit('pointerdown', pointer(800, 420));
  await corner.emit('pointermove', pointer(750, 450));
  assert.equal(state.layout.width, 700); assert.equal(state.layout.height, 450);
  assert.equal(frame.style.width, '700px'); assert.equal(frame.style.height, '450px');
  await corner.emit('pointerup', pointer(750, 450));
  assert.deepEqual(changes, [{ width: 700, height: 450 }]);
});

test('keyboard resize supports physical arrows, larger steps, bounds and resetting automatic layout', async t => {
  const { ui, state, nodes, frame, changes } = fixture(t);
  nodes.get('#preview-content').clientWidth = 600;
  state.layout.direction = 'rtl'; state.layout.width = 600; ui.init();
  const corner = resizeHandle(nodes, 'se');
  const right = await corner.emit('keydown', { key: 'ArrowRight' });
  assert.equal(right.defaultPrevented, true); assert.equal(right.propagationStopped, true);
  assert.equal(state.layout.width, 610, 'physical right grows the viewport even in RTL');
  assert.equal(nodes.get('.canvas-viewport-scale').style.transform, 'scale(1)');
  await corner.emit('keydown', { key: 'ArrowLeft', shiftKey: true });
  assert.equal(state.layout.width, 560);
  await corner.emit('keydown', { key: 'ArrowDown', shiftKey: true });
  assert.equal(state.layout.height, 360); assert.equal(frame.style.height, '360px');
  await corner.emit('keydown', { key: 'ArrowUp' });
  assert.equal(state.layout.height, 350);
  const count = changes.length;
  await corner.emit('keydown', { key: 'ArrowRight', ctrlKey: true });
  await resizeHandle(nodes, 'e').emit('keydown', { key: 'ArrowDown' });
  assert.equal(changes.length, count, 'unrelated axes and application shortcuts pass through');
  state.layout.width = 2400; state.layout.height = 1; ui.update();
  await corner.emit('keydown', { key: 'ArrowRight' });
  assert.equal(state.layout.width, 2410, 'web widths have no arbitrary upper cap');
  await corner.emit('keydown', { key: 'ArrowUp' });
  assert.equal(state.layout.height, 1);
  await corner.emit('keydown', { key: 'Home' });
  assert.deepEqual(changes.at(-1), { width: 'fit', height: 'auto' });
  assert.equal(frame.style.width, '100%'); assert.equal(frame.style.height, '310px');
});

for (const cancel of ['pointercancel', 'lostpointercapture', 'blur', 'Escape']) test(`${cancel} cancels resize and restores the starting layout without a callback`, async t => {
  const { ui, state, nodes, doc, changes } = fixture(t); ui.init();
  const handle = resizeHandle(nodes, 'se');
  await handle.emit('pointerdown', pointer(384, 310));
  await handle.emit('pointermove', pointer(344, 370));
  assert.equal(state.layout.width, 304); assert.equal(state.layout.height, 370);
  if (cancel === 'blur') await doc.defaultView.emit('blur');
  else if (cancel === 'Escape') await handle.emit('keydown', { key: 'Escape' });
  else await handle.emit(cancel, pointer(344, 370));
  assert.equal(state.layout.width, 'fit'); assert.equal(state.layout.height, 'auto');
  assert.equal(nodes.get('#preview-stage').dataset.resizing, undefined);
  assert.equal(handle.hasPointerCapture(7), false); assert.deepEqual(changes, []);
});

test('automatic height follows component content and expanded space while a custom height survives both', t => {
  const { ui, state, nodes, frame } = fixture(t);
  const content = nodes.get('#preview-content'); content.clientWidth = 600; content.clientHeight = 700;
  frame.dataset.autoHeight = '460'; ui.init();
  assert.equal(frame.style.height, '460px');
  state.layout.expanded = true; ui.update(); assert.equal(frame.style.height, '700px');
  state.layout.height = 390; ui.update(); assert.equal(frame.style.height, '390px');
  frame.dataset.autoHeight = '800'; ui.update(); assert.equal(frame.style.height, '390px');
  state.layout.expanded = false; ui.update(); assert.equal(frame.style.height, '390px');
  state.layout.height = 'auto'; ui.update(); assert.equal(frame.style.height, '800px');
});

for (const platform of ['ios', 'android']) test(`${platform} width drag measures the viewing area and commits only once without altering the capture`, async t => {
  const { ui, state, nodes, changes, native, surface, image } = nativeFixture(t, platform);
  nodes.get('#preview-content').clientWidth = 800;
  state.layout.width = 600;
  ui.init();
  assert.deepEqual(native.children.filter(child => child.dataset.resize).map(child => child.dataset.resize), ['e', 's', 'se', 'w', 'n', 'ne', 'nw', 'sw']);
  const east = resizeHandle(nodes, 'e', true);
  await east.emit('pointerdown', pointer(700));
  await east.emit('pointermove', pointer(650));
  assert.equal(state.layout.width, 500); assert.equal(native.style.width, '500px');
  assert.equal(state.layout.height, 'auto'); assert.deepEqual(changes, []);
  native.clientWidth = 500; ui.update();
  assert.equal(nodes.get('#canvas-dimensions').textContent, '500 × 310 px');
  assert.equal(surface.clientWidth, 320); assert.equal(image.style.width, '320px', 'the current capture is retained until the host supplies a replacement');
  await east.emit('pointerup', pointer(650));
  assert.deepEqual(changes, [{ width: 500 }]);
  await east.emit('keydown', { key: 'ArrowDown' });
  assert.equal(changes.length, 1);
  await resizeHandle(nodes, 's', true).emit('keydown', { key: 'ArrowDown' });
  assert.deepEqual(changes.at(-1), { height: 320 }, 'height-only edits do not request a new native width');
  assert.equal(native.style.height, '320px'); assert.equal(surface.clientHeight, 180);
  state.layout.width = 1200; ui.update();
  await east.emit('keydown', { key: 'ArrowRight', shiftKey: true });
  assert.equal(state.layout.width, 1250, 'viewing area size is independent of native capture safety limits');
});

for (const platform of ['ios', 'android']) for (const [edge, dx, dy, keyX, keyY] of [
  ['ne', 30, -40, 'ArrowRight', 'ArrowUp'], ['nw', -30, -40, 'ArrowLeft', 'ArrowUp'],
  ['se', 30, 40, 'ArrowRight', 'ArrowDown'], ['sw', -30, 40, 'ArrowLeft', 'ArrowDown'],
]) test(`${platform} ${edge} corner follows physical pointer and keyboard movement in both dimensions`, async t => {
  const { ui, state, nodes, native } = nativeFixture(t, platform);
  nodes.get('#preview-stage').clientWidth = 1000;
  state.layout.width = 600; state.layout.height = 400; state.layout.direction = 'rtl'; ui.init();
  const corner = resizeHandle(nodes, edge, true);
  await corner.emit('pointerdown', pointer(500, 400));
  await corner.emit('pointermove', pointer(500 + dx, 400 + dy));
  await corner.emit('pointerup', pointer(500 + dx, 400 + dy));
  assert.equal(state.layout.width, 660); assert.equal(state.layout.height, 440);
  await corner.emit('keydown', { key: keyX }); await corner.emit('keydown', { key: keyY, shiftKey: true });
  assert.equal(state.layout.width, 670); assert.equal(state.layout.height, 490);
  const labels = native.children.filter(child => child.dataset.resize).map(child => child.getAttribute('aria-label'));
  assert.equal(new Set(labels).size, 8);
});

test('native auto height tracks live metadata while explicit height and grid survive changing captures', async t => {
  const { ui, state, nodes, native, changes } = nativeFixture(t);
  state.layout.grid = true; ui.init();
  assert.equal(native.style.height, '310px');
  state.liveFrame = { logicalWidth: 320, logicalHeight: 700 }; ui.update();
  assert.equal(native.style.height, '700px');
  const ruler = native.children.find(child => child.className === 'canvas-rulers canvas-rulers-native');
  assert.equal(ruler.children[1].children.at(-1).textContent, '640');
  state.layout.height = 200; ui.update();
  state.liveFrame.logicalHeight = 900; ui.update();
  assert.equal(native.style.height, '200px');
  assert.equal(ruler.children[1].children.at(-1).textContent, '192');
  assert.deepEqual(changes, [], 'new capture geometry updates presentation without configuring another native frame');
  nodes.get('#preview-stage').clientHeight = 450;
  state.layout.height = 'auto'; state.layout.expanded = true; ui.update();
  assert.equal(native.style.height, '450px');
});

test('native edge scrolling cancels cleanly and reset restores both scroll containers without changing capture or preferences', async t => {
  const { ui, state, nodes, native, nativeFrame, surface, image, changes, pending, flush } = nativeFixture(t, 'android');
  const stage = nodes.get('#preview-stage');
  stage.clientWidth = 600; stage.clientHeight = 400;
  stage.rect = { left: 100, right: 700, top: 100, bottom: 500 };
  state.layout.width = 600; state.layout.height = 400; state.layout.grid = true;
  state.layout.direction = 'rtl'; ui.init();
  const corner = resizeHandle(nodes, 'se', true);
  await corner.emit('pointerdown', pointer(700, 500));
  assert.equal(pending.size, 0);
  await corner.emit('pointermove', pointer(710, 510)); flush(); flush();
  assert.ok(state.layout.width > 610); assert.ok(state.layout.height > 410);
  assert.ok(stage.scrollLeft > 0); assert.ok(stage.scrollTop > 0);
  await corner.emit('pointercancel', pointer(710, 510));
  assert.equal(state.layout.width, 600); assert.equal(state.layout.height, 400);
  assert.equal(stage.scrollLeft, 0); assert.equal(stage.scrollTop, 0);
  assert.equal(pending.size, 0); assert.deepEqual(changes, []);
  nativeFrame.scrollLeft = 80; nativeFrame.scrollTop = 60;
  stage.scrollLeft = 30; stage.scrollTop = 40;
  await corner.emit('pointerdown', pointer(700, 500));
  await corner.emit('pointermove', pointer(710, 510));
  await nodes.get('#canvas-reset-size').emit('mdClick');
  assert.equal(state.layout.width, 'fit'); assert.equal(state.layout.height, 'auto');
  assert.equal(native.style.width, '600px'); assert.equal(native.style.height, '310px');
  assert.equal(stage.scrollLeft, 0); assert.equal(stage.scrollTop, 0);
  assert.equal(nativeFrame.scrollLeft, 0); assert.equal(nativeFrame.scrollTop, 0);
  assert.equal(pending.size, 0);
  assert.deepEqual(changes, [{ width: 'fit', height: 'auto' }]);
  assert.equal(state.layout.grid, true); assert.equal(state.layout.direction, 'rtl');
  assert.equal(surface.parentNode, nativeFrame); assert.equal(image.parentNode, surface);
  ui.dispose();
  assert.equal(native.children.length, 1, 'disposal removes native handles and rulers but preserves the mounted capture');
});

test('replacement previews and disposal release handles, active pointer state and listeners', async t => {
  const { ui, state, nodes, doc, changes } = fixture(t); ui.init();
  const oldShell = nodes.get('.canvas-viewport-shell'), oldHandle = resizeHandle(nodes);
  await oldHandle.emit('pointerdown', pointer(384));
  await oldHandle.emit('pointermove', pointer(350));
  const replacement = new ElementStub(); nodes.set('.canvas-viewport-shell', replacement); ui.update();
  assert.equal(oldShell.children.length, 0); assert.equal(oldHandle.hasPointerCapture(7), false);
  assert.ok([...oldHandle.listeners.values()].every(listeners => listeners.size === 0));
  assert.equal(replacement.children.length, 8); assert.deepEqual(changes, []);
  const handle = resizeHandle(nodes);
  await handle.emit('pointerdown', pointer(384)); await handle.emit('pointermove', pointer(350));
  ui.dispose();
  assert.equal(state.layout.width, 'fit'); assert.equal(nodes.get('#preview-stage').dataset.resizing, undefined);
  assert.equal(replacement.children.length, 0); assert.equal(handle.hasPointerCapture(7), false);
  assert.ok([...handle.listeners.values()].every(listeners => listeners.size === 0));
  assert.equal(doc.defaultView.listeners.get('blur')?.size, 0);
  await handle.emit('pointerup', pointer(350)); assert.deepEqual(changes, []);
});


test('component navigation cancels an in-progress resize before the next preview is sized', async t => {
  const { ui, state, nodes, frame, changes } = fixture(t); ui.init();
  const handle = resizeHandle(nodes);
  await handle.emit('pointerdown', { ...pointer(384), button: 2 });
  assert.equal(nodes.get('#preview-stage').dataset.resizing, undefined, 'secondary buttons do not start resize');
  await handle.emit('pointerdown', { ...pointer(384), isPrimary: false });
  assert.equal(nodes.get('#preview-stage').dataset.resizing, undefined, 'secondary touch pointers do not start resize');
  await handle.emit('pointerdown', pointer(384)); await handle.emit('pointermove', pointer(344));
  assert.equal(state.layout.width, 304);
  state.selected = 'md-card'; ui.update();
  assert.equal(state.layout.width, 'fit'); assert.equal(frame.style.width, '100%');
  assert.equal(nodes.get('#preview-stage').dataset.resizing, undefined);
  await handle.emit('pointerup', pointer(344)); assert.deepEqual(changes, []);
});


test('fit and expanded auto height use the stage interior, never growing content dimensions', async t => {
  const { ui, state, nodes, doc, frame } = fixture(t);
  const stage = nodes.get('#preview-stage'), content = nodes.get('#preview-content');
  stage.clientWidth = 640; stage.clientHeight = 440;
  doc.defaultView.getComputedStyle = () => ({ paddingLeft: '20px', paddingRight: '20px', paddingTop: '20px', paddingBottom: '20px' });
  content.clientWidth = 3000; content.clientHeight = 4000;
  ui.init();
  assert.equal(nodes.get('.canvas-viewport-shell').style.width, '600px');
  state.layout.expanded = true; ui.update();
  assert.equal(frame.style.height, '400px');
  state.layout.width = 5000; state.layout.height = 6000; ui.update();
  assert.equal(nodes.get('.canvas-viewport-shell').style.width, '5000px');
  assert.equal(frame.style.height, '6000px');
  assert.equal(nodes.get('.canvas-viewport-scale').style.transform, 'scale(1)');
  await resizeHandle(nodes, 'nw').emit('keydown', { key: 'Home' });
  assert.equal(nodes.get('.canvas-viewport-shell').style.width, '600px');
  assert.equal(frame.style.height, '400px');
});

for (const [edge, dx, dy, keyX, keyY] of [
  ['ne', 30, -40, 'ArrowRight', 'ArrowUp'], ['nw', -30, -40, 'ArrowLeft', 'ArrowUp'],
  ['se', 30, 40, 'ArrowRight', 'ArrowDown'], ['sw', -30, 40, 'ArrowLeft', 'ArrowDown'],
]) test(`${edge} corner grows toward its physical directions with both pointer and keyboard`, async t => {
  const { ui, state, nodes } = fixture(t);
  nodes.get('#preview-stage').clientWidth = 1000;
  state.layout.width = 600; state.layout.height = 400; ui.init();
  const corner = resizeHandle(nodes, edge);
  await corner.emit('pointerdown', pointer(500, 400));
  await corner.emit('pointermove', pointer(500 + dx, 400 + dy));
  await corner.emit('pointerup', pointer(500 + dx, 400 + dy));
  assert.equal(state.layout.width, 660); assert.equal(state.layout.height, 440);
  await corner.emit('keydown', { key: keyX });
  await corner.emit('keydown', { key: keyY, shiftKey: true });
  assert.equal(state.layout.width, 670); assert.equal(state.layout.height, 490);
  const labels = nodes.get('.canvas-viewport-shell').children.map(child => child.getAttribute('aria-label'));
  assert.equal(new Set(labels).size, 8, 'all physical handles have distinct accessible names');
});

test('edge scrolling is limited to active axes and has bounded speed', () => {
  const rect = { left: 100, right: 700, top: 100, bottom: 500 };
  assert.deepEqual(canvasEdgeScroll({ edge: 'se', x: 400, y: 300, rect }), { x: 0, y: 0 });
  assert.deepEqual(canvasEdgeScroll({ edge: 'se', x: 900, y: 900, rect }), { x: 12, y: 12 });
  assert.deepEqual(canvasEdgeScroll({ edge: 'nw', x: 0, y: 0, rect }), { x: -12, y: -12 });
  assert.deepEqual(canvasEdgeScroll({ edge: 'e', x: 900, y: 900, rect }), { x: 12, y: 0 });
  assert.deepEqual(canvasEdgeScroll({ edge: 'se', x: 900, y: 900, rect, horizontal: false }), { x: 0, y: 12 });
});

test('dragging outward near the stage edges grows beyond the viewport and scrolls until release', async t => {
  const { ui, state, nodes, changes, pending, flush } = fixture(t);
  const stage = nodes.get('#preview-stage');
  stage.clientWidth = 600; stage.clientHeight = 400;
  stage.rect = { left: 100, right: 700, top: 100, bottom: 500 };
  state.layout.width = 600; state.layout.height = 400; ui.init();
  const corner = resizeHandle(nodes, 'se');
  await corner.emit('pointerdown', pointer(700, 500));
  assert.equal(pending.size, 0, 'holding an idle pointer on the edge never starts scrolling');
  assert.equal(state.layout.width, 600); assert.equal(state.layout.height, 400);
  await corner.emit('pointermove', pointer(710, 510));
  assert.equal(state.layout.width, 610); assert.equal(state.layout.height, 410);
  assert.equal(pending.size, 1); flush();
  assert.ok(state.layout.width > 610); assert.ok(state.layout.height > 410);
  assert.ok(stage.scrollLeft > 0); assert.ok(stage.scrollTop > 0);
  const firstWidth = state.layout.width; flush();
  assert.ok(state.layout.width > firstWidth, 'a captured stationary pointer continues edge scrolling');
  assert.deepEqual(changes, []);
  await corner.emit('pointerup', pointer(710, 510));
  assert.equal(pending.size, 0);
  assert.deepEqual(changes, [{ width: state.layout.width, height: state.layout.height }]);
  const committedWidth = state.layout.width; flush(); assert.equal(state.layout.width, committedWidth);
});

test('leading corners keep growing at zero scroll bounds and cancellation removes the scroll loop', async t => {
  const { ui, state, nodes, changes, pending, flush } = fixture(t);
  const stage = nodes.get('#preview-stage');
  stage.clientWidth = 600; stage.clientHeight = 400;
  stage.rect = { left: 100, right: 700, top: 100, bottom: 500 };
  let scrollLeft = 0, scrollTop = 0;
  Object.defineProperty(stage, 'scrollLeft', { get: () => scrollLeft, set: value => { scrollLeft = Math.max(0, value); } });
  Object.defineProperty(stage, 'scrollTop', { get: () => scrollTop, set: value => { scrollTop = Math.max(0, value); } });
  state.layout.width = 600; state.layout.height = 400; ui.init();
  const corner = resizeHandle(nodes, 'nw');
  await corner.emit('pointerdown', pointer(100, 100)); await corner.emit('pointermove', pointer(90, 90));
  const movedWidth = state.layout.width; flush(); flush();
  assert.ok(state.layout.width > movedWidth); assert.ok(state.layout.height > 410);
  assert.equal(stage.scrollLeft, 0); assert.equal(stage.scrollTop, 0);
  await corner.emit('pointercancel', pointer(90, 90));
  assert.equal(state.layout.width, 600); assert.equal(state.layout.height, 400);
  assert.equal(pending.size, 0); assert.deepEqual(changes, []);
});

test('auto-scrolling does not activate an unmoved corner axis and disposal cancels pending growth', async t => {
  const { ui, state, nodes, pending, flush } = fixture(t);
  const stage = nodes.get('#preview-stage'); stage.clientWidth = 600; stage.clientHeight = 400;
  stage.rect = { left: 100, right: 700, top: 100, bottom: 500 };
  state.layout.width = 600; state.layout.height = 400; ui.init();
  const corner = resizeHandle(nodes, 'se');
  await corner.emit('pointerdown', pointer(700, 500)); await corner.emit('pointermove', pointer(700, 510));
  flush();
  assert.equal(state.layout.width, 600); assert.equal(stage.scrollLeft, 0);
  assert.ok(state.layout.height > 410);
  ui.dispose();
  assert.equal(pending.size, 0); assert.equal(state.layout.height, 400);
  assert.equal(stage.scrollTop, 0);
});


test('reset size restores automatic dimensions and scroll while preserving other studio choices', async t => {
  const { ui, state, nodes, changes } = fixture(t);
  state.layout.width = 5000; state.layout.height = 7000; state.layout.grid = true; state.layout.bounds = true; state.layout.direction = 'rtl';
  state.selected = 'md-button'; const props = structuredClone(state.props); ui.init();
  const stage = nodes.get('#preview-stage'); stage.scrollLeft = 1400; stage.scrollTop = 2400;
  await nodes.get('#canvas-reset-size').emit('mdClick');
  assert.equal(state.layout.width, 'fit'); assert.equal(state.layout.height, 'auto');
  assert.equal(stage.scrollLeft, 0); assert.equal(stage.scrollTop, 0);
  assert.equal(state.layout.grid, true); assert.equal(state.layout.bounds, true); assert.equal(state.layout.direction, 'rtl');
  assert.equal(state.selected, 'md-button'); assert.deepEqual(state.props, props);
  assert.deepEqual(changes, [{ width: 'fit', height: 'auto' }]);
  await nodes.get('#canvas-reset-size').emit('mdClick'); assert.equal(changes.length, 1, 'resetting an already automatic viewport does not restart it');
});

test('reset cancels active drag and scrolling before committing a single automatic-size change', async t => {
  const { ui, state, nodes, changes, pending, flush } = fixture(t);
  const stage = nodes.get('#preview-stage'); stage.clientWidth = 600; stage.clientHeight = 400;
  stage.rect = { left: 100, right: 700, top: 100, bottom: 500 };
  state.layout.width = 800; state.layout.height = 700; ui.init();
  const corner = resizeHandle(nodes, 'se');
  await corner.emit('pointerdown', pointer(700, 500)); await corner.emit('pointermove', pointer(710, 510)); flush();
  assert.ok(pending.size > 0);
  await nodes.get('#canvas-reset-size').emit('mdClick');
  assert.equal(pending.size, 0); assert.equal(stage.dataset.resizing, undefined);
  assert.equal(stage.scrollLeft, 0); assert.equal(stage.scrollTop, 0);
  assert.equal(state.layout.width, 'fit'); assert.equal(state.layout.height, 'auto');
  assert.deepEqual(changes, [{ width: 'fit', height: 'auto' }]);
  await corner.emit('pointerup', pointer(710, 510)); assert.equal(changes.length, 1);
});

test('native reset requests one width update and clears custom viewing area height', async t => {
  const { ui, state, nodes, changes } = fixture(t, { platform: 'android', previewDocument: null });
  nodes.delete('#component-frame'); const native = new ElementStub();
  native.clientWidth = 500; nodes.set('#preview-content > .native-snapshot', native);
  state.layout.width = 900; state.layout.height = 500; ui.init();
  await nodes.get('#canvas-reset-size').emit('mdClick');
  assert.deepEqual(changes, [{ width: 'fit', height: 'auto' }]);
  assert.equal(native.style.width, '384px'); assert.equal(native.style.height, '310px');
});

test('Snackbar reset restores the default viewport instead of retaining a previous tall capture', async t => {
  const { ui, state, native, nodes, changes, flush } = nativeFixture(t, 'android');
  state.selected = { tag: 'md-snackbar' }; state.layout.height = 800;
  state.liveFrame = { logicalWidth: 640, logicalHeight: 800 };
  ui.init(); assert.equal(native.style.height, '800px');
  await nodes.get('#canvas-reset-size').emit('mdClick');
  assert.equal(native.style.height, '310px');
  assert.deepEqual(changes.at(-1), { height: 'auto' });
  await nodes.get('#canvas-fullscreen').emit('mdClick');
  assert.equal(changes.filter(change => 'expanded' in change).length, 0, 'wait for the measured fullscreen layout');
  flush(); assert.deepEqual(changes.at(-1), { expanded: true });
});

for (const platform of ['ios', 'android']) test(`${platform} responsive Snackbar canvas resize notifies once without rewriting authored size`, async t => {
  const { ui, state, nodes, observers, flush, changes, native } = nativeFixture(t, platform);
  state.selected = { tag: 'md-snackbar' };
  ui.init();
  for (const observer of observers) observer.callback([]);
  flush();
  assert.deepEqual(changes, [], 'initial observation must not restart a pending connection');
  nodes.get('#preview-content').clientWidth = 540;
  for (const observer of observers) observer.callback([]);
  flush();
  assert.equal(native.style.width, '540px');
  assert.deepEqual(changes, [{ viewport: true }]);
  assert.equal(state.layout.width, 'fit');
  for (const observer of observers) observer.callback([]);
  flush();
  assert.equal(changes.length, 1, 'layout feedback does not requeue the same dimensions');
  state.layout.width = 400; ui.update();
  nodes.get('#preview-content').clientWidth = 700;
  for (const observer of observers) observer.callback([]);
  flush();
  assert.equal(changes.length, 1, 'a fixed viewport does not change when its container grows');
  state.layout.width = 'fit'; ui.update();
  const east = native.children.find(child => child.dataset.resize === 'e');
  await east.emit('pointerdown', { pointerId: 21, button: 0, clientX: 700, clientY: 150 });
  await east.emit('pointermove', { pointerId: 21, clientX: 720, clientY: 150 });
  for (const observer of observers) observer.callback([]);
  flush();
  assert.equal(changes.length, 1, 'native drag remains deferred until pointer release');
  await east.emit('pointerup', { pointerId: 21, clientX: 720, clientY: 150 });
  assert.equal(changes.length, 2);
  assert.ok('width' in changes[1]);
  for (const observer of observers) observer.callback([]);
  flush();
  assert.equal(changes.length, 2, 'the committed drag does not trigger a duplicate resize');
});
