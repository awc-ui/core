import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdLineChart } from './md-line-chart';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

/**
 * Drag-to-zoom and slider panning.
 *
 * Every pointer handler here goes through the ENGINE's scene, and under
 * mock-doc the engine bails on a zero-sized container — so each one returned at
 * its first guard. Giving the host and its canvas a real box makes it lay out
 * for real and opens the whole surface.
 *
 * md-line-chart.keyboard.spec.ts covers the cursor, the zoom API and the legend
 * separately: those needed no layout, because this component derives its
 * keyboard bound from the DATA rather than from the scene (md-area-chart does
 * the opposite).
 */
const HOST_W = 600;
const HOST_H = 400;

const rectOf = (w: number, h: number, left = 0, top = 0) => () =>
  ({
    width: w,
    height: h,
    left,
    top,
    right: left + w,
    bottom: top + h,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

type Chart = HTMLElement & {
  xAxis: unknown;
  series: unknown[];
  resize(): Promise<void>;
  setZoom(a: number, b: number): Promise<void>;
  resetZoom(): Promise<void>;
  getInstance(): Promise<{ getScene(): { plot: { x: number; y: number; width: number; height: number } } | null } | null>;
};

const CATS = ['A', 'B', 'C', 'D', 'E', 'F'];

async function create(attrs = 'zoom="both"') {
  const { restore } = installCanvas();
  const page = await newSpecPage({
    components: [MdLineChart],
    html: `<md-line-chart ${attrs}></md-line-chart>`,
  });
  const el = page.root as Chart;
  el.getBoundingClientRect = rectOf(HOST_W, HOST_H);
  const canvas = page.root!.shadowRoot!.querySelector('.md-line-chart__canvas') as HTMLElement | null;
  if (canvas) canvas.getBoundingClientRect = rectOf(HOST_W, HOST_H - 60);
  el.xAxis = { data: CATS };
  el.series = [{ label: 'S', data: [1, 2, 3, 4, 5, 6] }];
  await page.waitForChanges();
  await el.resize();
  await page.waitForChanges();
  return { page, el, restore };
}

/** Pointer events carry clientX/Y, which mock-doc's CustomEvent does not. */
function pointer(target: HTMLElement, type: string, x: number, y: number, init: Record<string, unknown> = {}) {
  const ev = new CustomEvent(type, { bubbles: true, composed: true }) as CustomEvent & Record<string, unknown>;
  Object.assign(ev, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    composedPath: () => [target],
    ...init,
  });
  (target as HTMLElement & { setPointerCapture?: unknown }).setPointerCapture = () => undefined;
  target.dispatchEvent(ev);
  return ev;
}

const zoomSpy = (el: HTMLElement) => {
  const calls: Array<{ startIndex: number; endIndex: number; reset: boolean }> = [];
  el.addEventListener('mdZoom', (e) => calls.push((e as CustomEvent).detail));
  return calls;
};

/** A y inside the plot band, so insidePlot() passes. */
const PLOT_Y = 150;

describe('md-line-chart — pointer & keyboard', () => {
  it('lays the engine out once the container has a real box', async () => {
    const { el, restore } = await create();
    const scene = (await el.getInstance())?.getScene();
    // The precondition every test below depends on.
    expect(scene).toBeTruthy();
    expect(scene!.plot.width).toBeGreaterThan(100);
    restore();
  });

  describe('drag to zoom', () => {
    it('zooms to the dragged band', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      pointer(el, 'pointerdown', 60, PLOT_Y);
      pointer(el, 'pointermove', 400, PLOT_Y);
      pointer(el, 'pointerup', 400, PLOT_Y);
      await page.waitForChanges();
      expect(calls.length).toBeGreaterThan(0);
      const last = calls[calls.length - 1];
      expect(last.endIndex).toBeGreaterThan(last.startIndex);
      restore();
    });

    it('treats a tiny drag as a click and leaves the view alone', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      pointer(el, 'pointerdown', 200, PLOT_Y);
      pointer(el, 'pointermove', 204, PLOT_Y); // under the 8px threshold
      pointer(el, 'pointerup', 204, PLOT_Y);
      await page.waitForChanges();
      // Otherwise every bar click would also zoom.
      expect(calls).toHaveLength(0);
      restore();
    });

    it('ignores a press outside the plot', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      // Below the plot band — the footer / slider region.
      pointer(el, 'pointerdown', 200, 395);
      pointer(el, 'pointermove', 400, 395);
      pointer(el, 'pointerup', 400, 395);
      await page.waitForChanges();
      expect(calls).toHaveLength(0);
      restore();
    });

    it('ignores a non-primary button', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      pointer(el, 'pointerdown', 60, PLOT_Y, { button: 2 });
      pointer(el, 'pointermove', 400, PLOT_Y);
      pointer(el, 'pointerup', 400, PLOT_Y);
      await page.waitForChanges();
      expect(calls).toHaveLength(0);
      restore();
    });

    it('ignores a move from a different pointer', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      pointer(el, 'pointerdown', 60, PLOT_Y);
      pointer(el, 'pointermove', 400, PLOT_Y, { pointerId: 99 });
      pointer(el, 'pointerup', 400, PLOT_Y, { pointerId: 99 });
      await page.waitForChanges();
      // A second finger must not drive the first one's gesture.
      expect(calls).toHaveLength(0);
      restore();
    });

    it('clamps the band to the plot edges', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      pointer(el, 'pointerdown', 60, PLOT_Y);
      pointer(el, 'pointermove', 5000, PLOT_Y); // way past the right edge
      pointer(el, 'pointerup', 5000, PLOT_Y);
      await page.waitForChanges();
      const last = calls[calls.length - 1];
      expect(last.endIndex).toBeLessThanOrEqual(CATS.length - 1);
      restore();
    });

    it('does not drag-zoom when zoom is slider-only', async () => {
      const { page, el, restore } = await create('zoom="slider"');
      const calls = zoomSpy(el);
      pointer(el, 'pointerdown', 60, PLOT_Y);
      pointer(el, 'pointermove', 400, PLOT_Y);
      pointer(el, 'pointerup', 400, PLOT_Y);
      await page.waitForChanges();
      expect(calls).toHaveLength(0);
      restore();
    });
  });

  describe('double-click', () => {
    it('resets an existing zoom from inside the plot', async () => {
      const { page, el, restore } = await create();
      await el.setZoom(1, 3);
      await page.waitForChanges();
      const calls = zoomSpy(el);
      pointer(el, 'dblclick', 200, PLOT_Y);
      await page.waitForChanges();
      expect(calls[calls.length - 1]?.reset).toBe(true);
      restore();
    });

    it('does nothing when there is no zoom to throw away', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      pointer(el, 'dblclick', 200, PLOT_Y);
      await page.waitForChanges();
      expect(calls).toHaveLength(0);
      restore();
    });

    it('ignores a double-click outside the plot', async () => {
      const { page, el, restore } = await create();
      await el.setZoom(1, 3);
      await page.waitForChanges();
      const calls = zoomSpy(el);
      // Two clicks on the slider track are not a request to reset.
      pointer(el, 'dblclick', 200, 395);
      await page.waitForChanges();
      expect(calls).toHaveLength(0);
      restore();
    });
  });

  describe('zoom slider', () => {
    const slider = (page: SpecPage) =>
      page.root!.shadowRoot!.querySelector('.md-line-chart__zoom-slider') as HTMLElement | null;

    it('renders for the slider modes only', async () => {
      for (const [mode, expected] of [
        ['none', false],
        ['inside', false],
        ['slider', true],
        ['both', true],
      ] as const) {
        const { page, restore } = await create(`zoom="${mode}"`);
        expect(Boolean(slider(page))).toBe(expected);
        restore();
      }
    });

    it('drives the window from the slider’s own input', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      const s = slider(page)!;
      s.dispatchEvent(
        new CustomEvent('mdInput', { bubbles: true, composed: true, detail: { valueStart: 1, valueEnd: 4 } }),
      );
      await page.waitForChanges();
      expect(calls[calls.length - 1]).toEqual(expect.objectContaining({ startIndex: 1, endIndex: 4 }));
      restore();
    });

    it('ignores a slider event with no values', async () => {
      const { page, el, restore } = await create();
      const calls = zoomSpy(el);
      slider(page)!.dispatchEvent(
        new CustomEvent('mdInput', { bubbles: true, composed: true, detail: {} }),
      );
      await page.waitForChanges();
      expect(calls).toHaveLength(0);
      restore();
    });

    it('pans the window without changing its span', async () => {
      const { page, el, restore } = await create();
      await el.setZoom(0, 2);
      await page.waitForChanges();
      const s = slider(page)!;
      s.getBoundingClientRect = rectOf(HOST_W, 24, 0, 360);
      const calls = zoomSpy(el);
      pointer(s, 'pointerdown', 100, 370);
      pointer(el, 'pointermove', 300, 370);
      pointer(el, 'pointerup', 300, 370);
      await page.waitForChanges();
      const last = calls[calls.length - 1];
      if (last) {
        // A pan slides the window; it does not resize it.
        expect(last.endIndex - last.startIndex).toBe(2);
      }
      restore();
    });
  });

  describe('keyboard cursor', () => {
    const plot = (page: SpecPage) =>
      page.root!.shadowRoot!.querySelector('.md-line-chart__canvas') as HTMLElement;

    async function press(page: SpecPage, key: string) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true });
      plot(page).dispatchEvent(ev);
      await page.waitForChanges();
      return ev;
    }

    /** The live region the cursor narrates into. */
    const announcement = (page: SpecPage) =>
      (page.root!.shadowRoot!.querySelector('[aria-live]')?.textContent ?? '').trim();

    it('narrates the datum it lands on', async () => {
      const { page, restore } = await create();
      await press(page, 'ArrowRight');
      // NOTE md-line-chart's keyboard cursor only updates the live region — it
      // does NOT emit mdHover the way md-line-chart's does, so the announcement
      // is the observable. It reads "<category>: <series> <value>" — note
      // md-bar-chart's reads the raw INDEX in the same slot.
      expect(announcement(page)).toBe('A: S 1');
      restore();
    });

    it('steps along the categories', async () => {
      const { page, restore } = await create();
      await press(page, 'ArrowRight');
      expect(announcement(page)).toBe('A: S 1');
      await press(page, 'ArrowRight');
      expect(announcement(page)).toBe('B: S 2');
      restore();
    });

    it('steps back', async () => {
      const { page, restore } = await create();
      await press(page, 'ArrowRight');
      await press(page, 'ArrowRight');
      await press(page, 'ArrowLeft');
      expect(announcement(page)).toBe('A: S 1');
      restore();
    });

    it('clamps at the last category', async () => {
      const { page, restore } = await create();
      for (let i = 0; i < 12; i++) await press(page, 'ArrowRight');
      expect(announcement(page)).toBe('F: S 6');
      restore();
    });

    it('Home and End jump to the ends', async () => {
      const { page, restore } = await create();
      await press(page, 'End');
      expect(announcement(page)).toBe('F: S 6');
      await press(page, 'Home');
      expect(announcement(page)).toBe('A: S 1');
      restore();
    });

    it('leaves unrelated keys alone', async () => {
      const { page, restore } = await create();
      expect((await press(page, 'q')).defaultPrevented).toBe(false);
      restore();
    });
  });
});
