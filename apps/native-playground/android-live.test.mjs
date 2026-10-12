import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createAndroidLiveRenderer } from './android-live.mjs';
import { handleNativeLiveRequest } from './server.mjs';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8l8AAAAASUVORK5CYII=';
const config = { tag: 'md-button', properties: { toggle: true }, dark: false, width: 640 };
const image = changes => ({ png: PNG, width: 1, height: 1, logicalWidth: 640, logicalHeight: 200, events: [], ...changes });
const diagnostics = changes => ({ captureSequence: 1, capturedAtMs: 12345.5, captureMs: 2.75, encodeMs: 3.25, captureScale: 2, droppedCaptures: 0, ...changes });
const record = id => ({ id, name: 'mdClick', tag: 'md-button', nodeID: 'component', detail: { selected: true } });
const errorCode = code => error => error.code === code;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function fixture(t, options = {}) {
  const adbCalls = [], requests = [], streams = [];
  const mock = { devices: 'List of devices attached\nemulator-5554 device product:sdk\n', command: null, adb: null, closed: false };
  const runAdb = async args => {
    adbCalls.push(args);
    if (mock.adb) { const response = await mock.adb(args); if (response !== undefined) return response; }
    if (args[0] === 'devices') return mock.devices;
    if (args.includes('resolve-activity')) return 'dev.awc.playground/.LivePreviewActivity\n';
    if (args.includes('tcp:0')) return '42001\n';
    return '';
  };
  const fetchDevice = async (url, init) => {
    const body = init.body && JSON.parse(init.body);
    const entry = { url, init, body }; requests.push(entry);
    if (url.endsWith('/health')) return Response.json({ ok: true });
    if (url.endsWith('/stream')) {
      let controller;
      const stream = new ReadableStream({ start(value) { controller = value; } });
      const item = { entry, push: value => controller.enqueue(Buffer.from(value)), close: () => controller.close(), aborted: false };
      init.signal.addEventListener('abort', () => { item.aborted = true; controller.error(new DOMException('Aborted', 'AbortError')); }, { once: true });
      streams.push(item);
      return new Response(stream);
    }
    if (body.command === 'close') { await mock.closeGate; mock.closed = true; return Response.json({ ack: true, events: [] }); }
    if (mock.command) { const value = await mock.command(body, entry); if (value !== undefined) return value instanceof Response ? value : Response.json(value); }
    return Response.json(image());
  };
  const renderer = createAndroidLiveRenderer({ runAdb, fetchDevice, ...options });
  t.after(() => renderer.dispose());
  return { renderer, mock, adbCalls, requests, streams };
}

for (const scenario of ['button-behavior', 'navigation-events', 'focus-accessibility']) test(`Android receives ${scenario} separately from component properties`, async t => {
  const { renderer, requests } = fixture(t);
  await renderer.create({ ...config, scenario });
  const configure = requests.find(request => request.body?.command === 'configure').body;
  assert.equal(configure.scenario, scenario);
  assert.deepEqual(configure.properties, config.properties);
});

test('Android configure forwards generated theme colors and direction outside component properties', async t => {
  const { renderer, requests } = fixture(t);
  await renderer.create({ ...config, themeTokens: { '--md-sys-color-primary': '#007733' }, direction: 'rtl' });
  const configure = requests.find(request => request.body?.command === 'configure').body;
  assert.deepEqual(configure.themeTokens, { '--md-sys-color-primary': '#007733' });
  assert.equal(configure.direction, 'rtl');
  assert.deepEqual(configure.properties, config.properties);
});

for (const text of [undefined, '', 'Continuă 👋 <b>literal</b>']) test(`Android configure preserves ${text === undefined ? 'absent' : text === '' ? 'empty' : 'literal Unicode'} button text`, async t => {
  const { renderer, requests } = fixture(t);
  const properties = { icon: 'add', trailingIcon: 'arrow_forward', selected: false };
  await renderer.create({ ...config, properties, ...(text !== undefined ? { text } : {}) });
  const command = requests.find(request => request.body?.command === 'configure').body;
  assert.equal(Object.hasOwn(command, 'text'), text !== undefined);
  assert.equal(command.text, text);
  assert.deepEqual(command.properties, properties);
});

test('Android discovery rejects physical, offline and ambiguous devices and accepts an explicit emulator', async t => {
  for (const devices of ['phone-123 device\n', 'emulator-5554 offline\n', 'emulator-5554 device\nemulator-5556 device\n', '']) {
    const { renderer, mock, adbCalls } = fixture(t);
    mock.devices = devices;
    assert.equal((await renderer.status()).available, false);
    assert.deepEqual(adbCalls, [['devices', '-l']]);
  }
  const selected = fixture(t, { serial: 'emulator-5556' });
  selected.mock.devices = 'phone-123 device\nemulator-5554 device\nemulator-5556 device\n';
  const status = await selected.renderer.status();
  assert.equal(status.available, true);
  assert.equal(status.platform, 'android');
  assert.match(status.message, /emulator-5556/);
  assert.equal(selected.adbCalls[1][1], 'emulator-5556');
  const missing = fixture(t, { serial: 'phone-123' });
  missing.mock.devices = selected.mock.devices;
  assert.equal((await missing.renderer.status()).available, false);
});

test('Android setup reserves the emulator before discovery finishes', async t => {
  const { renderer, mock, adbCalls } = fixture(t);
  const discovered = deferred();
  mock.adb = args => args[0] === 'devices' ? discovered.promise : undefined;
  const pending = renderer.create(config);
  await assert.rejects(renderer.create(config), errorCode('ANDROID_SESSION_BUSY'));
  assert.deepEqual(adbCalls, [['devices', '-l']]);
  discovered.resolve(mock.devices);
  const result = await pending;
  assert.equal(result.platform, 'android');
  assert.equal(result.renderer, 'Jetpack Compose');
  assert.equal(result.tag, 'md-button');
  assert.equal(result.imageUrl, `data:image/png;base64,${PNG}`);
  assert.equal(result.logicalWidth, 640);
  assert.equal(result.revision, 1);
  assert.equal(Object.hasOwn(result, 'diagnostics'), false, 'Older native hosts remain compatible without capture telemetry');
});

test('Android configure and manual frames preserve only validated native capture diagnostics', async t => {
  const { renderer, mock } = fixture(t);
  mock.command = () => image({ diagnostics: { ...diagnostics(), privateHostValue: 'not forwarded' } });
  const initial = await renderer.create(config);
  assert.deepEqual(initial.diagnostics, diagnostics());
  mock.command = () => image({ diagnostics: diagnostics({ captureSequence: 2, capturedAtMs: 12362.25, droppedCaptures: 3 }) });
  const next = await renderer.frame(initial.sessionId);
  assert.deepEqual(next.diagnostics, diagnostics({ captureSequence: 2, capturedAtMs: 12362.25, droppedCaptures: 3 }));
  assert.equal(next.imageUrl, initial.imageUrl, 'Capture freshness is metadata; unchanged pixels must not rewrite it');
});

test('Android stream preserves cached heartbeat sequence and fresh capture timing independently of revisions', async t => {
  const { renderer, streams } = fixture(t);
  const initial = await renderer.create(config), frames = [], errors = [];
  const unsubscribe = renderer.subscribe(initial.sessionId, frame => frames.push(frame), error => errors.push(error));
  await nextTurn();
  const capture = diagnostics({ captureSequence: 7, capturedAtMs: 15000 });
  const fresh = diagnostics({ captureSequence: 8, capturedAtMs: 15016.75, captureMs: 1.5, encodeMs: 4, droppedCaptures: 2 });
  streams[0].push([capture, capture, fresh].map(value => `${JSON.stringify(image({ kind: 'frame', diagnostics: value }))}\n`).join(''));
  await nextTurn();
  assert.deepEqual(frames.map(frame => frame.revision), [2, 3, 4]);
  assert.deepEqual(frames.map(frame => frame.diagnostics), [capture, capture, fresh]);
  assert.equal(new Set(frames.map(frame => frame.imageUrl)).size, 1);
  assert.deepEqual(errors, []);
  unsubscribe();
});

test('Android rejects malformed or unbounded native capture diagnostics', async t => {
  const invalid = [null, [], 'capture',
    { captureSequence: -1 }, { captureSequence: 0.5 }, { captureSequence: Number.MAX_SAFE_INTEGER + 1 },
    { droppedCaptures: -1 }, { droppedCaptures: '1' },
    { capturedAtMs: -1 }, { capturedAtMs: null }, { capturedAtMs: Number.MAX_SAFE_INTEGER + 1 },
    { captureMs: -1 }, { captureMs: 60001 }, { captureMs: '2' },
    { encodeMs: false }, { encodeMs: 60001 },
    { captureScale: 0 }, { captureScale: -2 }, { captureScale: 17 }, { captureScale: '2' }];
  for (const value of invalid) {
    const { renderer, mock, adbCalls } = fixture(t);
    mock.command = () => image({ diagnostics: value });
    await assert.rejects(renderer.create(config), errorCode('INVALID_LIVE_FRAME'), JSON.stringify(value));
    assert.ok(adbCalls.some(args => args.includes('--remove')), 'Invalid telemetry must clean up the native host');
  }
});

test('malformed Android stream capture diagnostics never reach the browser', async t => {
  const { renderer, streams } = fixture(t);
  const initial = await renderer.create(config), errors = [];
  renderer.subscribe(initial.sessionId, () => assert.fail('Invalid telemetry must not reach the browser'), error => errors.push(error));
  await nextTurn();
  streams[0].push(`${JSON.stringify(image({ kind: 'frame', diagnostics: diagnostics({ encodeMs: 'fast' }) }))}\n`);
  await nextTurn(); await nextTurn();
  assert.equal(errors[0]?.code, 'INVALID_LIVE_FRAME');
  assert.equal(streams[0].aborted, true);
});

test('Android requests use one random bearer token and only the scoped emulator forward is removed', async t => {
  const { renderer, adbCalls, requests, mock } = fixture(t);
  const result = await renderer.create(config);
  const start = adbCalls.find(args => args.includes('start'));
  const token = start[start.indexOf('token') + 1];
  assert.match(token, /^[a-f0-9]{64}$/);
  await renderer.input(result.sessionId, { command: 'text', text: 'Salut Ștefan 👋' });
  await renderer.close('unrelated-session');
  assert.equal(mock.closed, false);
  await renderer.close(result.sessionId);
  assert.equal(mock.closed, true);
  for (const request of requests) {
    assert.match(request.url, /^http:\/\/127\.0\.0\.1:42001\/(health|command)$/);
    assert.equal(request.init.headers.Authorization, `Bearer ${token}`);
    assert.equal(request.init.redirect, 'error');
    assert.ok(request.init.signal instanceof AbortSignal);
  }
  assert.deepEqual(adbCalls.filter(args => args.includes('--remove')), [['-s', 'emulator-5554', 'forward', '--remove', 'tcp:42001']]);
  assert.ok(!JSON.stringify(result).includes(token));
  assert.ok(!adbCalls.some(args => args.includes('input') || args.includes('force-stop') || args.includes('--remove-all')));
});

test('Android native commands serialize and the input queue is bounded', async t => {
  const { renderer, mock, requests } = fixture(t);
  const initial = await renderer.create(config);
  const held = deferred(); let first = true;
  mock.command = body => {
    if (body.command === 'text' && first) { first = false; return held.promise; }
    return { ack: true, events: [] };
  };
  const operations = Array.from({ length: 8 }, (_, index) => renderer.input(initial.sessionId, { command: 'text', text: String(index) }));
  await nextTurn();
  assert.deepEqual(requests.filter(item => item.body?.command === 'text').map(item => item.body.text), ['0']);
  await assert.rejects(renderer.input(initial.sessionId, { command: 'text', text: 'overflow' }), errorCode('LIVE_INPUT_BUSY'));
  held.resolve({ ack: true, events: [record('first')] });
  const results = await Promise.all(operations);
  assert.deepEqual(requests.filter(item => item.body?.command === 'text').map(item => item.body.text), ['0', '1', '2', '3', '4', '5', '6', '7']);
  assert.deepEqual(results[0].events, [record('first')]);
  assert.equal(results[0].imageUrl, undefined);
  assert.equal(results[0].sessionId, initial.sessionId);
  assert.throws(() => renderer.input(initial.sessionId, { command: 'click', x: -1, y: 0 }), errorCode('INVALID_COORDINATES'));
});

test('Android NDJSON accepts split frames, preserves native event IDs and streams independently of inputs', async t => {
  const { renderer, mock, streams, requests } = fixture(t);
  const initial = await renderer.create(config), frames = [], errors = [];
  const unsubscribe = renderer.subscribe(initial.sessionId, frame => frames.push(frame), error => errors.push(error));
  assert.throws(() => renderer.subscribe(initial.sessionId, () => {}, () => {}), errorCode('STREAM_EXISTS'));
  await nextTurn();
  const held = deferred();
  mock.command = () => held.promise;
  const input = renderer.input(initial.sessionId, { command: 'pointer', phase: 'down', x: 30, y: 40 });
  const lines = `${JSON.stringify(image({ kind: 'frame', events: [record('native:1')] }))}\n${JSON.stringify(image({ kind: 'frame', events: [record('native:2')] }))}\n`;
  streams[0].push(lines.slice(0, 17)); await nextTurn();
  assert.equal(frames.length, 0);
  streams[0].push(lines.slice(17)); await nextTurn();
  assert.deepEqual(frames.map(frame => frame.revision), [2, 3]);
  assert.deepEqual(frames.flatMap(frame => frame.events.map(event => event.id)), ['native:1', 'native:2']);
  assert.equal(requests.filter(request => request.url.endsWith('/stream')).length, 1);
  assert.equal(requests.find(request => request.url.endsWith('/stream')).init.method, 'GET');
  held.resolve({ ack: true, events: [] }); await input;
  unsubscribe(); await nextTurn();
  assert.equal(streams[0].aborted, true);
  assert.deepEqual(errors, []);
  const unsubscribeAgain = renderer.subscribe(initial.sessionId, () => {}, error => errors.push(error));
  await nextTurn(); assert.equal(streams.length, 2);
  unsubscribeAgain();
});

test('invalid native frames disconnect the Android stream and clean up its forward', async t => {
  const { renderer, streams, adbCalls } = fixture(t);
  const initial = await renderer.create(config), errors = [];
  renderer.subscribe(initial.sessionId, () => assert.fail('Invalid frame must not reach the browser'), error => errors.push(error));
  await nextTurn();
  streams[0].push(`${JSON.stringify(image({ kind: 'frame', width: 2 }))}\n`);
  await nextTurn(); await nextTurn();
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'INVALID_LIVE_FRAME');
  assert.equal(streams[0].aborted, true);
  assert.ok(adbCalls.some(args => args.includes('--remove') && args.includes('tcp:42001')));
  assert.throws(() => renderer.frame(initial.sessionId), errorCode('SESSION_NOT_FOUND'));
});

test('an Android stream stops at the bounded frame size instead of accumulating an unlimited line', async t => {
  const { renderer, streams } = fixture(t);
  const initial = await renderer.create(config), errors = [];
  renderer.subscribe(initial.sessionId, () => assert.fail('Oversized frame must not reach the browser'), error => errors.push(error));
  await nextTurn();
  streams[0].push('x'.repeat(16 * 1024 * 1024 + 1));
  await nextTurn();
  assert.equal(errors[0]?.code, 'LIVE_OUTPUT_LIMIT');
  assert.equal(streams[0].aborted, true);
});

test('successful Android input cannot hide a stalled frame stream from its independent watchdog', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { renderer, streams, mock } = fixture(t, { streamTimeoutMs: 30, ttlMs: 80 });
  const initial = await renderer.create(config), errors = [];
  renderer.subscribe(initial.sessionId, () => {}, error => errors.push(error));
  await nextTurn();
  t.mock.timers.tick(20);
  mock.command = () => ({ ack: true, events: [] });
  await renderer.input(initial.sessionId, { command: 'text', text: 'still connected' });
  t.mock.timers.tick(9);
  assert.equal(errors.length, 0);
  t.mock.timers.tick(1); await nextTurn();
  assert.equal(errors[0]?.code, 'ANDROID_STREAM_TIMEOUT');
  assert.equal(streams[0].aborted, true);
  await renderer.dispose();
});

test('buffered frames from an unsubscribed Android stream cannot restart its watchdog', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { renderer, streams } = fixture(t, { streamTimeoutMs: 30, ttlMs: 80 });
  const initial = await renderer.create(config), frames = [], errors = [];
  const unsubscribe = renderer.subscribe(initial.sessionId, frame => { frames.push(frame); unsubscribe(); }, error => errors.push(error));
  await nextTurn();
  const line = `${JSON.stringify(image({ kind: 'frame' }))}\n`;
  streams[0].push(line + line);
  await nextTurn();
  assert.equal(frames.length, 1);
  assert.equal(streams[0].aborted, true);
  t.mock.timers.tick(20);
  const unsubscribeNew = renderer.subscribe(initial.sessionId, frame => frames.push(frame), error => errors.push(error));
  await nextTurn();
  t.mock.timers.tick(11); await nextTurn();
  assert.deepEqual(errors, [], 'Obsolete stream watchdog must not close the replacement subscriber');
  assert.equal(streams[1].aborted, false);
  unsubscribeNew();
  await renderer.dispose();
});

test('disposing while ADB creates a forward still removes that late forward', async t => {
  const { renderer, mock, adbCalls, requests } = fixture(t);
  const forwarded = deferred(), waiting = deferred();
  mock.adb = args => { if (args.includes('tcp:0')) { waiting.resolve(); return forwarded.promise; } };
  const creating = renderer.create(config);
  await waiting.promise;
  const disposing = renderer.dispose();
  forwarded.resolve('42001');
  await assert.rejects(creating, errorCode('SESSION_CLOSED'));
  await disposing;
  assert.ok(adbCalls.some(args => args.includes('--remove') && args.includes('tcp:42001')));
  assert.ok(!adbCalls.some(args => args.includes('start')));
  assert.equal(requests.filter(request => request.url.endsWith('/health')).length, 0);
  assert.equal((await renderer.status()).available, false);
});

test('reconnect waits for the previous Android cleanup and still reserves only one new session', async t => {
  const { renderer, mock, adbCalls } = fixture(t);
  const initial = await renderer.create(config);
  const closed = deferred(); mock.closeGate = closed.promise;
  const closing = renderer.close(initial.sessionId);
  const replacement = renderer.create(config);
  const competing = assert.rejects(renderer.create(config), errorCode('ANDROID_SESSION_BUSY'));
  await nextTurn();
  assert.equal(adbCalls.filter(args => args.includes('start')).length, 1, 'New Activity must wait for the old token-owned host to close');
  closed.resolve(); await closing;
  const next = await replacement;
  await competing;
  assert.notEqual(next.sessionId, initial.sessionId);
  assert.equal(adbCalls.filter(args => args.includes('start')).length, 2);
  const removed = adbCalls.findIndex(args => args.includes('--remove'));
  const startedAgain = adbCalls.findLastIndex(args => args.includes('start'));
  assert.ok(removed < startedAgain);
});

test('disposing during am start waits for launch then closes the owned Activity before removing its forward', async t => {
  const { renderer, mock, adbCalls, requests } = fixture(t);
  const launched = deferred(), waiting = deferred();
  mock.adb = args => { if (args.includes('start')) { waiting.resolve(); return launched.promise; } };
  const creating = renderer.create(config);
  await waiting.promise;
  const disposing = renderer.dispose();
  await nextTurn();
  assert.equal(requests.length, 0, 'Cleanup cannot address an Activity before launch has finished');
  assert.equal(adbCalls.some(args => args.includes('--remove')), false);
  launched.resolve('Status: ok');
  await assert.rejects(creating, errorCode('SESSION_CLOSED'));
  await disposing;
  assert.deepEqual(requests.map(request => request.body?.command), ['close']);
  assert.equal(mock.closed, true);
  assert.deepEqual(adbCalls.filter(args => args.includes('--remove')), [['-s', 'emulator-5554', 'forward', '--remove', 'tcp:42001']]);
});

test('platform query routes status, creation, input, streams and cleanup to the requested native host', async () => {
  const calls = [], sessionId = '8472268c-9a31-43a0-855e-390e67fc512c';
  const host = platform => ({
    status: async () => { calls.push([platform, 'status']); return { available: true }; },
    create: async value => { calls.push([platform, 'create', value]); return { sessionId }; },
    input: async (id, value) => { calls.push([platform, 'input', id, value]); return { sessionId }; },
    frame: async id => { calls.push([platform, 'frame', id]); return { sessionId }; },
    close: async id => { calls.push([platform, 'close', id]); },
    subscribe: id => { calls.push([platform, 'stream', id]); return () => calls.push([platform, 'unsubscribe', id]); },
  });
  const renderer = host('ios'), androidRenderer = host('android');
  async function request(route, query, body = {}, origin = 'http://127.0.0.1:4177') {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    Object.assign(req, { url: `/api/native-live/${route}${query}`, method: route === 'status' ? 'GET' : 'POST', headers: { host: '127.0.0.1:4177', 'content-type': 'application/json', origin } });
    const res = new EventEmitter();
    Object.assign(res, { writeHead() {}, write() { return true; }, end() {}, destroy() { this.destroyed = true; this.emit('close'); } });
    await handleNativeLiveRequest(req, res, { renderer, androidRenderer, tags: async () => new Set(['md-button']), json: (target, status, value) => Object.assign(target, { status, value }) });
    res.destroy();
    return res;
  }
  for (const [query, platform] of [['', 'ios'], ['?platform=ios', 'ios'], ['?platform=android', 'android']]) {
    const start = calls.length;
    assert.equal((await request('status', query)).status, 200);
    assert.equal((await request('session', query, config)).status, 200);
    assert.equal((await request(`${sessionId}/input`, query, { command: 'click', x: 30, y: 40 })).status, 200);
    await request(`${sessionId}/stream`, query);
    assert.equal((await request(`${sessionId}/close`, query)).status, 200);
    assert.deepEqual(calls.slice(start).map(call => call.slice(0, 2)), [['status'], ['create'], ['input'], ['stream'], ['unsubscribe'], ['close']].map(([action]) => [platform, action]));
  }
  const before = calls.length;
  assert.equal((await request('session', '?platform=android', config, 'https://external.example')).status, 403);
  assert.equal((await request('status', '?platform=arbitrary')).status, 400);
  assert.equal(calls.length, before);
});
