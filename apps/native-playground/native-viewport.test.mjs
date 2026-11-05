import { setImmediate as nextTurn } from 'node:timers/promises';
import { createNativeLiveClient } from './contracts.js';
import { validateLiveInput } from './native-live.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeCaptureViewport, nativeCanvasHeight, nativeLayoutNeedsRender, nativeCanvasReadout } from './native-viewport.js';
import { validateRenderRequest } from './native-render.mjs';
import { resolveAsset } from './server.mjs';

const tags = new Set(['md-snackbar', 'md-button']);
test('Snackbar capture follows the canvas and enforces a common 2x raster budget', () => {
  assert.deepEqual(nativeCaptureViewport(), { width: 640, height: 240 });
  for (const [width, height, expected] of [[640, 310, [640, 310]], [360, 480, [360, 480]], [1200, 5000, [1200, 1666]], [320, 5000, [320, 2000]], [2999, 218, [1200, 218]], [1, 0.01, [320, 1]], [641.6, 310.6, [642, 311]], [1e100, 1e100, [1200, 1666]]]) {
    const applied = validateRenderRequest({ tag: 'md-snackbar', width, height }, tags);
    assert.deepEqual([applied.width, applied.height], expected);
    assert.ok(applied.width * applied.height <= 2_000_000);
    assert.ok(applied.width * 2 * applied.height * 2 <= 8_000_000);
  }
  assert.equal(Object.hasOwn(validateRenderRequest({ tag: 'md-snackbar' }, tags), 'height'), false, 'old clients retain the native 240 fallback');
  for (const height of [0, -1, NaN, Infinity, -Infinity, null, '310', true, [], {}]) {
    assert.throws(() => validateRenderRequest({ tag: 'md-snackbar', height }, tags), error => error.code === 'INVALID_HEIGHT');
  }
  assert.throws(() => validateRenderRequest({ tag: 'md-button', height: 310 }, tags), error => error.code === 'INVALID_HEIGHT');
});

test('height-only and expanded overlay canvas changes request a new native viewport', () => {
  assert.equal(nativeCanvasHeight(480, 310), 480);
  for (const unready of [undefined, null, 0, NaN, Infinity, -1, '480']) assert.equal(nativeCanvasHeight(unready, 420), 420);
  assert.equal(nativeCanvasHeight(undefined, 0), 310);
  assert.equal(nativeLayoutNeedsRender('md-snackbar', { height: 480 }), true);
  assert.equal(nativeLayoutNeedsRender('md-snackbar', { expanded: true }), true);
  assert.equal(nativeLayoutNeedsRender('md-snackbar', { viewport: true }), true);
  assert.equal(nativeLayoutNeedsRender('md-button', { viewport: true }), false);
  assert.equal(nativeLayoutNeedsRender('md-button', { height: 480 }), false);
  assert.equal(nativeLayoutNeedsRender('md-button', { direction: 'rtl' }), true);
  assert.equal(nativeLayoutNeedsRender('md-snackbar', { grid: true }), false);
});

test('native readouts distinguish requested canvas size from committed captured dimensions', () => {
  assert.equal(nativeCanvasReadout('md-snackbar', 'ios', null, 2999, 5000).label, 'Canvas 2999 × 5000 px');
  for (const [platform, unit] of [['ios', 'pt'], ['android', 'dp']]) {
    const readout = nativeCanvasReadout('md-snackbar', platform, { logicalWidth: 1200, logicalHeight: 1666 }, 2999, 5000);
    assert.equal(readout.label, `Rendered 1200 × 1666 ${unit}`);
    assert.match(readout.title, /Canvas 2999 × 5000 px/);
    assert.match(readout.notice, /Laboratory capture limits/);
    assert.equal(nativeCanvasReadout('md-snackbar', platform, { logicalWidth: 640, logicalHeight: 310 }, 640, 310).notice, '');
  }
  assert.equal(nativeCanvasReadout('md-snackbar', 'web', null, 2999, 5000).label, '2999 × 5000 px');
  assert.equal(nativeCanvasReadout('md-button', 'ios', null, 640, 310).label, '640 × 310 px');
});

test('the browser can load the shared preview viewport module', async () => {
  assert.ok(await resolveAsset('/native-viewport.js', { repoRoot: new URL('../..', import.meta.url).pathname }));
});


test('retained resize is strictly Snackbar-scoped and rejects malformed inputs before transport', () => {
  const context = { tag: 'md-snackbar', logicalWidth: 640, logicalHeight: 310 };
  assert.deepEqual(validateLiveInput({ command: 'resize', width: 2999, height: 5000 }, context), { command: 'resize', width: 1200, height: 1666 });
  for (const patch of [{ width: 0 }, { width: -1 }, { height: 0 }, { height: NaN }, { height: Infinity }, { width: '360' }, { height: null }, { height: undefined }]) {
    assert.throws(() => validateLiveInput({ command: 'resize', width: 360, height: 480, ...patch }, context), { code: 'INVALID_VIEWPORT' });
  }
  assert.throws(() => validateLiveInput({ command: 'resize', width: 360, height: 480, tag: 'md-button' }, context), { code: 'INVALID_INPUT' });
  assert.throws(() => validateLiveInput({ command: 'resize', width: 360, height: 480 }, { ...context, tag: 'md-button' }), { code: 'INVALID_VIEWPORT' });
});

test('viewport edits stay ordered on one session and settle only after host acknowledgements', async t => {
  const calls = [], gates = [], events = [];
  const client = createNativeLiveClient({ send: async (route, payload) => {
    calls.push({ route, payload });
    if (route === 'session') return { sessionId: 'retained', revision: 1, imageUrl: 'frame-1', logicalWidth: 640, logicalHeight: 310, events: [] };
    if (route.endsWith('/close')) return {};
    return new Promise(resolve => gates.push(() => resolve({ sessionId: 'retained', revision: calls.length, events: [] })));
  }, onFrame() {}, onEvents: value => events.push(...value), onError: error => { throw error; } });
  client.setVisible(false); t.after(() => client.stop());
  await client.start({ tag: 'md-snackbar', properties: { open: true, autoHide: true, autoHideDuration: 5000 } });
  let settled = false;
  const resize = client.resize(360, 480).then(() => { settled = true; });
  const property = client.update({ message: 'Still the same Snackbar' });
  const second = client.resize(1200, 5000);
  await nextTurn();
  assert.equal(settled, false); assert.equal(calls.length, 2);
  gates.shift()(); await resize; await nextTurn();
  assert.equal(calls[2].payload.command, 'update');
  gates.shift()(); await property; await nextTurn();
  assert.deepEqual(calls[3].payload, { command: 'resize', width: 1200, height: 1666 });
  gates.shift()(); await second;
  assert.equal(calls.filter(call => call.route === 'session').length, 1);
  assert.deepEqual(events, [], 'viewport ACK does not invent component lifecycle events');
  await assert.rejects(client.resize(0, 480), { code: 'INVALID_VIEWPORT' });
  const pending = client.resize(400, 600); await nextTurn(); client.stop();
  await assert.rejects(pending, { code: 'SESSION_CLOSED' });
  gates.shift()(); await nextTurn();
});
