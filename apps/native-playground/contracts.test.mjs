import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createNativeLiveClient, createNativeSessionCoordinator, nativeLiveEndpoint } from './contracts.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const frame = (sessionId, platform) => ({ sessionId, revision: 1, events: [], imageUrl: 'data:image/png;base64,aA==', platform: platform === 'ios' ? 'macos' : 'android', renderer: platform === 'ios' ? 'SwiftUI' : 'Jetpack Compose', logicalWidth: 640, logicalHeight: 200 });

function fixture() {
  const coordinators = { ios: createNativeSessionCoordinator(), android: createNativeSessionCoordinator() };
  const calls = [], presented = [], errors = [], streams = [];
  const active = new Map(), counters = { ios: 0, android: 0 }, createGates = new Map(), closeGates = new Map();
  const client = platform => createNativeLiveClient({
    coordinator: coordinators[platform],
    send: async (route, payload) => {
      calls.push({ url: nativeLiveEndpoint(route, platform), payload });
      if (route === 'session') {
        assert.equal(active.has(platform), false, `Overlapping ${platform} session reservation`);
        const id = `${platform}-${++counters[platform]}`;
        active.set(platform, id);
        try { await createGates.get(id)?.promise; }
        catch (error) { active.delete(platform); throw error; }
        return frame(id, platform);
      }
      if (route.endsWith('/close')) {
        const id = route.split('/')[0];
        assert.equal(active.get(platform), id, 'Close must retain its original platform and session');
        await closeGates.get(id)?.promise;
        active.delete(platform);
        return { closed: true };
      }
      throw new Error(`Unexpected native command ${route}`);
    },
    subscribe: id => { const stream = { id, closed: false }; streams.push(stream); return () => { stream.closed = true; }; },
    onFrame: result => presented.push(result.sessionId), onError: error => errors.push(error),
  });
  return { client, active, calls, presented, errors, streams, createGates, closeGates };
}

test('rapid Android to iOS to Android waits for abandoned create and close without blocking iOS', async () => {
  const f = fixture(), created = deferred(), closed = deferred();
  f.createGates.set('android-1', created); f.closeGates.set('android-1', closed);
  const first = f.client('android'), oldStart = first.start({ tag: 'md-button' });
  await nextTurn(); first.stop();
  const ios = f.client('ios');
  await ios.start({ tag: 'md-button', scenario: 'button-behavior' });
  assert.deepEqual(f.presented, ['ios-1']);
  await ios.stop();
  const replacement = f.client('android'), newStart = replacement.start({ tag: 'md-button', scenario: 'button-behavior' });
  await nextTurn();
  assert.equal(f.calls.filter(call => call.url === '/api/native-live/session?platform=android').length, 1);
  created.resolve(); await nextTurn();
  assert.equal(f.calls.at(-1).url, '/api/native-live/android-1/close?platform=android');
  assert.equal(f.active.get('android'), 'android-1', 'Replacement must also wait for asynchronous cleanup');
  closed.resolve(); await Promise.all([oldStart, newStart]);
  assert.deepEqual(f.presented, ['ios-1', 'android-2']);
  assert.deepEqual(f.errors, []);
  assert.deepEqual(f.streams.map(stream => stream.id), ['ios-1', 'android-2']);
  await replacement.stop();
  assert.equal(f.active.size, 0);
  assert.ok(f.streams.every(stream => stream.closed));
  assert.equal(f.calls.filter(call => call.url.endsWith('/close?platform=android')).length, 2);
});

test('rapid scenario restarts skip canceled queued examples and start only after the previous close', async () => {
  const f = fixture(), closed = deferred();
  const initial = f.client('android');
  await initial.start({ tag: 'md-button' });
  f.closeGates.set('android-1', closed);
  const closing = initial.stop();
  const skipped = f.client('android'), skippedStart = skipped.start({ tag: 'md-button', scenario: 'button-behavior' });
  skipped.stop();
  const latest = f.client('android'), latestStart = latest.start({ tag: 'md-button', properties: { variant: 'outlined' } });
  await nextTurn();
  assert.equal(f.calls.filter(call => call.url.includes('/session?')).length, 1);
  assert.equal(f.streams[0].closed, true);
  closed.resolve(); await Promise.all([closing, skippedStart, latestStart]);
  const creates = f.calls.filter(call => call.url.includes('/session?'));
  assert.equal(creates.length, 2, 'Canceled queued scenario must never reserve a native session');
  assert.deepEqual(creates[1].payload, { tag: 'md-button', properties: { variant: 'outlined' } });
  assert.deepEqual(f.presented, ['android-1', 'android-2']);
  assert.deepEqual(f.errors, []);
  await latest.stop();
  assert.equal(f.active.size, 0);
});

test('failed creation releases the platform barrier and an abandoned failure cannot affect its successor', async () => {
  for (const abandoned of [false, true]) {
    const f = fixture(), created = deferred();
    f.createGates.set('android-1', created);
    const initial = f.client('android'), failedStart = initial.start({ tag: 'md-button' });
    await nextTurn();
    if (abandoned) initial.stop();
    const next = f.client('android'), nextStart = next.start({ tag: 'md-button', scenario: 'button-behavior' });
    created.reject(new Error('Native startup failed'));
    await Promise.all([failedStart, nextStart]);
    assert.equal(f.errors.length, abandoned ? 0 : 1);
    assert.deepEqual(f.presented, ['android-2']);
    await next.stop();
    assert.equal(f.active.size, 0);
  }
});
