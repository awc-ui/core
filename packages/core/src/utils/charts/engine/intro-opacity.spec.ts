/**
 * Chart engine — the entrance must never leave a layer faded out.
 * ===============================================================
 *
 * The entry animation fades the canvas (and its label layer) in by writing an
 * INLINE `opacity` on them, and the only thing that ever clears that inline
 * value is the animation loop's own terminal frame. So any path that ends the
 * loop early — a data update taking the bar-race FOLLOW branch, a drill armed
 * mid-entrance — has to undo the fade itself. When it didn't, the chart was
 * drawn correctly into a canvas pinned at `opacity: 0`: bars in the backing
 * store, nothing on screen, and no later write to style, so it never healed.
 *
 * The regression that motivated these: a host whose data is assigned AFTER it
 * hydrates (props set post-upgrade) renders once with an empty spec, starts the
 * entrance, and then the data render cancels it from the follow branch.
 *
 * These assert BOTH halves of the contract:
 *   - it always ends visible (inline opacity back to ''), and
 *   - it still animates (opacity passes through intermediate values first),
 * so a "fix" that just disables the entrance fails too.
 */
import { BarChartEngine } from './bar-chart';
import type { BarChartSpec } from './bar-layout';
import { LineChartEngine } from './chart';
import type { EngineTheme, LineChartSpec } from './layout';
import { PieChartEngine } from './pie-chart';
import type { PieChartSpec } from './pie-layout';
import { flushFrames, installCanvas, makeChartContainer, nextFrame } from './test-utils/canvas-harness';

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

/** mock-doc frames run ~1ms apart, so the 700ms default entrance never finishes
 *  inside a spec. A short duration keeps the same code path and settles. */
const SHORT = 25;

const barSpec = (over: Partial<BarChartSpec> = {}): BarChartSpec => ({
  series: [{ label: 'S1', color: '#6750A4', data: [3, 5, 2], hidden: false }],
  categories: ['A', 'B', 'C'],
  categoryFormatter: (v) => String(v),
  valueScale: 'value',
  valueFormatter: (v) => String(v),
  stack: 'none',
  horizontal: false,
  categoryGapRatio: 0.3,
  barGapRatio: 0.2,
  cornerRadius: 6,
  showLabels: true,
  ...over,
});

const emptyBar = (over: Partial<BarChartSpec> = {}): BarChartSpec => barSpec({ series: [], categories: [], ...over });

const lineSpec = (over: Partial<LineChartSpec> = {}): LineChartSpec => ({
  series: [{ label: 'A', color: '#6750A4', data: [0, 50, 100], curve: 'linear', connectNulls: false, showMarks: true, hidden: false }],
  xValues: ['Jan', 'Feb', 'Mar'],
  xScale: 'category',
  xFormatter: (v) => String(v),
  yScale: 'value',
  yFormatter: (v) => String(v),
  stack: 'none',
  area: false,
  ...over,
});

const pieSpec = (over: Partial<PieChartSpec> = {}): PieChartSpec => ({
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

/** Anything strictly between transparent and opaque — i.e. the fade really ran. */
const isMidFade = (v: string): boolean => v !== '' && Number(v) > 0 && Number(v) < 1;

describe('chart entrance — a cancelled intro must never leave the layer invisible', () => {
  let restore: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    ({ restore } = installCanvas());
    container = makeChartContainer(400, 300);
  });

  afterEach(() => {
    container.remove();
    restore();
  });

  const canvas = (): HTMLElement => container.querySelector('canvas[part="plot-canvas"]') as HTMLElement;
  /** Layer order is fixed by each engine's constructor `container.append(...)`. */
  const layerAt = (i: number): HTMLElement => container.children[i] as HTMLElement;

  describe('BarChartEngine', () => {
    let engine: BarChartEngine;
    const barLabels = (): HTMLElement => layerAt(3);

    beforeEach(() => {
      engine = new BarChartEngine(container);
    });
    afterEach(() => engine.dispose());

    it('data assigned after the first (dataless) render ends fully opaque', async () => {
      // The docs/demo pattern: the element hydrates with no data, so the first
      // render has an empty spec; the data lands a tick later.
      engine.setSpec(emptyBar(), theme);
      expect(canvas().style.opacity).toBe('0'); // the entrance faded it out…
      await nextFrame();
      engine.setSpec(barSpec({ animationDuration: SHORT }), theme);
      await flushFrames(80);

      expect(engine.getScene()?.bars.length).toBeGreaterThan(0); // the bars are there…
      expect(canvas().style.opacity).toBe(''); // …and so is the canvas
      expect(barLabels().style.opacity).toBe('');
    });

    it('late data still plays the entrance rather than snapping in', async () => {
      engine.setSpec(emptyBar(), theme);
      await nextFrame();
      engine.setSpec(barSpec({ animationDuration: SHORT }), theme);
      const seen = [canvas().style.opacity];
      for (let i = 0; i < 80; i++) {
        await nextFrame();
        seen.push(canvas().style.opacity);
      }
      expect(seen.some(isMidFade)).toBe(true); // it faded in…
      expect(seen[seen.length - 1]).toBe(''); // …and finished
    });

    it('data present for the first render still animates in (control)', async () => {
      engine.setSpec(barSpec({ animationDuration: SHORT }), theme);
      const seen = [canvas().style.opacity];
      for (let i = 0; i < 80; i++) {
        await nextFrame();
        seen.push(canvas().style.opacity);
      }
      expect(seen.some(isMidFade)).toBe(true);
      expect(seen[seen.length - 1]).toBe('');
      expect(barLabels().style.opacity).toBe('');
    });

    it('a data change mid-entrance (the bar-race follow path) ends opaque', async () => {
      // Here the FIRST render has data, so the follow branch — not the intro —
      // owns the second render, and it cancels the entrance rAF.
      engine.setSpec(barSpec(), theme);
      await nextFrame();
      await nextFrame();
      expect(canvas().style.opacity).not.toBe(''); // the entrance is still faded when the update lands
      engine.setSpec(barSpec({ series: [{ label: 'S1', color: '#6750A4', data: [9, 1, 7], hidden: false }] }), theme);
      await flushFrames(20);

      expect(canvas().style.opacity).toBe('');
      expect(barLabels().style.opacity).toBe('');
    });

    it('a drill armed mid-entrance ends opaque', async () => {
      engine.setSpec(barSpec(), theme);
      await nextFrame();
      engine.drill(0, 'down');
      engine.setSpec(barSpec({ categories: ['A1'], series: [{ label: 'S1', color: '#000', data: [1], hidden: false }] }), theme);
      await flushFrames(40);

      expect(canvas().style.opacity).toBe('');
      expect(barLabels().style.opacity).toBe('');
    });
  });

  describe('LineChartEngine', () => {
    let engine: LineChartEngine;
    const glyphs = (): HTMLElement => layerAt(3);

    beforeEach(() => {
      engine = new LineChartEngine(container);
    });
    afterEach(() => engine.dispose());

    it('data assigned after the first (dataless) render ends fully opaque', async () => {
      engine.setSpec(lineSpec({ series: [], xValues: [] }), theme);
      await nextFrame();
      engine.setSpec(lineSpec({ animationDuration: SHORT }), theme);
      await flushFrames(80);

      expect(canvas().style.opacity).toBe('');
      expect(glyphs().style.opacity).toBe('');
    });

    it('still animates in', async () => {
      engine.setSpec(lineSpec({ animation: 'expressive', animationDuration: SHORT }), theme);
      const seen = [canvas().style.opacity];
      for (let i = 0; i < 80; i++) {
        await nextFrame();
        seen.push(canvas().style.opacity);
      }
      expect(seen.some(isMidFade)).toBe(true);
      expect(seen[seen.length - 1]).toBe('');
    });
  });

  describe('PieChartEngine', () => {
    let engine: PieChartEngine;

    beforeEach(() => {
      engine = new PieChartEngine(container);
    });
    afterEach(() => engine.dispose());

    it('data assigned after the first (dataless) render ends fully opaque', async () => {
      engine.setSpec(pieSpec({ data: [] }), theme);
      await nextFrame();
      engine.setSpec(pieSpec({ animationDuration: SHORT }), theme);
      await flushFrames(80);

      expect(canvas().style.opacity).toBe('');
    });

    it('a drill armed mid-entrance ends opaque', async () => {
      engine.setSpec(pieSpec(), theme);
      await nextFrame();
      expect(canvas().style.opacity).not.toBe(''); // the entrance is still faded when the drill is armed
      engine.drill(0, 'down');
      engine.setSpec(pieSpec({ data: [{ label: 'A1', value: 10, color: '#6750A4' }] }), theme);
      await flushFrames(20);

      expect(canvas().style.opacity).toBe('');
    });

    it('still animates in', async () => {
      engine.setSpec(pieSpec({ animationDuration: SHORT }), theme);
      const seen = [canvas().style.opacity];
      for (let i = 0; i < 80; i++) {
        await nextFrame();
        seen.push(canvas().style.opacity);
      }
      expect(seen.some(isMidFade)).toBe(true);
      expect(seen[seen.length - 1]).toBe('');
    });
  });
});
