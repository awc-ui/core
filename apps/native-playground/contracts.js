// Browser-safe contract helpers. Literal parsing never evaluates source code.
export function literalChoices(property) {
  const type = typeof property.type === 'string' ? property.type : property.type?.text || '';
  const parts = [];
  let start = 0, quote = null, escaped = false;
  for (let index = 0; index < type.length; index++) {
    const char = type[index];
    if (escaped) { escaped = false; continue; }
    if (quote && char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = null; continue; }
    if (char === "'" || char === '"') quote = char;
    else if (char === '|') { parts.push(type.slice(start, index).trim()); start = index + 1; }
  }
  parts.push(type.slice(start).trim());
  const choices = [];
  for (const part of parts.filter(Boolean)) {
    if (part === 'true' || part === 'false') choices.push(part === 'true');
    else if (part === 'null') choices.push(null);
    else if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(part)) choices.push(Number(part));
    else if (/^(['"])(?:\\.|(?!\1)[^\\])*\1$/.test(part)) {
      const content = part.slice(1, -1);
      choices.push(content.replace(/\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|([\s\S]))/g, (_, codePoint, unicode, hex, char) => {
        if (codePoint || unicode || hex) return String.fromCodePoint(parseInt(codePoint || unicode || hex, 16));
        return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' })[char] ?? char;
      }));
    } else return Array.isArray(property.options) && property.options.length > 1 ? property.options : [];
  }
  return choices.length > 1 ? choices : [];
}

export const encodeLiteralChoice = value => JSON.stringify(value);
export function decodeLiteralChoice(encoded, property) {
  const candidate = JSON.parse(encoded);
  if (!literalChoices(property).some(value => Object.is(value, candidate))) throw new Error('Value is outside the declared literal union.');
  return candidate;
}
export function literalChoiceLabel(value, choices) {
  const label = value === null ? 'null' : String(value);
  return choices.some(other => !Object.is(other, value) && String(other) === label) ? `${label} (${value === null ? 'null' : typeof value})` : label;
}

export function portabilityFindings(component) {
  const source = component.diagnostics?.length || 0;
  const platforms = {};
  for (const platform of ['ios', 'android']) {
    const support = component.support?.[platform];
    platforms[platform] = ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots'].reduce((count, key) => count + (support?.[key]?.length || 0), 0) + (support?.status === 'missing-adapter' ? 1 : 0);
  }
  return { source, ...platforms, total: source + platforms.ios + platforms.android };
}

// Abort fetches eagerly, and guard callbacks (including image load events) that
// may still arrive after cancellation or a component/platform change.
export function createLatestRequest() {
  let controller;
  let generation = 0;
  const cancel = () => { generation++; controller?.abort(); controller = undefined; };
  return {
    cancel,
    start() {
      cancel();
      const currentGeneration = generation;
      controller = new AbortController();
      return { signal: controller.signal, isCurrent: () => currentGeneration === generation };
    },
  };
}

export function nativeRenderRequest(tag, properties, dark) {
  return { tag, properties: JSON.parse(JSON.stringify(properties)), dark: Boolean(dark), width: 640 };
}

// Input stays ordered independently of the native frame stream. Legacy clients
// can still poll; a late create response is closed even after navigation.
export function createNativeLiveClient({ send, subscribe, onFrame, onEvents = () => {}, onError, pollInterval = 250, interactiveInterval = 1000 / 60, animationTail = 600, now = Date.now, schedule = setTimeout, unschedule = clearTimeout }) {
  let active = null;
  let visible = true;
  const close = id => id && Promise.resolve(send(`${id}/close`, {})).catch(() => {});
  function stop() {
    const previous = active;
    active = null;
    if (!previous) return;
    previous.closed = true;
    endStream(previous);
    unschedule(previous.timer);
    previous.queue.length = 0;
    void close(previous.id);
  }
  function accept(session, result) {
    if (active !== session || session.closed) return;
    if (result.sessionId !== session.id) throw new Error('The native host returned a different session. Reconnect to continue.');
    const events = (result.events || []).filter((event, index) => {
      const id = event.id ?? `${result.revision}:${index}`;
      if (session.eventIDs.has(id)) return false;
      session.eventIDs.add(id);
      if (session.eventIDs.size > 1000) session.eventIDs.delete(session.eventIDs.values().next().value);
      return true;
    });
    if (events.length) onEvents(events);
    if (typeof result.imageUrl === 'string' && Number.isFinite(result.revision) && result.revision > session.revision) {
      session.revision = result.revision;
      onFrame(result);
    }
  }
  async function pump(session) {
    if (active !== session || session.closed || session.busy || !session.id) return;
    unschedule(session.timer);
    const input = session.queue.shift();
    if (!input && (!visible || subscribe)) return;
    session.busy = true;
    const requestStartedAt = now();
    let received = false;
    try {
      const result = await send(`${session.id}/${input ? 'input' : 'frame'}`, input || {});
      received = true;
      accept(session, result);
      session.pollFailures = 0;
    } catch (error) {
      if (active === session) {
        // Retrying an input could duplicate a native action. Only idempotent
        // frame reads recover from transient browser transport failures.
        if (!input && !received && error?.name === 'TypeError' && session.pollFailures < 2) session.pollFailures++;
        else { stop(); onError(error); }
      }
    } finally {
      session.busy = false;
      if (active === session && !session.closed) {
        if (session.queue.length) void pump(session);
        else if (visible && !subscribe) {
          // Spend the frame budget on native work, rather than adding another
          // frame interval after a render that already spent that budget.
          const fast = session.pointerHeld || now() < session.animateUntil;
          const delay = fast && !session.pollFailures ? Math.max(0, interactiveInterval - (now() - requestStartedAt)) : pollInterval * Math.max(1, session.pollFailures);
          session.timer = schedule(() => pump(session), delay);
        }
      }
    }
  }
  function endStream(session) {
    session.streamGeneration = (session.streamGeneration || 0) + 1;
    const closeStream = session.closeStream; session.closeStream = null; closeStream?.();
  }
  function beginStream(session) {
    endStream(session);
    const generation = session.streamGeneration;
    const current = () => active === session && !session.closed && visible && generation === session.streamGeneration;
    session.closeStream = subscribe(session.id, result => {
      if (!current()) return;
      try { accept(session, result); } catch (error) { stop(); onError(error); }
    }, error => { if (current()) { stop(); onError(error); } });
  }
  async function start(payload) {
    stop();
    const session = { id: null, closed: false, busy: true, queue: [], revision: -1, eventIDs: new Set(), timer: undefined, pollFailures: 0, pointerHeld: false, animateUntil: 0 };
    active = session;
    try {
      const result = await send('session', payload);
      session.id = result.sessionId;
      if (active !== session || session.closed) { void close(session.id); return; }
      if (!session.id) throw new Error('The native host did not return a session.');
      accept(session, result);
      session.busy = false;
      if (visible) { if (subscribe) beginStream(session); else session.timer = schedule(() => pump(session), pollInterval); }
    } catch (error) {
      if (active === session) { stop(); onError(error); }
    }
  }
  return {
    start, stop,
    input(command) {
      if (!active?.id || active.closed) return false;
      // A stuck host must not accumulate unbounded text or key commands.
      const releasing = command.command === 'pointer' && ['up', 'cancel'].includes(command.phase);
      if (active.queue.length >= 100 && !releasing) return false;
      if (command.command === 'pointer') {
        if (['down', 'up', 'cancel'].includes(command.phase)) active.pointerHeld = command.phase === 'down';
        active.animateUntil = now() + animationTail;
      }
      // Pointer motion never queues stale positions ahead of a release.
      const previous = active.queue.at(-1);
      if (command.command === 'pointer' && ['move', 'leave'].includes(command.phase) && previous?.command === 'pointer' && ['move', 'leave'].includes(previous.phase)) active.queue[active.queue.length - 1] = command;
      else active.queue.push(command);
      void pump(active);
      return true;
    },
    setVisible(value) {
      if (visible === Boolean(value)) return;
      visible = Boolean(value);
      if (!active) return;
      unschedule(active.timer);
      if (subscribe) { if (visible && active.id) beginStream(active); else endStream(active); }
      else if (visible) void pump(active);
    },
  };
}

export function nativeImagePoint(rect, pixelWidth, pixelHeight, logicalWidth, logicalHeight, clientX, clientY) {
  if (![rect.width, rect.height, pixelWidth, pixelHeight, logicalWidth, logicalHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(rect.width / pixelWidth, rect.height / pixelHeight);
  const width = pixelWidth * scale, height = pixelHeight * scale;
  const x = clientX - rect.left - (rect.width - width) / 2;
  const y = clientY - rect.top - (rect.height - height) / 2;
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x: x / width * logicalWidth, y: y / height * logicalHeight };
}

// One physical pointer owns a native press. Cancellation must never turn into
// an activation, and lost capture after a normal release must be a no-op.
export function createNativePointerInput(send) {
  let held = null;
  return {
    get pointerId() { return held?.id ?? null; },
    down(id, point) {
      if (held || !point) return false;
      if (send({ command: 'pointer', phase: 'down', ...point }) === false) return false;
      held = { id, point };
      return true;
    },
    up(id, point) {
      if (!held || held.id !== id) return false;
      const previous = held;
      held = null;
      return send({ command: 'pointer', phase: point ? 'up' : 'cancel', ...(point || previous.point) }) !== false;
    },
    cancel(id = held?.id) {
      if (!held || held.id !== id) return false;
      const previous = held;
      held = null;
      return send({ command: 'pointer', phase: 'cancel', ...previous.point }) !== false;
    },
  };
}

export function nativeTextChunks(value) {
  const encoder = new TextEncoder(), chunks = [];
  let chunk = '', size = 0;
  for (const char of value) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 4000) { chunks.push(chunk); chunk = ''; size = 0; }
    chunk += char; size += bytes;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
