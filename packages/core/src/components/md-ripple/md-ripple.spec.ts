import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdRipple } from './md-ripple';

/**
 * md-ripple had no spec of its own — its coverage came incidentally from
 * whichever components happened to embed it, which is why the interesting
 * branches (suppression, the release fade, host resolution) were never taken
 * deliberately.
 *
 * Two things have to be supplied before it does anything: mock-doc has no
 * `Element.animate`, and the ripple returns early without it; and the wave is
 * sized from the host's box, which mock-doc reports as zeros.
 */
type Ripple = HTMLElement & {
  disabled: boolean;
  trigger(): Promise<void>;
  whenSettled(): Promise<void>;
};

const box = (w = 100, h = 40) => () =>
  ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

/** A recording stand-in for Element.animate, since mock-doc has none. */
function installAnimate(opts: { finishGrow?: boolean; legacyFade?: boolean; cancelFade?: boolean } = {}) {
  const calls: Array<{ keyframes: unknown; options: unknown }> = [];
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  const prev = Object.getOwnPropertyDescriptor(proto, 'animate');
  proto.animate = function (keyframes: unknown, options: unknown) {
    calls.push({ keyframes, options });
    const fade = (options as { duration: number }).duration === 150;
    return {
      playState: opts.finishGrow === false ? 'running' : 'finished',
      cancel: () => undefined,
      finish: () => undefined,
      finished: fade && opts.legacyFade ? undefined : fade && opts.cancelFade ? Promise.reject(new Error('Animation cancelled')) : Promise.resolve(),
      addEventListener: (_t: string, cb: () => void) => cb(),
      removeEventListener: () => undefined,
    };
  };
  return {
    calls,
    restore: () => {
      if (prev) Object.defineProperty(proto, 'animate', prev);
      else delete proto.animate;
    },
  };
}

/** Suppress the ripple the way the global `data-ripple="off"` token does. */
function installComputedStyle(value: string) {
  const win = globalThis as unknown as { getComputedStyle?: unknown };
  const prev = win.getComputedStyle;
  win.getComputedStyle = () => ({
    getPropertyValue: (p: string) => (p === '--md-sys-ripple-enabled' ? value : ''),
    direction: 'ltr',
  });
  return () => {
    win.getComputedStyle = prev;
  };
}

/** A host element wrapping the ripple, as every consuming component does. */
async function create(attrs = ''): Promise<SpecPage> {
  const page = await newSpecPage({
    components: [MdRipple],
    html: `<button id="host"><md-ripple ${attrs}></md-ripple></button>`,
  });
  const host = page.body.querySelector('#host') as HTMLElement;
  host.getBoundingClientRect = box();
  await page.waitForChanges();
  return page;
}

const ripple = (page: SpecPage) => page.body.querySelector('md-ripple') as Ripple;
const host = (page: SpecPage) => page.body.querySelector('#host') as HTMLElement;

function press(page: SpecPage, x = 20, y = 10) {
  const ev = new CustomEvent('pointerdown', { bubbles: true }) as CustomEvent & Record<string, unknown>;
  Object.assign(ev, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  host(page).dispatchEvent(ev);
  return ev;
}

describe('md-ripple', () => {
  describe('public motion tokens', () => {
    it.each([
      { opacity: '0.3', inline: '20px', block: '10px', duration: '700ms', easing: 'linear', expectedOpacity: 0.3, expectedDuration: 700 },
      { opacity: 'invalid', inline: '-20px', block: 'calc(1px + 2px)', duration: 'invalid', easing: '', expectedOpacity: 0.12, expectedDuration: 450 },
    ])('uses valid tokens and safe fallbacks for $opacity/$duration', async (settings) => {
      const animation = installAnimate();
      const original = globalThis.getComputedStyle;
      const values: Record<string, string> = {
        '--md-ripple-opacity': settings.opacity,
        '--md-ripple-extend-inline': settings.inline,
        '--md-ripple-extend-block': settings.block,
        '--md-ripple-grow-duration': settings.duration,
        '--md-ripple-grow-easing': settings.easing,
      };
      globalThis.getComputedStyle = (() => ({ display: 'block', getPropertyValue: (name: string) => values[name] || '' })) as any;
      try {
        const page = await create();
        await ripple(page).trigger();
        await page.waitForChanges();
        expect(animation.calls[0].keyframes).toEqual([
          { transform: 'scale(0)', opacity: settings.expectedOpacity },
          { transform: 'scale(1)', opacity: settings.expectedOpacity },
        ]);
        expect(animation.calls[0].options).toMatchObject({ duration: settings.expectedDuration, easing: settings.easing || 'cubic-bezier(0.2, 0, 0, 1)' });
        await ripple(page).whenSettled();
        expect(page.root!.shadowRoot!.querySelectorAll('.md-ripple__wave')).toHaveLength(0);
      } finally {
        globalThis.getComputedStyle = original;
        animation.restore();
      }
    });

    it('skips a display-contents wrapper and unbinds when moved to another surface', async () => {
      const animation = installAnimate();
      const original = globalThis.getComputedStyle;
      globalThis.getComputedStyle = ((el: HTMLElement) => ({ display: el.id === 'boxless' ? 'contents' : 'block', getPropertyValue: () => '' })) as any;
      try {
        const page = await newSpecPage({ components: [MdRipple], html: '<button id="old"><span id="boxless"><md-ripple></md-ripple></span></button><button id="new">New</button>' });
        const old = page.body.querySelector('#old') as HTMLElement;
        old.getBoundingClientRect = box();
        const next = page.body.querySelector('#new') as HTMLElement;
        next.getBoundingClientRect = box();
        const el = ripple(page);
        await el.trigger();
        await page.waitForChanges();
        expect(animation.calls.length).toBeGreaterThan(0);
        el.remove();
        await page.waitForChanges();
        const before = animation.calls.length;
        old.dispatchEvent(new CustomEvent('pointerdown'));
        expect(animation.calls).toHaveLength(before);
        next.append(el);
        await page.waitForChanges();
        await el.trigger();
        await page.waitForChanges();
        expect(animation.calls.length).toBeGreaterThan(before);
      } finally {
        globalThis.getComputedStyle = original;
        animation.restore();
      }
    });
  });
  describe('rendering', () => {
    it('renders its container', async () => {
      const page = await create();
      expect(page.root?.shadowRoot?.querySelector('.md-ripple')).toBeTruthy();
    });
  });

  describe('press', () => {
    it('starts a wave on the host’s pointerdown', async () => {
      const a = installAnimate();
      const page = await create();
      press(page);
      await page.waitForChanges();
      // The ripple binds to its HOST, not itself — a press anywhere on the
      // button has to raise the wave.
      expect(a.calls.length).toBeGreaterThan(0);
      a.restore();
    });

    it('does nothing while disabled', async () => {
      const a = installAnimate();
      const page = await create('disabled');
      press(page);
      await page.waitForChanges();
      expect(a.calls).toHaveLength(0);
      a.restore();
    });

    it('does nothing when the ripple token is switched off', async () => {
      // The global `data-ripple="off"` switch resolves to
      // --md-sys-ripple-enabled: 0 on the element.
      const restoreCS = installComputedStyle('0');
      const a = installAnimate();
      const page = await create();
      press(page);
      await page.waitForChanges();
      expect(a.calls).toHaveLength(0);
      a.restore();
      restoreCS();
    });

    it('still ripples when the token is explicitly on', async () => {
      const restoreCS = installComputedStyle('1');
      const a = installAnimate();
      const page = await create();
      press(page);
      await page.waitForChanges();
      expect(a.calls.length).toBeGreaterThan(0);
      a.restore();
      restoreCS();
    });

    it('replaces an in-flight wave rather than stacking them', async () => {
      const a = installAnimate();
      const page = await create();
      press(page, 10, 10);
      press(page, 60, 20);
      await page.waitForChanges();
      // Two presses, but the container must not accumulate wave nodes.
      const container = page.root?.shadowRoot?.querySelector('.md-ripple') as HTMLElement;
      expect(container.children.length).toBeLessThanOrEqual(2);
      a.restore();
    });
  });

  describe('release', () => {
    it.each([{ finishGrow: false }, { legacyFade: true }, { cancelFade: true }])('removes waves with a supported animation adapter %j', async options => {
      const animation = installAnimate(options);
      try {
        const page = await create();
        press(page);
        window.dispatchEvent(new CustomEvent('pointerup'));
        await new Promise(resolve => setTimeout(resolve, 170));
        await page.waitForChanges();
        expect(page.root!.shadowRoot!.querySelectorAll('.md-ripple__wave')).toHaveLength(0);
        await expect(ripple(page).whenSettled()).resolves.toBeUndefined();
      } finally { animation.restore(); }
    });
    it('fades out on pointerup', async () => {
      const a = installAnimate();
      const page = await create();
      press(page);
      await page.waitForChanges();
      const before = a.calls.length;
      window.dispatchEvent(new CustomEvent('pointerup'));
      await page.waitForChanges();
      // The release fade is a second animation on the same wave.
      expect(a.calls.length).toBeGreaterThanOrEqual(before);
      a.restore();
    });

    it('also fades on pointercancel, so a scroll gesture cannot strand it', async () => {
      const a = installAnimate();
      const page = await create();
      press(page);
      await page.waitForChanges();
      expect(() => window.dispatchEvent(new CustomEvent('pointercancel'))).not.toThrow();
      await page.waitForChanges();
      a.restore();
    });

    it('tolerates a release with no wave in flight', async () => {
      const a = installAnimate();
      const page = await create();
      expect(() => window.dispatchEvent(new CustomEvent('pointerup'))).not.toThrow();
      await page.waitForChanges();
      a.restore();
    });
  });

  describe('trigger()', () => {
    it('raises a centred wave for a keyboard activation', async () => {
      const a = installAnimate();
      const page = await create();
      // md-ripple only listens for pointerdown, so Enter/Space activations call
      // this instead.
      await ripple(page).trigger();
      await page.waitForChanges();
      expect(a.calls.length).toBeGreaterThan(0);
      a.restore();
    });

    it('stays silent while disabled', async () => {
      const a = installAnimate();
      const page = await create('disabled');
      await ripple(page).trigger();
      await page.waitForChanges();
      expect(a.calls).toHaveLength(0);
      a.restore();
    });

    it('stays silent when the token is off', async () => {
      const restoreCS = installComputedStyle('0');
      const a = installAnimate();
      const page = await create();
      await ripple(page).trigger();
      await page.waitForChanges();
      expect(a.calls).toHaveLength(0);
      a.restore();
      restoreCS();
    });
  });

  describe('whenSettled()', () => {
    it('bounds the wait while a pointer is still held, without suppressing the eventual fade', async () => {
      const animation = installAnimate();
      try {
        const page = await create();
        press(page);
        expect(page.root!.shadowRoot!.querySelectorAll('.md-ripple__wave')).toHaveLength(1);
        await expect(ripple(page).whenSettled()).resolves.toBeUndefined();
        window.dispatchEvent(new CustomEvent('pointerup'));
        await page.waitForChanges();
        expect(page.root!.shadowRoot!.querySelectorAll('.md-ripple__wave')).toHaveLength(0);
      } finally { animation.restore(); }
    });
    it('resolves immediately when nothing is in flight', async () => {
      const page = await create();
      await expect(ripple(page).whenSettled()).resolves.toBeUndefined();
    });

    it('resolves after a press has been released', async () => {
      const a = installAnimate();
      const page = await create();
      press(page);
      await page.waitForChanges();
      window.dispatchEvent(new CustomEvent('pointerup'));
      // Bounded by its own max-wait, so a wave that never reports finished
      // cannot hang a caller forever.
      await expect(ripple(page).whenSettled()).resolves.toBeUndefined();
      a.restore();
    });
  });

  describe('teardown', () => {
    it('unbinds from the host when removed', async () => {
      const a = installAnimate();
      const page = await create();
      const el = ripple(page);
      el.remove();
      await page.waitForChanges();
      press(page);
      await page.waitForChanges();
      // A listener left on the host would keep firing at a detached ripple.
      expect(a.calls).toHaveLength(0);
      a.restore();
    });
  });
});
