import { newSpecPage } from '@stencil/core/testing';
import { MdAreaChart } from './md-area-chart';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

const data = [{ id: 'sales', label: 'Sales', data: [10, 20, null, 40, 50, 60] }, { id: 'costs', label: 'Costs', data: [6, 8, 10, 12, 14, 16] }];
describe('md-area-chart public data contracts', () => {
  let restore: () => void;
  beforeEach(() => { ({ restore } = installCanvas()); });
  afterEach(() => restore());
  async function create() {
    const page = await newSpecPage({ components: [MdAreaChart], html: '<md-area-chart no-animation zoom="both" stack="none" legend="right" label="Revenue"></md-area-chart>' });
    const host = page.root as HTMLMdAreaChartElement;
    const plot = host.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
    const rect = () => ({ width: 600, height: 360, x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 360, toJSON: () => ({}) }) as DOMRect;
    host.getBoundingClientRect = rect; plot.getBoundingClientRect = rect;
    host.series = data;
    host.xAxis = { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] };
    await page.waitForChanges(); await host.resize();
    const key = async (key: string) => { plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); await page.waitForChanges(); };
    return { page, host, plot, key };
  }

  it('announces keyboard readings, clears its cursor and keeps legend visibility across data refresh', async () => {
    const { page, host, plot, key } = await create();
    host.valueFormatter = value => value == null ? 'missing' : `$${value}`;
    await page.waitForChanges();
    await key('ArrowRight'); await key('ArrowRight');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Feb');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('$20');
    await key('End'); await key('ArrowLeft');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('May');
    await key('Escape'); await key('Tab');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('');
    const legend = () => host.shadowRoot!.querySelector('button[data-series-index="0"]') as HTMLButtonElement;
    legend().click();
    host.series = data.map(series => ({ ...series, data: [...series.data] }));
    await page.waitForChanges();
    expect(legend().getAttribute('aria-pressed')).toBe('false');
    await key('Home');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Costs');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).not.toContain('Sales');
    host.series = data.map(series => ({ ...series, hidden: false }));
    await page.waitForChanges();
    expect(legend().getAttribute('aria-pressed')).toBe('true');
    plot.dispatchEvent(new Event('blur')); await page.waitForChanges();
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('');
  });

  it('keeps zoom coordinates in source space, clamps invalid bounds and restores the complete view', async () => {
    const { page, host, key } = await create();
    const zoom = jest.fn(); host.addEventListener('mdZoom', zoom);
    await host.setZoom(1, 3); await page.waitForChanges();
    expect((await host.getInstance())!.getScene()!.xLabels).toEqual(['Feb', 'Mar', 'Apr']);
    await key('Home'); expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Feb');
    await host.setZoom(-10, 100); await page.waitForChanges();
    expect(zoom.mock.calls.at(-1)![0].detail).toEqual({ startIndex: 0, endIndex: 5, reset: false });
    await host.resetZoom(); await page.waitForChanges();
    expect(zoom.mock.calls.at(-1)![0].detail.reset).toBe(true);
    expect(host.series).toEqual(data);
    host.series = []; await page.waitForChanges();
    await host.setZoom(0, 1); await host.resetZoom();
    expect(host.shadowRoot!.querySelector('[part="empty"]')).toBeTruthy();
  });

  it('rebuilds formatted axes and its accessible table, then safely disposes the public engine', async () => {
    const { page, host } = await create();
    host.valueFormatter = value => value == null ? 'No reading' : `${value} units`;
    host.xAxis = { data: [1, 2, 3, 4, 5, 6], label: 'Month', valueFormatter: value => `M${value}` };
    host.yAxis = { label: 'Amount', valueFormatter: value => `${value}k`, min: 0, max: 100 };
    host.grid = 'both'; host.stack = 'percentage'; host.inverted = true;
    await page.waitForChanges(); await host.resize();
    const table = host.shadowRoot!.querySelector('table')!;
    expect(table.textContent).toContain('M1'); expect(table.textContent).toContain('10 units');
    expect((await host.getInstance())!.getScene()!.xLabels[0]).toBe('M1');
    host.stack = 'none'; host.tooltip = 'item'; host.inverted = false;
    await page.waitForChanges(); await host.refreshTheme(); await host.replay();
    expect(await host.toDataURL()).toBe('data:image/png;base64,TEST');
    host.remove(); await page.waitForChanges();
    expect(await host.getInstance()).toBeNull(); expect(await host.toDataURL()).toBe('');
    await host.resize(); await host.refreshTheme(); await host.replay();
  });
  it('maps real canvas clicks and range-control gestures back to public data events', async () => {
    const { page, host, plot } = await create();
    host.showMarks = true;
    await page.waitForChanges(); await host.resize();
    const selected = jest.fn(); host.addEventListener('mdMarkerClick', selected);
    const canvas = host.shadowRoot!.querySelector('canvas')!;
    canvas.getBoundingClientRect = plot.getBoundingClientRect;
    const scene = (await host.getInstance())!.getScene()!;
    const point = scene.markers[0];
    canvas.dispatchEvent(new MouseEvent('click', { clientX: point.x, clientY: point.y, bubbles: true }));
    expect(selected.mock.calls[0][0].detail).toEqual(expect.objectContaining({ seriesId: 'sales', dataIndex: 0, value: 10 }));
    const zoom = jest.fn(); host.addEventListener('mdZoom', zoom);
    await host.setZoom(1, 3); await page.waitForChanges();
    const slider = host.shadowRoot!.querySelector('md-slider')!;
    slider.getBoundingClientRect = plot.getBoundingClientRect;
    const grip = host.shadowRoot!.querySelector('[part="zoom-pan"]')!;
    const pointer = (target: Element, type: string, x: number) => {
      const event = new MouseEvent(type, { clientX: x, clientY: 340, button: 0, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'pointerId', { value: 1 }); target.dispatchEvent(event);
    };
    pointer(grip, 'pointerdown', 200); pointer(host, 'pointermove', 440); pointer(host, 'pointerup', 440);
    await page.waitForChanges();
    expect(zoom.mock.calls.at(-1)![0].detail).toEqual({ startIndex: 3, endIndex: 5, reset: false });
    slider.dispatchEvent(new CustomEvent('mdInput', { bubbles: true, detail: { valueStart: 0, valueEnd: 2 } }));
    await page.waitForChanges();
    expect(zoom.mock.calls.at(-1)![0].detail).toEqual({ startIndex: 0, endIndex: 2, reset: false });
    const changes = jest.fn(); host.addEventListener('mdChange', changes);
    slider.dispatchEvent(new CustomEvent('mdChange', { bubbles: true }));
    expect(changes).not.toHaveBeenCalled();
  });

  it('uses reading-direction arrows at the visible boundaries and ignores repeated Escape', async () => {
    const computed = globalThis.getComputedStyle;
    const style = jest.spyOn(globalThis, 'getComputedStyle').mockImplementation(element => {
      const value = computed(element); Object.defineProperty(value, 'direction', { value: 'rtl', configurable: true }); return value;
    });
    try {
      const { page, host, key } = await create();
      await key('Escape'); await key('Enter'); await key('ArrowRight');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Jun');
      await key('Home'); await key('ArrowLeft');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Feb');
      await host.setZoom(1, 3); await page.waitForChanges();
      await key('End'); await key('ArrowLeft');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Apr');
      await key('Home'); await key('ArrowRight');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Feb');
      await key('Escape'); await key('Escape');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('');
    } finally { style.mockRestore(); }
  });

  it('preserves per-point symbols through zoom and renders range bands and stream baselines', async () => {
    const { page, host } = await create();
    host.series = [{ label: 'Forecast', data: [10, 20, 30, 40, 50, 60], curve: 'linear', connectNulls: true, showMarks: true, lineWidth: 3, markSize: 5, stroke: true, pointSymbols: { 0: 'square', 2: 'diamond', 5: 'triangle' } }];
    await page.waitForChanges(); await host.setZoom(1, 3); await page.waitForChanges();
    let scene = (await host.getInstance())!.getScene()!;
    expect(scene.markers).toHaveLength(3);
    expect(scene.markers.some(mark => mark.symbol === 'diamond')).toBe(true);
    expect(scene.markers.some(mark => mark.symbol === 'triangle' || mark.symbol === 'square')).toBe(false);
    await host.resetZoom();
    host.series = [{ label: 'Forecast', data: [], range: [[1, 4], [2, 8], [3, 9]] }, { label: 'Forecast', data: [2, 5, 6] }];
    host.xAxis = { data: ['Mon', 'Tue', 'Wed'] }; host.yAxis = { scale: 'log' }; host.stack = 'none';
    await page.waitForChanges(); scene = (await host.getInstance())!.getScene()!;
    expect(scene.areas.length).toBeGreaterThan(0); expect(scene.xLabels).toEqual(['Mon', 'Tue', 'Wed']);
    host.yAxis = undefined; host.stack = 'wiggle'; host.showLine = false;
    host.series = [{ label: 'Work', data: [2, 5, 3] }, { label: 'Work', data: [3, 2, 6] }];
    await page.waitForChanges(); expect((await host.getInstance())!.getScene()!.areas).toHaveLength(2);
    host.stack = 'silhouette'; await page.waitForChanges(); expect((await host.getInstance())!.getScene()!.areas).toHaveLength(2);
  });

});
