import { MockWindow } from '@stencil/core/mock-doc';
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

function paintClock() {
  const view = new MockWindow() as unknown as Window;
  const pending = new Map<number, FrameRequestCallback>();
  let request = 0;
  view.requestAnimationFrame = callback => { pending.set(++request, callback); return request; };
  view.cancelAnimationFrame = id => { pending.delete(id); };
  return {
    document: view.document,
    pending,
    paint: () => {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach(callback => callback(0));
    },
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

  it('opens in the adopted document even if the original window never paints again', async () => {
    const source = paintClock();
    const destination = paintClock();
    const f = fixture();
    source.document.body.appendChild(f.host);
    f.lifecycle.connected();
    f.lifecycle.loaded();
    const originalOpening = f.show();
    source.paint();
    await Promise.resolve();
    const [staleFrame] = source.pending.values();
    expect(staleFrame).toBeDefined();

    f.lifecycle.disconnect();
    await originalOpening;
    expect(source.pending.size).toBe(0);
    destination.document.body.appendChild(f.host);
    const commit = jest.spyOn(f.host, 'getBoundingClientRect');
    f.lifecycle.connected();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(destination.pending.size).toBe(0);
    await f.show();
    expect(f.open).toBe(true);
    staleFrame(0);
    await Promise.resolve();
    expect(destination.pending.size).toBe(0);
  });

  it('still waits for two new frames when reconnected in the same document', async () => {
    const clock = paintClock();
    const f = fixture();
    clock.document.body.appendChild(f.host);
    f.lifecycle.loaded();
    clock.paint();
    await Promise.resolve();

    f.lifecycle.disconnect();
    expect(clock.pending.size).toBe(0);
    f.lifecycle.connected();
    const opening = f.show();
    expect(clock.pending.size).toBe(1);
    clock.paint();
    await Promise.resolve();
    expect(f.open).toBe(false);
    clock.paint();
    await opening;
    expect(f.open).toBe(true);
  });
});
