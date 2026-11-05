import { PieChartEngine } from './pie-chart';
import type { PieChartSpec } from './pie-layout';
import type { EngineTheme } from './layout';
import { flushFrames, installCanvas, makeChartContainer } from './test-utils/canvas-harness';

/**
 * The hover card a keyboard user gets (`focusIndex`) and the context a custom
 * `tooltipRender` receives: what share they state, in which number format, and
 * what is left on screen when the cursor lands on a slice the ring cannot draw.
 */
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
    { label: 'A', value: 2000.5, color: '#6750A4' },
    { label: 'B', value: 1000.25, color: '#B3261E' },
  ],
  innerRadius: '0%',
  outerRadius: '80%',
  startAngleDeg: 90,
  endAngleDeg: -270,
  paddingAngleDeg: 0,
  cornerRadius: 0,
  showLabels: false,
  highlight: 'slice',
  legend: 'none',
  valueFormatter: (v) => String(v),
  animation: 'none',
  ...over,
});

describe('PieChartEngine — keyboard hover card', () => {
  let restore: () => void;
  let container: HTMLElement;
  let engine: PieChartEngine;
  const hoverText = () => (container.children[3] as HTMLElement).textContent ?? '';

  beforeEach(() => {
    ({ restore } = installCanvas());
    container = makeChartContainer(400, 400);
    engine = new PieChartEngine(container);
  });
  afterEach(() => {
    engine.dispose();
    container.remove();
    restore();
  });

  it('keeps the one-decimal share when no percentFormatter is given', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    engine.focusIndex(0);
    expect(hoverText()).toContain('2000.5 (66.7%)');
  });

  it('prints the share through spec.percentFormatter', async () => {
    engine.setSpec(
      spec({ percentFormatter: (p) => `${p.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` }),
      theme,
    );
    await flushFrames(8);
    engine.focusIndex(0);
    expect(hoverText()).toContain('2000.5 (66,7%)');
  });

  it('clears the previous slice’s card when focus lands on a slice with nothing to draw', async () => {
    engine.setSpec(
      spec({
        data: [
          { label: 'A', value: 3, color: '#6750A4' },
          { label: 'Zero', value: 0, color: '#B3261E' },
          { label: 'B', value: 1, color: '#7D5260' },
        ],
      }),
      theme,
    );
    await flushFrames(8);
    engine.focusIndex(0);
    expect(hoverText()).toContain('A');
    engine.focusIndex(1);
    // A zero slice has no arc: the card for A must not stay up describing it.
    expect(hoverText()).toBe('');
  });

  it('gives tooltipRender each slice’s share of its OWN ring', async () => {
    let ctx: { series: { label: string; percent?: number }[] } | null = null;
    engine.setSpec(
      spec({
        data: [
          { label: 'Hardware', value: 40, color: '#6750A4', level: 0 },
          { label: 'Phones', value: 10, color: '#7965AF', level: 1, parent: 0 },
          { label: 'Laptops', value: 30, color: '#8A7ABA', level: 1, parent: 0 },
          { label: 'Services', value: 60, color: '#B3261E', level: 0 },
        ],
      }),
      theme,
    );
    engine.setTooltip({
      render: (c: any) => {
        ctx = c;
        return 'x';
      },
    });
    await flushFrames(8);
    engine.focusIndex(0);
    expect(ctx).not.toBeNull();
    const pct = Object.fromEntries(ctx!.series.map((s) => [s.label, Math.round((s.percent ?? 0) * 10) / 10]));
    // Hovering a parent must not restate its children as shares of the parents' ring.
    expect(pct).toEqual({ Hardware: 40, Phones: 25, Laptops: 75, Services: 60 });
  });
});

describe('PieChartEngine — hover treatment eases out as well as in', () => {
  let restore: () => void;
  let container: HTMLElement;
  let engine: PieChartEngine;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  /** The hover treatment as drawn: the raised rim (a band with dataIndex -1) and slice 1's fill. */
  const rim = () => Math.max(0, ...engine.getScene()!.slices.filter((x) => x.dataIndex === -1).map((x) => x.outerR - x.innerR));
  const fill1 = () => engine.getScene()!.slices.find((x) => x.dataIndex === 1)!.color;

  // The tween reads its clock from the frame timestamp. The test DOM's
  // requestAnimationFrame does not pass a performance.now() one, which makes
  // every tween finish in its first frame — so hand it a real clock here.
  let raf: typeof requestAnimationFrame;
  beforeEach(() => {
    raf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 4) as unknown as number) as typeof requestAnimationFrame;
    ({ restore } = installCanvas());
    container = makeChartContainer(400, 400);
    engine = new PieChartEngine(container);
  });
  afterEach(() => {
    engine.dispose();
    container.remove();
    restore();
    globalThis.requestAnimationFrame = raf;
  });

  it('keeps the last slice lit while the treatment fades, instead of dropping it in one frame', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    const restFill = fill1();
    expect(rim()).toBe(0);
    engine.focusIndex(0);
    await sleep(450);
    await flushFrames(4);
    const full = rim();
    expect(full).toBeGreaterThan(0);
    expect(fill1()).not.toBe(restFill);
    engine.focusIndex(-1);
    await flushFrames(1);
    // On the way out: the rim is still there (thinner), the others still faded.
    expect(rim()).toBeGreaterThan(0);
    expect(fill1()).not.toBe(restFill);
    await sleep(450);
    await flushFrames(4);
    expect(rim()).toBe(0);
    expect(fill1()).toBe(restFill);
  });

  it('drops the treatment at once when the data changes under it', async () => {
    engine.setSpec(spec(), theme);
    await flushFrames(8);
    engine.focusIndex(0);
    await sleep(450);
    await flushFrames(4);
    expect(rim()).toBeGreaterThan(0);
    engine.setSpec(spec({ data: [{ label: 'A', value: 1, color: '#6750A4' }, { label: 'B', value: 1, color: '#B3261E' }] }), theme);
    await flushFrames(1);
    // A new ring: nothing on it is lit.
    expect(rim()).toBe(0);
    expect(fill1()).toBe('#B3261E');
  });
});
