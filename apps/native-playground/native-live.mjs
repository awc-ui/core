import { nativeViewportCommand } from './native-viewport.js';
import { splitButtonCheckedOptions } from './split-button-state.js';
import { segmentedContextOptions, segmentedSelectionOptions } from './segmented-context.js';
import { nativeMethodCommand, nativeMethodResultsCommand, nativeMethodReply, nativeMethodValue } from './native-methods.js';
import { buttonGroupSelectionOptions } from './button-group-state.js';
import { nativeContentSlots } from './content-slots.js';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { RenderError } from './native-render.mjs';
import { nativeEventMetadata } from './native-event-metadata.mjs';
import { nativeThemeOptions } from './native-theme-options.js';
import { validateNativeInspection } from './native-inspection.mjs';
import { isNativePreviewKey } from './native-preview-keys.js';
import { nativePropertyUpdate } from './native-property-updates.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
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
export function validateLiveInput(value, { logicalWidth, logicalHeight, tag }) {
  if (!record(value)) throw failure(400, 'INVALID_INPUT', 'Send a native preview input object.');
  const exactKeys = allowed => {
    if (Object.keys(value).some(key => !allowed.includes(key))) throw failure(400, 'INVALID_INPUT', 'The native input contains unsupported fields.');
  };
  if (value.command === 'resize') {
    exactKeys(['command', 'width', 'height']);
    try { return nativeViewportCommand(tag, value.width, value.height); }
    catch (error) { throw failure(400, error.code, error.message); }
  }
  if (value.command === 'update') {
    exactKeys(['command', 'properties']);
    try { return nativePropertyUpdate(tag, value.properties); }
    catch (error) { throw failure(400, error.code, error.message); }
  }
  if (value.command === 'method') {
    exactKeys(['command', 'method', 'arguments', 'callId', 'target']);
    try { return nativeMethodCommand(tag, value.method, value.arguments, Object.hasOwn(value, 'callId') || Object.hasOwn(value, 'target') ? { callId: value.callId, target: value.target } : undefined); }
    catch (error) { throw failure(400, error.code, error.message); }
  }
  if (value.command === 'method-results') {
    exactKeys(['command', 'callIds', 'acknowledged']);
    try { return nativeMethodResultsCommand(tag, value.callIds, value.acknowledged); }
    catch (error) { throw failure(400, error.code, error.message); }
  }
  if (value.command === 'click') {
    exactKeys(['command', 'x', 'y']);
    if (![value.x, value.y].every(Number.isFinite) || value.x < 0 || value.y < 0 || value.x >= logicalWidth || value.y >= logicalHeight) {
      throw failure(400, 'INVALID_COORDINATES', 'Click inside the native preview.');
    }
    return { command: 'click', x: value.x, y: value.y };
  }
  if (value.command === 'pointer') {
    exactKeys(['command', 'phase', 'x', 'y']);
    if (!['md-button', 'md-icon-button', 'md-button-group', 'md-fab', 'md-fab-menu', 'md-fab-menu-item', 'md-segmented-button', 'md-split-button', 'md-snackbar', 'md-tooltip', 'md-accordion', 'md-accordion-item', 'md-card', 'md-list', 'md-list-item', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet'].includes(tag) || !['down', 'up', 'cancel', 'move', 'leave'].includes(value.phase)) {
      throw failure(400, 'INVALID_POINTER', 'Pointer input is unavailable for this component preview.');
    }
    if (![value.x, value.y].every(Number.isFinite)) throw failure(400, 'INVALID_COORDINATES', 'Pointer coordinates must be finite.');
    const inside = value.x >= 0 && value.y >= 0 && value.x < logicalWidth && value.y < logicalHeight;
    if (value.phase === 'down' && !inside) throw failure(400, 'INVALID_COORDINATES', 'Press inside the native preview.');
    // Captured browser releases can arrive outside the image; cancel instead of activating a control.
    const phase = value.phase === 'up' && !inside ? 'cancel' : value.phase === 'move' && !inside ? 'leave' : value.phase;
    return { command: 'pointer', phase, x: Math.min(logicalWidth - 0.001, Math.max(0, value.x)), y: Math.min(logicalHeight - 0.001, Math.max(0, value.y)) };
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
    if (!isNativePreviewKey(value.key) || !Array.isArray(modifiers) || modifiers.length > 4 || modifiers.some(modifier => !MODIFIERS.has(modifier)) || new Set(modifiers).size !== modifiers.length) {
      throw failure(400, 'INVALID_KEY', 'Use a supported preview key and modifiers.');
    }
    return { command: 'key', key: value.key, modifiers };
  }
  throw failure(400, 'INVALID_INPUT', 'Use pointer, click, text, or key for native input.');
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
    const subscriber = session.subscriber; session.subscriber = null;
    subscriber?.onError(error);
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

  function eventResult(session, values) {
    if (!Array.isArray(values) || values.length > 256) throw failure(502, 'INVALID_LIVE_FRAME', 'The renderer returned invalid events.');
    return values.map(event => {
      if (!record(event) || typeof event.name !== 'string' || event.name.length > 128 || typeof event.tag !== 'string' || event.tag.length > 128 || typeof event.nodeID !== 'string' || event.nodeID.length > 256 ||
        (event.id !== undefined && (typeof event.id !== 'string' || !event.id.length || event.id.length > 256)) || !validEventDetail(event.detail ?? null)) {
        throw failure(502, 'INVALID_LIVE_FRAME', 'The live renderer returned an invalid event.');
      }
      return { id: event.id ?? `${session.id}:${++session.eventSequence}`, name: event.name, tag: event.tag, nodeID: event.nodeID, detail: event.detail ?? null, ...nativeEventMetadata(event) };
    });
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
    const events = eventResult(session, message.events);
    const inspection = validateNativeInspection(message.inspection, 'macos');
    let selection;
    try { selection = { ...splitButtonCheckedOptions(message.splitButtonChecked, session.tag), ...buttonGroupSelectionOptions(message.buttonGroupSelection, session.tag), ...segmentedSelectionOptions(message.segmentedSelection, session.tag, session.segmentedContext) }; }
    catch { throw failure(502, 'INVALID_LIVE_FRAME', 'Invalid ordered child selection.'); }
    session.logicalWidth = message.logicalWidth;
    session.logicalHeight = message.logicalHeight;
    return session.lastFrame = {
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
      ...(inspection === undefined ? {} : { inspection }), ...selection,
    };
  }

  function receive(session, chunk) {
    if (session.closed) return;
    // Both replies and unsolicited stream frames are bounded JSON lines.
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
      if (record(message) && message.kind === 'frame' && message.id === null && session.streamAllowed) {
        try {
          const frame = frameResult(session, message);
          if (session.subscriber) { session.subscriber.onFrame(frame); touch(session); }
          else session.undeliveredEvents = [...session.undeliveredEvents, ...frame.events].slice(-256);
        } catch (error) { stop(session, error); return; }
        continue;
      }
      if (!record(message) || !session.pending || message.id !== session.pending.id) {
        stop(session, failure(502, 'INVALID_LIVE_RESPONSE', 'The live renderer returned an unexpected response.'));
        return;
      }
      if (message.error !== undefined) {
        stop(session, failure(502, 'LIVE_RENDER_FAILED', 'SwiftUI could not process this preview input. Start a new preview.'));
        return;
      }
      try {
        const command = session.pending.payload;
        const resized = command.command === 'resize';
        if (resized && (message.ack !== true || message.logicalWidth !== command.width || message.logicalHeight !== command.height)) throw failure(502, 'INVALID_VIEWPORT_FRAME', 'Native resize must acknowledge a captured frame at the requested applied dimensions.');
        if ((command.callId || command.command === 'method-results') && message.ack !== true) throw failure(502, 'INVALID_METHOD_RESULT', 'Native lifecycle methods require a separate acknowledgement.');
        let methodReply;
        try { methodReply = nativeMethodReply(message, command); }
        catch (error) { throw failure(502, error.code, error.message); }
        const result = message.ack === true && !resized
          ? { sessionId: session.id, revision: session.revision, events: eventResult(session, message.events), ...methodReply }
          : frameResult(session, message);
        if (command.command === 'method' && !command.callId && message.result !== undefined) {
          try { result.methodResult = nativeMethodValue(message.result); } catch (error) { throw failure(502, error.code, error.message); }
        }
        if (session.pending.payload.command === 'stream' && session.pending.payload.enabled === false) {
          session.undeliveredEvents = [...session.undeliveredEvents, ...result.events].slice(-256);
          result.events = [];
        } else result.events = [...session.undeliveredEvents.splice(0), ...result.events];
        finishCommand(session, null, result);
      }
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
    if (['click', 'pointer'].includes(pending.payload.command)) {
      try {
        pending.payload = validateLiveInput(pending.payload, session);
        pending.line = `${JSON.stringify({ ...pending.payload, id: pending.id })}\n`;
      }
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
    const session = { id: randomUUID(), tag: request.tag, segmentedContext: request.segmentedContext, revision: 0, eventSequence: 0, queue: [], buffer: Buffer.alloc(0), stderrBytes: 0, closed: false, exited: false, subscriber: null, streamAllowed: false, undeliveredEvents: [] };
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
      return await enqueue(session, { command: 'configure', tag: request.tag, properties: request.properties, dark: request.dark, width: request.width, ...(request.height !== undefined ? { height: request.height } : {}), ...(request.scenario ? { scenario: request.scenario } : {}), ...(request.text !== undefined ? { text: request.text } : {}), ...nativeThemeOptions(request), ...nativeContentSlots(request.slots), ...buttonGroupSelectionOptions(request.buttonGroupSelection, request.tag), ...segmentedContextOptions(request.segmentedContext, request.tag) });
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

  // One subscriber per view; frames do not wait for a browser round trip.
  function subscribe(id, onFrame, onError) {
    const session = getSession(id);
    if (session.subscriber) throw failure(409, 'STREAM_EXISTS', 'This preview already has a frame stream.');
    const subscriber = { onFrame, onError };
    session.subscriber = subscriber;
    session.streamAllowed = true;
    const unsubscribe = () => {
      if (session.subscriber !== subscriber) return;
      session.subscriber = null;
      if (!session.closed) void enqueue(session, { command: 'stream', enabled: false }).catch(error => stop(session, error));
    };
    void enqueue(session, { command: 'stream', enabled: true }).then(result => {
      if (session.subscriber !== subscriber) return;
      if (result.events.length && session.lastFrame) onFrame({ ...session.lastFrame, events: result.events });
    }).catch(error => { if (session.subscriber === subscriber) { unsubscribe(); onError(error); } });
    return unsubscribe;
  }

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

  return { status, create, input, frame, subscribe, close, dispose };
}
