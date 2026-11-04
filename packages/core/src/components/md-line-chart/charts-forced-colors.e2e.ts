/**
 * Forced colors (Windows high contrast) repaint every DOM background with the
 * system Canvas colour, but not the canvas the chart draws its series into: the
 * lines and bars keep their series colours. The colour keys that point at them —
 * the legend swatches, the tooltip rows' swatches and the hover markers — have to
 * keep those colours too, or the legend no longer says which line is which.
 */
import { newE2EPage, type E2EPage } from '@stencil/core/testing';

async function mount(tag: string): Promise<E2EPage> {
  const page = await newE2EPage();
  const cdp = await (page as any).target().createCDPSession();
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
  await page.setContent(`<${tag} no-animation label="Revenue" style="display:block;width:640px;height:360px"></${tag}>`);
  const chart = await page.find(tag);
  await chart.setProperty('series', [
    { label: 'North', color: '#00796B', data: [10, 20, 30, 40] },
    { label: 'South', color: '#F57C00', data: [15, 12, 22, 18] },
  ]);
  await chart.setProperty('xAxis', { data: ['Q1', 'Q2', 'Q3', 'Q4'] });
  await page.waitForChanges();
  return page;
}

/** Computed background colours of the colour keys, in `rgb()` form. */
function keyColours(page: E2EPage, tag: string) {
  return page.evaluate((t: string) => {
    const sr = document.querySelector(t)!.shadowRoot!;
    const bg = (n: Element) => getComputedStyle(n).backgroundColor;
    const legend = [...sr.querySelectorAll('[part="legend"] button')].map(b => bg(b.querySelector('span') as Element));
    const tip = sr.querySelector('[part="tooltip"]');
    const rows = tip ? [...tip.querySelectorAll('span')].filter(s => getComputedStyle(s).width === '10px').map(bg) : [];
    return { forced: matchMedia('(forced-colors: active)').matches, legend, rows };
  }, tag);
}

describe.each(['md-line-chart', 'md-area-chart', 'md-bar-chart'])('%s in forced colors', tag => {
  it('keeps the series colours on the legend swatches and the tooltip row swatches', async () => {
    const page = await mount(tag);
    const plot = await page.find(`${tag} >>> [part="canvas"]`);
    await plot.focus();
    await plot.press('ArrowRight');
    await page.waitForChanges();
    const keys = await keyColours(page, tag);
    expect(keys.forced).toBe(true);
    expect(keys.legend).toEqual(['rgb(0, 121, 107)', 'rgb(245, 124, 0)']);
    expect(keys.rows).toEqual(['rgb(0, 121, 107)', 'rgb(245, 124, 0)']);
  });
});

describe.each(['md-line-chart', 'md-area-chart'])('%s hover markers in forced colors', tag => {
  it('keeps the series colour on the highlighted point', async () => {
    const page = await mount(tag);
    const plot = await page.find(`${tag} >>> [part="canvas"]`);
    await plot.focus();
    await plot.press('ArrowRight');
    await page.waitForChanges();
    const fills = await page.evaluate((t: string) => {
      const layer = document.querySelector(t)!.shadowRoot!.querySelector('[data-hover-index]')!;
      // The ringed-circle markers: 50% radius, a series-colour fill.
      return [...layer.querySelectorAll('div')].filter(d => getComputedStyle(d).borderRadius === '50%').map(d => getComputedStyle(d).backgroundColor);
    }, tag);
    expect(fills).toEqual(['rgb(0, 121, 107)', 'rgb(245, 124, 0)']);
  });
});
