/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-bar-chart`.
 *
 * The chart is a canvas + DOM overlay, so its accessibility lives in the DOM
 * structure the component renders: `role="figure"` + an accessible summary, the
 * `role="application"` keyboard-explorable plot, the screen-reader data table,
 * and the polite live region. This validates that structure across a few
 * configurations. (Canvas pixels don't render under jsdom, which is fine — axe
 * checks the DOM contract, not the drawing.)
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdBarChart } from './md-bar-chart';
import { MdSlider } from '../md-slider/md-slider';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const wrap = (inner: string): string => `<body><h1>Report</h1>${inner}</body>`;

/** Let the batched applyEngine + the a11y-table rebuild flush before the sweep. */
async function settle(page: Awaited<ReturnType<typeof newSpecPage>>): Promise<void> {
  await page.waitForChanges();
  await new Promise((r) => setTimeout(r, 0));
  await page.waitForChanges();
}

describe('md-bar-chart · axe', () => {
  it('empty chart has no violations', async () => {
    const page = await newSpecPage({ components: [MdBarChart], html: '<md-bar-chart label="Revenue"></md-bar-chart>' });
    await settle(page);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('grouped vertical with data has no violations', async () => {
    const page = await newSpecPage({ components: [MdBarChart], html: '<md-bar-chart label="Revenue"></md-bar-chart>' });
    page.root!.series = [
      { label: 'A', data: [10, 20, 30] },
      { label: 'B', data: [5, 15, 25] },
    ];
    page.root!.xAxis = { data: ['Q1', 'Q2', 'Q3'] };
    await settle(page);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('horizontal stacked with value labels has no violations', async () => {
    const page = await newSpecPage({
      components: [MdBarChart],
      html: '<md-bar-chart label="Medals" layout="horizontal" stack="normal" show-labels></md-bar-chart>',
    });
    page.root!.series = [
      { label: 'Gold', data: [10, 8] },
      { label: 'Silver', data: [8, 6] },
    ];
    page.root!.xAxis = { data: ['USA', 'China'] };
    await settle(page);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('polar (radial) chart has no violations', async () => {
    const page = await newSpecPage({ components: [MdBarChart], html: '<md-bar-chart label="Medals" polar></md-bar-chart>' });
    page.root!.series = [
      { label: 'Gold', data: [10, 8] },
      { label: 'Silver', data: [8, 6] },
    ];
    page.root!.xAxis = { data: ['USA', 'China'] };
    await settle(page);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('zoom slider (embedded md-slider + aria labels) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdBarChart, MdSlider],
      html: '<md-bar-chart label="Daily sales" zoom="slider"></md-bar-chart>',
    });
    page.root!.series = [{ label: 'Sales', data: [10, 20, 30, 15, 22, 18, 24] }];
    page.root!.xAxis = { data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };
    await settle(page);
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});
