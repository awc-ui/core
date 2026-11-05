import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const values = [{ id: 'sales', label: 'Sales', data: [10, 20, 30, 40, 50, 60] }, { id: 'cost', label: 'Costs', data: [6, 8, 10, 12, 14, 16] }];
async function chartPage(direction = 'ltr') {
  const page = await newE2EPage();
  await page.setContent('<md-bar-chart dir="' + direction + '" no-animation animation="none" zoom="both" stack="none" label="Quarterly totals" style="display:block;width:640px;height:400px"></md-bar-chart>');
  const chart = await page.find('md-bar-chart');
  await chart.setProperty('series', values);
  await chart.setProperty('xAxis', { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] });
  await page.waitForChanges();
  await chart.callMethod('resize');
  return { page, chart };
}
const live = async (page: E2EPage) => (await page.find('md-bar-chart >>> [aria-live]')).textContent;

describe('md-bar-chart public browser interactions', () => {
  it.each(['ltr', 'rtl'])('keeps keyboard, activation and live-series visibility aligned (%s)', async direction => {
    const { page, chart } = await chartPage(direction);
    const activated = await chart.spyOnEvent('mdBarClick');
    const plot = await page.find('md-bar-chart >>> [part="canvas"]');
    await plot.press('Home');
    await plot.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    expect(await live(page)).toContain('Feb');
    await plot.press('Enter');
    expect(activated.lastEvent.detail.dataIndex).toBe(1);
    await plot.press('End');
    expect(await live(page)).toContain('Jun');
    await plot.press(direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
    expect(await live(page)).toContain('May');
    await plot.press('Escape');
    expect(await live(page)).toBe('');
    const legend = await page.find('md-bar-chart >>> button[data-series-index="0"]');
    await legend.click();
    await chart.setProperty('series', values.map(series => ({ ...series, data: series.data.map(value => value + 1) })));
    await page.waitForChanges();
    expect((await page.find('md-bar-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('false');
    await plot.press('Home');
    expect(await live(page)).toContain('Costs');
    expect(await live(page)).not.toContain('Sales');
    await chart.setProperty('series', values.map(series => ({ ...series, hidden: false })));
    await page.waitForChanges();
    expect((await page.find('md-bar-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('true');
    await page.evaluate(() => (document.querySelector('md-bar-chart')!.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement).blur());
    await page.waitForChanges();
    expect(await live(page)).toBe('');
  });

  it('zooms from the plot, pans the selected window and resets without modifying source data', async () => {
    const { page, chart } = await chartPage();
    const zoom = await chart.spyOnEvent('mdZoom');
    const geometry = await page.evaluate(async () => {
      const host = document.querySelector('md-bar-chart')!;
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
    const box = await page.evaluate(() => { const rect = document.querySelector('md-bar-chart')!.shadowRoot!.querySelector('[part="zoom-pan"]')!.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; });
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
    expect((await page.find('md-bar-chart >>> [part="loading"]')).textContent).toContain('Updating totals');
    expect(await page.find('md-bar-chart >>> [part="empty"]')).toBeNull();
    await chart.setProperty('loading', false);
    await page.evaluate(() => { const empty = document.createElement('span'); empty.slot = 'empty'; empty.textContent = 'No orders'; document.querySelector('md-bar-chart')!.append(empty); });
    await page.waitForChanges();
    expect((await page.find('md-bar-chart [slot="empty"]')).textContent).toBe('No orders');
    await chart.setProperty('series', values);
    await page.waitForChanges();
    expect((await page.find('md-bar-chart >>> table')).textContent).toContain('Sales');
    expect((await page.find('md-bar-chart >>> table')).textContent).toContain('Jun');
    const disposed = await page.evaluate(async () => { const host = document.querySelector('md-bar-chart')!; host.remove(); return await host.getInstance(); });
    expect(disposed).toBeNull();
  });
  it('keeps per-point formatting and source identities aligned in a zoomed view', async () => {
    const { page, chart } = await chartPage();
    const selected = await chart.spyOnEvent('mdBarClick');
    await chart.setProperty('series', [{ id: 'sales', label: 'Sales', data: [10, 20, 30, 40, 50, 60], pointColors: { 0: '#0000ff', 2: '#ff0000', 5: '#00ff00' }, pointWidths: { 0: 0.2, 2: 0.4, 5: 0.8 } }]);
    await page.waitForChanges();
    const point = await page.evaluate(async () => {
      const host = document.querySelector('md-bar-chart')!; const scene = (await host.getInstance())!.getScene()!;
      const datum = { x: scene.bars[0].x + scene.bars[0].w / 2, y: scene.bars[0].y + scene.bars[0].h / 2 }; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect();
      return { x: rect.left + datum.x, y: rect.top + datum.y };
    });
    await page.mouse.click(point.x, point.y); await page.waitForChanges();
    expect(selected.lastEvent.detail).toEqual(expect.objectContaining({ seriesId: 'sales', dataIndex: 0, value: 10 }));
    await chart.callMethod('setZoom', 1, 3); await page.waitForChanges();
    const result = await page.evaluate(async () => { const scene = (await document.querySelector('md-bar-chart')!.getInstance())!.getScene()!; return scene.bars.map(bar => ({ color: bar.color, index: bar.dataIndex })); });
    expect(result).toHaveLength(3); expect(result[1].color).toBe('#ff0000'); expect(result.some(bar => bar.color === '#0000ff' || bar.color === '#00ff00')).toBe(false);
    const slider = await page.find('md-bar-chart >>> md-slider');
    await page.evaluate(() => { const input = document.querySelector('md-bar-chart')!.shadowRoot!.querySelector('md-slider')!.shadowRoot!.querySelector('input')!; input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForChanges();
    expect(await slider.getProperty('valueStart')).toBe(2);
    await chart.callMethod('resetZoom');
  });

  it('renders the secondary value axis, ranged bars and radial bars from the same public data contract', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('series', [{ label: 'Revenue', data: [10, 20, 30] }, { label: 'Rate', data: [1, 2, 3], yAxisIndex: 1 }]);
    await chart.setProperty('xAxis', { data: ['Mon', 'Tue', 'Wed'] });
    await page.evaluate(() => { document.querySelector('md-bar-chart')!.yAxis2 = { label: 'Rate', min: 0, max: 10, valueFormatter: value => `${value}%` }; });
    await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-bar-chart')!.getInstance())!.getScene()!.texts.some(text => text.text.endsWith('%')))).toBe(true);
    await chart.setProperty('yAxis2', undefined);
    await chart.setProperty('series', [{ label: 'Range', data: [], range: [[1, 4], [2, 8], [3, 9]] }]);
    await chart.setProperty('yAxis', { scale: 'log' }); await chart.setProperty('categoryGap', '30%'); await chart.setProperty('barGap', 25); await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-bar-chart')!.getInstance())!.getScene()!.bars.length)).toBe(3);
    await chart.callMethod('drill', 0); await chart.callMethod('drill', 0, 'up');
    await chart.setProperty('series', [{ label: 'Work', data: [2, 5, 3] }, { label: 'Work', data: [3, 2, 6] }]);
    await chart.setProperty('layout', 'horizontal'); await chart.setProperty('stack', 'percentage'); await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-bar-chart')!.getInstance())!.getScene()!.bars.every(bar => bar.horizontal))).toBe(true);
    await chart.setProperty('polar', true); await chart.setProperty('barGap', '0.2'); await page.waitForChanges();
    expect(await page.evaluate(async () => (await document.querySelector('md-bar-chart')!.getInstance())!.getScene()!.polar)).toBe(true);
  });

  it('keeps ratio inputs equivalent and keyboard navigation bounded before the first reading', async () => {
    const { page, chart } = await chartPage();
    await chart.setProperty('series', [{ data: [10, 20, 30, 40, 50, 60] }]);
    await chart.setProperty('categoryGap', 0.3); await chart.setProperty('barGap', 0.2);
    await chart.setProperty('heightProp', '320px'); await chart.setProperty('label', '');
    await chart.setProperty('noAnimation', false); await page.waitForChanges();
    const widths = () => page.evaluate(async () => (await document.querySelector('md-bar-chart')!.getInstance())!.getScene()!.bars.map(bar => bar.w));
    const fractional = await widths();
    await chart.setProperty('categoryGap', 30); await chart.setProperty('barGap', '20%'); await page.waitForChanges();
    expect(await widths()).toEqual(fractional);
    await chart.setProperty('categoryGap', '30%'); await chart.setProperty('barGap', '0.2'); await page.waitForChanges();
    expect(await widths()).toEqual(fractional);
    const activated = await chart.spyOnEvent('mdBarClick');
    const plot = await page.find('md-bar-chart >>> [part="canvas"]');
    await plot.press('Enter'); expect(activated).not.toHaveReceivedEvent();
    await plot.press('Escape'); await plot.press('ArrowLeft'); expect(await live(page)).toContain('Jun');
    await plot.press('Escape'); await plot.press('ArrowRight'); expect(await live(page)).toContain('Jan');
    await plot.press('Space'); expect(activated.lastEvent.detail).toEqual(expect.objectContaining({ dataIndex: 0, value: 10 }));
    const zoom = await chart.spyOnEvent('mdZoom');
    await chart.callMethod('setZoom', 1, 3); await page.waitForChanges();
    const inside = await page.evaluate(async () => { const host = document.querySelector('md-bar-chart')!; const scene = (await host.getInstance())!.getScene()!; const rect = host.shadowRoot!.querySelector('canvas')!.getBoundingClientRect(); return { x: rect.left + scene.plot.x + scene.plot.width / 2, y: rect.top + scene.plot.y + scene.plot.height / 2 }; });
    await page.mouse.click(inside.x, inside.y, { count: 2 }); await page.waitForChanges();
    expect(zoom.lastEvent.detail).toEqual({ startIndex: 0, endIndex: 5, reset: true });
    const detachedExport = await page.evaluate(async () => { const host = document.querySelector('md-bar-chart')!; host.remove(); return host.toDataURL(); });
    expect(detachedExport).toBe('');
  });

});
