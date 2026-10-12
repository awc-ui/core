import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasViewportFit, createCanvasTools } from './canvas-tools.js';

// Controller boundaries only: real CSS geometry and fullscreen rendering are
// verified in the browser. The inspector has its own measurement tests.
class ElementStub {
  constructor() {
    this.listeners = new Map(); this.attributes = new Map(); this.children = [];
    this.dataset = {}; this.style = {}; this.clientWidth = 0; this.clientHeight = 0;
    this.hidden = false; this.inert = false;
    const classes = new Set();
    this.classList = { contains: name => classes.has(name), toggle(name, force) {
      const enabled = force ?? !classes.has(name);
      if (enabled) classes.add(name); else classes.delete(name);
      return enabled;
    } };
  }
  addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(listener); }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  async emit(name, detail = {}) { for (const listener of [...this.listeners.get(name) || []]) await listener({ target: this, defaultPrevented: false, ...detail }); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  closest(selector) { return selector === 'md-tooltip' ? this.tooltip : null; }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
  focus() { globalThis.document.activeElement = this; }
}

function frameDocument(width = 384, height = 256) {
  const doc = new ElementStub();
  doc.documentElement = new ElementStub(); doc.body = new ElementStub(); doc.defaultView = new ElementStub();
  Object.assign(doc.documentElement, { clientWidth: width, clientHeight: height });
  doc.createElement = () => new ElementStub();
  return doc;
}

function fixture(t, options = {}) {
  const selectors = ['.workspace-grid', '#preview-stage', '#preview-content', '.canvas-viewport-shell', '.canvas-viewport-scale', '#component-frame', '#canvas-dimensions', '#canvas-direction', '#canvas-help', '#canvas-rtl', '#canvas-grid', '#canvas-bounds', '#canvas-fullscreen', '#canvas-expand-tooltip', '#canvas-expanded-label', '#canvas-width'];
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
  const state = { platform: 'web', layout: { direction: 'ltr', width: 'fit', grid: false, bounds: false, expanded: false }, props: { icon: 'arrow_forward', label: 'Continue' }, previewDocument: preview, ...options };
  const changes = [], inspector = { updates: 0, disposals: 0, update() { this.updates++; }, dispose() { this.disposals++; } };
  const ui = createCanvasTools({ getState: () => state, onLayoutChange: patch => changes.push({ ...patch }), createInspector: () => inspector });
  t.after(() => {
    ui.dispose();
    for (const [name, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  });
  const flush = () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback()); };
  return { ui, state, doc, preview, nodes, frame, workspace, outside, changes, inspector, observers, pending, flush };
}

test('fixed viewports scale to available space while logical responsive dimensions remain unchanged', () => {
  const desktop = canvasViewportFit({ availableWidth: 614, viewportWidth: 1024, viewportHeight: 310 });
  assert.equal(desktop.logicalWidth, 1024);
  assert.equal(desktop.scale, 614 / 1024);
  assert.equal(desktop.width, 614);
  assert.equal(desktop.height, 310 * 614 / 1024);
  assert.equal(canvasViewportFit({ availableWidth: 1400, viewportWidth: 1024 }).scale, 1, 'large cards do not upscale components');
  assert.equal(canvasViewportFit({ availableWidth: 614, viewportWidth: 'fit' }).logicalWidth, 614);
  const expanded = canvasViewportFit({ availableWidth: 512, viewportWidth: 1024, viewportHeight: 310, expandedHeight: 400 });
  assert.equal(expanded.logicalHeight, 800);
  assert.equal(expanded.height, 400, 'expanded mode fills the available height after scaling');
});

test('desktop fit reserves only painted space, keeps CSS rulers truthful, and returns to responsive without replacing the iframe', async t => {
  const { ui, state, frame, preview, nodes, observers, flush } = fixture(t);
  const content = nodes.get('#preview-content'), shell = nodes.get('.canvas-viewport-shell'), scene = nodes.get('.canvas-viewport-scale');
  content.clientWidth = 614; frame.clientWidth = 1024; preview.documentElement.clientWidth = 1024;
  frame.style.height = '310px'; frame.clientHeight = 310;
  state.layout.width = 1024; state.layout.grid = true; ui.init();
  assert.equal(frame.style.width, '1024px');
  assert.equal(scene.style.width, '1024px');
  assert.equal(scene.style.transform, `scale(${614 / 1024})`);
  assert.equal(shell.style.width, '614px');
  assert.equal(shell.style.height, `${310 * 614 / 1024}px`);
  assert.equal(nodes.get('#canvas-dimensions').textContent, '1024 × 310 px · 60%');
  assert.match(nodes.get('#canvas-help').textContent, /viewport remains 1024 CSS px/);
  assert.equal(preview.body.children[0].children[0].children.at(-1).textContent, '960');
  content.clientWidth = 1200;
  for (const observer of observers) observer.callback([{ target: nodes.get('#preview-stage') }]);
  flush();
  assert.equal(scene.style.transform, 'scale(1)'); assert.equal(shell.style.width, '1024px');
  assert.equal(nodes.get('#canvas-dimensions').textContent, '1024 × 310 px');
  frame.clientWidth = 1200; preview.documentElement.clientWidth = 1200;
  await nodes.get('#canvas-width').emit('mdChange', { detail: 'fit' });
  assert.equal(frame.style.width, '100%'); assert.equal(scene.style.width, '1200px');
  assert.equal(nodes.get('#component-frame'), frame, 'scaling must not replace or reparent a mounted iframe');
  assert.equal(state.previewDocument, preview);
});

test('direction and viewport controls update the preview without rewriting component props', async t => {
  const { ui, state, preview, nodes, changes, frame } = fixture(t);
  const props = structuredClone(state.props);
  ui.init();
  assert.equal(preview.documentElement.dir, 'ltr');
  await nodes.get('#canvas-rtl').emit('mdClick', { detail: { selected: true } });
  assert.equal(preview.documentElement.dir, 'rtl');
  assert.equal(nodes.get('#canvas-direction').textContent, 'RTL ←');
  assert.equal(nodes.get('#canvas-rtl').selected, true);
  assert.match(nodes.get('#canvas-help').textContent, /centered text-only.*can look unchanged/);
  assert.deepEqual(state.props, props);
  assert.deepEqual(changes, [{ direction: 'rtl' }]);
  await nodes.get('#canvas-width').emit('mdChange', { target: new ElementStub(), detail: '360' });
  assert.equal(state.layout.width, 'fit', 'nested controls cannot change the viewport');
  await nodes.get('#canvas-width').emit('mdChange', { detail: '360' });
  assert.equal(frame.style.width, '360px');
  await nodes.get('#canvas-width').emit('mdChange', { detail: 'unexpected' });
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
  assert.ok(observers.some(observer => observer.elements.has(nativeSurface)));
  assert.equal(nodes.get('#canvas-dimensions').textContent, '426 × 180 px', 'native measurements exclude fixture headings, status and documentation');
  assert.equal(nodes.get('#canvas-help').hidden, true);
  assert.equal(nativeSurface.children.length, 0, 'native surfaces never receive Web rulers');
});

for (const platform of ['ios', 'android']) test(`${platform} disables Web inspection controls and preserves preferences for return to Web`, async t => {
  const { ui, state, preview, nodes, changes } = fixture(t);
  const stage = nodes.get('#preview-stage'), grid = nodes.get('#canvas-grid'), bounds = nodes.get('#canvas-bounds');
  ui.init();
  await grid.emit('mdClick', { detail: { selected: true } });
  await bounds.emit('mdClick', { detail: { selected: true } });
  assert.equal(preview.body.children.length, 1);
  const originalChanges = changes.length;
  state.platform = platform;
  const surface = new ElementStub(); nodes.set('#native-live-surface', surface);
  ui.update();
  for (const button of [grid, bounds]) {
    assert.equal(button.disabled, true); assert.equal(button.selected, false);
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.match(button.getAttribute('aria-label'), /Web preview only/);
    assert.equal(button.tooltip.text, 'Available in Web preview only');
    await button.emit('mdClick', { detail: { selected: false } });
  }
  assert.equal(changes.length, originalChanges, 'native clicks must not change layout or restart the native session');
  assert.equal(state.layout.grid, true); assert.equal(state.layout.bounds, true);
  assert.equal(stage.dataset.grid, 'false'); assert.equal(stage.dataset.bounds, 'false');
  assert.equal(preview.documentElement.dataset.grid, 'false');
  assert.equal(preview.body.children.length, 0); assert.equal(surface.children.length, 0);
  assert.equal(nodes.get('#canvas-help').hidden, true);
  state.platform = 'web'; ui.update();
  for (const button of [grid, bounds]) {
    assert.equal(button.disabled, false); assert.equal(button.selected, true);
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.doesNotMatch(button.getAttribute('aria-label'), /only/);
  }
  assert.equal(grid.tooltip.text, '8px grid with 64px pixel rulers');
  assert.equal(stage.dataset.grid, 'true'); assert.equal(stage.dataset.bounds, 'true');
  assert.equal(preview.body.children.length, 1);
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
