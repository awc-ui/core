import type { VirtualRow } from './wasm-option-store';

/**
 * The controller owns window math and scroll wiring; the WASM store is a
 * separate, already-specced unit. Mocking it keeps this suite about the
 * controller and lets us drive row counts directly.
 */
const store = {
  length: 0,
  ready: Promise.resolve() as Promise<void>,
  ensureReady: jest.fn((): Promise<void> => store.ready),
  load: jest.fn(() => Promise.resolve()),
  setQuery: jest.fn((): number => store.length),
  setFilterMode: jest.fn(),
  reset: jest.fn(),
  getLabels: jest.fn(() => new Map<string, string>()),
  getWindow: jest.fn(
    (start: number, count: number): VirtualRow[] =>
      Array.from({ length: Math.max(0, count) }, (_, i) => ({
        index: start + i,
        value: `v${start + i}`,
        label: `L${start + i}`,
        disabled: false,
        icon: '',
        supportingText: '',
      })) as VirtualRow[],
  ),
  labelAt: jest.fn((i: number) => `L${i}`),
  disabledAt: jest.fn(() => false),
  findLabelPrefix: jest.fn(() => -1),
};

let wasmSupported = true;

jest.mock('./wasm-option-store', () => ({
  __esModule: true,
  isWasmSupported: () => wasmSupported,
  WasmOptionStore: jest.fn(() => store),
}));

import { VirtualSelectController, type VirtualSelectHost } from './virtual-select-controller';

const ROW_H = 48;
/** Above this the spacers exceed DEFAULT_MAX_SCROLL_HEIGHT (1.5M) and the
 *  controller switches to its scaled, anchor-driven regime. */
const SCALED_ROWS = 200_000;

/** A viewport we can pose exactly — mock-doc's clientHeight/scrollHeight are
 *  read-only zeros, which would collapse every window calculation. */
function makeViewport(opts: { clientHeight?: number; scrollHeight?: number } = {}) {
  const listeners: Record<string, Array<(e?: unknown) => void>> = {};
  return {
    scrollTop: 0,
    clientHeight: opts.clientHeight ?? 320,
    scrollHeight: opts.scrollHeight ?? 1_000_000,
    addEventListener: jest.fn((t: string, fn: (e?: unknown) => void) => {
      (listeners[t] ??= []).push(fn);
    }),
    removeEventListener: jest.fn((t: string, fn: (e?: unknown) => void) => {
      listeners[t] = (listeners[t] ?? []).filter((f) => f !== fn);
    }),
    emit(t: string) {
      for (const fn of listeners[t] ?? []) fn();
    },
    listenerCount: (t: string) => (listeners[t] ?? []).length,
  };
}

type Viewport = ReturnType<typeof makeViewport>;

/** Resolve after `n` animation frames — the controller coalesces on rAF. */
const frames = (n = 1) =>
  new Promise<void>((resolve) => {
    let left = n;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });

function setup(
  opts: { rows?: number; item?: (i: number) => HTMLElement | null; vp?: Viewport } = {},
) {
  const requestRender = jest.fn();
  const queryItem = jest.fn(opts.item ?? (() => null));
  const host: VirtualSelectHost = { queryItem, requestRender };
  const ctrl = new VirtualSelectController(host);
  store.length = opts.rows ?? 100;
  store.setQuery.mockImplementation(() => store.length);
  return { ctrl, requestRender, queryItem, vp: opts.vp ?? makeViewport() };
}

async function attach(ctrl: VirtualSelectController, vp: Viewport) {
  await ctrl.attachViewport(() => Promise.resolve(vp as unknown as HTMLElement));
}

beforeEach(() => {
  wasmSupported = true;
  store.length = 0;
  store.ready = Promise.resolve();
  jest.clearAllMocks();
  store.getWindow.mockImplementation(
    (start: number, count: number) =>
      Array.from({ length: Math.max(0, count) }, (_, i) => ({
        index: start + i,
        value: `v${start + i}`,
        label: `L${start + i}`,
        disabled: false,
        icon: '',
        supportingText: '',
      })) as VirtualRow[],
  );
  store.labelAt.mockImplementation((i: number) => `L${i}`);
  store.disabledAt.mockImplementation(() => false);
  store.findLabelPrefix.mockImplementation(() => -1);
  store.getLabels.mockImplementation(() => new Map());
});

describe('VirtualSelectController', () => {
  describe('load', () => {
    it('activates and windows an array dataset', async () => {
      const { ctrl, requestRender } = setup({ rows: 500 });
      await expect(ctrl.load([{ value: 'a' }, { value: 'b' }])).resolves.toBe(true);
      expect(ctrl.active).toBe(true);
      expect(ctrl.filteredLength).toBe(500);
      expect(ctrl.windowRows.length).toBeGreaterThan(0);
      expect(requestRender).toHaveBeenCalled();
    });

    it('accepts a row factory without materialising it', async () => {
      const { ctrl } = setup({ rows: 3 });
      const source = { count: 3, getRow: jest.fn((i: number) => ({ value: `v${i}` })) };
      await expect(ctrl.load(source)).resolves.toBe(true);
      // The store streams the rows; the controller must not pull them itself.
      expect(source.getRow).not.toHaveBeenCalled();
    });

    it('declines when WASM is unavailable, leaving the host on its plain path', async () => {
      wasmSupported = false;
      const { ctrl } = setup();
      await expect(ctrl.load([{ value: 'a' }])).resolves.toBe(false);
      expect(ctrl.active).toBe(false);
      expect(store.load).not.toHaveBeenCalled();
    });

    it('declines an empty dataset rather than activating an empty window', async () => {
      const { ctrl } = setup();
      await expect(ctrl.load([])).resolves.toBe(false);
      await expect(ctrl.load({ count: 0, getRow: () => ({ value: 'x' }) })).resolves.toBe(false);
      expect(ctrl.active).toBe(false);
    });

    it('declines when the WASM module fails to initialise', async () => {
      const { ctrl } = setup({ rows: 10 });
      store.ensureReady.mockRejectedValueOnce(new Error('fetch failed'));
      await expect(ctrl.load([{ value: 'a' }])).resolves.toBe(false);
      expect(ctrl.active).toBe(false);
    });
  });

  describe('setQuery', () => {
    it('does nothing before a dataset is loaded', () => {
      const { ctrl, requestRender } = setup();
      ctrl.setQuery('abc');
      expect(requestRender).not.toHaveBeenCalled();
    });

    it('re-windows to the filtered length and scrolls back to the top', async () => {
      const { ctrl, vp } = setup({ rows: 1000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      vp.scrollTop = 4000;
      store.length = 12;
      ctrl.setQuery('foo');
      expect(store.setQuery).toHaveBeenCalledWith('foo');
      expect(ctrl.filteredLength).toBe(12);
      expect(vp.scrollTop).toBe(0);
      expect(ctrl.windowStart).toBe(0);
    });
  });

  it('delegates the filter mode and label lookups to the store', async () => {
    const { ctrl } = setup();
    ctrl.setFilterMode('fuzzy');
    expect(store.setFilterMode).toHaveBeenCalledWith('fuzzy');
    store.getLabels.mockReturnValueOnce(new Map([['a', 'Alpha']]));
    expect(ctrl.getLabels(['a']).get('a')).toBe('Alpha');
  });

  describe('setFixedRowHeight', () => {
    it('overrides the measured height', () => {
      const { ctrl } = setup();
      ctrl.setFixedRowHeight(72);
      expect(ctrl.rowHeight).toBe(72);
    });

    it('ignores non-positive values and keeps measuring', async () => {
      const { ctrl, vp } = setup({ rows: 50, item: () => ({ offsetHeight: 56 }) as HTMLElement });
      ctrl.setFixedRowHeight(0);
      ctrl.setFixedRowHeight(-10);
      ctrl.setFixedRowHeight(undefined);
      await attach(ctrl, vp);
      expect(ctrl.rowHeight).toBe(56);
    });

    it('wins over measurement when fixed', async () => {
      const { ctrl, vp } = setup({ rows: 50, item: () => ({ offsetHeight: 56 }) as HTMLElement });
      ctrl.setFixedRowHeight(40);
      await attach(ctrl, vp);
      expect(ctrl.rowHeight).toBe(40);
    });

    it('keeps the default when the rendered row has no height yet', async () => {
      const { ctrl, vp } = setup({ rows: 50, item: () => ({ offsetHeight: 0 }) as HTMLElement });
      await attach(ctrl, vp);
      expect(ctrl.rowHeight).toBe(ROW_H);
    });
  });

  describe('reset', () => {
    it('returns the controller to its pre-load state', async () => {
      const { ctrl } = setup({ rows: 100 });
      await ctrl.load([{ value: 'a' }]);
      ctrl.reset();
      expect(store.reset).toHaveBeenCalled();
      expect(ctrl.active).toBe(false);
      expect(ctrl.windowRows).toEqual([]);
      expect(ctrl.filteredLength).toBe(0);
      expect(ctrl.windowStart).toBe(0);
      expect(ctrl.topPad).toBe(0);
      expect(ctrl.bottomPad).toBe(0);
    });
  });

  describe('viewport wiring', () => {
    it('subscribes on attach and unsubscribes on detach', async () => {
      const { ctrl, vp } = setup({ rows: 100 });
      await attach(ctrl, vp);
      expect(vp.listenerCount('scroll')).toBe(1);
      ctrl.detachViewport();
      expect(vp.listenerCount('scroll')).toBe(0);
    });

    it('does not stack listeners when re-attached', async () => {
      const { ctrl, vp } = setup({ rows: 100 });
      await attach(ctrl, vp);
      await attach(ctrl, vp);
      expect(vp.listenerCount('scroll')).toBe(1);
    });

    it('tolerates a viewport that never resolves to an element', async () => {
      const { ctrl } = setup({ rows: 100 });
      await ctrl.attachViewport(() => Promise.resolve(null));
      expect(() => ctrl.detachViewport()).not.toThrow();
    });

    it('re-windows on scroll, coalescing a burst into one pass', async () => {
      const { ctrl, vp, requestRender } = setup({ rows: 5000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      requestRender.mockClear();
      vp.scrollTop = 4800;
      vp.emit('scroll');
      vp.emit('scroll');
      vp.emit('scroll');
      await frames(2);
      expect(requestRender).toHaveBeenCalledTimes(1);
      expect(ctrl.windowStart).toBeGreaterThan(0);
    });

    it('drops a pending scroll pass when detached mid-frame', async () => {
      const { ctrl, vp, requestRender } = setup({ rows: 5000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      requestRender.mockClear();
      vp.scrollTop = 4800;
      vp.emit('scroll');
      ctrl.detachViewport();
      await frames(2);
      expect(requestRender).not.toHaveBeenCalled();
    });
  });

  describe('ensureVisible — exact regime', () => {
    it('is a no-op with no viewport attached', async () => {
      const { ctrl } = setup({ rows: 100 });
      await expect(ctrl.provider.ensureVisible(10)).resolves.toBeUndefined();
    });

    it('scrolls up to reveal a row above the fold', async () => {
      const { ctrl, vp } = setup({ rows: 1000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      vp.scrollTop = 2000;
      await ctrl.provider.ensureVisible(10);
      expect(vp.scrollTop).toBe(10 * ROW_H);
    });

    it('scrolls down just far enough to seat a row below the fold', async () => {
      const { ctrl, vp } = setup({ rows: 1000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      vp.scrollTop = 0;
      await ctrl.provider.ensureVisible(20);
      // Bottom of row 20 flush with the bottom of a 320px viewport.
      expect(vp.scrollTop).toBe(21 * ROW_H - 320);
    });

    it('leaves the scroll alone for a row already in view', async () => {
      const { ctrl, vp } = setup({ rows: 1000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      vp.scrollTop = 480; // rows 10..16 visible
      await ctrl.provider.ensureVisible(12);
      expect(vp.scrollTop).toBe(480);
    });

    it('never scrolls above the top', async () => {
      const { ctrl, vp } = setup({ rows: 1000 });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      vp.scrollTop = 100;
      await ctrl.provider.ensureVisible(0);
      expect(vp.scrollTop).toBe(0);
    });

    it('clamps to the viewport maximum at the end of the list', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1000 * ROW_H });
      const { ctrl } = setup({ rows: 1000, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await ctrl.provider.ensureVisible(999);
      expect(vp.scrollTop).toBeLessThanOrEqual(1000 * ROW_H - 320);
    });

    it('stops waiting once the host renders the target row', async () => {
      const item = jest.fn(() => ({ offsetHeight: ROW_H }) as HTMLElement);
      const { ctrl, vp } = setup({ rows: 1000, item });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await expect(ctrl.provider.ensureVisible(30)).resolves.toBeUndefined();
    });

    it('gives up after a bounded wait when the row never renders', async () => {
      const { ctrl, vp } = setup({ rows: 1000, item: () => null });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      // Bounded, so a stuck host cannot hang keyboard navigation forever.
      await expect(ctrl.provider.ensureVisible(30)).resolves.toBeUndefined();
    });
  });

  describe('ensureVisible — scaled regime', () => {
    it('pins an anchor instead of trusting the coarse scrollTop', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1_500_000 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await ctrl.provider.ensureVisible(150_000);
      // One pixel of a capped 1.5M-px track spans several rows, so the window
      // must be anchor-driven for the target row to be in it at all.
      expect(ctrl.windowStart).toBeLessThanOrEqual(150_000);
      expect(ctrl.windowStart + ctrl.windowRows.length).toBeGreaterThan(150_000);
    });

    it('keeps the anchor when the scroll event is its own programmatic one', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1_500_000 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await ctrl.provider.ensureVisible(150_000);
      const anchored = ctrl.windowStart;
      vp.emit('scroll'); // echo of the controller's own scrollTop write
      await frames(2);
      expect(ctrl.windowStart).toBe(anchored);
    });

    it('releases the anchor when the user genuinely scrolls', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1_500_000 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await ctrl.provider.ensureVisible(150_000);
      const anchored = ctrl.windowStart;
      vp.scrollTop = 20;
      vp.emit('scroll');
      await frames(2);
      expect(ctrl.windowStart).not.toBe(anchored);
    });

    it('walks the anchor row by row when navigating upward', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1_500_000 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await ctrl.provider.ensureVisible(100_000);
      const first = ctrl.windowStart;
      await ctrl.provider.ensureVisible(99_999);
      expect(ctrl.windowStart).toBeLessThanOrEqual(first);
    });

    it('clamps the anchor at the end of the list', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1_500_000 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await ctrl.provider.ensureVisible(SCALED_ROWS - 1);
      expect(ctrl.windowStart + ctrl.windowRows.length).toBeLessThanOrEqual(SCALED_ROWS);
    });
  });

  describe('detectScrollCap', () => {
    it('adopts a genuine browser height clamp and re-windows against it', async () => {
      // Asked for far more than the browser will give: the short reading IS the
      // real maximum element height.
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 1_200_000 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await frames(4);
      await ctrl.provider.ensureVisible(SCALED_ROWS - 1);
      expect(ctrl.windowStart).toBeGreaterThan(0);
    });

    it('does not mistake an unlaid-out viewport for a clamp', async () => {
      // A tiny scrollHeight means the spacers have not rendered yet. Locking it
      // in would permanently collapse the scroll geometry — the cap never grows
      // back — so it must retry rather than adopt.
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 500 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      await frames(6);
      // Geometry still spans the whole dataset.
      expect(ctrl.topPad + ctrl.bottomPad).toBeGreaterThan(1000);
      ctrl.detachViewport();
    });

    it('stops probing once the viewport is detached', async () => {
      const vp = makeViewport({ clientHeight: 320, scrollHeight: 500 });
      const { ctrl } = setup({ rows: SCALED_ROWS, vp });
      await ctrl.load([{ value: 'a' }]);
      await attach(ctrl, vp);
      ctrl.detachViewport();
      await frames(6);
      expect(vp.listenerCount('scroll')).toBe(0);
    });
  });

  describe('provider', () => {
    it('exposes the filtered count and delegates row queries to the store', async () => {
      const item = ({ id: 'row' }) as unknown as HTMLElement;
      const { ctrl } = setup({ rows: 42, item: () => item });
      await ctrl.load([{ value: 'a' }]);
      expect(ctrl.provider.count()).toBe(42);
      expect(ctrl.provider.labelAt(7)).toBe('L7');
      expect(ctrl.provider.isDisabledAt(7)).toBe(false);
      expect(ctrl.provider.domItemForIndex(7)).toBe(item);
      store.findLabelPrefix.mockReturnValueOnce(9);
      expect(ctrl.provider.findPrefix('ab', 0)).toBe(9);
      expect(store.findLabelPrefix).toHaveBeenCalledWith('ab', 0);
    });
  });
});
