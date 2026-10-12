import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createAndroidLiveRenderer } from '../../native-playground/android-live.mjs';

// Requires a dedicated booted emulator and installed Android debug playground APK.
// AWC_NATIVE_PERF_MIN_FPS optionally makes the local performance target a gate.
const renderer = createAndroidLiveRenderer();
let unsubscribe, streamError;
const frames = [], events = new Map(), inputs = [], streamRestarts = [];
const frameDirectory = process.env.AWC_NATIVE_FRAME_DIR;
const saveFrame = async (name, frame) => {
  if (!frameDirectory) return;
  await mkdir(frameDirectory, { recursive: true });
  await writeFile(path.join(frameDirectory, name), Buffer.from(frame.imageUrl.split(',')[1], 'base64'));
};
const remember = result => {
  for (const event of result.events) {
    assert.ok(!events.has(event.id), `Native event ${event.id} must not be delivered twice across stream reconnects.`);
    events.set(event.id, event);
  }
};
try {
  const first = await renderer.create({ tag: 'md-button', properties: { size: 'md', variant: 'filled', toggle: false }, width: 640, dark: false });
  assert.equal(first.width, 1280, 'The native host must rasterize at 2×, independently of emulator width.');
  assert.equal(first.logicalWidth, 640);
  remember(first);
  const subscribe = () => renderer.subscribe(first.sessionId, frame => { frames.push({ at: performance.now(), frame }); remember(frame); }, error => { streamError = error; });
  unsubscribe = subscribe();
  const waitFor = async (condition, message = 'The native stream must make progress.') => {
    const deadline = performance.now() + 5000;
    while (!condition()) {
      if (streamError) throw streamError;
      assert.ok(performance.now() < deadline, message);
      await delay(10);
    }
    if (streamError) throw streamError;
  };
  const restartStream = async label => {
    unsubscribe(); unsubscribe = null;
    const frameIndex = frames.length, started = performance.now();
    // This is the same socket abort/re-subscribe path as browser visibility.
    // Do not send a native stream-disable command or poll a frame to repair it.
    unsubscribe = subscribe();
    await waitFor(() => frames.length > frameIndex, `${label}: the replacement stream must deliver within five seconds.`);
    const next = frames[frameIndex].frame;
    assert.equal(next.width, 1280, 'Resubscribing must preserve the real 2× native surface.');
    assert.equal(next.logicalWidth, 640);
    streamRestarts.push({ phase: label, firstFrameMs: +(performance.now() - started).toFixed(2) });
    return frameIndex;
  };
  await waitFor(() => frames.length >= 1);
  await saveFrame('android-button.png', frames.at(-1).frame);
  const input = async (phase, x = first.logicalWidth / 2, y = first.logicalHeight / 2) => {
    const started = performance.now();
    const result = await renderer.input(first.sessionId, { command: 'pointer', phase, x, y });
    inputs.push(performance.now() - started);
    assert.equal(result.imageUrl, undefined, 'Input acknowledgments must not wait for image capture.');
    remember(result);
  };
  await input('move');
  const animationStart = frames.length;
  await input('down');
  const heldAt = frames.length;
  await delay(260);
  assert.ok(frames.length > heldAt + 2, 'Frames must continue independently while the button stays pressed.');
  assert.equal(events.size, 0, 'A held press must not activate the button.');
  assert.ok(new Set(frames.slice(heldAt).map(value => value.frame.imageUrl)).size > 1, 'Compose must draw changing native press animation frames.');
  await saveFrame('android-button-pressed.png', frames.slice(heldAt)[1].frame);
  await saveFrame('android-button-held.png', frames.at(-1).frame);
  await input('up');
  await waitFor(() => events.size > 0);
  assert.deepEqual([...events.values()].map(event => event.name), ['mdClick']);
  await delay(500);
  const animationEnd = frames.length;
  await input('down'); await input('leave'); await input('cancel');
  await delay(1500);
  assert.equal(events.size, 1, 'Hover and cancellation must not add another activation.');
  if (streamError) throw streamError;
  // Idle heartbeats keep a session alive but are not fresh animation frames.
  const seenCaptures = new Set();
  const samples = frames.slice(animationStart, animationEnd).filter(({ frame }) => {
    const sequence = frame.diagnostics?.captureSequence;
    assert.ok(Number.isSafeInteger(sequence), 'Each frame must identify its native capture.');
    if (seenCaptures.has(sequence)) return false;
    seenCaptures.add(sequence); return true;
  });
  assert.ok(samples.length > 2, 'The native press must produce fresh animation frames.');
  const intervals = samples.slice(1).map((frame, index) => frame.at - samples[index].at).sort((a, b) => a - b);
  const fps = (samples.length - 1) * 1000 / (samples.at(-1).at - samples[0].at);
  const minimum = Number(process.env.AWC_NATIVE_PERF_MIN_FPS || 0);
  if (minimum) assert.ok(fps >= minimum, `Expected at least ${minimum} fps, received ${fps.toFixed(1)}.`);
  await waitFor(() => frames.length >= 2 && frames.at(-1).frame.diagnostics.captureSequence === frames.at(-2).frame.diagnostics.captureSequence,
    'The button must reach an idle heartbeat before the idle reconnect check.');
  const idleSequence = frames.at(-1).frame.diagnostics.captureSequence;
  await restartStream('idle');
  assert.ok(frames.at(-1).frame.diagnostics.captureSequence >= idleSequence, 'Idle resubscribe must not return an older capture.');
  await input('down');
  await waitFor(() => frames.at(-1).frame.diagnostics.captureSequence > idleSequence,
    'The replacement idle stream must capture a new native interaction.');
  assert.equal(events.size, 1, 'Reconnecting and pressing must not replay or add activation events.');
  const heldSequence = frames.at(-1).frame.diagnostics.captureSequence;
  await input('up');
  const resumedAt = await restartStream('after interaction');
  await waitFor(() => frames.slice(resumedAt).some(({ frame }) => frame.diagnostics.captureSequence > heldSequence),
    'Resubscribing after release must deliver the newer native capture.');
  await waitFor(() => events.size === 2, 'The second accepted press must deliver exactly one new native activation.');
  assert.deepEqual([...events.values()].map(event => event.name), ['mdClick', 'mdClick']);
  unsubscribe(); unsubscribe = null;
  const snapshot = await renderer.frame(first.sessionId);
  assert.ok(snapshot.imageUrl.startsWith('data:image/png;base64,'), 'Polling remains available after a stream disconnects.');
  remember(snapshot);
  assert.equal(events.size, 2, 'Disconnecting or polling must not replay native activation.');
  console.log(JSON.stringify({ passed: true, frames: frames.length, freshAnimationFrames: samples.length, sourcePixels: [first.width, first.height], pixelScale: first.width / first.logicalWidth, fps: +fps.toFixed(1), medianFrameMs: +intervals[Math.floor(intervals.length / 2)].toFixed(2), p95FrameMs: +intervals[Math.floor(intervals.length * 0.95)].toFixed(2), averageInputAckMs: +(inputs.reduce((a, b) => a + b, 0) / inputs.length).toFixed(2), nativeClicks: events.size, streamRestarts }, null, 2));
} finally { unsubscribe?.(); await renderer.dispose(); }
