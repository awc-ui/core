import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createNativeLiveRenderer } from '../../native-playground/native-live.mjs';

// Requires a logged-in macOS WindowServer session and the built AWCLivePreview.
// AWC_NATIVE_PERF_MIN_FPS optionally makes the local performance target a gate.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const renderer = createNativeLiveRenderer({ repoRoot });
let unsubscribe, streamError;
const frames = [], events = new Map(), inputs = [];
const remember = result => { for (const event of result.events) events.set(event.id, event); };
try {
  const first = await renderer.create({ tag: 'md-button', properties: { size: 'md', variant: 'filled', toggle: false }, width: 640, dark: false });
  unsubscribe = renderer.subscribe(first.sessionId, frame => { frames.push({ at: performance.now(), frame }); remember(frame); }, error => { streamError = error; });
  const waitFor = async condition => {
    const deadline = performance.now() + 5000;
    while (!condition()) {
      if (streamError) throw streamError;
      assert.ok(performance.now() < deadline, 'The native stream must make progress.');
      await delay(10);
    }
  };
  await waitFor(() => frames.length >= 10);
  const input = async (phase, x = 40, y = 40) => {
    const started = performance.now();
    const result = await renderer.input(first.sessionId, { command: 'pointer', phase, x, y });
    inputs.push(performance.now() - started);
    assert.equal(result.imageUrl, undefined, 'Input acknowledgments must not wait for image capture.');
    remember(result);
  };
  await input('move');
  await input('down');
  const heldAt = frames.length;
  await delay(260);
  assert.ok(frames.length > heldAt + 2, 'Frames must continue independently while the button stays pressed.');
  assert.equal(events.size, 0, 'A held press must not activate the button.');
  await input('up');
  await waitFor(() => events.size > 0);
  assert.deepEqual([...events.values()].map(event => event.name), ['mdClick']);
  await input('down'); await input('leave'); await input('cancel');
  await delay(1500);
  assert.equal(events.size, 1, 'Hover and cancellation must not add another activation.');
  if (streamError) throw streamError;
  const samples = frames.slice(10), intervals = samples.slice(1).map((frame, index) => frame.at - samples[index].at).sort((a, b) => a - b);
  const fps = (samples.length - 1) * 1000 / (samples.at(-1).at - samples[0].at);
  const minimum = Number(process.env.AWC_NATIVE_PERF_MIN_FPS || 0);
  if (minimum) assert.ok(fps >= minimum, `Expected at least ${minimum} fps, received ${fps.toFixed(1)}.`);
  unsubscribe(); unsubscribe = null;
  const snapshot = await renderer.frame(first.sessionId);
  assert.ok(snapshot.imageUrl.startsWith('data:image/png;base64,'), 'Polling remains available after a stream disconnects.');
  console.log(JSON.stringify({ passed: true, frames: frames.length, fps: +fps.toFixed(1), medianFrameMs: +intervals[Math.floor(intervals.length / 2)].toFixed(2), p95FrameMs: +intervals[Math.floor(intervals.length * 0.95)].toFixed(2), averageInputAckMs: +(inputs.reduce((a, b) => a + b, 0) / inputs.length).toFixed(2), nativeClicks: events.size }, null, 2));
} finally { unsubscribe?.(); renderer.dispose(); }
