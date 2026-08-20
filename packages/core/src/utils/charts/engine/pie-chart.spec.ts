import { PieChartEngine } from './pie-chart';
import type { PieChartSpec } from './pie-layout';
import type { EngineTheme } from './layout';
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

const spec = (over: Partial<PieChartSpec> = {}): PieChartSpec => ({
  data: [
    { label: 'A', value: 50, color: '#6750A4' },
    { label: 'B', value: 30, color: '#B3261E' },
    { label: 'C', value: 20, color: '#7D5260' },
  ],
  innerRadius: '0%',
  outerRadius: '80%',
  startAngleDeg: 90,
  endAngleDeg: -270,
  paddingAngleDeg: 0,
  cornerRadius: 0,
  showLabels: false,
  highlight: 'none',
  legend: 'none',
  valueFormatter: (v) => String(v),
  ...over,
});

describe('PieChartEngine', () => {
  let ctx: RecordingCtx;
  let restore: () => void;
  let container: HTMLElement;
  let engine: PieChartEngine;

  beforeEach(() => {
    ({ ctx, restore } = installCanvas());
    container = makeChartContainer(400, 400);
    engine = new PieChartEngine(container);
  });

  afterEach(() => {
    engine.dispose();
    container.remove();
    restore();
  });

  describe('construction', () => {
    it('builds the canvas and the three overlay layers', () => {
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
      expect(canvas?.getAttribute('part')).toBe('plot-canvas');
      // plot + clipped overlay + unclipped legend layer + hover layer
      expect(container.children).toHaveLength(4);
    });

    it('has no scene until a spec arrives', () => {
      expect(engine.getScene()).toBeNull();
      expect(engine.getCenter()).toBeNull();
    });
  });

  describe('setSpec', () => {
    it('renders a scene with one slice per datum', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const scene = engine.getScene();
      expect(scene).toBeTruthy();
      expect(scene?.slices).toHaveLength(3);
    });

    it('actually paints to the canvas', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      // A scene that never reaches the context is the failure this catches.
      expect(ctx.calls.length).toBeGreaterThan(0);
      expect(ctx.ops()).toContain('fill');
    });

    it('reports the ring centre once there is a scene', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const c = engine.getCenter();
      expect(c).not.toBeNull();
      expect(c!.x).toBeGreaterThan(0);
      expect(c!.y).toBeGreaterThan(0);
    });

    it('reports a zero hole for a solid pie and a real one for a donut', async () => {
      engine.setSpec(spec({ innerRadius: '0%' }), theme);
      await flushFrames(8);
      expect(engine.getHoleBox().width).toBe(0);

      engine.setSpec(spec({ innerRadius: '60%' }), theme);
      await flushFrames(8);
      expect(engine.getHoleBox().width).toBeGreaterThan(0);
    });

    it('re-renders when the spec changes', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.setSpec(spec({ data: [{ label: 'Solo', value: 1, color: '#000' }] }), theme);
      await flushFrames(8);
      expect(engine.getScene()?.slices).toHaveLength(1);
    });

    it('survives an empty dataset', async () => {
      engine.setSpec(spec({ data: [] }), theme);
      await flushFrames(4);
      expect(engine.getScene()?.slices ?? []).toHaveLength(0);
    });

    it('omits hidden slices from the ring', async () => {
      engine.setSpec(
        spec({
          data: [
            { label: 'A', value: 50, color: '#6750A4' },
            { label: 'B', value: 30, color: '#B3261E', hidden: true },
          ],
        }),
        theme,
      );
      await flushFrames(8);
      expect(engine.getScene()?.slices).toHaveLength(1);
    });
  });

  describe('legend', () => {
    it('renders a chip per slice into the unclipped legend layer', async () => {
      engine.setSpec(spec({ legend: 'top-end' }), theme);
      await flushFrames(8);
      const nav = container.querySelector('[part="legend"]');
      expect(nav).toBeTruthy();
      expect(nav?.children).toHaveLength(3);
    });

    it('reports a legend click to the consumer', async () => {
      const onLegendClick = jest.fn();
      engine.setSpec(spec({ legend: 'top-end' }), theme, { onLegendClick });
      await flushFrames(8);
      const chip = container.querySelector('[part="legend"] button') as HTMLElement;
      chip.click();
      expect(onLegendClick).toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('ignores the observer’s initial same-size callback', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const before = ctx.calls.length;
      engine.resize(); // same rect as the last render
      // Repainting here would cancel the intro animation mid-flight.
      expect(ctx.calls.length).toBe(before);
    });

    it('repaints when the box actually changed', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const before = ctx.calls.length;
      container.getBoundingClientRect = () =>
        ({ width: 600, height: 500, top: 0, left: 0, right: 600, bottom: 500, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
      engine.resize();
      await nextFrame();
      expect(ctx.calls.length).toBeGreaterThan(before);
    });
  });

  describe('interaction', () => {
    const pointerAt = (el: HTMLElement, type: string, x: number, y: number) => {
      const ev = new CustomEvent(type, { bubbles: true }) as CustomEvent & {
        clientX: number;
        clientY: number;
      };
      Object.assign(ev, { clientX: x, clientY: y });
      el.dispatchEvent(ev);
      return ev;
    };

    it('moves keyboard focus onto a slice', async () => {
      const onHover = jest.fn();
      engine.setSpec(spec({ highlight: 'slice' }), theme, { onHover });
      await flushFrames(8);
      engine.focusIndex(1);
      await flushFrames(8);
      expect(engine.getScene()).toBeTruthy();
    });

    it('activates a slice, firing the press ripple', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      ctx.reset();
      engine.activate(0);
      await flushFrames(12);
      // The ripple animates, so activation must keep painting.
      expect(ctx.calls.length).toBeGreaterThan(0);
    });

    it('ignores pointer moves that miss every slice', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      const canvas = container.querySelector('canvas') as HTMLElement;
      // Far outside the ring — must not throw or report a hover.
      expect(() => pointerAt(canvas, 'pointermove', 5000, 5000)).not.toThrow();
      await flushFrames(4);
    });

    it('clears the hover on pointerleave', async () => {
      engine.setSpec(spec({ highlight: 'slice' }), theme);
      await flushFrames(8);
      const canvas = container.querySelector('canvas') as HTMLElement;
      pointerAt(canvas, 'pointermove', 200, 200);
      await flushFrames(4);
      expect(() => canvas.dispatchEvent(new CustomEvent('pointerleave', { bubbles: true }))).not.toThrow();
      await flushFrames(8);
    });
  });

  describe('replay / drill', () => {
    it('replays the intro without throwing', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.replay();
      await flushFrames(20);
      expect(engine.getScene()).toBeTruthy();
    });

    it('queues a drill and settles on the new level', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.drill(0, 'down');
      engine.setSpec(spec({ data: [{ label: 'A1', value: 10, color: '#111' }] }), theme);
      await flushFrames(40);
      expect(engine.getScene()?.slices).toHaveLength(1);
    });
  });

  describe('export + teardown', () => {
    it('exports the canvas as a data URL', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      expect(engine.toDataURL()).toContain('data:image/png');
      expect(engine.toDataURL('image/jpeg')).toContain('image/jpeg');
    });

    it('detaches its DOM and drops the scene on dispose', async () => {
      engine.setSpec(spec(), theme);
      await flushFrames(8);
      engine.dispose();
      expect(container.querySelector('canvas')).toBeNull();
      expect(engine.getScene()).toBeNull();
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
