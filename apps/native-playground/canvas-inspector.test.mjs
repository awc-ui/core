import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile } from 'node:fs/promises';
import { createCanvasInspector, inspectElement, inspectNativeFrame, nativeNodeAtPoint, nativeOverlayGeometry, hoveredPart, composedContains, formatPixels } from './canvas-inspector.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const jsdomPackage = packages.find(name => name.startsWith('jsdom@22.')) || packages.find(name => name.startsWith('jsdom@'));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${jsdomPackage}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const inspectorCSS = await readFile(new URL('./canvas-inspector.css', import.meta.url), 'utf8');
const rect = (left, top, width, height) => ({ x: left, y: top, left, top, right: left + width, bottom: top + height, width, height });
const tick = window => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
function setup(t) {
  const parent = new JSDOM('<!doctype html><head></head><body><section class="preview-panel"><md-card class="studio-card"><div id="preview-stage"></div><div class="preview-footer"></div></md-card></section></body>', { pretendToBeVisual: true });
  const frame = new JSDOM('<!doctype html><head></head><body><md-button id="demo" style="padding:0 24px;margin:4px 8px;row-gap:8px;column-gap:8px;font-size:14px;line-height:20px;font-weight:500;font-family:Roboto;letter-spacing:.1px;direction:ltr">Continue</md-button></body>', { pretendToBeVisual: true });
  const host = frame.window.document.querySelector('md-button'); host.getBoundingClientRect = () => rect(40, 50, 105.25, 56);
  const state = { platform: 'web', layout: { bounds: true }, previewDocument: frame.window.document, target: host };
  const inspector = createCanvasInspector({ getState: () => state, document: parent.window.document });
  t.after(() => { inspector.dispose(); parent.window.close(); frame.window.close(); });
  return { parent, frame, host, state, inspector };
}

const measuredFrame = platform => ({
  logicalWidth: 400, logicalHeight: 200,
  inspection: { version: 1, unit: platform === 'ios' ? 'pt' : 'dp', source: platform === 'ios' ? 'SwiftUI layout' : 'Compose layout',
    nodes: [{ id: 'component', name: 'md-button', bounds: { x: 120, y: 40, width: 100, height: 50 } }] },
});
function setupNative(t, platform = 'ios') {
  const context = setup(t), { parent, state } = context, doc = parent.window.document;
  state.platform = platform; state.previewDocument = null; state.target = null; state.liveFrame = measuredFrame(platform);
  doc.querySelector('#preview-stage').innerHTML = '<section class="native-snapshot"><div id="native-render-frame"><div id="native-live-surface"><img alt="Native capture"></div></div></section>';
  const style = doc.createElement('style'); style.textContent = inspectorCSS; doc.head.append(style);
  const native = doc.querySelector('.native-snapshot'), viewport = doc.querySelector('#native-render-frame'), image = doc.querySelector('img');
  const boxes = { viewport: rect(100, 80, 600, 300), image: rect(200, 160, 400, 200), native: rect(100, 80, 600, 300) };
  native.getBoundingClientRect = () => boxes.native; viewport.getBoundingClientRect = () => boxes.viewport; image.getBoundingClientRect = () => boxes.image;
  for (const [name, value] of Object.entries({ clientWidth: 600, clientHeight: 300, clientLeft: 0, clientTop: 0 }))
    Object.defineProperty(viewport, name, { configurable: true, value });
  return { ...context, native, viewport, image, boxes };
}
function withNativeMetrics(frame) {
  const typography = { size: 14, lineHeight: 20, weight: 500, spacing: 0.1, family: 'Native Sans', unit: frame.inspection.unit === 'pt' ? 'pt' : 'sp' };
  frame.inspection.nodes[0].metrics = { padding: [0, 24, 0, 24], margin: [4, 8, 4, 8], border: [4, 4, 4, 4],
    gap: { row: 0, column: 8 }, typography, display: 'native button', direction: 'ltr' };
  frame.inspection.nodes.push({ id: 'component.label', name: 'Button label', parentId: 'component',
    bounds: { x: 144, y: 55, width: 52, height: 20 }, metrics: { typography, display: 'native text', direction: 'ltr' } });
  return frame;
}

test('real computed styles expose physical CSS spacing, typography and fractional rendered dimensions', t => {
  const { host } = setup(t);
  const metrics = inspectElement(host);
  assert.equal(metrics.name, 'md-button#demo');
  assert.deepEqual(metrics.padding, ['0px', '24px', '0px', '24px']);
  assert.deepEqual(metrics.margin, ['4px', '8px', '4px', '8px']);
  assert.equal(metrics.typography.size, '14px');
  assert.equal(metrics.typography.lineHeight, '20px');
  assert.equal(metrics.typography.weight, '500');
  assert.deepEqual(metrics.gap, { row: '8px', column: '8px' });
  assert.equal(metrics.direction, 'ltr');
  assert.equal(metrics.rect.width, 105.25);
  assert.equal(formatPixels(105.25), '105.25px');
  assert.equal(formatPixels(NaN), 'Unavailable');
});

test('inspection panel sits outside iframe and overlay paints dimensions/padding without blocking input', t => {
  const { parent, frame, inspector } = setup(t); inspector.update();
  const panel = parent.window.document.querySelector('#canvas-inspector-panel');
  assert.equal(panel.localName, 'md-card');
  assert.equal(panel.previousElementSibling.id, 'preview-stage');
  assert.equal(panel.nextElementSibling.className, 'preview-footer');
  assert.match(panel.textContent, /105\.25px × 56px/);
  assert.match(panel.textContent, /0px · 24px · 0px · 24px/);
  const overlay = frame.window.document.querySelector('.canvas-measure-overlay');
  assert.equal(overlay.style.pointerEvents, 'none');
  assert.equal(overlay.getAttribute('aria-hidden'), 'true');
  assert.equal(overlay.querySelector('.canvas-measure-bounds').style.left, '40px');
  assert.equal(overlay.querySelectorAll('.canvas-measure-padding').length, 2);
  assert.equal(overlay.querySelectorAll('.canvas-measure-margin').length, 4);
  assert.match(overlay.textContent, /105\.25px × 56px/);
  assert.equal(parent.window.document.querySelectorAll('link[data-canvas-inspector-style]').length, 1);
  inspector.update();
  assert.equal(frame.window.document.querySelectorAll('.canvas-measure-overlay').length, 1);
});

test('hover inspection follows open shadow parts, retains click behavior and restores component on leave', async t => {
  const { parent, frame, inspector, host } = setup(t);
  const shadow = host.attachShadow({ mode: 'open' }); shadow.innerHTML = '<span part="label" style="font-size:14px">Continue</span>';
  const label = shadow.querySelector('span'); label.getBoundingClientRect = () => rect(64, 68, 57, 20);
  assert.equal(composedContains(host, label), true);
  assert.equal(hoveredPart({ composedPath: () => [label, shadow, host, frame.window.document] }, host), label);
  inspector.update();
  const button = parent.window.document.querySelector('#canvas-inspector-hover');
  button.dispatchEvent(new parent.window.CustomEvent('mdClick', { bubbles: true, detail: { selected: true } }));
  let clicks = 0; host.addEventListener('click', () => clicks++);
  label.dispatchEvent(new frame.window.MouseEvent('pointermove', { bubbles: true, composed: true }));
  label.dispatchEvent(new frame.window.MouseEvent('click', { bubbles: true, composed: true }));
  await tick(parent.window);
  assert.equal(clicks, 1);
  assert.equal(parent.window.document.querySelector('[data-inspector-selection]').textContent, 'span ::part(label)');
  assert.match(parent.window.document.querySelector('[data-inspector-content]').textContent, /57px × 20px/);
  frame.window.document.documentElement.dispatchEvent(new frame.window.MouseEvent('pointerleave'));
  await tick(parent.window);
  assert.equal(parent.window.document.querySelector('[data-inspector-selection]').textContent, 'md-button#demo');
});

test('style mutations refresh measurements and transformed boxes do not pretend padding guides are accurate', async t => {
  const { parent, frame, host, inspector } = setup(t); inspector.update();
  host.style.padding = '2px 12px'; host.style.fontSize = '18px';
  host.style.direction = 'rtl';
  await tick(parent.window);
  assert.match(parent.window.document.querySelector('[data-inspector-content]').textContent, /2px · 12px · 2px · 12px/);
  assert.match(parent.window.document.querySelector('[data-inspector-content]').textContent, /18px \/ 20px/);
  assert.match(parent.window.document.querySelector('[data-inspector-content]').textContent, /RTL/);
  host.style.transform = 'scale(1.2)';
  await tick(parent.window);
  assert.equal(frame.window.document.querySelectorAll('.canvas-measure-padding').length, 0);
  assert.match(parent.window.document.querySelector('[data-inspector-content]').textContent, /transformed element: spacing guides omitted/);
});

test('platform changes preserve inspection preference and remove overlays from the previous platform', async t => {
  const { parent, frame, state, inspector } = setup(t); inspector.update();
  const panel = parent.window.document.querySelector('#canvas-inspector-panel');
  for (const platform of ['ios', 'android']) {
    state.platform = platform; inspector.update();
    assert.equal(panel.hidden, false);
    assert.equal(state.layout.bounds, true);
    assert.match(panel.textContent, /Waiting for a rendered native frame/);
    assert.equal(panel.querySelector('#canvas-inspector-hover').hidden, true);
    assert.equal(frame.window.document.querySelector('.canvas-measure-overlay'), null);
    assert.equal(frame.window.document.querySelector('link[data-canvas-inspector-style]'), null);
    state.platform = 'web'; inspector.update();
    assert.equal(panel.hidden, false);
    assert.equal(panel.querySelector('#canvas-inspector-hover').hidden, false);
    assert.ok(frame.window.document.querySelector('.canvas-measure-overlay'));
    assert.match(panel.textContent, /105\.25px × 56px/);
  }
  state.layout.bounds = false; inspector.update();
  assert.equal(panel.hidden, true);
  assert.equal(frame.window.document.querySelector('.canvas-measure-overlay'), null);
  inspector.dispose(); inspector.dispose();
  frame.window.dispatchEvent(new frame.window.Event('resize'));
  await tick(parent.window);
  assert.equal(parent.window.document.querySelector('#canvas-inspector-panel'), null);
  assert.equal(parent.window.document.querySelector('link[data-canvas-inspector-style]'), null);
  assert.equal(frame.window.document.querySelector('link[data-canvas-inspector-style]'), null);
});

for (const platform of ['ios', 'android']) test(`${platform} reports host-measured root geometry and native units without invented CSS metrics`, t => {
  const { parent, state, inspector } = setupNative(t, platform); inspector.update();
  const doc = parent.window.document, panel = doc.querySelector('#canvas-inspector-panel'), unit = platform === 'ios' ? 'pt' : 'dp';
  assert.match(panel.textContent, new RegExp(`100${unit} × 50${unit}`));
  assert.match(panel.textContent, new RegExp(`120${unit} / 40${unit}`));
  assert.match(panel.textContent, new RegExp(`400${unit} × 200${unit}`));
  assert.match(panel.textContent, new RegExp(platform === 'ios' ? 'SwiftUI layout' : 'Compose layout'));
  assert.match(panel.textContent, /Some measurements are unavailable for this part/);
  assert.equal(panel.querySelector('.measure-padding dd').textContent, 'Unavailable');
  assert.equal(panel.querySelector('.canvas-metrics').children.length, 6);
  assert.equal(panel.querySelector('.canvas-inspector-font').textContent, 'Unavailable · Unavailable · Unavailable');
  assert.equal(panel.querySelector('#canvas-inspector-hover').hidden, true);
  const overlay = doc.querySelector('.canvas-measure-native');
  assert.equal(overlay.getAttribute('aria-hidden'), 'true'); assert.equal(overlay.style.pointerEvents, 'none');
  assert.equal(overlay.style.width, '600px'); assert.equal(overlay.style.height, '300px');
  assert.equal(overlay.querySelector('.canvas-measure-native-image').style.left, '100px');
  assert.equal(overlay.querySelector('.canvas-measure-native-image').style.top, '80px');
  assert.equal(overlay.querySelector('.canvas-measure-bounds').style.left, '120px');
  assert.equal(overlay.querySelector('.canvas-measure-bounds').style.top, '40px');
  assert.equal(overlay.querySelector('.canvas-measure-bounds').style.width, '100px');
  assert.equal(overlay.querySelector('.canvas-measure-label').textContent, `100${unit} × 50${unit}`);
  assert.equal(overlay.querySelector('.canvas-measure-padding'), null);
  assert.equal(parent.window.getComputedStyle(overlay).overflow, 'hidden');
  assert.equal(parent.window.getComputedStyle(overlay.querySelector('.canvas-measure-native-image')).overflow, 'hidden');
  state.liveFrame.inspection.nodes[0].bounds.width = 140; inspector.update();
  assert.match(panel.textContent, new RegExp(`140${unit} × 50${unit}`));
  assert.equal(doc.querySelectorAll('.canvas-measure-native').length, 1);
  assert.equal(overlay.querySelector('.canvas-measure-bounds').style.width, '140px');
});

test('native metadata requires valid native units and an explicit measured component root', () => {
  const original = measuredFrame('ios');
  assert.deepEqual(inspectNativeFrame(original, 'ios').bounds, { x: 120, y: 40, width: 100, height: 50 });
  for (const mutate of [
    frame => { delete frame.inspection; },
    frame => { frame.inspection.version = 2; },
    frame => { frame.inspection.unit = 'px'; },
    frame => { frame.inspection.source = 'Image bounds'; },
    frame => { frame.inspection.nodes[0].id = 'frame'; },
    frame => { frame.inspection.nodes[0].bounds.width = -1; },
    frame => { frame.inspection.nodes[0].bounds.x = NaN; },
    frame => { frame.logicalWidth = 0; },
  ]) {
    const frame = structuredClone(original); mutate(frame); assert.equal(inspectNativeFrame(frame, 'ios'), null);
  }
  assert.equal(inspectNativeFrame(original, 'android'), null, 'a previous platform report cannot be relabeled as current native evidence');
  original.inspection.nodes.unshift({ id: 'child', name: 'child', bounds: { x: 0, y: 0, width: 400, height: 200 } });
  assert.equal(inspectNativeFrame(original, 'ios').bounds.width, 100, 'the entire frame or first child must not replace the measured root');
});

test('native image mapping scales the overlay only and clips within the native scrollport', async t => {
  const { parent, state, inspector, viewport, boxes } = setupNative(t);
  boxes.image = rect(50, 50, 200, 100);
  boxes.viewport = rect(100, 80, 120, 70);
  Object.defineProperty(viewport, 'clientWidth', { value: 120 });
  Object.defineProperty(viewport, 'clientHeight', { value: 70 });
  inspector.update();
  const doc = parent.window.document, overlay = doc.querySelector('.canvas-measure-native');
  assert.equal(overlay.style.width, '120px'); assert.equal(overlay.style.height, '70px');
  assert.equal(overlay.querySelector('.canvas-measure-native-image').style.left, '-50px');
  assert.equal(overlay.querySelector('.canvas-measure-native-image').style.top, '-30px');
  assert.equal(overlay.querySelector('.canvas-measure-bounds').style.width, '50px');
  assert.match(doc.querySelector('#canvas-inspector-panel').textContent, /100pt × 50pt/, 'image presentation never changes reported native component size');
  boxes.image = rect(-30, 10, 200, 100);
  viewport.dispatchEvent(new parent.window.Event('scroll'));
  await tick(parent.window);
  assert.equal(overlay.querySelector('.canvas-measure-native-image').style.left, '-130px');
  assert.equal(overlay.querySelector('.canvas-measure-native-image').style.top, '-70px');
  boxes.native = rect(140, 100, 600, 300); boxes.viewport = rect(140, 100, 120, 70); boxes.image = rect(200, 120, 200, 100);
  parent.window.dispatchEvent(new parent.window.Event('resize')); await tick(parent.window);
  assert.equal(overlay.style.left, '0px'); assert.equal(overlay.querySelector('.canvas-measure-native-image').style.left, '60px');
  const metrics = inspectNativeFrame(state.liveFrame, 'ios');
  assert.equal(nativeOverlayGeometry(metrics, rect(0, 0, 0, 0), boxes.viewport, boxes.native), null);
});

test('native frames without metadata never substitute image or capture dimensions for component size', t => {
  const { parent, state, inspector } = setupNative(t);
  delete state.liveFrame.inspection; inspector.update();
  const panel = parent.window.document.querySelector('#canvas-inspector-panel');
  assert.match(panel.textContent, /Measurements are unavailable/);
  assert.equal(panel.querySelector('.canvas-metrics'), null);
  assert.equal(parent.window.document.querySelector('.canvas-measure-bounds'), null);
  state.liveFrame = null; inspector.update();
  assert.match(panel.textContent, /Waiting for a rendered native frame/);
});

test('native reconnect clears stale bounds promptly, preserves its layer, and updates after a new frame', async t => {
  const { parent, state, inspector, viewport, image } = setupNative(t); inspector.update();
  const doc = parent.window.document, overlay = doc.querySelector('.canvas-measure-native'), surface = image.parentElement;
  state.liveFrame = null; viewport.replaceChildren();
  await tick(parent.window);
  assert.equal(overlay.hidden, true); assert.equal(overlay.querySelector('.canvas-measure-bounds'), null);
  assert.match(doc.querySelector('#canvas-inspector-panel').textContent, /Waiting/);
  state.liveFrame = measuredFrame('ios'); viewport.append(surface); inspector.update();
  assert.equal(doc.querySelector('.canvas-measure-native'), overlay);
  assert.equal(overlay.hidden, false); assert.ok(overlay.querySelector('.canvas-measure-bounds'));
  state.layout.bounds = false; inspector.update();
  assert.equal(overlay.isConnected, false);
  state.layout.bounds = true; inspector.update();
  assert.equal(doc.querySelectorAll('.canvas-measure-native').length, 1);
});

test('native platform replacement and disposal remove old layers, observers, and queued work', async t => {
  const { parent, frame, state, inspector, viewport } = setupNative(t); inspector.update();
  const doc = parent.window.document, oldOverlay = doc.querySelector('.canvas-measure-native');
  state.platform = 'android'; inspector.update();
  assert.match(doc.querySelector('#canvas-inspector-panel').textContent, /unavailable/, 'old pt metadata is not rendered as dp after platform change');
  state.liveFrame = measuredFrame('android'); inspector.update();
  assert.match(doc.querySelector('#canvas-inspector-panel').textContent, /100dp × 50dp/);
  viewport.dispatchEvent(new parent.window.Event('scroll'));
  inspector.dispose();
  await tick(parent.window);
  assert.equal(oldOverlay.isConnected, false);
  assert.equal(doc.querySelector('#canvas-inspector-panel'), null);
  assert.equal(doc.querySelector('.canvas-measure-native'), null);
  assert.equal(doc.querySelector('link[data-canvas-inspector-style]'), null);
  viewport.replaceChildren(); parent.window.dispatchEvent(new parent.window.Event('resize'));
  frame.window.dispatchEvent(new frame.window.Event('resize')); await tick(parent.window);
  assert.equal(doc.querySelector('.canvas-measure-native'), null);
});

for (const platform of ['ios', 'android']) test(`${platform} native metrics use the Web panel layout and honest native spacing guides`, t => {
  const { parent, state, inspector } = setupNative(t, platform);
  state.liveFrame = withNativeMetrics(state.liveFrame); inspector.update();
  const doc = parent.window.document, panel = doc.querySelector('#canvas-inspector-panel'), overlay = doc.querySelector('.canvas-measure-native');
  const unit = platform === 'ios' ? 'pt' : 'dp', fontUnit = platform === 'ios' ? 'pt' : 'sp';
  assert.deepEqual([...panel.querySelectorAll('.canvas-metrics dt')].map(node => node.textContent),
    ['Rendered size', 'Padding · ↑ → ↓ ←', 'Margin · ↑ → ↓ ←', 'Gap · row / column', 'Font / line height', 'Weight / letter spacing']);
  assert.equal(panel.querySelector('.measure-padding dd').textContent, `0${unit} · 24${unit} · 0${unit} · 24${unit}`);
  assert.equal(panel.querySelector('.measure-margin dd').textContent, `4${unit} · 8${unit} · 4${unit} · 8${unit}`);
  assert.equal(panel.querySelector('.measure-gap dd').textContent, `0${unit} / 8${unit}`);
  assert.match(panel.textContent, new RegExp(`14${fontUnit} / 20${fontUnit}`));
  assert.match(panel.textContent, new RegExp(`500 / 0.1${fontUnit}`));
  assert.equal(panel.querySelector('.canvas-inspector-font').textContent, 'Native Sans · LTR · native button');
  assert.doesNotMatch(panel.textContent, /unavailable|Unavailable/);
  assert.equal(panel.querySelector('#canvas-inspector-hover').hidden, false);
  const padding = [...overlay.querySelectorAll('.canvas-measure-padding')];
  assert.equal(padding.length, 2);
  assert.deepEqual(padding.map(node => [node.style.left, node.style.top, node.style.width, node.style.height]),
    [['120px', '40px', '24px', '50px'], ['196px', '40px', '24px', '50px']],
    'native overlaid borders do not add another 4px to applied padding');
  assert.equal(overlay.querySelectorAll('.canvas-measure-margin').length, 4);
  assert.equal(overlay.querySelector('.canvas-measure-label').textContent, `100${unit} × 50${unit}`);
});

for (const platform of ['ios', 'android']) for (const part of ['leading', 'trailing']) {
  test(`${platform} outlined Split Button ${part} guides respect its layout border at image scale`, async t => {
    const { parent, state, inspector, image, boxes } = setupNative(t, platform);
    state.liveFrame.inspection.nodes[0].name = 'md-split-button';
    const name = platform === 'ios' ? `md-split-button ::part(${part})` : `${part === 'leading' ? 'Leading' : 'Trailing'} button`;
    state.liveFrame.inspection.nodes.push({
      id: `component.${part}`, name, parentId: 'component',
      bounds: { x: 120, y: 40, width: 100, height: 50 },
      metrics: { padding: [2, 14, 3, 12], border: [1, 1, 1, 1] },
    });
    boxes.image = rect(200, 160, 200, 100);
    inspector.update();
    const doc = parent.window.document;
    doc.querySelector('#canvas-inspector-hover').dispatchEvent(new parent.window.CustomEvent('mdClick', { detail: { selected: true } }));
    image.dispatchEvent(new parent.window.MouseEvent('pointermove', { bubbles: true, clientX: 280, clientY: 190 }));
    await tick(parent.window);
    assert.equal(doc.querySelector('[data-inspector-selection]').textContent, name);
    assert.deepEqual([...doc.querySelectorAll('.canvas-measure-padding')].map(node =>
      [node.style.left, node.style.top, node.style.width, node.style.height]), [
      ['60.5px', '20.5px', '49px', '1px'], ['60.5px', '43px', '49px', '1.5px'],
      ['60.5px', '21.5px', '6px', '21.5px'], ['102.5px', '21.5px', '7px', '21.5px'],
    ]);
    const unit = platform === 'ios' ? 'pt' : 'dp';
    assert.equal(doc.querySelector('.measure-padding dd').textContent, `2${unit} · 14${unit} · 3${unit} · 12${unit}`,
      'displayed native padding remains the measured value, without adding border or image scale');
  });
}

for (const platform of ['ios', 'android']) test(`${platform} hovered parts follow scaled/scrolled native coordinates without blocking native input`, async t => {
  const { parent, state, inspector, viewport, image, boxes } = setupNative(t, platform);
  state.liveFrame = withNativeMetrics(state.liveFrame);
  boxes.image = rect(200, 160, 200, 100);
  inspector.update();
  const doc = parent.window.document, hover = doc.querySelector('#canvas-inspector-hover'), unit = platform === 'ios' ? 'pt' : 'dp';
  hover.dispatchEvent(new parent.window.CustomEvent('mdClick', { bubbles: true, detail: { selected: true } }));
  let inputClicks = 0;
  image.parentElement.addEventListener('click', () => inputClicks++);
  const move = new parent.window.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 285, clientY: 192 });
  image.dispatchEvent(move);
  image.dispatchEvent(new parent.window.MouseEvent('click', { bubbles: true }));
  await tick(parent.window);
  assert.equal(move.defaultPrevented, false); assert.equal(inputClicks, 1);
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'Button label');
  assert.match(doc.querySelector('[data-inspector-content]').textContent, new RegExp(`52${unit} × 20${unit}`));
  assert.equal(doc.querySelector('.canvas-measure-bounds').style.width, '26px');
  assert.equal(doc.querySelector('.canvas-measure-padding'), null, 'unreported label spacing is not fabricated as zero');
  boxes.image = rect(120, 140, 200, 100);
  viewport.dispatchEvent(new parent.window.Event('scroll')); await tick(parent.window);
  assert.equal(doc.querySelector('.canvas-measure-native-image').style.left, '20px');
  image.dispatchEvent(new parent.window.MouseEvent('pointermove', { bubbles: true, clientX: 205, clientY: 172 }));
  await tick(parent.window);
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'Button label');
  viewport.dispatchEvent(new parent.window.MouseEvent('pointerleave')); await tick(parent.window);
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'md-button');
  image.dispatchEvent(new parent.window.MouseEvent('pointermove', { bubbles: true, clientX: 205, clientY: 172 }));
  await tick(parent.window);
  hover.dispatchEvent(new parent.window.CustomEvent('mdClick', { bubbles: true, detail: { selected: false } }));
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'md-button');
});

test('native hover deterministically prefers deepest/smallest measured leaf and rejects clipped or malformed coordinates', () => {
  const frame = withNativeMetrics(measuredFrame('ios'));
  const label = frame.inspection.nodes[1];
  frame.inspection.nodes.push({ id: 'component.content', name: 'Content', parentId: 'component', bounds: { ...label.bounds } });
  let inspection = inspectNativeFrame(frame, 'ios');
  assert.equal(nativeNodeAtPoint(inspection, rect(100, 100, 200, 100), 180, 132), 'component.label', 'equal text-only content and label rectangles prefer the label');
  frame.inspection.nodes.reverse(); inspection = inspectNativeFrame(frame, 'ios');
  assert.equal(nativeNodeAtPoint(inspection, rect(100, 100, 200, 100), 180, 132), 'component.label', 'tie selection does not depend on report ordering');
  label.parentId = 'component.content'; inspection = inspectNativeFrame(frame, 'ios');
  assert.equal(nativeNodeAtPoint(inspection, rect(100, 100, 200, 100), 180, 132), 'component.label');
  assert.equal(nativeNodeAtPoint(inspection, rect(-100, -100, 200, 100), 180, 132), 'component');
  assert.equal(nativeNodeAtPoint(inspection, rect(100, 100, 200, 100), NaN, 132), 'component');
  assert.equal(nativeNodeAtPoint(inspection, rect(100, 100, 0, 100), 100, 132), 'component');
});

test('native button picking respects clipped edges without changing intrinsic measurements or other components', () => {
  for (const platform of ['ios', 'android']) {
    const frame = withNativeMetrics(measuredFrame(platform));
    frame.inspection.nodes[0].bounds = { x: 120, y: 40, width: 48, height: 20 };
    frame.inspection.nodes[1].bounds = { x: 110, y: 30, width: 68, height: 40 };
    const inspection = inspectNativeFrame(frame, platform), before = structuredClone(inspection);
    const pick = (x, y) => nativeNodeAtPoint(inspection, rect(100, 100, 200, 100), 100 + x / 2, 100 + y / 2);
    assert.equal(pick(140, 50), 'component.label');
    for (const [x, y] of [[119, 50], [168, 50], [140, 39], [140, 60]]) {
      assert.equal(pick(x, y), 'component', 'a measured but clipped label region cannot be hovered');
    }
    assert.deepEqual(inspection, before, 'picking never crops the measured part bounds');
    inspection.name = 'md-dialog';
    assert.equal(pick(119, 50), 'component.label', 'root clipping is not assumed for arbitrary native components');
  }
});

for (const platform of ['ios', 'android']) test(`${platform} clipped button hover retains full measured label size`, async t => {
  const { parent, state, inspector, image, boxes } = setupNative(t, platform);
  state.liveFrame = withNativeMetrics(state.liveFrame);
  state.liveFrame.inspection.nodes[0].bounds = { x: 120, y: 40, width: 48, height: 20 };
  state.liveFrame.inspection.nodes[1].bounds = { x: 111.25, y: 38, width: 65.5, height: 24 };
  boxes.image = rect(100, 100, 200, 100);
  inspector.update();
  const doc = parent.window.document, unit = platform === 'ios' ? 'pt' : 'dp';
  doc.querySelector('#canvas-inspector-hover').dispatchEvent(new parent.window.CustomEvent('mdClick', { detail: { selected: true } }));
  image.dispatchEvent(new parent.window.MouseEvent('pointermove', { bubbles: true, clientX: 170, clientY: 125 }));
  await tick(parent.window);
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'Button label');
  assert.equal(doc.querySelector('.measure-size dd').textContent, `65.5${unit} × 24${unit}`);
  image.dispatchEvent(new parent.window.MouseEvent('pointermove', { bubbles: true, clientX: 157, clientY: 125 }));
  await tick(parent.window);
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'md-button');
  assert.equal(doc.querySelector('.measure-size dd').textContent, `48${unit} × 20${unit}`);
});

test('native optional invalid metrics remain unavailable while valid measured bounds and fields remain visible', t => {
  const { parent, state, inspector } = setupNative(t, 'android');
  state.liveFrame = withNativeMetrics(state.liveFrame);
  const metrics = state.liveFrame.inspection.nodes[0].metrics;
  metrics.padding[1] = NaN; metrics.margin = [-2, 0, 0, 4]; metrics.gap.row = -1;
  metrics.typography.size = 0; metrics.typography.spacing = Infinity; metrics.typography.family = '<img src=x onerror=evil()>';
  metrics.direction = 'sideways'; metrics.display = '<native>';
  inspector.update();
  const panel = parent.window.document.querySelector('#canvas-inspector-panel');
  assert.equal(panel.querySelector('.measure-padding dd').textContent, 'Unavailable');
  assert.equal(panel.querySelector('.measure-margin dd').textContent, '-2dp · 0dp · 0dp · 4dp');
  assert.equal(panel.querySelector('.measure-gap dd').textContent, 'Unavailable / 8dp');
  assert.match(panel.textContent, /Unavailable \/ 20sp/);
  assert.match(panel.textContent, /500 \/ Unavailable/);
  assert.match(panel.textContent, /<img src=x onerror=evil\(\)> · Unavailable · <native>/);
  assert.equal(panel.querySelector('img'), null);
  assert.equal(parent.window.document.querySelector('.canvas-measure-padding'), null);
  assert.equal(parent.window.document.querySelectorAll('.canvas-measure-margin').length, 1, 'negative margins are reported but not painted as a positive region');
  assert.match(panel.textContent, /100dp × 50dp/);
  metrics.typography.unit = 'pt'; inspector.update();
  assert.match(panel.textContent, /Font \/ line heightUnavailable \/ Unavailable/, 'wrong native font units are not silently relabeled');
});

test('native session changes and disappearing hover nodes restore root selection without stale part metrics', async t => {
  const { parent, state, inspector, image, viewport } = setupNative(t);
  state.liveFrame = withNativeMetrics(state.liveFrame); state.liveFrame.sessionId = 'first';
  inspector.update();
  const doc = parent.window.document;
  doc.querySelector('#canvas-inspector-hover').dispatchEvent(new parent.window.CustomEvent('mdClick', { detail: { selected: true } }));
  const hoverLabel = async () => { image.dispatchEvent(new parent.window.MouseEvent('pointermove', { bubbles: true, clientX: 370, clientY: 225 })); await tick(parent.window); };
  await hoverLabel(); assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'Button label');
  state.liveFrame.sessionId = 'second'; inspector.update();
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'md-button');
  await hoverLabel(); assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'Button label');
  state.liveFrame.inspection.nodes.pop(); inspector.update();
  assert.equal(doc.querySelector('[data-inspector-selection]').textContent, 'md-button');
  assert.equal(doc.querySelector('#canvas-inspector-hover').hidden, true);
  state.liveFrame = null; viewport.replaceChildren(); await tick(parent.window);
  assert.match(doc.querySelector('#canvas-inspector-panel').textContent, /Waiting/);
  assert.equal(doc.querySelector('.canvas-measure-label'), null);
});

test('native size labels disappear with completely clipped parts while measurements remain host-based', async t => {
  const { parent, inspector, viewport, boxes } = setupNative(t); inspector.update();
  assert.ok(parent.window.document.querySelector('.canvas-measure-label'));
  boxes.image = rect(-900, -900, 400, 200);
  viewport.dispatchEvent(new parent.window.Event('scroll')); await tick(parent.window);
  assert.equal(parent.window.document.querySelector('.canvas-measure-label'), null);
  assert.match(parent.window.document.querySelector('#canvas-inspector-panel').textContent, /100pt × 50pt/);
});

test('computed font strings are escaped and nonnumeric CSS values stay truthful', t => {
  const { parent, host, inspector } = setup(t);
  const original = host.ownerDocument.defaultView.getComputedStyle;
  host.ownerDocument.defaultView.getComputedStyle = element => {
    const css = original(element);
    return new Proxy(css, { get(target, name) { return name === 'fontFamily' ? '<img src=x onerror=evil()>' : name === 'lineHeight' ? 'normal' : name === 'marginTop' ? 'auto' : Reflect.get(target, name); } });
  };
  inspector.update();
  const panel = parent.window.document.querySelector('#canvas-inspector-panel');
  assert.equal(panel.querySelector('img'), null);
  assert.match(panel.textContent, /<img src=x onerror=evil\(\)>/);
  assert.match(panel.textContent, /auto · 8px/);
  assert.match(panel.textContent, /14px \/ normal/);
});
