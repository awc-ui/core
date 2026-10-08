import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { RenderError } from './native-render.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const KEYS = new Set(['Enter', 'Space', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const MODIFIERS = new Set(['shift', 'control', 'alt', 'meta']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (status, code, message) => new RenderError(status, code, message);

function validEventDetail(detail) {
  const pending = [[detail, 0]];
  let count = 0;
  while (pending.length) {
    const [value, depth] = pending.pop();
    if (depth > 32 || ++count > 4096) return false;
    if (value && typeof value === 'object') for (const child of Object.values(value)) pending.push([child, depth + 1]);
  }
  return Buffer.byteLength(JSON.stringify(detail)) <= 16 * 1024;
}

/** Validate local view input. No command can name an OS window, selector, or executable. */
export function validateLiveInput(value, { logicalWidth, logicalHeight }) {
  if (!record(value)) throw failure(400, 'INVALID_INPUT', 'Send a native preview input object.');
  const exactKeys = allowed => {
    if (Object.keys(value).some(key => !allowed.includes(key))) throw failure(400, 'INVALID_INPUT', 'The native input contains unsupported fields.');
  };
  if (value.command === 'click') {
    exactKeys(['command', 'x', 'y']);
    if (![value.x, value.y].every(Number.isFinite) || value.x < 0 || value.y < 0 || value.x >= logicalWidth || value.y >= logicalHeight) {
      throw failure(400, 'INVALID_COORDINATES', 'Click inside the native preview.');
    }
    return { command: 'click', x: value.x, y: value.y };
  }
  if (value.command === 'text') {
    exactKeys(['command', 'text']);
    if (typeof value.text !== 'string' || !value.text.length || Buffer.byteLength(value.text) > 4096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.text)) {
      throw failure(400, 'INVALID_TEXT', 'Enter between 1 and 4096 bytes of text.');
    }
    return { command: 'text', text: value.text };
  }
  if (value.command === 'key') {
    exactKeys(['command', 'key', 'modifiers']);
    const modifiers = value.modifiers ?? [];
    if (!KEYS.has(value.key) || !Array.isArray(modifiers) || modifiers.length > 4 || modifiers.some(modifier => !MODIFIERS.has(modifier)) || new Set(modifiers).size !== modifiers.length) {
      throw failure(400, 'INVALID_KEY', 'Use a supported preview key and modifiers.');
    }
    return { command: 'key', key: value.key, modifiers };
  }
  throw failure(400, 'INVALID_INPUT', 'Use click, text, or key for native input.');
}

/** One isolated SwiftUI process per session; commands are serialized within that view. */
export function createNativeLiveRenderer({
  repoRoot,
  executable = process.env.AWC_NATIVE_LIVE_RENDERER,
  platform = process.platform,
  spawnProcess = spawn,
  ttlMs = 60_000,
  commandTimeoutMs = 15_000,
  maxSessions = 2,
  maxPending = 8,
  maxLineBytes = 16 * 1024 * 1024,
  maxStderrBytes = 256 * 1024,
  killGraceMs = 500,
} = {}) {
  const binary = path.resolve(executable || path.join(repoRoot, 'apps/native-ios-playground/.build/debug/AWCLivePreview'));
  const sessions = new Map();
  const children = new Set();
  let disposed = false;

  async function status() {
    if (disposed) return { available: false, platform: 'macos', renderer: 'SwiftUI', message: 'The native preview service has stopped.' };
    if (platform !== 'darwin') return { available: false, platform: 'macos', renderer: 'SwiftUI', message: 'Interactive SwiftUI previews require macOS.' };
    try {
      await access(binary, constants.X_OK);
      return { available: true, platform: 'macos', renderer: 'SwiftUI', message: 'A persistent SwiftUI view on macOS. This is not an iOS simulator.' };
    } catch {
      return { available: false, platform: 'macos', renderer: 'SwiftUI', message: 'Build the live renderer: swift build --package-path apps/native-ios-playground --product AWCLivePreview.' };
    }
  }

  function finishCommand(session, error, value) {
    const pending = session.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    session.pending = null;
    if (error) pending.reject(error);
    else pending.resolve(value);
  }

  function stop(session, error = failure(410, 'SESSION_CLOSED', 'The native session has closed. Start a new preview.')) {
    if (session.closed) return;
    session.closed = true;
    sessions.delete(session.id);
    clearTimeout(session.idleTimer);
    finishCommand(session, error);
    for (const pending of session.queue.splice(0)) pending.reject(error);
    session.buffer = Buffer.alloc(0);
    if (session.child && !session.exited) {
      session.child.stdin.end();
      session.child.kill('SIGTERM');
      if (!session.exited) {
        session.killTimer = setTimeout(() => {
          if (!session.exited) session.child.kill('SIGKILL');
        }, killGraceMs);
        session.killTimer.unref();
      }
    }
  }

  function touch(session) {
    clearTimeout(session.idleTimer);
    session.idleTimer = setTimeout(() => stop(session, failure(410, 'SESSION_EXPIRED', 'The native preview expired after being idle. Start it again.')), ttlMs);
    session.idleTimer.unref();
  }

  function frameResult(session, message) {
    const dimensions = ['width', 'height'];
    if (dimensions.some(key => !Number.isSafeInteger(message[key]) || message[key] <= 0 || message[key] > 16384) || message.width * message.height > 32 * 1024 * 1024 ||
      ['logicalWidth', 'logicalHeight'].some(key => !Number.isFinite(message[key]) || message[key] <= 0 || message[key] > 16384) ||
      typeof message.png !== 'string' || message.png.length > maxLineBytes || !/^[A-Za-z0-9+/]+={0,2}$/.test(message.png) || message.png.length % 4 !== 0 ||
      !Array.isArray(message.events) || message.events.length > 256) {
      throw failure(502, 'INVALID_LIVE_FRAME', 'The live renderer returned invalid frame metadata.');
    }
    const png = Buffer.from(message.png, 'base64');
    if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString('ascii', 12, 16) !== 'IHDR' || png.readUInt32BE(16) !== message.width || png.readUInt32BE(20) !== message.height) {
      throw failure(502, 'INVALID_LIVE_FRAME', 'The live renderer did not return a valid PNG frame.');
    }
    const events = message.events.map(event => {
      if (!record(event) || typeof event.name !== 'string' || event.name.length > 128 || typeof event.tag !== 'string' || event.tag.length > 128 || typeof event.nodeID !== 'string' || event.nodeID.length > 256 ||
        (event.id !== undefined && (typeof event.id !== 'string' || !event.id.length || event.id.length > 256)) || !validEventDetail(event.detail ?? null)) {
        throw failure(502, 'INVALID_LIVE_FRAME', 'The live renderer returned an invalid event.');
      }
      return { id: event.id ?? `${session.id}:${++session.eventSequence}`, name: event.name, tag: event.tag, nodeID: event.nodeID, detail: event.detail ?? null };
    });
    session.logicalWidth = message.logicalWidth;
    session.logicalHeight = message.logicalHeight;
    return {
      sessionId: session.id,
      platform: 'macos',
      renderer: 'SwiftUI',
      tag: session.tag,
      imageUrl: `data:image/png;base64,${message.png}`,
      width: message.width,
      height: message.height,
      logicalWidth: message.logicalWidth,
      logicalHeight: message.logicalHeight,
      revision: ++session.revision,
      events,
    };
  }

  function receive(session, chunk) {
    if (session.closed) return;
    // A command produces exactly one line. Reject excess data before allocating a larger buffer.
    if (session.buffer.length + chunk.length > maxLineBytes) {
      stop(session, failure(502, 'LIVE_OUTPUT_LIMIT', 'The live renderer exceeded the frame size limit.'));
      return;
    }
    session.buffer = Buffer.concat([session.buffer, chunk]);
    let end;
    while (!session.closed && (end = session.buffer.indexOf(10)) >= 0) {
      const line = session.buffer.subarray(0, end);
      session.buffer = session.buffer.subarray(end + 1);
      let message;
      try { message = JSON.parse(line.toString('utf8')); }
      catch { stop(session, failure(502, 'INVALID_LIVE_RESPONSE', 'The live renderer returned invalid JSON.')); return; }
      if (!record(message) || !session.pending || message.id !== session.pending.id) {
        stop(session, failure(502, 'INVALID_LIVE_RESPONSE', 'The live renderer returned an unexpected response.'));
        return;
      }
      if (message.error !== undefined) {
        stop(session, failure(502, 'LIVE_RENDER_FAILED', 'SwiftUI could not process this preview input. Start a new preview.'));
        return;
      }
      try { finishCommand(session, null, frameResult(session, message)); }
      catch (error) { stop(session, error); return; }
      touch(session);
      // Dispatch after parsing this chunk so extra unsolicited output cannot match a new command.
      queueMicrotask(() => dispatch(session));
    }
  }

  function dispatch(session) {
    if (session.closed || session.pending || !session.queue.length) return;
    const pending = session.queue.shift();
    // A preceding action may have resized the view while this click waited in the queue.
    if (pending.payload.command === 'click') {
      try { validateLiveInput(pending.payload, session); }
      catch (error) { pending.reject(error); queueMicrotask(() => dispatch(session)); return; }
    }
    session.pending = pending;
    pending.timer = setTimeout(() => stop(session, failure(504, 'LIVE_COMMAND_TIMEOUT', 'The native preview timed out. Start it again.')), commandTimeoutMs);
    try {
      session.child.stdin.write(pending.line, error => {
        if (error) stop(session, failure(502, 'LIVE_PROCESS_FAILED', 'The native preview input stream closed.'));
      });
    } catch { stop(session, failure(502, 'LIVE_PROCESS_FAILED', 'The native preview input stream closed.')); }
  }

  function enqueue(session, payload) {
    if (session.closed) return Promise.reject(failure(410, 'SESSION_CLOSED', 'The native session has closed.'));
    if (session.queue.length + Number(Boolean(session.pending)) >= maxPending) return Promise.reject(failure(429, 'LIVE_INPUT_BUSY', 'The native input queue is full. Wait for the current frame.'));
    const id = randomUUID();
    const line = `${JSON.stringify({ ...payload, id })}\n`;
    if (Buffer.byteLength(line) > 128 * 1024) return Promise.reject(failure(413, 'REQUEST_TOO_LARGE', 'The native preview request is too large.'));
    touch(session);
    return new Promise((resolve, reject) => {
      session.queue.push({ id, line, payload, resolve, reject });
      dispatch(session);
    });
  }

  function getSession(id) {
    const session = typeof id === 'string' ? sessions.get(id) : undefined;
    if (!session || session.closed) throw failure(404, 'SESSION_NOT_FOUND', 'This native preview session is unavailable. Start a new preview.');
    return session;
  }

  async function create(request) {
    const availability = await status();
    if (!availability.available || disposed) throw failure(503, 'LIVE_RENDERER_UNAVAILABLE', availability.message);
    if (children.size >= maxSessions) throw failure(429, 'LIVE_RENDERER_BUSY', 'Two native previews are already open. Close one or wait for it to expire.');
    const session = { id: randomUUID(), tag: request.tag, revision: 0, eventSequence: 0, queue: [], buffer: Buffer.alloc(0), stderrBytes: 0, closed: false, exited: false };
    sessions.set(session.id, session);
    try {
      session.child = spawnProcess(binary, ['--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
      children.add(session);
      session.child.stdout.on('data', chunk => receive(session, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      session.child.stderr.on('data', chunk => {
        session.stderrBytes += Buffer.byteLength(chunk);
        if (session.stderrBytes > maxStderrBytes) stop(session, failure(502, 'LIVE_OUTPUT_LIMIT', 'The native preview produced too much diagnostic output.'));
      });
      session.child.on('error', () => stop(session, failure(502, 'LIVE_PROCESS_FAILED', 'The native preview process could not start.')));
      session.child.stdin.on('error', () => stop(session, failure(502, 'LIVE_PROCESS_FAILED', 'The native preview input stream closed.')));
      session.child.stdout.on('error', () => stop(session, failure(502, 'LIVE_PROCESS_FAILED', 'The native preview output stream closed.')));
      session.child.stderr.on('error', () => stop(session, failure(502, 'LIVE_PROCESS_FAILED', 'The native preview diagnostic stream closed.')));
      session.child.on('close', () => {
        session.exited = true;
        clearTimeout(session.killTimer);
        children.delete(session);
        stop(session, failure(502, 'LIVE_PROCESS_EXITED', 'The native preview process exited. Start it again.'));
      });
      return await enqueue(session, { command: 'configure', tag: request.tag, properties: request.properties, dark: request.dark, width: request.width });
    } catch (error) {
      const safeError = error instanceof RenderError ? error : failure(502, 'LIVE_PROCESS_FAILED', 'The native preview process could not start.');
      stop(session, safeError);
      throw safeError;
    }
  }

  async function input(id, payload) {
    const session = getSession(id);
    return enqueue(session, validateLiveInput(payload, session));
  }

  async function frame(id) { return enqueue(getSession(id), { command: 'frame' }); }

  function close(id) {
    const session = getSession(id);
    stop(session);
    return { sessionId: id, closed: true };
  }

  function onExit() {
    for (const session of children) session.child.kill('SIGKILL');
  }
  process.once('exit', onExit);

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const session of [...sessions.values()]) stop(session);
    // Kill every remaining child, including processes already awaiting graceful shutdown.
    for (const session of children) {
      clearTimeout(session.killTimer);
      session.child.kill('SIGKILL');
    }
    process.removeListener('exit', onExit);
  }

  return { status, create, input, frame, close, dispose };
}
