// macOS SwiftUI capture: drives the Laboratory's live SwiftUI host (AWCLivePreview --stdio) directly.
// `configure` renders the same request the Laboratory sends; `accessibility` returns the tree read through the
// macOS Accessibility API (AXUIElement — what VoiceOver receives), AppKit keyboard focus and the effective node.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';

export function macHost(root, binary = process.env.AWC_NATIVE_LIVE_RENDERER || path.join(root, 'apps/native-ios-playground/.build/debug/AWCLivePreview')) {
  const child = spawn(binary, ['--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map(); let next = 1; let closed = false; const stderr = [];
  child.stderr.on('data', d => { stderr.push(String(d)); if (stderr.length > 50) stderr.shift(); });
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', line => {
    let message; try { message = JSON.parse(line); } catch { return; }
    const resolve = pending.get(message.id); if (resolve) { pending.delete(message.id); resolve(message); }
  });
  child.on('exit', () => { closed = true; for (const resolve of pending.values()) resolve({ error: 'host exited', stderr: stderr.join('') }); pending.clear(); });
  const send = (command, timeout = 30000) => new Promise(resolve => {
    if (closed) return resolve({ error: 'host exited', stderr: stderr.join('') });
    const id = next++;
    const timer = setTimeout(() => { pending.delete(id); resolve({ error: `timeout ${command.command}` }); }, timeout);
    pending.set(id, value => { clearTimeout(timer); resolve(value); });
    child.stdin.write(JSON.stringify({ ...command, id }) + '\n');
  });
  return { send, close: () => { try { child.stdin.end(); } catch {} setTimeout(() => child.kill('SIGKILL'), 2000).unref(); } };
}

/** One case: configure, read the tree, then Tab through the preview and record keyboard focus after each step. */
export async function captureMac(host, request, { tabs = 0, update = null, settle = 0.35 } = {}) {
  const configured = await host.send({ command: 'configure', ...request });
  if (configured.error) return { error: configured.error, stderr: configured.stderr };
  await new Promise(r => setTimeout(r, settle * 1000));   // entry motions (sheets, dialogs) finish before the tree is read
  const snapshot = await host.send({ command: 'accessibility' });
  if (snapshot.error) return { error: snapshot.error, stderr: snapshot.stderr };
  const focus = [];
  for (let i = 0; i < tabs; i++) {
    const key = await host.send({ command: 'key', key: 'Tab' });
    if (key.error) { focus.push({ error: key.error }); break; }
    const s = await host.send({ command: 'accessibility' });
    focus.push({ keyboardFocus: s.keyboardFocus ?? null, axFocused: s.axFocused ?? null });
  }
  // A property update (Laboratory retained update) and the announcements it causes.
  let afterUpdate = null;
  if (update) {
    const u = await host.send({ command: 'update', properties: update });
    await new Promise(r => setTimeout(r, 600));
    const s = await host.send({ command: 'accessibility' });
    afterUpdate = u.error ? { error: u.error } : { announcements: s.announcements ?? [], tree: s.windows };
  }
  // The first snapshot's pixels (before any Tab focus ring) feed the contrast check.
  const image = snapshot.image ? { scale: snapshot.image.scale, offset: [0, 0], cssPerUnit: 1 } : null, png = snapshot.image ? Buffer.from(snapshot.image.png, 'base64') : null;
  return { platform: 'macos', image, png, announcements: snapshot.announcements ?? [], afterUpdate, tree: snapshot.windows, keyboardFocus: snapshot.keyboardFocus, axFocused: snapshot.axFocused ?? null, axTrusted: snapshot.axTrusted, node: snapshot.node, focus, inspection: configured.inspection ?? null };
}
