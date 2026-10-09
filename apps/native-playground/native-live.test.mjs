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
      else {
        if (command.phase === 'up' && this.held) {
          this.selected = !this.selected;
          events.push({ name: 'mdClick', tag: 'md-button', nodeID: 'component', detail: { selected: this.selected } });
        }
        this.held = false;
      }
    }
    this.stdout.write(`${JSON.stringify({ id: command.id, png: PNG, width: 1, height: 1, ...bounds, events, ...changes })}\n`);
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

test('pointer input is scoped to buttons, validates phases, and converts outside releases to cancellation', () => {
  const button = { ...bounds, tag: 'md-button' };
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'down', x: 20.5, y: 50 }, button), { command: 'pointer', phase: 'down', x: 20.5, y: 50 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'up', x: -10, y: 500 }, button), { command: 'pointer', phase: 'cancel', x: 0, y: 199.999 });
  assert.deepEqual(validateLiveInput({ command: 'pointer', phase: 'cancel', x: 700, y: -1 }, button), { command: 'pointer', phase: 'cancel', x: 639.999, y: 0 });
  for (const value of [
    { command: 'pointer', phase: 'down', x: -1, y: 20 },
    { command: 'pointer', phase: 'down', x: 640, y: 20 },
    { command: 'pointer', phase: 'move', x: 20, y: 20 },
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

test('unsupported platforms and absent executables do not spawn native processes', async t => {
  for (const options of [{ platform: 'linux' }, { executable: '/does/not/exist/AWCLivePreview' }]) {
    const { renderer, children } = fixture(t, options);
    assert.equal((await renderer.status()).available, false);
    await assert.rejects(renderer.create(request), errorCode('LIVE_RENDERER_UNAVAILABLE'));
    assert.equal(children.length, 0);
  }
});
