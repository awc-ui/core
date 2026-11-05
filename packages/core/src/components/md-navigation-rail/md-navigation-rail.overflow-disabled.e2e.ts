import { newE2EPage } from '@stencil/core/testing';

/*
 * A disabled destination pushed into the overflow menu must stay disabled: the menu
 * row is disabled and choosing it never selects the destination or emits mdTabChange.
 */
describe('md-navigation-rail overflow keeps disabled destinations disabled', () => {
  it('renders the overflowed disabled destination as a disabled row and refuses selection', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary" max-visible="2" active-index="0">
        <md-navigation-rail-tab icon="home" label="Home" value="home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search" value="search"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="mail" label="Mail" value="mail"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="block" label="Blocked" value="blocked" disabled></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    const changes = await page.spyOnEvent('mdTabChange');
    const rows = await page.evaluate(() => Array.from(document.querySelector('md-navigation-rail')!.shadowRoot!.querySelectorAll('md-menu-item')).map((i: any) => ({ headline: i.headline, disabled: i.disabled })));
    expect(rows).toEqual([{ headline: 'Mail', disabled: false }, { headline: 'Blocked', disabled: true }]);
    await page.evaluate(() => {
      const items = document.querySelector('md-navigation-rail')!.shadowRoot!.querySelectorAll('md-menu-item');
      (items[1] as HTMLElement).click();
    });
    await page.waitForChanges();
    expect(await page.$eval('md-navigation-rail', (el: any) => el.activeIndex)).toBe(0);
    expect(changes).not.toHaveReceivedEvent();
    // An enabled overflowed destination is still selectable.
    await page.evaluate(() => {
      const items = document.querySelector('md-navigation-rail')!.shadowRoot!.querySelectorAll('md-menu-item');
      (items[0] as HTMLElement).click();
    });
    await page.waitForChanges();
    expect(await page.$eval('md-navigation-rail', (el: any) => el.activeIndex)).toBe(2);
    expect(changes).toHaveReceivedEventDetail({ index: 2, value: 'mail' });
  });
});
