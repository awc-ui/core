import { newE2EPage } from '@stencil/core/testing';

/**
 * `--md-menu-item-gap` is a documented md-menu-item hook. The standard and
 * vibrant variants tighten the default gap to 8px, but that default must not
 * override a hook the consumer set (on the menu or on the item).
 */
describe('md-menu-item --md-menu-item-gap hook', () => {
  const gap = async (variant: string, style = '') => {
    const page = await newE2EPage();
    await page.setContent(`<md-menu variant="${variant}" ${style}><md-menu-item headline="Copy"></md-menu-item></md-menu>`);
    return page.evaluate(() => getComputedStyle(document.querySelector('md-menu-item')!).columnGap);
  };

  for (const variant of ['baseline', 'standard', 'vibrant']) {
    it(`${variant}: the hook wins`, async () => {
      expect(await gap(variant, 'style="--md-menu-item-gap:20px"')).toBe('20px');
    });
  }

  it('without the hook the defaults are unchanged (12px baseline, 8px vertical variants)', async () => {
    expect(await gap('baseline')).toBe('12px');
    expect(await gap('standard')).toBe('8px');
    expect(await gap('vibrant')).toBe('8px');
  });
});
