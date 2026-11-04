import { newE2EPage } from '@stencil/core/testing';

describe('md-navigation-rail overflow selection', () => {
  it('selects an overflow destination then restores full destinations when the limit grows', async () => {
    const page = await newE2EPage(); await page.setContent('<md-navigation-rail orientation="horizontal" max-visible="1"><md-navigation-rail-tab icon="home" label="Home" value="home"></md-navigation-rail-tab><md-navigation-rail-tab icon="search" label="Search" value="search"></md-navigation-rail-tab><md-navigation-rail-tab icon="settings" label="Settings" value="settings"></md-navigation-rail-tab></md-navigation-rail>');
    const rail = await page.find('md-navigation-rail'); const changed = await rail.spyOnEvent('mdTabChange');
    await (await page.find('md-navigation-rail >>> .md-navigation-rail__overflow-trigger')).click();
    await page.waitForFunction(() => (document.querySelector('md-navigation-rail')!.shadowRoot!.querySelector('md-menu') as HTMLMdMenuElement).open);
    await (await page.find('md-navigation-rail >>> md-menu-item')).click(); await page.waitForChanges();
    expect(changed.lastEvent.detail).toEqual({ index: 1, value: 'search' }); expect(await rail.getProperty('activeIndex')).toBe(1);
    rail.setProperty('maxVisible', 3); await page.waitForChanges(); expect((await page.findAll('md-navigation-rail-tab[data-overflowed]')).length).toBe(0);
    await rail.callMethod('focusTab', 2); expect(await page.evaluate(() => document.activeElement?.getAttribute('label'))).toBe('Settings');
  });
});
