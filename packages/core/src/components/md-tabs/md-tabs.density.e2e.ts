import { newE2EPage } from '@stencil/core/testing';

/*
 * md-tab's minimum width tapers with density (max(48px, 90px + density × 8px)). Inside a
 * tablist md-tabs re-declared a flat 90px for every slotted tab, so density never reached
 * the minimum width of a tab in its normal container.
 */
describe('md-tabs keeps md-tab density', () => {
  it.each([[0, 90], [-1, 82], [-2, 74], [-4, 58]])('density %i gives a %ipx minimum in a tablist', async (density, min) => {
    const page = await newE2EPage();
    await page.setContent(`<div style="width:600px"><md-tabs tab-width="auto"><md-tab label="A" density="${density}"></md-tab><md-tab label="B"></md-tab></md-tabs></div>
      <md-tab id="solo" label="A" density="${density}"></md-tab>`);
    await page.waitForChanges();
    const r = await page.evaluate(() => ({
      inList: getComputedStyle(document.querySelector('md-tabs md-tab')!).minInlineSize,
      width: document.querySelector('md-tabs md-tab')!.getBoundingClientRect().width,
      solo: getComputedStyle(document.querySelector('#solo')!).minInlineSize,
    }));
    expect(r).toEqual({ inList: `${min}px`, width: min, solo: `${min}px` });
  });

  it('a global data-density ancestor also tapers tabs in a tablist', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div style="width:600px; --md-sys-density-scale:-3"><md-tabs tab-width="auto"><md-tab label="A"></md-tab></md-tabs></div>`);
    await page.waitForChanges();
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('md-tab')!).minInlineSize)).toBe('66px');
  });
});
