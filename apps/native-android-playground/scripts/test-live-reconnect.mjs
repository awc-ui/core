import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createAndroidLiveRenderer } from '../../native-playground/android-live.mjs';

// Uses the installed debug host on a dedicated emulator. Close and recreate
// at multiple browser-like delays, alternating theme at a browser-sized viewport.
const renderer = createAndroidLiveRenderer({ startupTimeoutMs: 7000 });
const sessions = new Set(), results = [];
let previousImage;
try {
  const gaps = [0, 75, 100, 125, 0, 125, 75, 100];
  for (let cycle = 0; cycle < gaps.length; cycle++) {
    const dark = cycle % 2 === 1;
    const start = performance.now();
    const first = await renderer.create({ tag: 'md-button', properties: { size: 'md', toggle: true, selected: false }, width: 426, dark });
    assert.ok(!sessions.has(first.sessionId), 'Reconnection must create a fresh native session.');
    sessions.add(first.sessionId);
    assert.ok(first.imageUrl.startsWith('data:image/png;base64,'));
    if (previousImage) assert.notEqual(first.imageUrl, previousImage, 'Alternating themes must change the actual native pixels.');
    previousImage = first.imageUrl;
    let frames = 0, streamError, closing = false;
    const events = new Map();
    const remember = result => { for (const event of result.events) events.set(event.id, event); };
    const unsubscribe = renderer.subscribe(first.sessionId, frame => { frames++; remember(frame); }, error => { if (!closing) streamError = error; });
    const waitFor = async condition => {
      const deadline = performance.now() + 5000;
      while (!condition()) {
        if (streamError) throw streamError;
        assert.ok(performance.now() < deadline, `Native session ${cycle + 1} stopped making progress.`);
        await delay(10);
      }
    };
    await waitFor(() => frames >= 3);
    remember(await renderer.input(first.sessionId, { command: 'pointer', phase: 'down', x: 40, y: 40 }));
    remember(await renderer.input(first.sessionId, { command: 'pointer', phase: 'up', x: 40, y: 40 }));
    await waitFor(() => events.size >= 2);
    assert.deepEqual([...events.values()].map(event => event.name), ['mdClick', 'mdChange']);
    assert.equal([...events.values()][1].detail.selected, true, 'Each new session starts with fresh native toggle state.');
    results.push({ cycle: cycle + 1, dark, gapBeforeNextMs: gaps[cycle], elapsedMs: Math.round(performance.now() - start), frames });
    console.log(JSON.stringify(results.at(-1)));
    closing = true;
    // Browser shutdown aborts its stream first and may still have a pointerleave
    // request in flight when it asks the backend to close the old session.
    unsubscribe();
    const leave = cycle % 2 ? renderer.input(first.sessionId, { command: 'pointer', phase: 'leave', x: 40, y: 40 }).catch(() => {}) : null;
    await renderer.close(first.sessionId);
    if (leave) await leave;
    await delay(gaps[cycle]);
  }
  console.log(JSON.stringify({ passed: true, reconnects: results.length, results }, null, 2));
} finally { await renderer.dispose(); }
