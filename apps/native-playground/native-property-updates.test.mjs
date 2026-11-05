import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { createNativeLiveClient } from './contracts.js';
import { validateLiveInput } from './native-live.mjs';
import { dispatchRetainedPropertyEdit, nativePropertyUpdate, PROGRESS_UPDATE_PROPERTIES, SNACKBAR_UPDATE_PROPERTIES, SKELETON_UPDATE_PROPERTIES, supportsRetainedPropertyUpdates } from './native-property-updates.js';

const tag = 'md-progress-indicator';
const full = { variant: 'circular', value: -2.5, max: 0, indeterminate: false,
  thickness: 0, wave: true, waveAmplitude: 0, waveLength: 40, waveSpeed: -1,
  size: 0, fourColor: false, label: 'Încărcare', complete: true, density: -4 };
const component = { tag, support: {
  ios: { properties: PROGRESS_UPDATE_PROPERTIES }, android: { properties: PROGRESS_UPDATE_PROPERTIES },
} };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { resolve, reject, promise }; };

function fixture() {
  const calls = [], events = [], frames = [], errors = [], held = [];
  let stream, serial = 0, block = false;
  const frame = id => ({ sessionId: id, revision: 1, imageUrl: 'data:image/png;base64,aA==', events: [] });
  const client = createNativeLiveClient({
    send: async (route, payload) => {
      calls.push({ route, payload });
      if (route === 'session') return frame(`session-${++serial}`);
      if (route.endsWith('/close')) return { closed: true };
      if (block) { const gate = deferred(); held.push(gate); return gate.promise; }
      return { sessionId: route.split('/')[0], revision: 1, events: [] };
    },
    subscribe: (_id, accept) => { stream = accept; return () => {}; },
    onFrame: value => frames.push(value), onEvents: value => events.push(...value), onError: value => errors.push(value),
  });
  return { client, calls, events, frames, errors, held, block: () => { block = true; }, push: value => stream(value) };
}

test('retained Progress patch matches all source properties and preserves zero, false and negative inputs', async () => {
  const source = await readFile(new URL('../../packages/core/src/components/md-progress-indicator/md-progress-indicator.tsx', import.meta.url), 'utf8');
  const declared = [...source.matchAll(/@Prop\([^)]*\)\s+(\w+)\s*:/g)].map(match => match[1]);
  assert.deepEqual(PROGRESS_UPDATE_PROPERTIES, declared);
  const command = nativePropertyUpdate(tag, full);
  assert.deepEqual(command, { command: 'update', properties: full });
  full.label = 'Changed after validation';
  assert.equal(command.properties.label, 'Încărcare');
  full.label = 'Încărcare';
  assert.deepEqual(validateLiveInput(command, { tag }), command);
});

test('patch validation rejects other roots, privileged targets, malformed values and getters without evaluating them', () => {
  const invalid = [{}, [], null, { value: NaN }, { max: Infinity }, { complete: 'true' },
    { variant: 'radial' }, { density: -1.5 }, { label: 'ă'.repeat(2049) }, { hidden: true },
    { __proto__: { value: 3 } }, { value: null }, { size: undefined }];
  let read = false;
  invalid.push(Object.defineProperty({}, 'complete', { enumerable: true, get() { read = true; return true; } }));
  for (const patch of invalid) assert.throws(() => nativePropertyUpdate(tag, patch), { code: 'INVALID_PROPERTY_UPDATE' });
  assert.equal(read, false);
  assert.throws(() => nativePropertyUpdate('md-button', { complete: true }), { code: 'INVALID_PROPERTY_UPDATE' });
  assert.throws(() => validateLiveInput({ command: 'update', properties: { value: 1 }, target: 'other-window' }, { tag }), { status: 400 });
});

test('updates retain a session, preserve false→true edges, and acknowledge application separately from completion', async t => {
  const f = fixture(); t.after(() => f.client.stop());
  await f.client.start({ tag, properties: { complete: true, value: 37 } });
  assert.equal(f.client.canUpdate(tag), true);
  assert.equal(f.calls.length, 1, 'initial complete=true is not converted into a second mutation');
  const first = f.client.update({ complete: false }), second = f.client.update({ complete: true });
  await Promise.all([first, second]);
  assert.deepEqual(f.calls.slice(1).map(call => call.payload), [
    { command: 'update', properties: { complete: false } },
    { command: 'update', properties: { complete: true } },
  ]);
  assert.equal(f.calls.filter(call => call.route === 'session').length, 1);
  assert.deepEqual(f.events, [], 'an applied property acknowledgement must not fabricate mdComplete');
  f.push({ sessionId: 'session-1', revision: 2, events: [{ id: 'completed', name: 'mdComplete', detail: null }] });
  assert.equal(f.events.length, 1);
  assert.equal(f.frames.length, 1, 'an event-only response does not replace the rendered frame');
});

test('session replacement rejects pending and queued changes; late replies cannot update a replacement', async t => {
  const f = fixture(); t.after(() => f.client.stop());
  await f.client.start({ tag, properties: { complete: false } });
  f.block();
  const first = f.client.update({ value: 90 }), second = f.client.update({ complete: true });
  const rejected = Promise.all([assert.rejects(first, { code: 'SESSION_CLOSED' }), assert.rejects(second, { code: 'SESSION_CLOSED' })]);
  await f.client.start({ tag, properties: { complete: false, value: 0 } });
  await rejected;
  f.held[0].resolve({ sessionId: 'session-1', revision: 9, imageUrl: 'old', events: [{ id: 'old', name: 'mdComplete' }] });
  await nextTurn();
  assert.deepEqual(f.events, []);
  assert.deepEqual(f.frames.map(frame => frame.sessionId), ['session-1', 'session-2']);
  assert.equal(f.calls.filter(call => call.route.endsWith('/input')).length, 1, 'queued old complete edge was discarded');
});

test('uncertain update failure is reported once and never replayed as configure or another input', async () => {
  const f = fixture(); await f.client.start({ tag, properties: { complete: false } }); f.block();
  const pending = f.client.update({ complete: true });
  f.held[0].reject(new TypeError('Transport disconnected after applying the patch'));
  await assert.rejects(pending, /disconnected/);
  await nextTurn();
  assert.equal(f.errors.length, 1);
  assert.equal(f.calls.filter(call => call.route.endsWith('/input')).length, 1);
  assert.equal(f.calls.filter(call => call.route === 'session').length, 1);
  assert.equal(f.client.canUpdate(tag), false);
});

test('right-panel routing requires actual complete adapter declarations and a connected matching root', async () => {
  const updates = [], errors = [];
  const client = { canUpdate: target => target === tag, update: async patch => { updates.push(patch); } };
  assert.equal(supportsRetainedPropertyUpdates(component, 'web'), false);
  assert.equal(supportsRetainedPropertyUpdates({ ...component, support: { ios: { properties: ['complete'] } } }, 'ios'), false);
  assert.equal(dispatchRetainedPropertyEdit({ component, platform: 'ios', client, name: 'complete', value: true }), true);
  assert.deepEqual(updates, [{ complete: true }]);
  assert.equal(dispatchRetainedPropertyEdit({ component, platform: 'ios', client: { ...client, canUpdate: () => false }, name: 'complete', value: true }), false, 'startup/reset uses normal initial configuration');
  const failing = { ...client, update: async () => { throw new Error('Rejected by mounted host'); } };
  assert.equal(dispatchRetainedPropertyEdit({ component, platform: 'android', client: failing, name: 'complete', value: false, onError: error => errors.push(error) }), true, 'failure must not request a remount');
  await nextTurn();
  assert.equal(errors[0].message, 'Rejected by mounted host');
  assert.deepEqual(updates, [{ complete: true }]);
});

test('retained Snackbar updates cover every source property and gate legacy adapters until actual methods exist', async () => {
  const source = await readFile(new URL('../../packages/native-compiler/generated/ir/md-snackbar.json', import.meta.url), 'utf8');
  assert.deepEqual(SNACKBAR_UPDATE_PROPERTIES, JSON.parse(source).properties.map(property => property.name));
  const properties = { open: true, message: '', action: 'Undo', closeable: false, autoHide: false, autoHideDuration: -1,
    position: 'top-end', stacked: true, politeness: 'assertive', dismissLabel: 'Închide', density: -4 };
  assert.deepEqual(nativePropertyUpdate('md-snackbar', properties), { command: 'update', properties });
  const ready = { tag: 'md-snackbar', support: { ios: { properties: SNACKBAR_UPDATE_PROPERTIES, methods: ['show', 'hide'] } } };
  assert.equal(supportsRetainedPropertyUpdates(ready, 'ios'), true);
  assert.equal(supportsRetainedPropertyUpdates({ ...ready, support: { ios: { properties: SNACKBAR_UPDATE_PROPERTIES, methods: [] } } }, 'ios'), false);
  assert.equal(supportsRetainedPropertyUpdates({ ...ready, support: { ios: { ...ready.support.ios, unsupportedMethods: ['hide'] } } }, 'ios'), false);
  for (const patch of [{ open: 'true' }, { autoHideDuration: Infinity }, { position: 'left' }, { politeness: 'off' }, { dismissLabel: null }, { value: 3 }]) {
    assert.throws(() => nativePropertyUpdate('md-snackbar', patch), { code: 'INVALID_PROPERTY_UPDATE' });
  }
});

test('Snackbar property edges stay on one native instance and hover coordinates cross the bounded input route', async t => {
  const f = fixture(); t.after(() => f.client.stop());
  await f.client.start({ tag: 'md-snackbar', properties: { open: true, autoHide: false } });
  assert.equal(f.client.canUpdate('md-snackbar'), true);
  await Promise.all([f.client.update({ open: false }), f.client.update({ message: 'Updated while mounted' }), f.client.update({ open: true })]);
  assert.deepEqual(f.calls.slice(1).map(call => call.payload.properties), [{ open: false }, { message: 'Updated while mounted' }, { open: true }]);
  assert.equal(f.calls.filter(call => call.route === 'session').length, 1);
  assert.deepEqual(f.events, [], 'property ACK must not synthesize lifecycle events');
  const hover = validateLiveInput({ command: 'pointer', phase: 'move', x: 25, y: 30 }, { tag: 'md-snackbar', logicalWidth: 360, logicalHeight: 480 });
  assert.deepEqual(hover, { command: 'pointer', phase: 'move', x: 25, y: 30 });
  assert.equal(validateLiveInput({ command: 'pointer', phase: 'move', x: 400, y: 30 }, { tag: 'md-snackbar', logicalWidth: 360, logicalHeight: 480 }).phase, 'leave');
});

test('Skeleton retained schema matches all ten source properties and preserves authored relative lengths', async () => {
  const source = JSON.parse(await readFile(new URL('../../packages/native-compiler/generated/ir/md-skeleton.json', import.meta.url), 'utf8'));
  assert.deepEqual(SKELETON_UPDATE_PROPERTIES, source.properties.map(property => property.name));
  const properties = { variant: 'text', animation: 'wave', lines: 3.5, width: 'calc(100% - 48px)', height: '2em', fullWidth: false, fullHeight: true, ariaLabelProp: 'Încărcare', announce: true, density: -3 };
  assert.deepEqual(nativePropertyUpdate('md-skeleton', properties), { command: 'update', properties });
  for (const patch of [{ variant: 'linear' }, { animation: 'spin' }, { lines: Infinity }, { width: 200 }, { height: null }, { announce: 'true' }, { fullWidth: 1 }, { density: -5 }, { complete: true }]) {
    assert.throws(() => nativePropertyUpdate('md-skeleton', patch), { code: 'INVALID_PROPERTY_UPDATE' });
  }
  for (const platform of ['ios', 'android']) {
    const ready = { tag: 'md-skeleton', support: { [platform]: { properties: SKELETON_UPDATE_PROPERTIES } } };
    assert.equal(supportsRetainedPropertyUpdates(ready, platform), true);
    ready.support[platform].unsupportedProperties = ['animation'];
    assert.equal(supportsRetainedPropertyUpdates(ready, platform), false);
  }
});

test('Skeleton right-panel edits retain one session and preserve every change edge without inventing events', async t => {
  const f = fixture(); t.after(() => f.client.stop());
  await f.client.start({ tag: 'md-skeleton', properties: { animation: 'none' } });
  const ready = { tag: 'md-skeleton', support: { ios: { properties: SKELETON_UPDATE_PROPERTIES } } };
  for (const [name, value] of [['lines', 3], ['animation', 'wave'], ['width', '80%'], ['announce', false]]) {
    assert.equal(dispatchRetainedPropertyEdit({ component: ready, platform: 'ios', client: f.client, name, value }), true);
  }
  await nextTurn();
  assert.equal(f.calls.filter(call => call.route === 'session').length, 1);
  assert.deepEqual(f.calls.filter(call => call.route.endsWith('/input')).map(call => call.payload.properties), [{ lines: 3 }, { animation: 'wave' }, { width: '80%' }, { announce: false }]);
  assert.deepEqual(f.events, []);
});
