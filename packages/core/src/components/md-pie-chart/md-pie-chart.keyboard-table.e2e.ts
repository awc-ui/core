/**
 * Gate-1 contract fixes (2026-10-25): the keyboard cursor, the screen-reader
 * table and the hover card must describe the chart that is actually drawn.
 */
import { newE2EPage, E2EPage } from '@stencil/core/testing';

const live = async (page: E2EPage) => (await page.find('md-pie-chart >>> [aria-live]')).textContent;
const tooltip = (page: E2EPage) =>
  page.evaluate(() => document.querySelector('md-pie-chart')!.shadowRoot!.querySelector('[part="tooltip"]')?.textContent ?? null);
const tableRows = (page: E2EPage) =>
  page.evaluate(() =>
    Array.from(document.querySelector('md-pie-chart')!.shadowRoot!.querySelectorAll('tbody tr'), tr =>
      Array.from(tr.children, c => c.textContent),
    ),
  );

async function chart(html: string, data: unknown) {
  const page = await newE2EPage();
  await page.setContent(html);
  const el = await page.find('md-pie-chart');
  await el.setProperty('data', data);
  await page.waitForChanges();
  const plot = await page.find('md-pie-chart >>> [part="canvas"]');
  return { page, el, plot };
}

describe('md-pie-chart keyboard walks the drawn slices only', () => {
  it('skips a hidden slice and states shares of the visible ring, like the hover card', async () => {
    const { page, el, plot } = await chart(
      '<md-pie-chart no-animation style="width:600px;height:400px"></md-pie-chart>',
      [{ label: 'A', value: 50 }, { label: 'B', value: 30, hidden: true }, { label: 'C', value: 20 }],
    );
    const clicked = await el.spyOnEvent('mdSliceClick');
    await plot.press('Home');
    expect(await live(page)).toBe('A: 50 (71.4%)');
    expect(await tooltip(page)).toBe('A50 (71.4%)');
    await plot.press('ArrowRight');
    expect(await live(page)).toBe('C: 20 (28.6%)');
    await plot.press('Enter');
    expect(clicked.lastEvent.detail).toEqual(expect.objectContaining({ dataIndex: 2, value: 20 }));
    await plot.press('ArrowLeft');
    expect(await live(page)).toBe('A: 50 (71.4%)');
  });

  it('skips the children of a slice the legend hid, and slices hidden by a legend toggle', async () => {
    const { page, plot } = await chart(
      '<md-pie-chart no-animation inner-radius="35%" style="width:600px;height:400px"></md-pie-chart>',
      [
        { id: 'hw', label: 'Hardware', value: 40, children: [{ label: 'Phones', value: 10 }, { label: 'Laptops', value: 30 }] },
        { id: 'sv', label: 'Services', value: 60 },
      ],
    );
    await (await page.find('md-pie-chart >>> button[data-series-index="0"]')).click(); // hide Hardware
    await page.waitForChanges();
    await plot.press('Home');
    expect(await live(page)).toBe('Services: 60 (100%)');
    await plot.press('ArrowRight');
    expect(await live(page)).toBe('Services: 60 (100%)');
    await plot.press('End');
    expect(await live(page)).toBe('Services: 60 (100%)');
  });

  it('keeps the cursor on a real slice when the data shrinks under it', async () => {
    const { page, el, plot } = await chart(
      '<md-pie-chart no-animation style="width:600px;height:400px"></md-pie-chart>',
      [1, 2, 3, 4, 5].map((v, i) => ({ label: `S${i}`, value: v })),
    );
    await plot.press('End');
    expect(await live(page)).toBe('S4: 5 (33.3%)');
    await el.setProperty('data', [{ label: 'X', value: 1 }, { label: 'Y', value: 3 }]);
    await page.waitForChanges();
    expect(await live(page)).toBe('Y: 3 (75%)');
    await plot.press('ArrowLeft');
    expect(await live(page)).toBe('X: 1 (25%)');
    await el.setProperty('data', []);
    await page.waitForChanges();
    expect(await live(page)).toBe('');
  });

  it('moves the cursor to the next drawn slice when `hidden` takes out the one it is on', async () => {
    const rows = [{ label: 'A', value: 50 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }];
    const { page, el, plot } = await chart(
      '<md-pie-chart no-animation style="width:600px;height:400px"></md-pie-chart>',
      rows,
    );
    await plot.press('Home');
    await plot.press('ArrowRight');
    expect(await live(page)).toBe('B: 30 (30%)');
    await el.setProperty('data', rows.map(r => (r.label === 'B' ? { ...r, hidden: true } : r)));
    await page.waitForChanges();
    expect(await live(page)).toBe('C: 20 (28.6%)');
  });

  it('takes the last slice\u2019s card down when the cursor reaches a zero slice', async () => {
    const { page, plot } = await chart(
      '<md-pie-chart no-animation style="width:600px;height:400px"></md-pie-chart>',
      [{ label: 'A', value: 3 }, { label: 'Zero', value: 0 }, { label: 'B', value: 1 }],
    );
    await plot.press('Home');
    expect(await tooltip(page)).toBe('A3 (75.0%)');
    await plot.press('ArrowRight');
    expect(await live(page)).toBe('Zero: 0 (0%)');
    expect(await tooltip(page)).toBeNull();
  });
});

describe('md-pie-chart hover card', () => {
  it('applies a tooltipRenderer assigned after the first render', async () => {
    const { page, plot } = await chart(
      '<md-pie-chart no-animation style="width:600px;height:400px"></md-pie-chart>',
      [{ label: 'A', value: 3 }, { label: 'B', value: 1 }],
    );
    await page.evaluate(() => {
      (document.querySelector('md-pie-chart') as HTMLMdPieChartElement).tooltipRenderer = ctx => `custom ${ctx.axisLabel}`;
    });
    await page.waitForChanges();
    await plot.press('Home');
    expect(await tooltip(page)).toBe('custom A');
  });

  it('formats the share with the chart locale', async () => {
    const { page, plot } = await chart(
      '<md-pie-chart no-animation locale="de-DE" style="width:600px;height:400px"></md-pie-chart>',
      [{ label: 'A', value: 2000.5 }, { label: 'B', value: 1000 }],
    );
    await plot.press('Home');
    expect(await live(page)).toBe('A: 2.000,5 (66,7%)');
    expect(await tooltip(page)).toBe('A2.000,5 (66,7%)');
  });
});

describe('md-pie-chart screen-reader table', () => {
  it('prints shares as percentages, not through the value formatter', async () => {
    const { page } = await chart(
      '<md-pie-chart no-animation label="Revenue" style="width:600px;height:400px"></md-pie-chart>',
      [{ label: 'A', value: 1500 }, { label: 'B', value: 500 }],
    );
    await page.evaluate(() => {
      (document.querySelector('md-pie-chart') as HTMLMdPieChartElement).valueFormatter = v =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
    });
    await page.waitForChanges();
    expect(await tableRows(page)).toEqual([
      ['A', '$1,500.00', '75%'],
      ['B', '$500.00', '25%'],
    ]);
  });

  it('lists every ring of a nested chart, each share against its siblings', async () => {
    const { page } = await chart(
      '<md-pie-chart no-animation locale="de-DE" style="width:600px;height:400px"></md-pie-chart>',
      [
        { label: 'Hardware', value: 40, children: [{ label: 'Phones', value: 10 }, { label: 'Laptops', value: 20 }] },
        { label: 'Services', value: 60 },
      ],
    );
    expect(await tableRows(page)).toEqual([
      ['Hardware', '40', '40%'],
      ['Hardware / Phones', '10', '33,3%'],
      ['Hardware / Laptops', '20', '66,7%'],
      ['Services', '60', '60%'],
    ]);
  });
});
