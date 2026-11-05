import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const values = [{ id: 'sales', label: 'Sales', data: [10, 20, 30, 40, 50, 60] }, { id: 'cost', label: 'Costs', data: [6, 8, 10, 12, 14, 16] }];
async function chartPage(direction = 'ltr') {
  const page = await newE2EPage();
  await page.setContent('<md-line-chart dir="' + direction + '" no-animation animation="none" zoom="both" stack="none" label="Quarterly totals" style="display:block;width:640px;height:400px"></md-line-chart>');
  const chart = await page.find('md-line-chart');
  await chart.setProperty('series', values);
  await chart.setProperty('xAxis', { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] });

  await page.waitForChanges();
  await chart.callMethod('resize');
  return { page, chart };
}
const live = async (page: E2EPage) => (await page.find('md-line-chart >>> [aria-live]')).textContent;

describe('md-line-chart public browser interactions', () => {
  it.each(['ltr', 'rtl'])('keeps keyboard, activation and live-series visibility aligned (%s)', async direction => {
    const { page, chart } = await chartPage(direction);
    const hover = await chart.spyOnEvent('mdHover');
    const activated = await chart.spyOnEvent('mdAxisClick');
    const plot = await page.find('md-line-chart >>> [part="canvas"]');
    await plot.press('Home');
    await plot.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    expect(hover.lastEvent.detail.dataIndex).toBe(1);
    expect(await live(page)).toContain('Feb');
    await plot.press('Enter');
    expect(activated.lastEvent.detail.dataIndex).toBe(1);
    await plot.press('End');
    expect(await live(page)).toContain('Jun');
    await plot.press(direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    expect(await live(page)).toContain('May');
    await plot.press('Escape');
    expect(await live(page)).toBe('');
    const legend = await page.find('md-line-chart >>> button[data-series-index="0"]');
    await legend.click();
    await chart.setProperty('series', values.map(series => ({ ...series, data: series.data.map(value => value + 1) })));
    await page.waitForChanges();
    expect((await page.find('md-line-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('false');
    await plot.press('Home');
    expect(hover.lastEvent.detail.seriesIndices).toEqual([1]);
    await chart.setProperty('series', values.map(series => ({ ...series, hidden: false })));
    await page.waitForChanges();
    expect((await page.find('md-line-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('true');
    await page.evaluate(() => (document.querySelector('md-line-chart')!.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement).blur());
    await page.waitForChanges();
    expect(await live(page)).toBe('');
  });

  it('zooms from the plot, pans the selected window and resets without modifying source data', async () => {
    const { page, chart } = await chartPage();
    const zoom = await chart.spyOnEvent('mdZoom');
    const geometry = await page.evaluate(async () => {
      const host = document.querySelector('md-line-chart')!;
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
    const box = await page.evaluate(() => { const rect = document.querySelector('md-line-chart')!.shadowRoot!.querySelector('[part="zoom-pan"]')!.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
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
    expect((await page.find('md-line-chart >>> [part="loading"]')).textContent).toContain('Updating totals');
    expect(await page.find('md-line-chart >>> [part="empty"]')).toBeNull();
    await chart.setProperty('loading', false);
    await chart.setProperty('labelEmpty', 'No orders');
    await page.waitForChanges();
    expect((await page.find('md-line-chart >>> [part="empty"]')).textContent).toContain('No orders');
    await chart.setProperty('series', values);
    await page.waitForChanges();
    expect((await page.find('md-line-chart >>> table')).textContent).toContain('Sales');
    expect((await page.find('md-line-chart >>> table')).textContent).toContain('Jun');
    const disposed = await page.evaluate(async () => { const host = document.querySelector('md-line-chart')!; host.remove(); return await host.getInstance(); });
    expect(disposed).toBeNull();
  });
  it('keeps per-point formatting and source identities aligned in a zoomed view', async () => {
    const { page, chart } = await chartPage();
    const selected = await chart.spyOnEvent('mdMarkerClick');
    await chart.setProperty('series', [{ id: 'sales', label: 'Sales', data: [10, 20, 30, 40, 50, 60], showMarks: true, curve: 'linear', lineWidth: 3, markSize: 5, connectNulls: true, stroke: true, pointSymbols: { 0: 'square', 2: 'diamond', 5: 'triangle' } }]);
    await page.waitForChanges();
    const point = await page.evaluate(async () => {
      const host = document.querySelector('md-line-chart')!; const scene = (await host.getInstance())!.getScene()!;
      const datum = scene.markers[0]; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
      return { x: rect.left + datum.x, y: rect.top + datum.y };
    });
    await page.mouse.click(point.x, point.y); await page.waitForChanges();
    expect(selected.lastEvent.detail).toEqual(expect.objectContaining({ seriesId: 'sales', dataIndex: 0, value: 10 }));
    await chart.callMethod('setZoom', 1, 3); await page.waitForChanges();
    const result = await page.evaluate(async () => { const scene = (await document.querySelector('md-line-chart')!.getInstance())!.getScene()!; return scene.markers.map(mark => mark.symbol); });
    expect(result).toHaveLength(3); expect(result).toContain('diamond'); expect(result).not.toContain('triangle'); expect(result).not.toContain('square');
    const slider = await page.find('md-line-chart >>> md-slider');
    await page.evaluate(() => { const input = document.querySelector('md-line-chart')!.shadowRoot!.querySelector('md-slider')!.shadowRoot!.querySelector('input')!; input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForChanges();
    expect(await slider.getProperty('valueStart')).toBe(2);
    await chart.callMethod('resetZoom');
  });

  it('aligns irregular x samples and reports missing values without losing each series index', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('xAxis', { scale: 'value' });
    await chart.setProperty('series', [{ id: 'first', label: 'First', data: [{ x: 1, y: 10 }, { x: 4, y: 40 }], showMarks: true }, { id: 'second', label: 'Second', data: [{ x: 2, y: 20 }, { x: 4, y: 80 }], showMarks: true }]);
    await page.waitForChanges(); await chart.callMethod('setZoom', 1, 2); await page.waitForChanges();
    const clicked = await chart.spyOnEvent('mdAxisClick');
    const plot = await page.find('md-line-chart >>> [part="canvas"]');
    await plot.press('Home'); await plot.press('Enter');
    expect(clicked.lastEvent.detail).toEqual(expect.objectContaining({ dataIndex: 1, axisValue: 2 }));
    expect(clicked.lastEvent.detail.seriesValues).toEqual([
      expect.objectContaining({ seriesId: 'first', dataIndex: -1, value: null }),
      expect.objectContaining({ seriesId: 'second', dataIndex: 0, value: 20 }),
    ]);
    await chart.callMethod('resetZoom');
    await page.evaluate(() => { const host = document.querySelector('md-line-chart')!; host.valueFormatter = value => value == null ? 'No reading' : `${value} USD`; host.yAxes = [{ label: 'Revenue', min: 0, max: 100, valueFormatter: value => `${value} USD` }, { label: 'Rate', min: 0, max: 1 }]; });
    await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-line-chart')!.getInstance())!.getScene()!.texts.some(text => text.text.endsWith(' USD')))).toBe(true);
    expect((await page.find('md-line-chart >>> table')).textContent).toContain('No reading');
  });

  it('keeps reference annotations inside the selected window and differentiates line and filled-area clicks', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('series', [{ data: [10, 20, 30, 40, 50, 60], dashAfter: 2 }]);
    await chart.setProperty('showMarks', false); await chart.setProperty('curve', 'linear');
    await chart.setProperty('markLines', [{ value: 0, label: 'Before' }, { value: 2, label: 'Target', color: '#ff0000' }, { value: 5, label: 'After' }]);
    await chart.setProperty('heightProp', '320px'); await chart.setProperty('label', '');
    await chart.setProperty('noAnimation', false); await page.waitForChanges();
    await chart.callMethod('setZoom', 1, 3); await page.waitForChanges();
    const texts = await page.evaluate(async () => (await document.querySelector('md-line-chart')!.getInstance())!.getScene()!.texts.map(text => text.text));
    expect(texts).toContain('Target'); expect(texts).not.toContain('Before'); expect(texts).not.toContain('After');
    const lineClick = await chart.spyOnEvent('mdLineClick');
    const line = await page.evaluate(async () => { const host = document.querySelector('md-line-chart')!; const points = (await host.getInstance())!.getScene()!.hoverPoints[0].byIndex; const point = points[1]; const next = points[2]; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect(); return { x: rect.left + point.x + (next.x - point.x) / 4, y: rect.top + point.y + (next.y - point.y) / 4 }; });
    await page.mouse.click(line.x, line.y); await page.waitForChanges();
    expect(lineClick.lastEvent.detail).toEqual(expect.objectContaining({ dataIndex: 2, value: 30 }));
    await chart.setProperty('area', true); await chart.setProperty('showLine', false); await chart.setProperty('tooltip', 'item'); await page.waitForChanges();
    const areaClick = await chart.spyOnEvent('mdAreaClick');
    const area = await page.evaluate(async () => { const host = document.querySelector('md-line-chart')!; const scene = (await host.getInstance())!.getScene()!; const point = scene.hoverPoints[0].byIndex[1]; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect(); return { x: rect.left + point.x, y: rect.top + (point.y + scene.areas[0].baselineY) / 2 }; });
    await page.mouse.click(area.x, area.y); await page.waitForChanges();
    expect(areaClick.lastEvent.detail).toEqual(expect.objectContaining({ dataIndex: 2, value: 30 }));
    await chart.callMethod('resetZoom');
    await chart.setProperty('stack', 'percentage'); await chart.setProperty('grid', 'both'); await chart.setProperty('inverted', true); await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-line-chart')!.getInstance())!.getScene()!.inverted)).toBe(true);
    await page.evaluate(() => { const host = document.querySelector('md-line-chart')!; host.xAxis = { data: [1, 2, 3, 4, 5, 6], valueFormatter: value => `Month ${value}` }; host.yAxis = { valueFormatter: value => `${value}k` }; host.valueFormatter = value => `${value} units`; });
    await chart.setProperty('stack', 'none'); await page.waitForChanges();
    await (await page.find('md-line-chart >>> [part="canvas"]')).press('Home');
    expect(await live(page)).toContain('Month 1'); expect(await live(page)).toContain('10 units');
  });

});
