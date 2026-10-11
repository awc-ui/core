import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { RenderError } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';
import { nativeEventMetadata } from './native-event-metadata.mjs';

const execute = promisify(execFile);
const fail = (status, code, message) => new RenderError(status, code, message);
const component = 'dev.awc.playground/.LivePreviewActivity';
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maxBytes = 16 * 1024 * 1024;

function events(values = []) {
  if (!Array.isArray(values) || values.length > 256) throw fail(502, 'INVALID_LIVE_FRAME', 'Invalid Android events.');
  return values.map(event => {
    if (!event || !['id', 'name', 'tag', 'nodeID'].every(key => typeof event[key] === 'string' && event[key].length > 0 && event[key].length <= 256)
      || Buffer.byteLength(JSON.stringify(event.detail ?? null)) > 16384) throw fail(502, 'INVALID_LIVE_FRAME', 'Invalid Android event.');
    return { id: event.id, name: event.name, tag: event.tag, nodeID: event.nodeID, detail: event.detail ?? null, ...nativeEventMetadata(event) };
  });
}

function frameResult(session, value) {
  if (['width', 'height'].some(key => !Number.isSafeInteger(value[key]) || value[key] <= 0 || value[key] > 16384)
    || value.width * value.height > 32 * 1024 * 1024
    || ['logicalWidth', 'logicalHeight'].some(key => !Number.isFinite(value[key]) || value[key] <= 0 || value[key] > 16384)
    || typeof value.png !== 'string' || value.png.length > maxBytes || value.png.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.png)) {
    throw fail(502, 'INVALID_LIVE_FRAME', 'Invalid Android frame metadata.');
  }
  const png = Buffer.from(value.png, 'base64');
  if (png.length < 24 || !png.subarray(0, 8).equals(pngSignature) || png.toString('ascii', 12, 16) !== 'IHDR'
    || png.readUInt32BE(16) !== value.width || png.readUInt32BE(20) !== value.height) throw fail(502, 'INVALID_LIVE_FRAME', 'Invalid Android PNG.');
  session.logicalWidth = value.logicalWidth; session.logicalHeight = value.logicalHeight;
  return { sessionId: session.id, platform: 'android', renderer: 'Jetpack Compose', tag: session.tag,
    imageUrl: `data:image/png;base64,${value.png}`, width: value.width, height: value.height,
    logicalWidth: value.logicalWidth, logicalHeight: value.logicalHeight, revision: ++session.revision, events: events(value.events) };
}

/** One dedicated emulator Activity. Input stays inside that Activity; ADB never injects global input. */
export function createAndroidLiveRenderer({
  adb = process.env.AWC_ANDROID_ADB || path.join(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '', 'platform-tools/adb'),
  serial = process.env.AWC_ANDROID_SERIAL,
  runAdb = async args => (await execute(adb, args, { shell: false, timeout: 15000, maxBuffer: 1024 * 1024 })).stdout,
  fetchDevice = fetch,
  ttlMs = 60000,
  commandTimeoutMs = 15000,
  startupTimeoutMs = 20000,
  streamTimeoutMs = 15000,
} = {}) {
  let active = null, disposed = false;

  async function device() {
    let output;
    try { output = await runAdb(['devices', '-l']); }
    catch { throw fail(503, 'ANDROID_ADB_UNAVAILABLE', 'Set ANDROID_HOME to your Android SDK and start a dedicated emulator.'); }
    const available = String(output).split(/\r?\n/).map(line => line.trim().split(/\s+/))
      .filter(parts => /^emulator-\d+$/.test(parts[0]) && parts[1] === 'device').map(parts => parts[0]);
    if (serial ? !available.includes(serial) : available.length !== 1) {
      throw fail(503, 'ANDROID_EMULATOR_UNAVAILABLE', 'Start a dedicated Android emulator. With multiple emulators, set AWC_ANDROID_SERIAL (emulator-NNNN).');
    }
    return serial || available[0];
  }

  async function inspect() {
    const selected = await device();
    const resolved = await runAdb(['-s', selected, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', '-n', component]);
    if (!String(resolved).includes(component)) throw fail(503, 'ANDROID_APP_UNAVAILABLE', 'Build and install the debug Android playground APK on the emulator.');
    return selected;
  }

  async function status() {
    try {
      if (disposed) throw fail(503, 'SERVICE_STOPPED', 'The Android preview service has stopped.');
      const selected = await inspect();
      return { available: true, platform: 'android', renderer: 'Jetpack Compose', message: `Real Jetpack Compose on ${selected}. One live Android preview at a time.` };
    } catch (error) { return { available: false, platform: 'android', renderer: 'Jetpack Compose', message: error instanceof RenderError ? error.message : 'Android emulator is unavailable.' }; }
  }

  async function request(session, route, payload, signal) {
    const response = await fetchDevice(`http://127.0.0.1:${session.port}${route}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${session.token}`, ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: signal || AbortSignal.timeout(commandTimeoutMs),
      redirect: 'error',
    });
    if (!response.ok) { await response.body?.cancel(); throw fail(502, 'ANDROID_HOST_FAILED', 'The Android preview host rejected the request. Start a new preview.'); }
    return response;
  }

  async function readJSON(response) {
    let length = 0; const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > maxBytes) throw fail(502, 'LIVE_OUTPUT_LIMIT', 'Android frame exceeded the size limit.');
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }

  function touch(session) {
    clearTimeout(session.timer);
    session.timer = setTimeout(() => { void stop(session, fail(410, 'SESSION_EXPIRED', 'The Android preview expired. Start it again.')); }, ttlMs);
    session.timer.unref?.();
  }

  async function stop(session, error = fail(410, 'SESSION_CLOSED', 'The Android preview closed.')) {
    if (session.cleanup) return session.cleanup;
    session.closed = true; clearTimeout(session.timer);
    session.abort.abort();
    const subscriber = session.subscriber; session.subscriber = null;
    subscriber?.abort.abort(); subscriber?.onError(error);
    session.cleanup = (async () => {
      // ADB operations cannot be aborted reliably. Wait for any operation that
      // can create a resource before cleaning up, including a canceled start.
      try { await session.forwarding; } catch {}
      try { await session.launch; } catch {}
      // Cleanup only this token-owned Activity and this exact ADB forward.
      if (session.port) {
        try { await (await request(session, '/command', { command: 'close' }, AbortSignal.timeout(2000))).body?.cancel(); } catch {}
        try { await runAdb(['-s', session.serial, 'forward', '--remove', `tcp:${session.port}`]); } catch {}
      }
      if (active === session) active = null;
    })();
    return session.cleanup;
  }

  function get(id) {
    if (!active || active.id !== id || active.closed) throw fail(404, 'SESSION_NOT_FOUND', 'This Android preview is unavailable. Start a new preview.');
    return active;
  }

  function enqueue(session, payload) {
    if (session.pending >= 8) return Promise.reject(fail(429, 'LIVE_INPUT_BUSY', 'Wait for the current Android input.'));
    session.pending++; touch(session);
    const operation = session.tail.then(async () => {
      if (session.closed) throw fail(410, 'SESSION_CLOSED', 'The Android preview closed.');
      if (['pointer', 'click', 'key', 'text'].includes(payload.command)) payload = validateLiveInput(payload, session);
      try {
        const value = await readJSON(await request(session, '/command', payload, AbortSignal.any([session.abort.signal, AbortSignal.timeout(commandTimeoutMs)])));
        if (value.error) throw fail(502, 'ANDROID_INPUT_FAILED', value.message || 'Android could not process this input.');
        const result = value.ack === true ? { sessionId: session.id, revision: session.revision, events: events(value.events) } : frameResult(session, value);
        result.events = [...session.undelivered.splice(0), ...result.events];
        touch(session); return result;
      } catch (error) { void stop(session); throw error instanceof RenderError ? error : fail(502, 'ANDROID_CONNECTION_FAILED', 'Android disconnected or timed out. Start a new preview.'); }
    });
    session.tail = operation.catch(() => {}).finally(() => { session.pending--; });
    return operation;
  }

  async function create(config) {
    if (disposed) throw fail(503, 'SERVICE_STOPPED', 'The Android preview service has stopped.');
    if (active?.closed) await active.cleanup;
    if (disposed) throw fail(503, 'SERVICE_STOPPED', 'The Android preview service has stopped.');
    if (active) throw fail(429, 'ANDROID_SESSION_BUSY', 'The emulator already has a live preview. Close the other Android preview tab and retry.');
    const session = active = { id: randomUUID(), token: randomBytes(32).toString('hex'), tag: config.tag, revision: 0,
      abort: new AbortController(), tail: Promise.resolve(), pending: 0, undelivered: [], closed: false };
    try {
      session.serial = await inspect();
      if (session.closed) throw fail(410, 'SESSION_CLOSED', 'The Android preview closed.');
      session.forwarding = runAdb(['-s', session.serial, 'forward', 'tcp:0', 'tcp:39091']).then(output => {
        const port = String(output).trim();
        if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw fail(502, 'ANDROID_FORWARD_FAILED', 'Unable to forward the Android preview connection.');
        session.port = Number(port);
      });
      await session.forwarding;
      if (session.closed) throw fail(410, 'SESSION_CLOSED', 'The Android preview closed.');
      session.launch = runAdb(['-s', session.serial, 'shell', 'am', 'start', '-W', '-n', component, '--es', 'token', session.token, '--ei', 'port', '39091']);
      await session.launch;
      const deadline = Date.now() + startupTimeoutMs;
      while (true) {
        if (session.closed) throw fail(410, 'SESSION_CLOSED', 'The Android preview closed.');
        try { await readJSON(await request(session, '/health', undefined, AbortSignal.timeout(1500))); break; }
        catch { if (Date.now() >= deadline) throw fail(504, 'ANDROID_START_TIMEOUT', 'Android preview did not start. Reinstall the debug playground APK and retry.'); await delay(100); }
      }
      return await enqueue(session, { command: 'configure', ...config });
    } catch (error) {
      await stop(session);
      throw error instanceof RenderError ? error : fail(502, 'ANDROID_START_FAILED', 'Unable to start the Android preview. Check the emulator and debug APK.');
    }
  }

  function subscribe(id, onFrame, onError) {
    const session = get(id);
    if (session.subscriber) throw fail(409, 'STREAM_EXISTS', 'This Android preview already has a frame stream.');
    const subscriber = { onFrame, onError, abort: new AbortController() };
    session.subscriber = subscriber;
    let watchdog;
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      if (subscriber.abort.signal.aborted || session.subscriber !== subscriber) return;
      watchdog = setTimeout(() => { void stop(session, fail(504, 'ANDROID_STREAM_TIMEOUT', 'Android stopped sending frames. Start a new preview.')); }, streamTimeoutMs);
      watchdog.unref?.();
    };
    subscriber.abort.signal.addEventListener('abort', () => clearTimeout(watchdog), { once: true });
    resetWatchdog();
    touch(session);
    void (async () => {
      let buffer = Buffer.alloc(0);
      try {
        const response = await request(session, '/stream', undefined, subscriber.abort.signal);
        for await (const chunk of response.body) {
          buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
          let newline;
          while ((newline = buffer.indexOf(10)) >= 0) {
            if (newline > maxBytes) throw fail(502, 'LIVE_OUTPUT_LIMIT', 'Android stream exceeded the frame size limit.');
            const value = JSON.parse(buffer.subarray(0, newline).toString('utf8')); buffer = buffer.subarray(newline + 1);
            if (value.kind !== 'frame') throw fail(502, 'INVALID_LIVE_FRAME', 'Invalid Android stream message.');
            const frame = frameResult(session, value);
            resetWatchdog();
            if (session.subscriber === subscriber) { frame.events = [...session.undelivered.splice(0), ...frame.events]; onFrame(frame); touch(session); }
            else session.undelivered.push(...frame.events);
          }
          if (buffer.length > maxBytes || session.undelivered.length > 256) throw fail(502, 'LIVE_OUTPUT_LIMIT', 'Android stream exceeded its buffer limit.');
        }
        if (!subscriber.abort.signal.aborted) throw fail(502, 'ANDROID_STREAM_ENDED', 'Android frame stream disconnected.');
      } catch (error) {
        if (!subscriber.abort.signal.aborted && session.subscriber === subscriber) await stop(session, error instanceof RenderError ? error : fail(502, 'ANDROID_STREAM_FAILED', 'Android frame stream disconnected. Start it again.'));
      }
    })();
    return () => { if (session.subscriber === subscriber) session.subscriber = null; subscriber.abort.abort(); };
  }

  return { status, create, subscribe,
    input: (id, payload) => { const session = get(id); return enqueue(session, validateLiveInput(payload, session)); },
    frame: id => enqueue(get(id), { command: 'frame' }),
    close: id => active?.id === id ? stop(active) : Promise.resolve(),
    dispose: () => { disposed = true; return active ? stop(active) : Promise.resolve(); },
  };
}
