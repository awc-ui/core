import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay, setImmediate as nextTurn } from 'node:timers/promises';
import { createNativeLiveRenderer, validateLiveInput } from './native-live.mjs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8l8AAAAASUVORK5CYII=';
const request = { tag: 'md-text-field', properties: { value: '' }, dark: false, width: 640 };
const bounds = { logicalWidth: 640, logicalHeight: 200 };
const errorCode = code => error => error.code === code;

class FakeChild extends EventEmitter {
  constructor({ auto = true, ignoreTerm = false } = {}) {
    super();
    this.auto = auto;
    this.ignoreTerm = ignoreTerm;
    this.commands = [];
    this.signals = [];
    this.value = '';
    this.selected = false;
    this.held = false;
    this.streaming = false;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.stdin = new Writable({ write: (data, _encoding, done) => {
      const command = JSON.parse(data.toString());
      this.commands.push(command);
      if (this.auto) queueMicrotask(() => this.respond(command));
      done();
    } });
  }

  respond(command = this.commands.at(-1), changes = {}) {
    const events = [];
    if (command.command === 'configure') this.value = command.properties.value ?? '';
    if (command.command === 'click') {
      this.selected = !this.selected;
      events.push({ name: 'mdChange', tag: request.tag, nodeID: 'component', detail: { selected: this.selected } });
    }
    if (command.command === 'text') {
      this.value += command.text;
      events.push({ name: 'mdInput', tag: request.tag, nodeID: 'component', detail: { value: this.value } });
    }
    if (command.command === 'pointer') {
      if (command.phase === 'down') this.held = true;
      else if (['up', 'cancel'].includes(command.phase)) {
        if (command.phase === 'up' && this.held) {
          this.selected = !this.selected;
          events.push({ name: 'mdClick', tag: 'md-button', nodeID: 'component', detail: { selected: this.selected } });
        }
        this.held = false;
      }
    }
    if (command.command === 'resize') changes = { ack: true, logicalWidth: command.width, logicalHeight: command.height, ...changes };
    if (command.command === 'stream') this.streaming = command.enabled;
    if (command.command === 'stream' || (this.streaming && command.command !== 'frame' && command.command !== 'resize')) {
      this.stdout.write(`${JSON.stringify({ id: command.id, ack: true, events, ...changes })}\n`);
      return;
    }
    this.stdout.write(`${JSON.stringify({ id: command.id, png: PNG, width: 1, height: 1, ...bounds, events, ...changes })}\n`);
  }

  pushFrame(changes = {}) {
    this.stdout.write(`${JSON.stringify({ kind: 'frame', id: null, png: PNG, width: 1, height: 1, ...bounds, events: [], ...changes })}\n`);
  }

  kill(signal) {
    this.signals.push(signal);
    if (signal === 'SIGTERM' && this.ignoreTerm) return true;
    if (!this.exited) {
      this.exited = true;
      this.stdout.end();
      this.stderr.end();
      this.stdin.destroy();
      this.emit('exit', null, signal);
      this.emit('close', null, signal);
    }
    return true;
  }
}

function fixture(t, options = {}, childOptions = {}) {
  const children = [];
  const renderer = createNativeLiveRenderer({
    repoRoot: process.cwd(), executable: process.execPath, platform: 'darwin',
    spawnProcess(binary, args, spawnOptions) {
      assert.equal(binary, process.execPath);
      assert.deepEqual(args, ['--stdio']);
      assert.equal(spawnOptions.shell, false);
      assert.deepEqual(spawnOptions.stdio, ['pipe', 'pipe', 'pipe']);
      const child = new FakeChild(childOptions);
      children.push(child);
      return child;
    },
    ...options,
  });
  t.after(() => renderer.dispose());
  return { renderer, children };
}

test('SwiftUI forwards measured native layout only with the frame that reported it', async t => {
  const { renderer, children } = fixture(t, {}, { auto: false });
  const pending = renderer.create(request);
  while (!children[0]?.commands.length) await nextTurn();
  const inspection = { version: 1, unit: 'pt', source: 'SwiftUI layout',
    nodes: [{ id: 'component', name: request.tag, bounds: { x: 24, y: 24, width: 592, height: 56 },
      metrics: { padding: [0, 24, 0, 24], gap: { row: 0, column: 8 }, direction: 'ltr' } },
    { id: 'component.label', parentId: 'component', name: 'Label', bounds: { x: 280, y: 40, width: 80, height: 24 },
      metrics: { typography: { size: 16, lineHeight: 24, weight: 500, spacing: 0.15, family: 'Roboto', unit: 'pt' } } }] };
  children[0].respond(undefined, { inspection });
  const initial = await pending;
  assert.deepEqual(initial.inspection, inspection);
  children[0].auto = true;
  const next = await renderer.frame(initial.sessionId);
  assert.equal(Object.hasOwn(next, 'inspection'), false, 'a frame without metadata must not reuse previous geometry');
});

for (const scenario of ['button-behavior', 'navigation-events', 'focus-accessibility']) test(`SwiftUI receives ${scenario} without polluting component properties`, async t => {
  const { renderer, children } = fixture(t);
  await renderer.create({ ...request, tag: 'md-button', scenario });
  assert.equal(children[0].commands[0].scenario, scenario);
  assert.deepEqual(children[0].commands[0].properties, request.properties);
});

test('SwiftUI configure receives validated theme colors and direction separately from properties', async t => {
  const { renderer, children } = fixture(t);
  await renderer.create({ ...request, themeTokens: { '--md-sys-color-primary': '#007733' }, direction: 'rtl' });
  assert.deepEqual(children[0].commands[0].themeTokens, { '--md-sys-color-primary': '#007733' });
  assert.equal(children[0].commands[0].direction, 'rtl');
  assert.deepEqual(children[0].commands[0].properties, request.properties);
});

for (const text of [undefined, '', 'Continuă 👋 <b>literal</b>']) test(`SwiftUI configure preserves ${text === undefined ? 'absent' : text === '' ? 'empty' : 'literal Unicode'} button text`, async t => {
  const { renderer, children } = fixture(t);
  const properties = { icon: 'add', trailingIcon: 'arrow_forward', selected: false };
  await renderer.create({ ...request, tag: 'md-button', properties, ...(text !== undefined ? { text } : {}) });
  const command = children[0].commands[0];
  assert.equal(Object.hasOwn(command, 'text'), text !== undefined);
  assert.equal(command.text, text);
  assert.deepEqual(command.properties, properties);
});

test('live input accepts only bounded view-local coordinates, Unicode text, and known keys', () => {
  assert.deepEqual(validateLiveInput({ command: 'click', x: 0, y: 199.5 }, bounds), { command: 'click', x: 0, y: 199.5 });
  assert.deepEqual(validateLiveInput({ command: 'text', text: 'Salut, România 👋' }, bounds), { command: 'text', text: 'Salut, România 👋' });
  assert.deepEqual(validateLiveInput({ command: 'key', key: 'Tab', modifiers: ['shift'] }, bounds), { command: 'key', key: 'Tab', modifiers: ['shift'] });
  for (const value of [null, [], {}, { command: 'configure' }, { command: 'click', x: NaN, y: 0 }, { command: 'click', x: Infinity, y: 0 },
    { command: 'click', x: -1, y: 0 }, { command: 'click', x: 640, y: 0 }, { command: 'click', x: 0, y: 200 }, { command: 'click', x: '1', y: 1 },
    { command: 'click', x: 1, y: 1, selector: 'other-window' }, { command: 'text', text: '' }, { command: 'text', text: '\0' },
    { command: 'text', text: 'ă'.repeat(2049) }, { command: 'key', key: 'LaunchApplication' }, { command: 'key', key: 'Tab', modifiers: ['root'] },
    { command: 'key', key: 'Tab', modifiers: ['shift', 'shift'] }, { command: 'key', key: 'Tab', modifiers: 'shift' }]) {
    assert.throws(() => validateLiveInput(value, bounds), error => error.status === 400);
  }
});

test('SwiftUI property updates reach the retained process without a second configuration', async t => {
  const { renderer, children } = fixture(t);
  const initial = await renderer.create({ ...request, tag: 'md-progress-indicator', properties: { value: 37, complete: false } });
  await renderer.input(initial.sessionId, { command: 'update', properties: { complete: true } });
  await renderer.input(initial.sessionId, { command: 'update', properties: { complete: false, value: 0 } });
  assert.equal(children.length, 1);
  assert.deepEqual(children[0].commands.map(command => command.command), ['configure', 'update', 'update']);
  assert.deepEqual(children[0].commands[1].properties, { complete: true });
  assert.deepEqual(children[0].commands[2].properties, { complete: false, value: 0 });
  await assert.rejects(renderer.input(initial.sessionId, { command: 'update', properties: { tag: 'md-button' } }), errorCode('INVALID_PROPERTY_UPDATE'));
});

test('pointer input is scoped to buttons, validates phases, and converts outside releases to cancellation', () => {
  const button = { ...bounds, tag: 'md-button' };
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'down', x: 20.5, y: 50 }, button), { command: 'pointer', phase: 'down', x: 20.5, y: 50 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'up', x: -10, y: 500 }, button), { command: 'pointer', phase: 'cancel', x: 0, y: 199.999 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'cancel', x: 700, y: -1 }, button), { command: 'pointer', phase: 'cancel', x: 639.999, y: 0 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'move', x: 20, y: 30 }, button), { command: 'pointer', phase: 'move', x: 20, y: 30 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'move', x: -10, y: 500 }, button), { command: 'pointer', phase: 'leave', x: 0, y: 199.999 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'leave', x: 700, y: -1 }, button), { command: 'pointer', phase: 'leave', x: 639.999, y: 0 });
  for (const value of [
    { command: 'pointer', phase: 'down', x: -1, y: 20 },
    { command: 'pointer', phase: 'down', x: 640, y: 20 },
    { command: 'pointer', phase: 'drag-global-window', x: 20, y: 20 },
    { command: 'pointer', phase: 'up', x: Infinity, y: 20 },
    { command: 'pointer', phase: 'cancel', x: 20, y: NaN },
    { command: 'pointer', phase: 'down', x: 20, y: 20, button: 'right' },
  ]) assert.throws(() => validateLiveInput(value, button), error => error.status === 400);
  assert.throws(() => validateLiveInput({ command: 'pointer', phase: 'down', x: 20, y: 20 }, { ...bounds, tag: 'md-chip' }), errorCode('INVALID_POINTER'));
});

test('held pointer commands retain one process and do not synthesize click or release while polling', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create({ ...request, tag: 'md-button', properties: { toggle: true } });
  const down = await renderer.input(sessionId, { command: 'pointer', phase: 'down', x: 20, y: 30 });
  assert.deepEqual(down.events, []);
  assert.equal(children[0].held, true);
  assert.deepEqual((await renderer.frame(sessionId)).events, []);
  assert.equal(children[0].held, true);
  const up = await renderer.input(sessionId, { command: 'pointer', phase: 'up', x: 20, y: 30 });
  assert.equal(up.events[0].name, 'mdClick');
  assert.equal(children[0].held, false);
  await renderer.input(sessionId, { command: 'pointer', phase: 'down', x: 20, y: 30 });
  const canceled = await renderer.input(sessionId, { command: 'pointer', phase: 'up', x: 800, y: 30 });
  assert.deepEqual(canceled.events, []);
  assert.equal(children[0].held, false);
  assert.equal(children[0].commands.at(-1).phase, 'cancel');
  assert.deepEqual(children[0].commands.map(command => command.command), ['configure', 'pointer', 'frame', 'pointer', 'pointer', 'pointer']);
});

test('a queued release outside newly resized bounds is canceled before reaching the renderer', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create({ ...request, tag: 'md-button' });
  const child = children[0];
  await renderer.input(sessionId, { command: 'pointer', phase: 'down', x: 500, y: 30 });
  child.auto = false;
  const resize = renderer.frame(sessionId);
  const release = renderer.input(sessionId, { command: 'pointer', phase: 'up', x: 500, y: 30 });
  child.respond(undefined, { logicalWidth: 320 });
  await resize;
  assert.equal(child.commands.at(-1).phase, 'cancel');
  assert.equal(child.commands.at(-1).x, 319.999);
  child.respond();
  assert.deepEqual((await release).events, []);
  assert.equal(child.held, false);
});

test('a persistent process receives configure once and serializes actions and frame requests', async t => {
  const { renderer, children } = fixture(t);
  assert.equal((await renderer.status()).available, true);
  const initial = await renderer.create(request);
  assert.equal(initial.platform, 'macos');
  assert.equal(initial.renderer, 'SwiftUI');
  assert.equal(initial.revision, 1);
  assert.equal(initial.imageUrl, `data:image/png;base64,${PNG}`);
  const child = children[0];
  child.auto = false;
  const clickPromise = renderer.input(initial.sessionId, { command: 'click', x: 20, y: 30 });
  const framePromise = renderer.frame(initial.sessionId);
  const textPromise = renderer.input(initial.sessionId, { command: 'text', text: 'Salut' });
  assert.equal(child.commands.length, 2);
  child.respond();
  const clicked = await clickPromise;
  assert.equal(clicked.events[0].detail.selected, true);
  assert.equal(clicked.events[0].id, `${initial.sessionId}:1`);
  assert.equal(child.commands.at(-1).command, 'frame');
  child.respond();
  const refreshed = await framePromise;
  assert.deepEqual(refreshed.events, []);
  assert.equal(refreshed.revision, 3);
  assert.equal(child.commands.at(-1).command, 'text');
  child.respond();
  const typed = await textPromise;
  assert.equal(typed.events[0].detail.value, 'Salut');
  assert.equal(typed.events[0].id, `${initial.sessionId}:2`);
  assert.equal(typed.revision, 4);
  child.auto = true;
  const more = await renderer.input(initial.sessionId, { command: 'text', text: ' lume' });
  assert.equal(more.events[0].detail.value, 'Salut lume');
  assert.deepEqual(child.commands.map(command => command.command), ['configure', 'click', 'frame', 'text', 'text']);
  assert.equal(children.length, 1);
  assert.deepEqual(renderer.close(initial.sessionId), { sessionId: initial.sessionId, closed: true });
  assert.deepEqual(child.signals, ['SIGTERM']);
  await assert.rejects(renderer.frame(initial.sessionId), errorCode('SESSION_NOT_FOUND'));
});

test('capacity is reserved before configure completes, and closing releases it', async t => {
  const { renderer, children } = fixture(t, {}, { auto: false });
  const firstPromise = renderer.create(request);
  const secondPromise = renderer.create(request);
  while (children.length < 2) await nextTurn();
  await assert.rejects(renderer.create(request), errorCode('LIVE_RENDERER_BUSY'));
  children[0].respond(); children[1].respond();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.notEqual(first.sessionId, second.sessionId);
  renderer.close(first.sessionId);
  const thirdPromise = renderer.create(request);
  while (children.length < 3) await nextTurn();
  children[2].respond();
  const third = await thirdPromise;
  assert.notEqual(third.sessionId, first.sessionId);
});

test('invalid input never reaches SwiftUI and pending input is bounded and rejected on close', async t => {
  const { renderer, children } = fixture(t, { maxPending: 2 });
  const { sessionId } = await renderer.create(request);
  const child = children[0];
  await assert.rejects(renderer.input(sessionId, { command: 'click', x: -5, y: 0 }), errorCode('INVALID_COORDINATES'));
  assert.equal(child.commands.length, 1);
  child.auto = false;
  const pending = assert.rejects(renderer.frame(sessionId), errorCode('SESSION_CLOSED'));
  const queued = assert.rejects(renderer.input(sessionId, { command: 'text', text: 'queued' }), errorCode('SESSION_CLOSED'));
  await assert.rejects(renderer.frame(sessionId), errorCode('LIVE_INPUT_BUSY'));
  assert.equal(child.commands.length, 2);
  renderer.close(sessionId);
  await Promise.all([pending, queued]);
});

test('queued coordinates are checked again after an earlier action resizes the preview', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create(request);
  const child = children[0];
  child.auto = false;
  const resize = renderer.frame(sessionId);
  const click = assert.rejects(renderer.input(sessionId, { command: 'click', x: 500, y: 30 }), errorCode('INVALID_COORDINATES'));
  child.respond(undefined, { logicalWidth: 320 });
  await resize;
  await click;
  assert.equal(child.commands.length, 2);
});

test('idle expiry and command timeout stop processes and allow new sessions', async t => {
  const idle = fixture(t, { ttlMs: 20 });
  const initial = await idle.renderer.create(request);
  await delay(50);
  assert.deepEqual(idle.children[0].signals, ['SIGTERM']);
  await assert.rejects(idle.renderer.frame(initial.sessionId), errorCode('SESSION_NOT_FOUND'));
  assert.ok((await idle.renderer.create(request)).sessionId);

  const timeout = fixture(t, { commandTimeoutMs: 20 }, { auto: false });
  await assert.rejects(timeout.renderer.create(request), errorCode('LIVE_COMMAND_TIMEOUT'));
  assert.deepEqual(timeout.children[0].signals, ['SIGTERM']);
});

test('unexpected exits and spawn errors reject every waiting request without leaking capacity', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create(request);
  children[0].auto = false;
  const pending = assert.rejects(renderer.frame(sessionId), errorCode('LIVE_PROCESS_EXITED'));
  const queued = assert.rejects(renderer.frame(sessionId), errorCode('LIVE_PROCESS_EXITED'));
  children[0].kill('SIGKILL');
  await Promise.all([pending, queued]);
  assert.ok((await renderer.create(request)).sessionId);

  const failed = fixture(t, { spawnProcess: () => { throw new Error('spawn failed'); } });
  await assert.rejects(failed.renderer.create(request), errorCode('LIVE_PROCESS_FAILED'));
  await assert.rejects(failed.renderer.create(request), errorCode('LIVE_PROCESS_FAILED'));
});

test('oversized output, malformed metadata, and unsolicited response ids terminate the session', async t => {
  for (const corrupt of [
    child => child.stdout.write('x'.repeat(1025)),
    child => child.stdout.write('not JSON\n'),
    child => child.respond(undefined, { id: 'another-session' }),
    child => child.respond(undefined, { png: 'YWJjZA==' }),
    child => child.respond(undefined, { width: 2 }),
    child => child.respond(undefined, { logicalHeight: -1 }),
    child => child.respond(undefined, { events: [{ name: 'mdInput' }] }),
    child => child.respond(undefined, { error: 'renderer failed' }),
  ]) {
    const { renderer, children } = fixture(t, { maxLineBytes: 1024 });
    const { sessionId } = await renderer.create(request);
    const child = children[0];
    child.auto = false;
    const pending = assert.rejects(renderer.frame(sessionId), error => error.status === 502);
    corrupt(child);
    await pending;
    assert.deepEqual(child.signals, ['SIGTERM']);
    await assert.rejects(renderer.frame(sessionId), errorCode('SESSION_NOT_FOUND'));
    renderer.dispose();
  }
});

test('split JSON lines are reassembled and excessive diagnostic output is bounded', async t => {
  const { renderer, children } = fixture(t, { maxStderrBytes: 16 });
  const { sessionId } = await renderer.create(request);
  const child = children[0];
  child.auto = false;
  const frame = renderer.frame(sessionId);
  const line = `${JSON.stringify({ id: child.commands.at(-1).id, png: PNG, width: 1, height: 1, ...bounds, events: [] })}\n`;
  child.stdout.write(line.slice(0, 10));
  child.stdout.write(line.slice(10));
  assert.equal((await frame).revision, 2);
  const pending = assert.rejects(renderer.frame(sessionId), errorCode('LIVE_OUTPUT_LIMIT'));
  child.stderr.write('01234567890123456');
  await pending;
  assert.deepEqual(child.signals, ['SIGTERM']);
});

test('unresponsive children are force-killed and dispose removes its exit handler', async t => {
  const listeners = process.listenerCount('exit');
  const { renderer, children } = fixture(t, { killGraceMs: 10 }, { ignoreTerm: true });
  const { sessionId } = await renderer.create(request);
  renderer.close(sessionId);
  await delay(30);
  assert.deepEqual(children[0].signals, ['SIGTERM', 'SIGKILL']);
  await renderer.create(request);
  renderer.dispose();
  assert.deepEqual(children[1].signals, ['SIGTERM', 'SIGKILL']);
  assert.equal(process.listenerCount('exit'), listeners);
  assert.equal((await renderer.status()).available, false);
  await assert.rejects(renderer.create(request), errorCode('LIVE_RENDERER_UNAVAILABLE'));
});

test('pushed frames interleave with separate input acknowledgements without frame polling', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create(request);
  const frames = [], errors = [];
  const unsubscribe = renderer.subscribe(sessionId, frame => frames.push(frame), error => errors.push(error));
  await nextTurn();
  const child = children[0];
  assert.equal(child.streaming, true);
  assert.throws(() => renderer.subscribe(sessionId, () => {}, () => {}), errorCode('STREAM_EXISTS'));
  child.auto = false;
  const typing = renderer.input(sessionId, { command: 'text', text: 'Salut 👋' });
  child.pushFrame({ events: [{ id: 'native-event-1', name: 'mdFocus', tag: request.tag, nodeID: 'component', detail: null, defaultPrevented: false, propagationPath: ['component', 'root'], activation: { id: 'input-1', kind: 'nativeControl' } }] });
  assert.equal(frames.length, 1);
  assert.equal(frames[0].revision, 2);
  assert.equal(frames[0].events[0].id, 'native-event-1');
  assert.deepEqual(frames[0].events[0].propagationPath, ['component', 'root']);
  assert.equal(frames[0].events[0].activation.id, 'input-1');
  assert.equal(frames[0].events[0].defaultPrevented, false);
  child.respond();
  const ack = await typing;
  assert.equal(ack.imageUrl, undefined, 'input ACK must not introduce a second image pipeline');
  assert.equal(ack.events.length, 1);
  assert.equal(ack.events[0].detail.value, 'Salut 👋');
  child.pushFrame();
  assert.deepEqual(frames.map(frame => frame.revision), [2, 3]);
  assert.deepEqual(frames[1].events, []);
  assert.equal(child.commands.some(command => command.command === 'frame'), false);
  child.auto = true;
  unsubscribe(); unsubscribe(); await nextTurn();
  assert.deepEqual(child.commands.filter(command => command.command === 'stream').map(command => command.enabled), [true, false]);
  assert.equal(child.streaming, false);
  assert.deepEqual(errors, []);
});

test('detaching a stream retains bounded events from in-flight frames for the next subscriber', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create(request);
  const first = [], resumed = [];
  const unsubscribe = renderer.subscribe(sessionId, frame => first.push(frame), () => {});
  await nextTurn();
  const child = children[0];
  child.auto = false;
  unsubscribe();
  for (let index = 0; index < 270; index++) child.pushFrame({ events: [{ id: `native:${index}`, name: 'mdInput', tag: request.tag, nodeID: 'component', detail: index }] });
  assert.deepEqual(first, []);
  child.respond(); await nextTurn();
  child.auto = true;
  const stopResumed = renderer.subscribe(sessionId, frame => resumed.push(frame), () => {});
  await nextTurn();
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].events.length, 256);
  assert.equal(resumed[0].events[0].id, 'native:14');
  assert.equal(resumed[0].events.at(-1).id, 'native:269');
  stopResumed();
});

test('malformed pushed output closes the stream and rejects pending input exactly once', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create(request);
  const errors = [];
  renderer.subscribe(sessionId, () => assert.fail('Invalid frame must not render'), error => errors.push(error));
  await nextTurn();
  const child = children[0]; child.auto = false;
  const pending = assert.rejects(renderer.input(sessionId, { command: 'text', text: 'pending' }), errorCode('INVALID_LIVE_FRAME'));
  child.pushFrame({ png: 'YWJjZA==' });
  await pending;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'INVALID_LIVE_FRAME');
  assert.deepEqual(child.signals, ['SIGTERM']);
  await assert.rejects(renderer.frame(sessionId), errorCode('SESSION_NOT_FOUND'));
});

test('unsupported platforms and absent executables do not spawn native processes', async t => {
  for (const options of [{ platform: 'linux' }, { executable: '/does/not/exist/AWCLivePreview' }]) {
    const { renderer, children } = fixture(t, options);
    assert.equal((await renderer.status()).available, false);
    await assert.rejects(renderer.create(request), errorCode('LIVE_RENDERER_UNAVAILABLE'));
    assert.equal(children.length, 0);
  }
});

test('Swift group frames carry actual ordered child selection separately from exact event payloads', async t => {
  const { renderer, children } = fixture(t, {}, { auto: false });
  const config = { ...request, tag: 'md-button-group', properties: { selectionMode: 'multi-select' }, buttonGroupSelection: [true, false, false], buttonGroupAppearance: { gap: 6 } };
  const pending = renderer.create(config);
  while (!children[0]?.commands.length) await nextTurn();
  assert.deepEqual(children[0].commands[0].buttonGroupSelection, [true, false, false]);
  assert.deepEqual(children[0].commands[0].buttonGroupAppearance, { gap: 6 });
  const detail = { values: ['same'], added: ['same'], removed: [] };
  children[0].respond(undefined, { buttonGroupSelection: [false, true, false], events: [{ name: 'mdSelectionChange', tag: 'md-button-group', nodeID: 'component', detail }] });
  const frame = await pending;
  assert.deepEqual(frame.buttonGroupSelection, [false, true, false]);
  assert.deepEqual(frame.events[0].detail, detail);
  const next = renderer.input(frame.sessionId, { command: 'pointer', phase: 'down', x: 20, y: 20 });
  while (children[0].commands.length < 2) await nextTurn();
  children[0].respond(undefined, { buttonGroupSelection: ['false'] });
  await assert.rejects(next, { code: 'INVALID_LIVE_FRAME' });
});

test('Swift segmented frames correlate actual selection with the configured composition and preserve proposal detail', { timeout: 3000 }, async t => {
  const { renderer, children } = fixture(t, {}, { auto: false });
  const segmentedContext = { mode: 'set', multiselect: true, density: -2, selection: [true, false, false] };
  const pending = renderer.create({ ...request, tag: 'md-segmented-button', properties: { value: 'same' }, segmentedContext, segmentedButtonAppearance: { iconSize: 20 }, slots: { icon: { kind: 'symbol', value: 'favorite' } } });
  while (!children[0]?.commands.length) await nextTurn();
  assert.deepEqual(children[0].commands[0].segmentedContext, segmentedContext);
  assert.deepEqual(children[0].commands[0].segmentedButtonAppearance, { iconSize: 20 });
  const detail = { value: 'same', selected: true };
  children[0].respond(undefined, { segmentedSelection: [false, true, true], events: [{ name: 'mdSegmentClick', tag: 'md-segmented-button', nodeID: 'component', detail }] });
  const frame = await pending;
  assert.deepEqual(frame.segmentedSelection, [false, true, true]);
  assert.deepEqual(frame.events[0].detail, detail, 'ordered state never rewrites a proposal event');
  const next = renderer.input(frame.sessionId, { command: 'pointer', phase: 'down', x: 20, y: 20 });
  while (children[0].commands.length < 2) await nextTurn();
  children[0].respond(undefined, { segmentedSelection: [] });
  await assert.rejects(next, { code: 'INVALID_LIVE_FRAME' });
});

test('Swift split frames preserve committed Boolean state independently of notifications', { timeout: 3000 }, async t => {
  const { renderer, children } = fixture(t, {}, { auto: false });
  const pending = renderer.create({ ...request, tag: 'md-split-button', properties: { trailingChecked: true, label: 'Create' }, splitButtonAppearance: { iconSize: 20 }, slots: { '': ' project' } });
  while (!children[0]?.commands.length) await nextTurn();
  assert.deepEqual(children[0].commands[0].splitButtonAppearance, { iconSize: 20 });
  assert.equal(children[0].commands[0].properties.label, 'Create');
  children[0].respond(undefined, { splitButtonChecked: false, events: [{ name: 'mdLeadingClick', tag: 'md-split-button', nodeID: 'component', detail: null }] });
  const frame = await pending;
  assert.equal(frame.splitButtonChecked, false);
  assert.equal(frame.events[0].detail, null, 'frame state does not invent a leading-event payload');
  const next = renderer.input(frame.sessionId, { command: 'pointer', phase: 'down', x: 20, y: 20 });
  while (children[0].commands.length < 2) await nextTurn();
  children[0].respond(undefined, { splitButtonChecked: 'false' });
  await assert.rejects(next, { code: 'INVALID_LIVE_FRAME' });
});

test('SwiftUI forwards FAB method commands unchanged and awaits their acknowledgement independently of frames', async t => {
  const { renderer, children } = fixture(t);
  const initial = await renderer.create({ ...request, tag: 'md-fab', properties: { icon: 'add' }, slots: { icon: { kind: 'symbol', value: 'edit' } }, fabAppearance: { iconSize: 28 } });
  const child = children[0], frames = [];
  assert.deepEqual(child.commands[0].fabAppearance, { iconSize: 28 });
  const unsubscribe = renderer.subscribe(initial.sessionId, frame => frames.push(frame), () => {});
  await nextTurn(); child.auto = false;
  for (const value of ['close', '', ' ', null]) {
    let complete = false;
    const pending = renderer.input(initial.sessionId, { command: 'method', method: 'setMenuIcon', arguments: [value] }).then(result => { complete = true; return result; });
    const command = child.commands.at(-1);
    assert.deepEqual({ ...command, id: undefined }, { id: undefined, command: 'method', method: 'setMenuIcon', arguments: [value] });
    child.pushFrame(); await nextTurn();
    assert.equal(complete, false, 'a frame is not the method acknowledgement');
    child.respond();
    const result = await pending;
    assert.equal(result.imageUrl, undefined);
    assert.deepEqual(result.events, []);
  }
  assert.equal(frames.length, 4);
  assert.equal(child.commands.filter(command => command.command === 'configure').length, 1, 'temporary method state never changes authored configuration');
  child.auto = true; unsubscribe();
  await assert.rejects(renderer.input(initial.sessionId, { command: 'method', method: 'whenClosed', arguments: [] }), { code: 'INVALID_METHOD' });
});

test('SwiftUI lifecycle acceptance and result queries leave the input queue free for a later close', async t => {
  const { renderer, children } = fixture(t);
  const { sessionId } = await renderer.create({ ...request, tag:'md-fab-menu' });
  const child=children[0]; child.auto=false;
  const waiting={command:'method',target:'component',callId:'wait-1',method:'whenClosed',arguments:[]};
  const accepted=renderer.input(sessionId,waiting);
  child.respond(undefined,{ack:true,methodCall:{callId:'wait-1',status:'accepted'}});
  assert.deepEqual((await accepted).methodCall,{callId:'wait-1',status:'accepted'});
  const close=renderer.input(sessionId,{...waiting,callId:'close-1',method:'close'});
  child.respond(undefined,{ack:true,methodCall:{callId:'close-1',status:'accepted'}});
  await close;
  assert.deepEqual(child.commands.filter(command=>command.command==='method').map(command=>command.method),['whenClosed','close']);
  const query={command:'method-results',callIds:['wait-1','close-1'],acknowledged:[]};
  const pending=renderer.input(sessionId,query);
  child.respond(undefined,{ack:true,methodResults:[{callId:'wait-1',status:'pending'},{callId:'close-1',status:'fulfilled'}]});
  assert.deepEqual((await pending).methodResults,[{callId:'wait-1',status:'pending'},{callId:'close-1',status:'fulfilled'}]);
  const invalid=assert.rejects(renderer.input(sessionId,query),{code:'INVALID_METHOD_RESULT'});
  child.respond(undefined,{ack:true,methodResults:[{callId:'wrong',status:'fulfilled'}]});
  await invalid;
});


test('SwiftUI receives actual Snackbar viewport height outside component properties', async t => {
  const { renderer, children } = fixture(t);
  await renderer.create({ ...request, tag: 'md-snackbar', width: 360, height: 480, properties: { position: 'top-end' } });
  const command = children[0].commands[0];
  assert.equal(command.width, 360);
  assert.equal(command.height, 480);
  assert.deepEqual(command.properties, { position: 'top-end' });
});


test('SwiftUI forwards a bounded retained Snackbar resize on the existing process', async t => {
  const { renderer, children } = fixture(t);
  const initial = await renderer.create({ ...request, tag: 'md-snackbar', height: 310 });
  const resized = await renderer.input(initial.sessionId, { command: 'resize', width: 2999, height: 5000 });
  assert.equal(resized.logicalWidth, 1200); assert.equal(resized.logicalHeight, 1666);
  assert.match(resized.imageUrl, /^data:image\/png;base64,/);
  assert.ok(resized.revision > initial.revision);
  await renderer.input(initial.sessionId, { command: 'click', x: 1100, y: 1500 });
  assert.equal(children.length, 1);
  assert.equal(children[0].commands.filter(command => command.command === 'configure').length, 1);
  const { command, width, height } = children[0].commands.find(command => command.command === 'resize');
  assert.deepEqual({ command, width, height }, { command: 'resize', width: 1200, height: 1666 });
});

for (const invalid of [{ ack: false }, { logicalWidth: 640 }, { logicalHeight: 200 }, { png: undefined }]) test(`SwiftUI rejects an uncommitted resize reply ${JSON.stringify(invalid)}`, async t => {
  const { renderer, children } = fixture(t);
  const initial = await renderer.create({ ...request, tag: 'md-snackbar' });
  children[0].auto = false;
  const rejected = assert.rejects(renderer.input(initial.sessionId, { command: 'resize', width: 360, height: 480 }), { code: 'png' in invalid ? 'INVALID_LIVE_FRAME' : 'INVALID_VIEWPORT_FRAME' });
  children[0].respond(undefined, invalid);
  await rejected;
});
