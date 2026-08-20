import {
  RIPPLE_MAX_SETTLE_MS,
  RIPPLE_RELEASE_FADE_MS,
  triggerRipple,
  waitForHostRipple,
  type RippleElement,
} from './ripple';

/**
 * A host with a shadow root containing one or more fake `<md-ripple>`s.
 * Real `md-ripple` only reacts to `pointerdown`; these helpers exist so
 * keyboard activation can drive it directly.
 */
function makeHost(
  ripples: Array<{ tag?: string; el?: Partial<RippleElement> }> = [],
): HTMLElement {
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  for (const { tag = 'md-ripple', el } of ripples) {
    const node = document.createElement(tag) as RippleElement;
    Object.assign(node, el);
    root.appendChild(node);
  }
  return host;
}

describe('ripple utils', () => {
  describe('triggerRipple', () => {
    it('triggers the ripple in the host shadow root', () => {
      const trigger = jest.fn().mockResolvedValue(undefined);
      const host = makeHost([{ el: { trigger } }]);
      triggerRipple(host);
      expect(trigger).toHaveBeenCalledTimes(1);
    });

    it('scopes to a selector when a component renders more than one ripple', () => {
      const lead = jest.fn().mockResolvedValue(undefined);
      const trail = jest.fn().mockResolvedValue(undefined);
      const host = document.createElement('div');
      const root = host.attachShadow({ mode: 'open' });
      for (const [cls, fn] of [
        ['leading', lead],
        ['trailing', trail],
      ] as const) {
        const r = document.createElement('md-ripple') as RippleElement;
        r.className = cls;
        r.trigger = fn;
        root.appendChild(r);
      }
      triggerRipple(host, 'md-ripple.trailing');
      expect(trail).toHaveBeenCalledTimes(1);
      expect(lead).not.toHaveBeenCalled();
    });

    it('is a no-op when the host has no shadow root', () => {
      expect(() => triggerRipple(document.createElement('div'))).not.toThrow();
    });

    it('is a no-op when no ripple matches the selector', () => {
      const host = makeHost([{ el: { trigger: jest.fn() } }]);
      expect(() => triggerRipple(host, 'md-ripple.missing')).not.toThrow();
    });

    it('is a no-op when the ripple has not upgraded yet', () => {
      // Element exists in the shadow root but its class has not been defined,
      // so `trigger` is undefined — the common pre-hydration state.
      const host = makeHost([{}]);
      expect(() => triggerRipple(host)).not.toThrow();
    });
  });

  describe('waitForHostRipple', () => {
    it('awaits the ripple when it reports its own settle', async () => {
      let settled = false;
      const host = makeHost([
        {
          el: {
            whenSettled: () =>
              new Promise<void>((r) =>
                setTimeout(() => {
                  settled = true;
                  r();
                }, 20),
              ),
          },
        },
      ]);
      await waitForHostRipple(host);
      expect(settled).toBe(true);
    });

    it('holds for at least one release-fade beat even if the wave settles instantly', async () => {
      const host = makeHost([{ el: { whenSettled: () => Promise.resolve() } }]);
      const started = Date.now();
      await waitForHostRipple(host);
      // Otherwise a menu item would close before its ripple was ever seen.
      expect(Date.now() - started).toBeGreaterThanOrEqual(RIPPLE_RELEASE_FADE_MS - 5);
    });

    it('does not pad further when the wave already outran the fade', async () => {
      const host = makeHost([
        {
          el: {
            whenSettled: () =>
              new Promise<void>((r) => setTimeout(r, RIPPLE_RELEASE_FADE_MS + 60)),
          },
        },
      ]);
      const started = Date.now();
      await waitForHostRipple(host);
      const elapsed = Date.now() - started;
      expect(elapsed).toBeGreaterThanOrEqual(RIPPLE_RELEASE_FADE_MS);
      expect(elapsed).toBeLessThan(RIPPLE_RELEASE_FADE_MS * 2 + 60);
    });

    it('falls back to the fade duration when the host has no shadow root', async () => {
      const started = Date.now();
      await waitForHostRipple(document.createElement('div'));
      expect(Date.now() - started).toBeGreaterThanOrEqual(RIPPLE_RELEASE_FADE_MS - 5);
    });

    it('falls back when the ripple has not upgraded', async () => {
      const started = Date.now();
      await waitForHostRipple(makeHost([{}]));
      expect(Date.now() - started).toBeGreaterThanOrEqual(RIPPLE_RELEASE_FADE_MS - 5);
    });

    it('honours a selector so one ripple does not gate on another', async () => {
      const wrong = jest.fn();
      const host = document.createElement('div');
      const root = host.attachShadow({ mode: 'open' });
      const a = document.createElement('md-ripple') as RippleElement;
      a.className = 'leading';
      a.whenSettled = wrong;
      const b = document.createElement('md-ripple') as RippleElement;
      b.className = 'trailing';
      b.whenSettled = () => Promise.resolve();
      root.append(a, b);
      await waitForHostRipple(host, 'md-ripple.trailing');
      expect(wrong).not.toHaveBeenCalled();
    });

    it('resolves within the documented settle bound', async () => {
      const host = makeHost([{ el: { whenSettled: () => Promise.resolve() } }]);
      const started = Date.now();
      await waitForHostRipple(host);
      expect(Date.now() - started).toBeLessThan(RIPPLE_MAX_SETTLE_MS);
    });
  });
});
