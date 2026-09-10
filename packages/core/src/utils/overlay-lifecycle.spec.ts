import { OverlayLifecycle } from './overlay-lifecycle';

function fixture() {
  const host = document.createElement('div');
  host.attachShadow({ mode: 'open' });
  let open = false;
  const lifecycle = new OverlayLifecycle(() => host, () => open);
  return {
    host, lifecycle,
    get open() { return open; },
    show: () => lifecycle.show(() => { open = true; lifecycle.opened(); }),
    close: () => { lifecycle.cancelOpen(); open = false; lifecycle.closed(); },
  };
}

describe('OverlayLifecycle', () => {
  it('waits for the first closed render before opening', async () => {
    const f = fixture();
    const opening = f.show();
    await Promise.resolve();
    expect(f.open).toBe(false);
    f.lifecycle.loaded();
    await opening;
    expect(f.open).toBe(true);
    f.close();
    await f.lifecycle.whenClosed();
  });

  it('cancels a pending opening before the component has loaded', async () => {
    const f = fixture();
    const opening = f.show();
    f.close();
    await opening;
    f.lifecycle.loaded();
    await f.lifecycle.whenClosed();
    expect(f.open).toBe(false);
  });

  it('waits for shell motion and ignores nested or infinite animations', async () => {
    const f = fixture();
    f.lifecycle.loaded();
    await f.show();
    const shell = document.createElement('div');
    f.host.shadowRoot!.append(shell);
    const child = document.createElement('span');
    f.host.append(child);
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    Object.defineProperty(f.host, 'getAnimations', { value: () => [
      { effect: { target: shell, getTiming: () => ({ iterations: 1 }) }, finished },
      { effect: { target: child, getTiming: () => ({ iterations: Infinity }) }, finished: new Promise(() => {}) },
      { effect: { target: shell, getTiming: () => ({ iterations: Infinity }) }, finished: new Promise(() => {}) },
    ] });
    f.close();
    let closed = false;
    const completion = f.lifecycle.whenClosed().then(() => { closed = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed).toBe(false);
    finish();
    await completion;
    expect(closed).toBe(true);
  });

  it('keeps completion pending when an exit reverses into another opening', async () => {
    const f = fixture();
    f.lifecycle.loaded();
    await f.show();
    f.close();
    let closed = false;
    const completion = f.lifecycle.whenClosed().then(() => { closed = true; });
    await f.show();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed).toBe(false);
    f.close();
    await completion;
  });

  it('resolves pending callers when disconnected and supports reconnection', async () => {
    const f = fixture();
    const opening = f.show();
    f.lifecycle.disconnect();
    await opening;
    await f.lifecycle.whenClosed();
    expect(f.open).toBe(false);
    f.lifecycle.connected();
    f.lifecycle.loaded();
    await f.show();
    expect(f.open).toBe(true);
    f.close();
    await f.lifecycle.whenClosed();
  });
});
