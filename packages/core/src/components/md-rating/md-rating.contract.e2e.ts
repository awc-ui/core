import { newE2EPage } from '@stencil/core/testing';

// Declarative `outline-empty` contract (Gate 1, 2026-10-25). The prop defaults to true, so
// `outline-empty="false"` is the only way markup can turn it off. Stencil parses that string to
// `false` but leaves the authored attribute in place.
const emptyFill = (page: any) =>
  page.$$eval('md-rating', (els: any[]) => els.map(el => {
    const bg = el.shadowRoot.querySelectorAll('.md-rating__icon--bg')[4] as HTMLElement;
    return /"FILL" 1/.test(getComputedStyle(bg).fontVariationSettings) ? 'filled' : 'outlined';
  }));

describe('md-rating outline-empty', () => {
  it('authored outline-empty="false" draws filled empty glyphs, like the property', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-rating value="2"></md-rating><md-rating outline-empty="false" value="2"></md-rating><md-rating id="p" value="2"></md-rating>');
    await page.$eval('#p', (el: any) => { el.outlineEmpty = false; });
    await page.waitForChanges();
    expect(await emptyFill(page)).toEqual(['outlined', 'filled', 'filled']);
  });

  it('switching the property back on outlines the empty glyphs again', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-rating outline-empty="false" value="2"></md-rating>');
    await page.$eval('md-rating', (el: any) => { el.outlineEmpty = true; });
    await page.waitForChanges();
    expect(await emptyFill(page)).toEqual(['outlined']);
  });
});
