import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
import { createCanvasInspector, inspectElement, hoveredPart, composedContains, formatPixels } from './canvas-inspector.js';

const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const jsdomPackage = packages.find(name => name.startsWith('jsdom@22.')) || packages.find(name => name.startsWith('jsdom@'));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${jsdomPackage}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
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

test('both native modes hide inspection while retaining the Web preference and removing overlays', async t => {
  const { parent, frame, state, inspector } = setup(t); inspector.update();
  const panel = parent.window.document.querySelector('#canvas-inspector-panel');
  for (const platform of ['ios', 'android']) {
    state.platform = platform; inspector.update();
    assert.equal(panel.hidden, true);
    assert.equal(state.layout.bounds, true, 'native mode does not erase the Web preference');
    assert.equal(frame.window.document.querySelector('.canvas-measure-overlay'), null);
    assert.equal(frame.window.document.querySelector('link[data-canvas-inspector-style]'), null);
    state.platform = 'web'; inspector.update();
    assert.equal(panel.hidden, false);
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
