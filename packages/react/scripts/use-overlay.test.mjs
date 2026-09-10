import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MessageChannel } from 'node:worker_threads';

// Reuse the monorepo's browser/component test dependencies; no installed
// package files or generated wrappers are needed for this source-level suite.
const requireCore = createRequire(new URL('../../core/package.json', import.meta.url));
const { build } = requireCore('esbuild');
const { JSDOM } = requireCore('jsdom');
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('./fixtures/use-overlay-harness.tsx', import.meta.url))],
  bundle: true, write: false, format: 'iife', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent',
});

function fixture(t, options, strict = false, deferOpening = false) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only', url: 'https://awc.test/', pretendToBeVisual: true,
  });
  const channels = [];
  dom.window.MessageChannel = class extends MessageChannel {
    constructor() { super(); channels.push(this); }
  };
  dom.window.eval(bundle.outputFiles[0].text);
  const harness = dom.window.createOverlayHarness(options, strict, deferOpening);
  let mounted = true;
  const originalUnmount = harness.unmount;
  harness.unmount = () => { if (mounted) { originalUnmount(); mounted = false; } };
  t.after(() => {
    harness.unmount();
    channels.forEach(({ port1, port2 }) => { port1.close(); port2.close(); });
    dom.window.close();
  });
  return harness;
}

test('StrictMode replay reopens the native host without reporting a user dismissal', async (t) => {
  const calls = [];
  const overlay = fixture(t, { onClosing: () => calls.push('closing'), onClosed: () => calls.push('closed') }, true);
  assert.equal(overlay.element().shows, 2);
  assert.equal(overlay.element().closes, 1);
  assert.equal(overlay.element().open, true);
  assert.deepEqual(calls, [], 'effect cleanup must not notify the app or unmount its replayed overlay');
  await overlay.finishExit();
  assert.deepEqual(calls, [], 'a stale cleanup completion must not remove the reopened overlay');
  overlay.requestClose();
  assert.deepEqual(calls, ['closing']);
  await overlay.finishExit();
  assert.deepEqual(calls, ['closing', 'closed']);
});

test('a nested select/menu close event does not dismiss its outer overlay', async (t) => {
  const calls = [];
  const overlay = fixture(t, { onClosing: () => calls.push('closing'), onClosed: () => calls.push('closed') });
  overlay.nestedClose();
  await overlay.finishExit();
  assert.deepEqual(calls, []);
  assert.equal(overlay.element().open, true);
});

test('onClosing runs at native close while onClosed waits for the shell exit', async (t) => {
  const calls = [];
  const overlay = fixture(t, { onClosing: () => calls.push('closing'), onClosed: () => calls.push('closed') });
  overlay.requestClose();
  assert.deepEqual(calls, ['closing']);
  assert.equal(overlay.element().isConnected, true, 'the React host remains mounted throughout its exit');
  await overlay.finishExit();
  assert.deepEqual(calls, ['closing', 'closed']);
});

test('callbacks use current props without restarting the overlay effect', async (t) => {
  const calls = [];
  const overlay = fixture(t, { onClosing: () => calls.push('stale closing'), onClosed: () => calls.push('stale closed') });
  overlay.update({ onClosing: () => calls.push('current closing'), onClosed: () => calls.push('earlier closed') });
  assert.equal(overlay.element().shows, 1);
  overlay.requestClose();
  overlay.update({ onClosed: () => calls.push('latest closed') });
  await overlay.finishExit();
  assert.deepEqual(calls, ['current closing', 'latest closed']);
});

test('an unmounted overlay cannot deliver a late closed callback', async (t) => {
  const calls = [];
  const overlay = fixture(t, { onClosing: () => calls.push('closing'), onClosed: () => calls.push('closed') });
  overlay.requestClose();
  overlay.unmount();
  await overlay.finishExit();
  assert.deepEqual(calls, ['closing']);
});

test('cancelling before the first open completes once without a native close event', async (t) => {
  const calls = [];
  const overlay = fixture(t, { onClosing: () => calls.push('closing'), onClosed: () => calls.push('closed') }, false, true);
  assert.equal(overlay.element().open, false);
  overlay.requestClose();
  assert.deepEqual(calls, [], 'no open state means Core emits no mdClose');
  await overlay.finishExit();
  assert.deepEqual(calls, ['closed'], 'the cancelled native cycle still releases its mounted React host');
  overlay.requestClose();
  await overlay.finishExit();
  assert.deepEqual(calls, ['closed'], 'completion belongs to the mount, not each close request');
});
