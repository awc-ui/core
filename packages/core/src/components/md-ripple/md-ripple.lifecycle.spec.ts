import { newSpecPage } from '@stencil/core/testing';
import { MdRipple } from './md-ripple';

type Handle = HTMLElement & { trigger(): Promise<void>; whenSettled(): Promise<void>; disabled: boolean };
type Recorded = { target: HTMLElement; frames: any[]; options: any; animation: any; finish(): void; cancel(): void };

describe('md-ripple lifecycle ownership', () => {
  let records: Recorded[];
  let originalAnimate: PropertyDescriptor | undefined;
  let originalStyle: typeof getComputedStyle;
  let tokens: Record<string, string>;

  beforeEach(() => {
    records = []; tokens = {};
    originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
    originalStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = ((element: HTMLElement) => ({ display: 'block',
      getPropertyValue: (name: string) => name === '--md-ripple-opacity' && element.tagName !== 'MD-RIPPLE' ? '.12' : tokens[name] || '',
    })) as any;
    (HTMLElement.prototype as any).animate = function (frames: any[], options: any) {
      const listeners: Array<() => void> = [];
      let resolve!: () => void, reject!: (reason: Error) => void;
      const finished = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
      // The test harness observes cancelled promises as a browser caller would.
      finished.catch(() => undefined);
      const record: Recorded = { target: this, frames, options,
        animation: { playState: 'running', finished,
          addEventListener: (name: string, fn: () => void) => { if (name === 'finish') listeners.push(fn); },
          removeEventListener: () => undefined,
          cancel: () => record.cancel(),
        },
        finish: () => { record.animation.playState = 'finished'; resolve(); listeners.forEach(fn => fn()); },
        cancel: () => { record.animation.playState = 'idle'; reject(new Error('cancelled')); },
      };
      records.push(record);
      return record.animation;
    };
  });
  afterEach(() => {
    globalThis.getComputedStyle = originalStyle;
    if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
    else delete (HTMLElement.prototype as any).animate;
  });
  async function create() {
    const page = await newSpecPage({ components: [MdRipple], html: '<button id="surface"><md-ripple></md-ripple></button>' });
    const host = page.body.querySelector('#surface') as HTMLElement;
    host.getBoundingClientRect = () => ({ x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 }) as DOMRect;
    const ripple = page.body.querySelector('md-ripple') as Handle;
    const press = (extra = {}) => {
      const event = new CustomEvent('pointerdown', { bubbles: true });
      Object.assign(event, { clientX: 30, clientY: 30, button: 0, pointerId: 3, isPrimary: true }, extra);
      host.dispatchEvent(event);
    };
    const release = (pointerId = 3, name = 'pointerup') => {
      const event = new CustomEvent(name); Object.assign(event, { pointerId }); window.dispatchEvent(event);
    };
    return { page, host, ripple, press, release, waves: () => ripple.shadowRoot!.querySelectorAll('.md-ripple__wave').length };
  }
  const flush = async () => { for (let n = 0; n < 6; n++) await Promise.resolve(); };

  it.each([{ button: 2 }, { isPrimary: false }])('ignores non-activation pointer %j', async extra => {
    const c = await create(); c.press(extra); expect(c.waves()).toBe(0);
  });
  it('ignores a release belonging to another pointer', async () => {
    const c = await create(); c.press(); records[0].finish(); c.release(8); await flush();
    expect(records).toHaveLength(1);
    c.release(); await flush(); expect(records).toHaveLength(2); records[1].finish(); await flush();
    expect(c.waves()).toBe(0);
  });
  it('removes both release subscriptions after the matching release', async () => {
    const c = await create();
    const remove = jest.spyOn(c.ripple.ownerDocument.defaultView!, 'removeEventListener');
    c.press(); c.release();
    expect(remove.mock.calls.some(args => args[0] === 'pointerup')).toBe(true);
    expect(remove.mock.calls.some(args => args[0] === 'pointercancel')).toBe(true);
    records[0].finish(); await flush(); records[1].finish(); await flush(); remove.mockRestore();
  });
  it('cancels and removes a held wave on disconnect and reconnects cleanly', async () => {
    const c = await create(); c.press(); c.ripple.remove(); await c.page.waitForChanges();
    expect(c.waves()).toBe(0); expect(records[0].animation.playState).toBe('idle');
    c.host.append(c.ripple); await c.page.waitForChanges(); c.press(); expect(c.waves()).toBe(1);
    c.ripple.remove(); await c.page.waitForChanges();
  });
  it('cancels a held wave when disabled changes', async () => {
    const c = await create(); c.press(); c.ripple.disabled = true; await c.page.waitForChanges();
    expect(c.waves()).toBe(0);
  });
  it('uses per-instance opacity and parses seconds as a CSS time', async () => {
    tokens['--md-ripple-opacity'] = '.35'; tokens['--md-ripple-grow-duration'] = '.6s';
    const c = await create(); c.press();
    expect(records[0].frames[0].opacity).toBe(.35); expect(records[0].options.duration).toBe(600);
    c.ripple.remove(); await c.page.waitForChanges();
  });
  it.each([['2', 1], ['-1', 0], ['.5junk', .12]])('normalizes opacity %s to %s', async (raw, expected) => {
    tokens['--md-ripple-opacity'] = raw as string; const c = await create(); c.press();
    expect(records[0].frames[0].opacity).toBe(expected); c.ripple.remove(); await c.page.waitForChanges();
  });
  it('does not treat percentages as concrete-pixel extension hooks', async () => {
    tokens['--md-ripple-extend-inline'] = '20%'; const c = await create(); c.press();
    expect(parseFloat(records[0].target.style.width)).toBeCloseTo(2 * Math.hypot(80,30));
    c.ripple.remove(); await c.page.waitForChanges();
  });
  it('keeps settling scoped to the new wave when an old wave is replaced', async () => {
    const c = await create(); c.press(); c.release(); c.press();
    let settled = false; void c.ripple.whenSettled().then(() => { settled = true; });
    records[0].finish(); await flush();
    expect(settled).toBe(false); expect(c.waves()).toBe(1);
    c.release(); [...records].reverse().find(record => record.frames[0].transform)?.finish(); await flush();
    [...records].reverse().find(record => !record.frames[0].transform)?.finish(); await flush();
    expect(settled).toBe(true); expect(c.waves()).toBe(0);
  });
  it('cleans up an externally cancelled grow animation without rejecting release', async () => {
    const c = await create(); c.press(); c.release(); records[0].cancel(); await flush();
    expect(c.waves()).toBe(0);
  });
  it('cancels a held press when its window loses focus', async () => {
    const c = await create(); c.press(); window.dispatchEvent(new CustomEvent('blur')); await flush();
    expect(c.waves()).toBe(0);
  });
  it('falls back for invalid easing without leaving an unanimated wave', async () => {
    tokens['--md-ripple-grow-easing'] = 'invalid-easing';
    const animate = (HTMLElement.prototype as any).animate;
    (HTMLElement.prototype as any).animate = function (frames: any[], options: any) {
      if (options.easing === 'invalid-easing') throw new TypeError('Invalid easing');
      return animate.call(this, frames, options);
    };
    const c = await create(); await expect(c.ripple.trigger()).resolves.toBeUndefined();
    expect(records[0].options.easing).toBe('cubic-bezier(0.2, 0, 0, 1)');
    c.ripple.remove(); await c.page.waitForChanges();
  });
  it('allows an explicitly instantaneous grow duration', async () => {
    tokens['--md-ripple-grow-duration'] = '0s'; const c = await create(); c.press();
    expect(records[0].options.duration).toBe(0);
    c.ripple.remove(); await c.page.waitForChanges();
  });
});
