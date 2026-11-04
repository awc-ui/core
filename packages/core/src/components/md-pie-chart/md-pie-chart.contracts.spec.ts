import { newSpecPage } from '@stencil/core/testing';
import { MdPieChart } from './md-pie-chart';
import { installCanvas } from '../../utils/charts/engine/test-utils/canvas-harness';

describe('md-pie-chart public data and interaction contracts', () => {
  let restore: () => void;
  beforeEach(() => { ({ restore } = installCanvas()); });
  afterEach(() => restore());

  async function create() {
    const page = await newSpecPage({ components: [MdPieChart], html: '<md-pie-chart no-animation label="Revenue" legend="right"></md-pie-chart>' });
    const host = page.root as HTMLMdPieChartElement;
    const plot = host.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
    const rect = () => ({ width: 600, height: 360, x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 360, toJSON: () => ({}) }) as DOMRect;
    host.getBoundingClientRect = rect;
    plot.getBoundingClientRect = rect;
    return { page, host, plot };
  }

  it('announces nested slices as shares of their siblings and emits the selected child', async () => {
    const { page, host, plot } = await create();
    host.data = [{ id: 'parent', label: 'Hardware', value: 40, children: [{ id: 'a', label: 'Phones', value: 10 }, { id: 'b', label: 'Laptops', value: 30 }] }, { id: 'other', label: 'Services', value: 60 }];
    host.valueFormatter = value => `$${value}`;
    host.innerRadius = '35%';
    host.monochrome = 'tertiary';
    await page.waitForChanges();
    await host.resize();
    const clicked = jest.fn(); host.addEventListener('mdSliceClick', clicked);
    const press = async (key: string) => { plot.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); await page.waitForChanges(); };
    await press('Enter');
    expect(clicked).not.toHaveBeenCalled();
    await press('Home'); await press('ArrowDown');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('Phones: $10 (25%)');
    await press(' ');
    expect(clicked.mock.calls[0][0].detail).toEqual(expect.objectContaining({ dataIndex: 1, seriesId: 'a', value: 10 }));
    await press('End'); await press('ArrowUp');
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('Laptops: $30 (75%)');
    plot.dispatchEvent(new Event('blur'));
    await page.waitForChanges();
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('');
    await press('Escape'); await press('Tab');
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('persists a legend choice across live data updates and honors an explicit visibility override', async () => {
    const { page, host } = await create();
    host.data = [{ id: 'a', label: 'North', value: 10 }, { id: 'b', label: 'South', value: 20 }];
    await page.waitForChanges(); await host.resize();
    const legend = () => host.shadowRoot!.querySelector('button[data-series-index="0"]') as HTMLButtonElement;
    expect(legend()).toBeTruthy();
    const changed = jest.fn(); host.addEventListener('mdLegendClick', changed);
    legend().click();
    expect(changed.mock.calls[0][0].detail).toEqual({ dataIndex: 0, selected: false });
    host.data = [{ id: 'a', label: 'North', value: 12 }, { id: 'b', label: 'South', value: 30 }];
    await page.waitForChanges();
    expect(legend().getAttribute('aria-pressed')).toBe('false');
    host.data = [{ id: 'a', label: 'North', value: 12, hidden: false }, { id: 'b', label: 'South', value: 30 }];
    await page.waitForChanges();
    expect(legend().getAttribute('aria-pressed')).toBe('true');
    await host.drill(0);
    host.data = [{ label: 'North detail', value: 12 }];
    await page.waitForChanges();
    await host.drill(0, 'up');
    host.data = [{ label: 'North', value: 12 }, { label: 'South', value: 30 }];
    await page.waitForChanges();
    await host.refreshTheme(); await host.replay();
    expect(await host.toDataURL()).toBe('data:image/png;base64,TEST');
    expect(await host.getInstance()).not.toBeNull();
    host.remove(); await page.waitForChanges();
    expect(await host.getInstance()).toBeNull();
    expect(await host.toDataURL()).toBe('');
  });

  it('replaces loading with localized empty and zero-value announcements', async () => {
    const { page, host, plot } = await create();
    host.loading = true; host.loadingLabel = 'Updating revenue'; host.labelEmpty = 'No sales';
    await page.waitForChanges();
    expect(host.shadowRoot!.querySelector('[part="loading"]')!.textContent).toContain('Updating revenue');
    expect(host.shadowRoot!.querySelector('[part="empty"]')).toBeNull();
    host.loading = false;
    await page.waitForChanges();
    expect(host.shadowRoot!.querySelector('[part="empty"]')!.textContent).toContain('No sales');
    host.data = [{ label: 'Zero', value: 0 }];
    await page.waitForChanges();
    plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await page.waitForChanges();
    expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('Zero: 0 (0%)');
    host.tableLabels = { category: 'Region', value: 'Sales', share: 'Percentage' };
    await page.waitForChanges();
    const headers = Array.from(host.shadowRoot!.querySelectorAll('table thead th'), cell => cell.textContent);
    expect(headers).toEqual(['Region', 'Sales', 'Percentage']);
  });
});

describe('md-pie-chart directional and empty input contracts', () => {
  it('moves through duplicate labels in RTL, and detached public methods stay safe', async () => {
    const { restore } = installCanvas();
    const computed = globalThis.getComputedStyle;
    const style = jest.spyOn(globalThis, 'getComputedStyle').mockImplementation(element => {
      const value = computed(element); Object.defineProperty(value, 'direction', { value: 'rtl', configurable: true }); return value;
    });
    try {
      const page = await newSpecPage({ components: [MdPieChart], html: '<md-pie-chart no-animation dir="rtl" height="300px"></md-pie-chart>' });
      const host = page.root as HTMLMdPieChartElement;
      const plot = host.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement;
      plot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' })); await page.waitForChanges();
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('');
      host.data = [{ label: 'Same', value: 1 }, { label: 'Same', value: 3 }, { label: 'Other', value: 2 }];
      host.monochrome = ''; await page.waitForChanges();
      const key = async (key: string) => { plot.dispatchEvent(new KeyboardEvent('keydown', { key })); await page.waitForChanges(); };
      await key('Home'); await key('ArrowLeft');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toBe('Same: 3 (50%)');
      await key('ArrowRight');
      expect(host.shadowRoot!.querySelector('[aria-live]')!.textContent).toContain('Same: 1');
      host.remove(); await page.waitForChanges();
      await host.resize(); await host.replay(); await host.drill(0); await host.refreshTheme();
      expect(await host.getInstance()).toBeNull();
    } finally { style.mockRestore(); restore(); }
  });
});
