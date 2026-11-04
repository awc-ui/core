import { newE2EPage } from '@stencil/core/testing';

const nested = [{ id: 'hardware', label: 'Hardware', value: 40, children: [{ id: 'phones', label: 'Phones', value: 10 }, { id: 'laptops', label: 'Laptops', value: 30 }] }, { id: 'services', label: 'Services', value: 60 }];
describe('md-pie-chart browser contracts', () => {
  it.each(['ltr', 'rtl'])('announces nested shares and activates the selected child with directional keys (%s)', async direction => {
    const page = await newE2EPage();
    await page.setContent(`<md-pie-chart dir="${direction}" no-animation inner-radius="35%" legend="right" label="Revenue" style="width:600px;height:400px"></md-pie-chart>`);
    const chart = await page.find('md-pie-chart');
    await chart.setProperty('data', nested); await page.waitForChanges();
    const clicked = await chart.spyOnEvent('mdSliceClick');
    const plot = await page.find('md-pie-chart >>> [part="canvas"]');
    await plot.press('Enter'); expect(clicked).not.toHaveReceivedEvent();
    await plot.press('Home'); await plot.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('Phones: 10 (25%)');
    await plot.press('Space');
    expect(clicked.lastEvent.detail).toEqual(expect.objectContaining({ seriesId: 'phones', dataIndex: 1, value: 10 }));
    await plot.press('End'); await plot.press('ArrowUp');
    expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('Laptops: 30 (75%)');
    await plot.press('Escape');
    expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('');
    await chart.setProperty('tableLabels', { category: 'Region', value: 'Revenue', share: 'Share of parent' }); await page.waitForChanges();
    expect(await page.evaluate(() => Array.from(document.querySelector('md-pie-chart')!.shadowRoot!.querySelectorAll('thead th'), th => th.textContent))).toEqual(['Region', 'Revenue', 'Share of parent']);
  });

  it('keeps legend choices across live updates, drills and restores loading and empty states', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-pie-chart no-animation label="Revenue" style="width:600px;height:400px"></md-pie-chart>');
    const chart = await page.find('md-pie-chart');
    const data = [{ id: 'north', label: 'North', value: 10 }, { id: 'south', label: 'South', value: 20 }];
    await chart.setProperty('data', data); await page.waitForChanges();
    const changed = await chart.spyOnEvent('mdLegendClick');
    await (await page.find('md-pie-chart >>> button[data-series-index="0"]')).click();
    expect(changed.lastEvent.detail).toEqual({ dataIndex: 0, selected: false });
    await chart.setProperty('data', data.map(datum => ({ ...datum, value: datum.value + 5 }))); await page.waitForChanges();
    expect((await page.find('md-pie-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('false');
    await chart.setProperty('data', data.map(datum => ({ ...datum, hidden: false }))); await page.waitForChanges();
    expect((await page.find('md-pie-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('true');
    await chart.callMethod('drill', 0);
    await chart.setProperty('data', [{ label: 'North detail', value: 10 }]); await page.waitForChanges();
    expect((await page.find('md-pie-chart >>> table')).textContent).toContain('North detail');
    await chart.callMethod('drill', 0, 'up'); await chart.setProperty('data', data); await page.waitForChanges();
    await chart.setProperty('loading', true); await chart.setProperty('loadingLabel', 'Updating revenue'); await chart.setProperty('data', []); await page.waitForChanges();
    expect((await page.find('md-pie-chart >>> [part="loading"]')).textContent).toContain('Updating revenue');
    expect(await page.find('md-pie-chart >>> [part="empty"]')).toBeNull();
    await chart.setProperty('loading', false); await chart.setProperty('labelEmpty', 'No sales'); await page.waitForChanges();
    expect((await page.find('md-pie-chart >>> [part="empty"]')).textContent).toContain('No sales');
    await chart.setProperty('data', [{ label: 'Zero', value: 0 }]); await page.waitForChanges();
    await (await page.find('md-pie-chart >>> [part="canvas"]')).press('Home');
    expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('Zero: 0 (0%)');
    await chart.callMethod('refreshTheme'); await chart.callMethod('resize'); await chart.callMethod('replay');
    expect(await chart.callMethod('toDataURL')).toMatch(/^data:image\/png;base64,/);
    expect(await page.evaluate(async () => { const host = document.querySelector('md-pie-chart')!; host.remove(); return await host.getInstance(); })).toBeNull();
  });
  it('formats monochrome duplicate-label slices and clears keyboard focus when leaving the plot', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-pie-chart animation="none" height="320px" style="width:600px" monochrome=""></md-pie-chart>');
    const chart = await page.find('md-pie-chart');
    await chart.setProperty('data', [{ label: 'Same', value: 1, color: '#ff0000' }, { label: 'Same', value: 3 }, { label: 'Other', value: 2 }]);
    await page.evaluate(() => { document.querySelector('md-pie-chart')!.valueFormatter = value => `$${value}`; });
    await page.waitForChanges();
    const plot = await page.find('md-pie-chart >>> [part="canvas"]');
    await plot.press('ArrowLeft'); expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('Other: $2 (33.3%)');
    await plot.press('Home'); await plot.press('ArrowRight');
    expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('Same: $3 (50%)');
    await page.evaluate(() => (document.querySelector('md-pie-chart')!.shadowRoot!.querySelector('[part="canvas"]') as HTMLElement).blur()); await page.waitForChanges();
    expect((await page.find('md-pie-chart >>> [aria-live]')).textContent).toBe('');
    await chart.setProperty('monochrome', '#0000ff'); await page.waitForChanges();
    expect(await chart.callMethod('toDataURL')).toMatch(/^data:image\/png;base64,/);
    expect(await page.evaluate(async () => { const host = document.querySelector('md-pie-chart')!; host.remove(); return await host.toDataURL(); })).toBe('');
  });

});
