import { newE2EPage, type E2EPage } from '@stencil/core/testing';

const SERIES = [
  { id: 'revenue', label: 'Revenue', color: '#c02162', data: [12, 28, 18] },
  { id: 'costs', label: 'Costs', color: '#1565c0', data: [5, 10, 8] },
];

async function mount(page: E2EPage, attrs = '') {
  await page.setContent(`<md-line-chart label="Quarterly revenue" animation="none"
    style="width:600px;height:320px" ${attrs}></md-line-chart>`);
  const chart = await page.find('md-line-chart');
  await chart.setProperty('xAxis', { data: ['Jan', 'Feb', 'Mar'] });
  await chart.setProperty('series', SERIES);
  await page.waitForChanges();
  // Wait for the actual series colour, not just a canvas element or painted axes.
  await waitForRevenuePixels(page);
  return chart;
}

async function waitForRevenuePixels(page: E2EPage) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('md-line-chart')?.shadowRoot?.querySelector('canvas');
    if (!canvas?.width || !canvas.height) return false;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === 192 && pixels[i + 1] === 33 && pixels[i + 2] === 98 && pixels[i + 3] > 200) return true;
    }
    return false;
  });
}

function tableRows(page: E2EPage) {
  return page.evaluate(() => Array.from(
    document.querySelector('md-line-chart')!.shadowRoot!.querySelectorAll('tbody tr'),
    (row) => Array.from(row.children, (cell) => cell.textContent),
  ));
}

describe('md-line-chart browser behavior', () => {
  it('paints the supplied series and updates the canvas and accessible data when values change', async () => {
    const page = await newE2EPage();
    const chart = await mount(page);
    expect(await tableRows(page)).toEqual([
      ['Jan', '12', '5'], ['Feb', '28', '10'], ['Mar', '18', '8'],
    ]);
    const before = await chart.callMethod('toDataURL');
    expect(before).toMatch(/^data:image\/png;base64,/);

    await chart.setProperty('series', [{ ...SERIES[0], data: [30, 9, 40] }, SERIES[1]]);
    await page.waitForChanges();
    await page.waitForFunction(() => document.querySelector('md-line-chart')!.shadowRoot!
      .querySelector('tbody tr td')?.textContent === '30');
    await waitForRevenuePixels(page);
    expect(await tableRows(page)).toEqual([
      ['Jan', '30', '5'], ['Feb', '9', '10'], ['Mar', '40', '8'],
    ]);
    expect(await chart.callMethod('toDataURL')).not.toBe(before);
  });

  it.each(['ltr', 'rtl'] as const)('navigates data and activates the exact axis values with the keyboard (%s)', async (direction) => {
    const page = await newE2EPage();
    const chart = await mount(page, `dir="${direction}"`);
    const hover = await chart.spyOnEvent('mdHover');
    const activate = await chart.spyOnEvent('mdAxisClick');
    const plot = await page.find('md-line-chart >>> [part="canvas"]');
    await plot.press('Home');
    await page.keyboard.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(hover.lastEvent.detail).toEqual({ dataIndex: 1, axisValue: 'Feb', seriesIndices: [0, 1] });
    expect(activate.lastEvent.detail).toEqual(expect.objectContaining({
      dataIndex: 1,
      axisValue: 'Feb',
      seriesValues: [
        { seriesIndex: 0, seriesId: 'revenue', label: 'Revenue', dataIndex: 1, value: 28 },
        { seriesIndex: 1, seriesId: 'costs', label: 'Costs', dataIndex: 1, value: 10 },
      ],
    }));
    expect((await page.find('md-line-chart >>> .md-line-chart__live')).textContent).toBe('Feb: Revenue 28, Costs 10');

    await page.keyboard.press('End');
    await page.waitForChanges();
    expect(hover.lastEvent.detail.dataIndex).toBe(2);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect((await page.find('md-line-chart >>> .md-line-chart__live')).textContent).toBe('');
    expect(activate).toHaveReceivedEventTimes(1);
  });

  it('keeps a legend-hidden series out of keyboard values after a live data refresh', async () => {
    const page = await newE2EPage();
    const chart = await mount(page);
    const legend = await chart.spyOnEvent('mdLegendClick');
    const hover = await chart.spyOnEvent('mdHover');
    const revenue = await page.find('md-line-chart >>> button[data-series-index="0"]');
    await revenue.click();
    await page.waitForChanges();
    expect(legend).toHaveReceivedEventDetail({ seriesIndex: 0, seriesId: 'revenue', selected: false });
    expect((await page.find('md-line-chart >>> button[data-series-index="0"]')).getAttribute('aria-pressed')).toBe('false');

    await chart.setProperty('series', [{ ...SERIES[0], data: [20, 40, 60] }, SERIES[1]]);
    await page.waitForChanges();
    const plot = await page.find('md-line-chart >>> [part="canvas"]');
    await plot.press('Home');
    await page.waitForChanges();
    expect(hover.lastEvent.detail.seriesIndices).toEqual([1]);
    expect((await page.find('md-line-chart >>> .md-line-chart__live')).textContent).toBe('Jan: Costs 5');

    await (await page.find('md-line-chart >>> button[data-series-index="0"]')).press('Enter');
    await page.waitForChanges();
    expect(legend.lastEvent.detail).toEqual({ seriesIndex: 0, seriesId: 'revenue', selected: true });
    await plot.press('Home');
    await page.waitForChanges();
    expect(hover.lastEvent.detail.seriesIndices).toEqual([0, 1]);
    expect((await page.find('md-line-chart >>> .md-line-chart__live')).textContent).toBe('Jan: Revenue 20, Costs 5');
  });

  it('replaces empty and loading affordances with a usable plot when data arrives', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-line-chart label-empty="No readings" loading-label="Fetching readings" animation="none" style="width:600px;height:320px"></md-line-chart>');
    const chart = await page.find('md-line-chart');
    expect((await page.find('md-line-chart >>> [part="empty"]')).textContent).toBe('No readings');
    expect((await page.find('md-line-chart >>> [part="canvas"]')).getAttribute('tabindex')).toBeNull();
    await chart.setProperty('loading', true);
    await page.waitForChanges();
    expect(chart.getAttribute('aria-busy')).toBe('true');
    expect(await page.find('md-line-chart >>> [part="empty"]')).toBeNull();
    expect((await page.find('md-line-chart >>> [part="loading"]')).textContent).toContain('Fetching readings');

    await chart.setProperty('series', SERIES);
    await chart.setProperty('xAxis', { data: ['Jan', 'Feb', 'Mar'] });
    await chart.setProperty('loading', false);
    await page.waitForChanges();
    await waitForRevenuePixels(page);
    expect(await page.find('md-line-chart >>> [part="loading"]')).toBeNull();
    expect((await page.find('md-line-chart >>> [part="canvas"]')).getAttribute('tabindex')).toBe('0');
    expect(await tableRows(page)).toHaveLength(3);
  });
});
