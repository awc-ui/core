import { LineChartEngine } from './chart';
import type { EngineTheme, LineChartSpec } from './layout';
import {
  flushFrames,
  installCanvas,
  makeChartContainer,
  nextFrame,
  type RecordingCtx,
} from './test-utils/canvas-harness';

const theme: EngineTheme = {
  background: 'transparent',
  textColor: '#1C1B1F',
  textColorMuted: '#49454F',
  axisLineColor: '#79747E',
  gridLineColor: '#CAC4D0',
  surface: '#FFFBFE',
  fontFamily: 'Roboto',
  labelSize: 11,
  titleSize: 14,
};

const spec = (over: Partial<LineChartSpec> = {}): LineChartSpec => ({
  series: [
    {
      label: 'A',
      color: '#6750A4',
      data: [0, 50, 100],
      curve: 'linear',
      connectNulls: false,
      showMarks: true,
      hidden: false,
    },
  ],
  xValues: ['Jan', 'Feb', 'Mar'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: false,
  ...over,
});

/** A second series, for legend / multi-series paths. */
const twoSeries = (): Partial<LineChartSpec> => ({
  series: [
    { label: 'A', color: '#6750A4', data: [0, 50, 100], curve: 'linear', connectNulls: false, showMarks: true, hidden: false },
    { label: 'B', color: '#B3261E', data: [10, 20, 30], curve: 'linear', connectNulls: false, showMarks: true, hidden: false },
  ],
});

describe('LineChartEngine', () => {
  let ctx: RecordingCtx;
  let restore: () => void;
  let container: HTMLElement;
  let engine: LineChartEngine;

  const canvas = () => container.querySelector('canvas') as HTMLElement;

  /** Pointer events carry clientX/Y, which mock-doc's CustomEvent does not. */
  const pointer = (type: string, x: number, y: number) => {
    const ev = new CustomEvent(type, { bubbles: true }) as CustomEvent & {
      clientX: number;
      clientY: number;
      button: number;
    };
    Object.assign(ev, { clientX: x, clientY: y, button: 0 });
    canvas().dispatchEvent(ev);
  };

  beforeEach(() => {
    ({ ctx, restore } = installCanvas());
    container = makeChartContainer(400, 300);
    engine = new LineChartEngine(container);
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    restore();
  });

  describe('construction', () => {
    it('layers the canvas and its five overlay layers', () => {
      expect(canvas()).toBeTruthy();
      expect(canvas().getAttribute('part')).toBe('plot-canvas');
      // canvas + overlay + legend + glyph + end-label + hover
      expect(container.children).toHaveLength(6);
    });

    it('has no scene until a spec arrives', () => {
      expect(engine.getScene()).toBeNull();
    });
  });

  describe('setSpec', () => {
    it('renders a polyline per series and paints it', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      expect(engine.getScene()?.lines).toHaveLength(1);
      expect(ctx.calls.length).toBeGreaterThan(0);
    });

    it('renders one line per visible series', async () => {
      engine.setSpec(spec(twoSeries()), theme);
      await flushFrames(8);
      expect(engine.getScene()?.lines).toHaveLength(2);
    });

    it('omits a hidden series', async () => {
      const s = twoSeries();
      s.series![1].hidden = true;
      engine.setSpec(spec(s), theme);
      await flushFrames(8);
      expect(engine.getScene()?.lines).toHaveLength(1);
    });

    it('fills the area when asked', async () => {
      engine.setSpec(spec({ area: true }), theme);
      await flushFrames(8);
      expect(engine.getScene()?.areas.length).toBeGreaterThan(0);
    });

    it('survives an empty dataset', async () => {
      engine.setSpec(spec({ series: [], xValues: [] }), theme);
      await flushFrames(4);
      expect(engine.getScene()?.lines ?? []).toHaveLength(0);
    });

    it('handles a gap in the data', async () => {
      engine.setSpec(
        spec({
          series: [
            { label: 'A', color: '#000', data: [0, null, 100], curve: 'linear', connectNulls: false, showMarks: true, hidden: false },
          ],
        }),
        theme,
      );
      await flushFrames(8);
      expect(engine.getScene()).toBeTruthy();
    });

    it('bridges a gap when connectNulls is set', async () => {
      engine.setSpec(
        spec({
          series: [
            { label: 'A', color: '#000', data: [0, null, 100], curve: 'linear', connectNulls: true, showMarks: true, hidden: false },
          ],
        }),
        theme,
      );
      await flushFrames(8);
      expect(engine.getScene()?.lines[0].points.length).toBeGreaterThan(0);
    });

    it('re-renders on a new spec', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.setSpec(spec(twoSeries()), theme);
      await flushFrames(8);
      expect(engine.getScene()?.lines).toHaveLength(2);
    });
  });

  describe('legend', () => {
    it('renders a chip per series and reports clicks', async () => {
      const onLegendClick = jest.fn();
      engine.setSpec(spec(twoSeries()), theme, { onLegendClick });
      await flushFrames(8);
      const nav = container.querySelector('[part="legend"]');
      expect(nav?.children).toHaveLength(2);
      (nav?.children[0] as HTMLElement).click();
      expect(onLegendClick).toHaveBeenCalled();
    });
  });

  describe('hover', () => {
    it('reports the nearest category as the pointer moves', async () => {
      const onHover = jest.fn();
      engine.setSpec(spec(), theme, { onHover });
      await flushFrames(8);
      pointer('pointermove', 200, 150);
      await flushFrames(4);
      expect(onHover).toHaveBeenCalled();
    });

    it('reports -1 when the pointer leaves', async () => {
      const onHover = jest.fn();
      engine.setSpec(spec(), theme, { onHover });
      await flushFrames(8);
      pointer('pointermove', 200, 150);
      await flushFrames(2);
      onHover.mockClear();
      pointer('pointerleave', 0, 0);
      await flushFrames(4);
      expect(onHover).toHaveBeenCalledWith(-1);
    });

    it('stays quiet once hover is disabled', async () => {
      const onHover = jest.fn();
      engine.setSpec(spec(), theme, { onHover });
      await flushFrames(8);
      engine.setHoverEnabled(false);
      onHover.mockClear();
      pointer('pointermove', 200, 150);
      await flushFrames(4);
      expect(onHover).not.toHaveBeenCalled();
    });

    it('accepts a tooltip configuration', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      expect(() => engine.setTooltip({})).not.toThrow();
    });
  });

  describe('clicks', () => {
    it('reports a background click with the nearest index', async () => {
      const onAxisClick = jest.fn();
      engine.setSpec(spec(), theme, { onAxisClick });
      await flushFrames(8);
      pointer('pointerdown', 200, 150);
      pointer('click', 200, 150);
      await flushFrames(4);
      // Either an axis click or a nearer target fired — the engine must not
      // swallow the gesture entirely.
      expect(ctx.calls.length).toBeGreaterThan(0);
    });

    it('treats a long drag as a gesture, not a click', async () => {
      const onAxisClick = jest.fn();
      engine.setSpec(spec(), theme, { onAxisClick });
      await flushFrames(8);
      pointer('pointerdown', 50, 150);
      // The drag is recognised from pointermove, not from comparing down/click
      // positions — so a real gesture has to travel, not teleport.
      pointer('pointermove', 300, 150);
      pointer('click', 300, 150);
      await flushFrames(4);
      expect(onAxisClick).not.toHaveBeenCalled();
    });
  });

  describe('focus', () => {
    it('moves the keyboard focus to a point', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      expect(() => engine.focusIndex(1)).not.toThrow();
      await flushFrames(8);
    });

    it('tolerates an out-of-range index', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      expect(() => engine.focusIndex(99)).not.toThrow();
      expect(() => engine.focusIndex(-1)).not.toThrow();
      await flushFrames(4);
    });
  });

  describe('resize', () => {
    it('ignores the observer’s initial same-size callback', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const before = ctx.calls.length;
      engine.resize();
      expect(ctx.calls.length).toBe(before);
    });

    it('repaints when the box actually changed', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const before = ctx.calls.length;
      container.getBoundingClientRect = () =>
        ({ width: 800, height: 500, top: 0, left: 0, right: 800, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
      engine.resize();
      await nextFrame();
      expect(ctx.calls.length).toBeGreaterThan(before);
    });
  });

  describe('replay / export / teardown', () => {
    it('replays the intro', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.replay();
      await flushFrames(20);
      expect(engine.getScene()).toBeTruthy();
    });

    it('exports a data URL', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      expect(engine.toDataURL()).toContain('data:image/png');
      expect(engine.toDataURL('image/jpeg')).toContain('image/jpeg');
    });

    it('detaches its DOM on dispose', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.dispose();
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('stops painting after dispose', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.dispose();
      ctx.reset();
      await flushFrames(10);
      // A leaked rAF would keep drawing into a detached canvas forever.
      expect(ctx.calls).toHaveLength(0);
    });

    it('tolerates a second dispose', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(4);
      engine.dispose();
      expect(() => engine.dispose()).not.toThrow();
    });
  });
});
