import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequest, nativeRenderRequest } from './contracts.js';

test('native render payload preserves typed union values and snapshots editable objects', () => {
  const properties = { clearable: false, passwordToggle: true, density: -1, value: 'false', options: [{ value: 0, disabled: false }], unset: undefined };
  const request = nativeRenderRequest('md-text-field', properties, true);
  assert.deepEqual(request, { tag: 'md-text-field', properties: { clearable: false, passwordToggle: true, density: -1, value: 'false', options: [{ value: 0, disabled: false }] }, dark: true, width: 640 });
  properties.clearable = 'internal';
  properties.options[0].disabled = true;
  assert.equal(request.properties.clearable, false);
  assert.equal(request.properties.options[0].disabled, false);
  assert.equal(nativeRenderRequest('md-chip', {}, false).dark, false);
});

test('new render aborts fetch and rejects callbacks already queued by an old render', async () => {
  const requests = createLatestRequest();
  const old = requests.start();
  const accepted = [];
  const delayedCallback = Promise.resolve().then(() => { if (old.isCurrent()) accepted.push('old component'); });
  const current = requests.start();
  await delayedCallback;
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  assert.equal(current.signal.aborted, false);
  if (current.isCurrent()) accepted.push('current component');
  assert.deepEqual(accepted, ['current component']);
});

test('leaving native preview invalidates a pending image callback without a replacement request', () => {
  const requests = createLatestRequest();
  const current = requests.start();
  requests.cancel();
  assert.equal(current.isCurrent(), false);
  assert.equal(current.signal.aborted, true);
  requests.cancel();
  const returned = requests.start();
  assert.equal(returned.isCurrent(), true);
  assert.equal(current.isCurrent(), false);
});

const turn = () => new Promise(resolve => setImmediate(resolve));
const frame = (sessionId, revision, events = []) => ({ sessionId, revision, events, platform: 'macos', renderer: 'SwiftUI', imageUrl: 'data:image/png;base64,aA==', logicalWidth: 640, logicalHeight: 260, width: 1280, height: 520 });

test('live session serializes polls and native inputs, keeps one host, and deduplicates native events', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const calls = [], scheduled = [], frames = [], events = [];
  let releasePoll;
  let revision = 0;
  const emitted = { id: 'session:1', name: 'mdInput', detail: 'Salut Ștefan 👋' };
  const client = createNativeLiveClient({
    send: async (route, body) => {
      calls.push({ route, body });
      if (route === 'session') return frame('session', revision++);
      if (route === 'session/frame') return new Promise(resolve => { releasePoll = () => resolve(frame('session', revision++, [emitted])); });
      if (route === 'session/input') return frame('session', revision++, [emitted]);
      return {};
    },
    onFrame: value => frames.push(value.revision), onEvents: value => events.push(...value), onError: error => { throw error; },
    schedule: callback => { scheduled.push(callback); return callback; }, unschedule: () => {},
  });
  await client.start({ tag: 'md-text-field' });
  scheduled.shift()();
  assert.equal(client.input({ command: 'text', text: 'Salut Ștefan 👋' }), true);
  client.input({ command: 'key', key: 'ArrowLeft', modifiers: [] });
  assert.deepEqual(calls.map(call => call.route), ['session', 'session/frame']);
  releasePoll(); await turn();
  assert.deepEqual(calls.map(call => call.route), ['session', 'session/frame', 'session/input', 'session/input']);
  assert.equal(calls[2].body.text, 'Salut Ștefan 👋');
  assert.deepEqual(frames, [0, 1, 2, 3]);
  assert.deepEqual(events, [emitted]);
  client.stop();
  assert.equal(calls.at(-1).route, 'session/close');
});

test('a session created after navigation is closed and never rendered', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const calls = [];
  let finishCreate;
  const client = createNativeLiveClient({ send: (route) => { calls.push(route); return route === 'session' ? new Promise(resolve => { finishCreate = resolve; }) : Promise.resolve({}); }, onFrame: () => assert.fail('Abandoned frame must not render'), onError: () => assert.fail('Abandoned session must not show an error') });
  const creating = client.start({ tag: 'md-chip' });
  client.stop();
  finishCreate(frame('abandoned', 0));
  await creating;
  assert.deepEqual(calls, ['session', 'abandoned/close']);
});

test('hidden previews pause polling and disconnect invalidates queued input and late responses', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const calls = [], frames = [], errors = [];
  let finishInput;
  const client = createNativeLiveClient({
    send: (route) => {
      calls.push(route);
      if (route === 'session') return Promise.resolve(frame('hidden', 0));
      if (route === 'hidden/input') return new Promise(resolve => { finishInput = resolve; });
      return Promise.resolve({});
    }, onFrame: value => frames.push(value.revision), onError: error => errors.push(error),
    schedule: () => assert.fail('Hidden preview must not schedule polls'), unschedule: () => {},
  });
  client.setVisible(false);
  await client.start({ tag: 'md-chip' });
  client.input({ command: 'click', x: 10, y: 20 });
  client.input({ command: 'text', text: 'queued' });
  client.stop();
  finishInput(frame('hidden', 1)); await turn();
  assert.deepEqual(calls, ['session', 'hidden/input', 'hidden/close']);
  assert.deepEqual(frames, [0]);
  assert.deepEqual(errors, []);
  assert.equal(client.input({ command: 'click', x: 0, y: 0 }), false);
});

test('native coordinates account for Retina scaling, responsive size and letterboxing', async () => {
  const { nativeImagePoint } = await import('./contracts.js');
  assert.deepEqual(nativeImagePoint({ left: 10, top: 20, width: 640, height: 100 }, 1280, 200, 640, 100, 330, 70), { x: 320, y: 50 });
  assert.deepEqual(nativeImagePoint({ left: 10, top: 20, width: 320, height: 50 }, 1280, 200, 640, 100, 170, 45), { x: 320, y: 50 });
  assert.deepEqual(nativeImagePoint({ left: 10, top: 20, width: 640, height: 400 }, 1280, 200, 640, 100, 330, 220), { x: 320, y: 50 });
  assert.equal(nativeImagePoint({ left: 10, top: 20, width: 640, height: 400 }, 1280, 200, 640, 100, 330, 50), null);
  assert.equal(nativeImagePoint({ left: 10, top: 20, width: 640, height: 100 }, 1280, 200, 640, 100, 650, 70), null);
  assert.equal(nativeImagePoint({ left: 0, top: 0, width: 0, height: 100 }, 1280, 200, 640, 100, 0, 0), null);
});

test('native text forwarding preserves Unicode across the transport byte limit', async () => {
  const { nativeTextChunks } = await import('./contracts.js');
  const text = 'Salut Ștefan 👋🏽 — 漢字\n'.repeat(1000);
  const chunks = nativeTextChunks(text);
  assert.equal(chunks.join(''), text);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(Buffer.byteLength(chunk, 'utf8') <= 4000);
    assert.equal(Buffer.from(chunk, 'utf8').toString('utf8'), chunk);
  }
  assert.deepEqual(nativeTextChunks(''), []);
});

test('native button press tracks one pointer and emits one release without a duplicate click', async () => {
  const { createNativePointerInput } = await import('./contracts.js');
  const sent = [], pointer = createNativePointerInput(command => { sent.push(command); return true; });
  assert.equal(pointer.down(7, { x: 20, y: 30 }), true);
  assert.equal(pointer.down(8, { x: 22, y: 32 }), false);
  assert.equal(pointer.up(8, { x: 22, y: 32 }), false);
  assert.equal(pointer.pointerId, 7);
  assert.equal(pointer.up(7, { x: 24, y: 34 }), true);
  assert.equal(pointer.cancel(7), false);
  assert.equal(pointer.up(7, { x: 24, y: 34 }), false);
  assert.equal(pointer.pointerId, null);
  assert.deepEqual(sent, [{ command: 'pointer', phase: 'down', x: 20, y: 30 }, { command: 'pointer', phase: 'up', x: 24, y: 34 }]);
});

test('native press cancels outside the image or on lost focus, without activating', async () => {
  const { createNativePointerInput } = await import('./contracts.js');
  const sent = [], pointer = createNativePointerInput(command => { sent.push(command); return true; });
  pointer.down(1, { x: 20, y: 30 }); pointer.up(1, null);
  pointer.down(2, { x: 40, y: 50 }); pointer.cancel(); pointer.cancel();
  assert.deepEqual(sent.map(command => command.phase), ['down', 'cancel', 'down', 'cancel']);
  assert.deepEqual(sent.at(-1), { command: 'pointer', phase: 'cancel', x: 40, y: 50 });
  assert.equal(pointer.pointerId, null);
  const disconnected = createNativePointerInput(() => false);
  assert.equal(disconnected.down(1, { x: 20, y: 30 }), false);
  assert.equal(disconnected.pointerId, null);
});

test('held native presses stream frames at transport speed, then return to idle polling', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const scheduled = [], calls = [];
  let clock = 1000, revision = 0;
  const client = createNativeLiveClient({
    send: async (route, body) => { calls.push({ route, body }); clock += 40; return frame('held', revision++); },
    onFrame: () => {}, onError: error => { throw error; }, now: () => clock,
    schedule: (callback, delay) => { const timer = { callback, delay, canceled: false }; scheduled.push(timer); return timer; },
    unschedule: timer => { if (timer) timer.canceled = true; },
  });
  await client.start({ tag: 'md-button' });
  assert.equal(scheduled.at(-1).delay, 250);
  client.input({ command: 'pointer', phase: 'down', x: 20, y: 30 }); await turn();
  assert.equal(scheduled[0].canceled, true);
  assert.equal(scheduled.at(-1).delay, 0, '40 ms native render already spent the frame budget');
  scheduled.at(-1).callback(); await turn();
  assert.equal(calls.at(-1).route, 'held/frame');
  assert.equal(scheduled.at(-1).delay, 0);
  client.input({ command: 'pointer', phase: 'up', x: 20, y: 30 }); await turn();
  assert.equal(scheduled.at(-1).delay, 0, 'release animation continues streaming');
  clock += 400; scheduled.at(-1).callback(); await turn();
  assert.equal(scheduled.at(-1).delay, 0, 'quick-press ripple still needs its growth and fade frames');
  clock += 200; scheduled.at(-1).callback(); await turn();
  assert.equal(scheduled.at(-1).delay, 250);
  client.stop();
});

test('live client retries only transient frame transport failures, never uncertain native inputs', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const scheduled = [], errors = [], revisions = [], calls = [];
  let frameAttempts = 0;
  const client = createNativeLiveClient({
    send: async route => {
      calls.push(route);
      if (route === 'session') return frame('retry', 0);
      if (route === 'retry/frame') {
        if (++frameAttempts <= 2) throw new TypeError('Failed to fetch');
        return frame('retry', 1);
      }
      if (route === 'retry/input') throw new TypeError('Connection lost after sending input');
      return {};
    },
    onFrame: value => revisions.push(value.revision), onError: error => errors.push(error),
    schedule: callback => { scheduled.push(callback); return callback; }, unschedule: () => {},
  });
  await client.start({ tag: 'md-chip' });
  for (let attempt = 0; attempt < 3; attempt++) { scheduled.shift()(); await turn(); }
  assert.equal(frameAttempts, 3);
  assert.deepEqual(revisions, [0, 1]);
  assert.deepEqual(errors, []);
  client.input({ command: 'click', x: 10, y: 10 }); await turn();
  assert.equal(calls.filter(route => route === 'retry/input').length, 1);
  assert.equal(errors.length, 1);
  assert.equal(calls.at(-1), 'retry/close');
  client.stop();
});

test('pushed native frames keep arriving while input is pending and never schedule polls', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const calls = [], frames = [], events = [], streams = [];
  let finishInput;
  const client = createNativeLiveClient({
    send: (route, body) => {
      calls.push({ route, body });
      if (route === 'session') return Promise.resolve(frame('streamed', 0));
      if (route.endsWith('/input')) return new Promise(resolve => { finishInput = resolve; });
      return Promise.resolve({});
    },
    subscribe: (id, onFrame, onError) => { const stream = { id, onFrame, onError, closed: false }; streams.push(stream); return () => { stream.closed = true; }; },
    onFrame: value => frames.push(value.revision), onEvents: value => events.push(...value), onError: error => { throw error; },
    schedule: () => assert.fail('Streaming sessions must not poll'), unschedule: () => {},
  });
  await client.start({ tag: 'md-button' });
  client.input({ command: 'pointer', phase: 'down', x: 30, y: 40 });
  streams[0].onFrame(frame('streamed', 1));
  streams[0].onFrame(frame('streamed', 2));
  const event = { id: 'click', name: 'mdClick' };
  finishInput({ sessionId: 'streamed', revision: 2, events: [event] }); await turn();
  streams[0].onFrame(frame('streamed', 3, [event]));
  assert.deepEqual(frames, [0, 1, 2, 3]);
  assert.deepEqual(events, [event]);
  assert.deepEqual(calls.map(call => call.route), ['session', 'streamed/input']);
  client.setVisible(false); assert.equal(streams[0].closed, true);
  streams[0].onFrame(frame('streamed', 4));
  client.setVisible(true); assert.equal(streams.length, 2);
  client.setVisible(true); assert.equal(streams.length, 2, 'Redundant visibility must not start duplicate streams');
  streams[1].onFrame(frame('streamed', 5));
  assert.deepEqual(frames, [0, 1, 2, 3, 5]);
  client.stop(); assert.equal(streams[1].closed, true);
  streams[1].onFrame(frame('streamed', 6));
  assert.equal(frames.at(-1), 5);
});

test('pointer motion coalesces while an input is pending without losing release order', async () => {
  const { createNativeLiveClient } = await import('./contracts.js');
  const sent = []; let finish;
  const client = createNativeLiveClient({
    send: (route, body) => {
      if (route === 'session') return Promise.resolve(frame('motion', 0));
      if (route.endsWith('/input')) { sent.push(body); return new Promise(resolve => { finish = () => resolve({ sessionId: 'motion', revision: 0, events: [] }); }); }
      return Promise.resolve({});
    }, subscribe: () => () => {}, onFrame: () => {}, onError: error => { throw error; },
  });
  await client.start({ tag: 'md-button' });
  client.input({ command: 'pointer', phase: 'down', x: 30, y: 40 });
  for (let x = 31; x < 100; x++) client.input({ command: 'pointer', phase: 'move', x, y: 40 });
  client.input({ command: 'pointer', phase: 'up', x: 99, y: 40 });
  finish(); await turn();
  assert.deepEqual(sent.map(value => [value.phase, value.x]), [['down', 30], ['move', 99]]);
  finish(); await turn();
  assert.deepEqual(sent.map(value => value.phase), ['down', 'move', 'up']);
  finish(); await turn(); client.stop();
});
