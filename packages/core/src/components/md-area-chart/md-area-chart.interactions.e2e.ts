import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const values = [{ id: 'sales', label: 'Sales', data: [10, 20, 30, 40, 50, 60] }, { id: 'cost', label: 'Costs', data: [6, 8, 10, 12, 14, 16] }];
async function chartPage(direction = 'ltr') {
  const page = await newE2EPage();
  await page.setContent('<md-area-chart dir="' + direction + '" no-animation animation="none" zoom="both" stack="none" label="Quarterly totals" style="display:block;width:640px;height:400px"></md-area-chart>');
  const chart = await page.find('md-area-chart');
  await chart.setProperty('series', values);
  await chart.setProperty('xAxis', { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] });

  await page.waitForChanges();
  await chart.callMethod('resize');
  return { page, chart };
}
const live = async (page: E2EPage) => (await page.find('md-area-chart >>> [aria-live]')).textContent;

describe('md-area-chart public browser interactions', () => {
  it.each(['ltr', 'rtl'])('keeps keyboard, activation and live-series visibility aligned (%s)', async direction => {
    const { page, chart } = await chartPage(direction);
    const plot = await page.find('md-area-chart >>> [part="canvas"]');
    await plot.press('Home');
    await plot.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    expect(await live(page)).toContain('Feb');
    await plot.press('End');
    expect(await live(page)).toContain('Jun');
    await plot.press(direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    expect(await live(page)).toContain('May');
    await plot.press('Escape');
    expect(await live(page)).toBe('');
    const legend = await page.find('md-area-chart >>> button[data-series-index="0"]');
    await legend.click();
    await chart.setProperty('series', values.map(series => ({ ...series, data: series.data.map(value => value + 1) })));
    await page.waitForChanges();
    expect((await page.find('md-area-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('false');
    await plot.press('Home');
    expect(await live(page)).toContain('Costs');
    expect(await live(page)).not.toContain('Sales');
    await chart.setProperty('series', values.map(series => ({ ...series, hidden: false })));
    await page.waitForChanges();
    expect((await page.find('md-area-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('true');
    await page.evaluate(() => (document.querySelector('md-area-chart')!.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement).blur());
    await page.waitForChanges();
    expect(await live(page)).toBe('');
  });

  it('zooms from the plot, pans the selected window and resets without modifying source data', async () => {
    const { page, chart } = await chartPage();
    const zoom = await chart.spyOnEvent('mdZoom');
    const geometry = await page.evaluate(async () => {
      const host = document.querySelector('md-area-chart')!;
      const engine = await host.getInstance();
      const scene = engine!.getScene()!;
      const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
      return { x: rect.x + scene.plot.x, y: rect.y + scene.plot.y + scene.plot.height / 2, width: scene.plot.width };
    });
    await page.mouse.move(geometry.x + geometry.width * 0.15, geometry.y);
    await page.mouse.down();
    await page.mouse.move(geometry.x + geometry.width * 0.65, geometry.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForChanges();
    expect(zoom.lastEvent.detail.reset).toBe(false);
    expect(zoom.lastEvent.detail.endIndex).toBeGreaterThan(zoom.lastEvent.detail.startIndex);
    await chart.callMethod('setZoom', 1, 3);
    const box = await page.evaluate(() => { const rect = document.querySelector('md-area-chart')!.shadowRoot!.querySelector('[part="zoom-pan"]')!.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForChanges();
    expect(zoom.lastEvent.detail.startIndex).toBeGreaterThan(1);
    expect(zoom.lastEvent.detail.endIndex - zoom.lastEvent.detail.startIndex).toBe(2);
    await chart.callMethod('resetZoom');
    expect(zoom.lastEvent.detail).toEqual({ startIndex: 0, endIndex: 5, reset: true });
    expect(await chart.getProperty('series')).toEqual(values);
    await chart.callMethod('refreshTheme'); await chart.callMethod('replay');
    expect(await chart.callMethod('toDataURL')).toMatch(/^data:image\/png;base64,/);
  });

  it('replaces loading and empty content, exports data labels and disposes after removal', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('loading', true);
    await chart.setProperty('loadingLabel', 'Updating totals');
    await chart.setProperty('series', []);
    await page.waitForChanges();
    expect((await page.find('md-area-chart >>> [part="loading"]')).textContent).toContain('Updating totals');
    expect(await page.find('md-area-chart >>> [part="empty"]')).toBeNull();
    await chart.setProperty('loading', false);
    await chart.setProperty('labelEmpty', 'No orders');
    await page.waitForChanges();
    expect((await page.find('md-area-chart >>> [part="empty"]')).textContent).toContain('No orders');
    await chart.setProperty('series', values);
    await page.waitForChanges();
    expect((await page.find('md-area-chart >>> table')).textContent).toContain('Sales');
    expect((await page.find('md-area-chart >>> table')).textContent).toContain('Jun');
    const disposed = await page.evaluate(async () => { const host = document.querySelector('md-area-chart')!; host.remove(); return await host.getInstance(); });
    expect(disposed).toBeNull();
  });
  it('keeps per-point formatting and source identities aligned in a zoomed view', async () => {
    const { page, chart } = await chartPage();
    const selected = await chart.spyOnEvent('mdMarkerClick');
    await chart.setProperty('series', [{ id: 'sales', label: 'Sales', data: [10, 20, 30, 40, 50, 60], showMarks: true, curve: 'linear', lineWidth: 3, markSize: 5, connectNulls: true, stroke: true, pointSymbols: { 0: 'square', 2: 'diamond', 5: 'triangle' } }]);
    await page.waitForChanges();
    await chart.callMethod('resize');
    const point = await page.evaluate(async () => {
      const host = document.querySelector('md-area-chart')!; const scene = (await host.getInstance())!.getScene()!;
      const datum = scene.markers.find(mark => mark.symbol === 'diamond')!; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
      return { x: rect.left + datum.x, y: rect.top + datum.y };
    });
    await page.mouse.click(point.x, point.y); await page.waitForChanges();
    expect(selected.lastEvent.detail).toEqual(expect.objectContaining({ seriesId: 'sales', dataIndex: 2, value: 30 }));
    await chart.callMethod('setZoom', 1, 3); await page.waitForChanges();
    const result = await page.evaluate(async () => { const scene = (await document.querySelector('md-area-chart')!.getInstance())!.getScene()!; return scene.markers.map(mark => mark.symbol); });
    expect(result).toHaveLength(3); expect(result).toContain('diamond'); expect(result).not.toContain('triangle'); expect(result).not.toContain('square');
    const slider = await page.find('md-area-chart >>> md-slider');
    await page.evaluate(() => { const input = document.querySelector('md-area-chart')!.shadowRoot!.querySelector('md-slider')!.shadowRoot!.querySelector('input')!; input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForChanges();
    expect(await slider.getProperty('valueStart')).toBe(2);
    await chart.callMethod('resetZoom');
  });

  it('renders forecast ranges and switches stream baselines without changing source values', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('series', [{ label: 'Forecast', data: [], range: [[1, 4], [2, 8], [3, 9]] }, { label: 'Forecast', data: [2, 5, 6] }]);
    await chart.setProperty('xAxis', { data: ['Mon', 'Tue', 'Wed'] });
    await chart.setProperty('yAxis', { scale: 'log' });
    await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-area-chart')!.getInstance())!.getScene()!.areas.length)).toBeGreaterThan(0);
    await chart.setProperty('series', [{ label: 'Work', data: [2, 5, 3] }, { label: 'Work', data: [3, 2, 6] }]);
    await chart.setProperty('yAxis', undefined); await chart.setProperty('showLine', false);
    for (const stack of ['wiggle', 'silhouette', 'percentage']) {
      await chart.setProperty('stack', stack); await page.waitForChanges();
      expect(await page.evaluate(async () => (await document.querySelector('md-area-chart')!.getInstance())!.getScene()!.areas.length)).toBe(2);
    }
    await page.evaluate(() => { const host = document.querySelector('md-area-chart')!; host.valueFormatter = value => `${value} units`; host.yAxis = { valueFormatter: value => `${value}k` }; });
    await chart.setProperty('stack', 'none'); await chart.setProperty('inverted', true); await chart.setProperty('grid', 'both'); await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-area-chart')!.getInstance())!.getScene()!.inverted)).toBe(true);
    expect((await page.find('md-area-chart >>> table')).textContent).toContain('2 units');
  });

  it('distinguishes line and band activation and resets a zoom from the plot', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('series', [{ data: [10, 20, 30, 40, 50, 60] }]);
    await chart.setProperty('showMarks', false); await chart.setProperty('curve', 'linear');
    await chart.setProperty('heightProp', '320px'); await chart.setProperty('label', '');
    await chart.setProperty('noAnimation', false); await page.waitForChanges();
    await chart.callMethod('setZoom', 1, 3); await page.waitForChanges();
    await chart.callMethod('resize');
    const lineClick = await chart.spyOnEvent('mdLineClick');
    const markerClick = await chart.spyOnEvent('mdMarkerClick');
    const bandClick = await chart.spyOnEvent('mdAreaClick');
    const line = await page.evaluate(async () => { const host = document.querySelector('md-area-chart')!; const points = (await host.getInstance())!.getScene()!.hoverPoints[0].byIndex; const point = points[1]; const next = points[2]; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect(); return { x: rect.left + point.x + (next.x - point.x) / 4, y: rect.top + point.y + (next.y - point.y) / 4 }; });
    await page.mouse.click(line.x, line.y); await page.waitForChanges();
    expect({ line: lineClick.lastEvent?.detail?.dataIndex, marker: markerClick.lastEvent?.detail?.dataIndex, area: bandClick.lastEvent?.detail?.dataIndex }).toEqual({ line: 2, marker: undefined, area: undefined });
    expect(lineClick.lastEvent.detail.value).toBe(30);
    await chart.setProperty('showLine', false); await chart.setProperty('tooltip', 'item'); await page.waitForChanges();
    const areaClick = await chart.spyOnEvent('mdAreaClick');
    await chart.callMethod('resize');
    const area = await page.evaluate(async () => { const host = document.querySelector('md-area-chart')!; const scene = (await host.getInstance())!.getScene()!; const point = scene.hoverPoints[0].byIndex[1]; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect(); return { x: rect.left + point.x, y: rect.top + (point.y + scene.areas[0].baselineY) / 2 }; });
    await page.mouse.click(area.x, area.y); await page.waitForChanges();
    expect(areaClick.lastEvent.detail).toEqual(expect.objectContaining({ dataIndex: 2, value: 30 }));
    const zoom = await chart.spyOnEvent('mdZoom');
    await page.mouse.click(area.x, area.y, { count: 2 }); await page.waitForChanges();
    expect(zoom.lastEvent.detail).toEqual({ startIndex: 0, endIndex: 5, reset: true });
    const plot = await page.find('md-area-chart >>> [part="canvas"]');
    await plot.press('ArrowLeft'); expect(await live(page)).toContain('Jun');
    await plot.press('Escape'); await plot.press('ArrowRight'); expect(await live(page)).toContain('Jan');
    const detachedExport = await page.evaluate(async () => { const host = document.querySelector('md-area-chart')!; host.remove(); return host.toDataURL(); });
    expect(detachedExport).toBe('');
  });

});
