import { newE2EPage } from '@stencil/core/testing';

describe('md-app-bar live slots and search', () => {
  it('updates slotted subtitle/leading content and recovers trailing overflow when actions are removed', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-app-bar variant="medium" leading-icon="menu"><b slot="headline">Workspace</b><span slot="subtitle">Today</span><button slot="leading">Back</button><button slot="trailing">One</button><button slot="trailing">Two</button><button slot="trailing">Three</button><button slot="trailing" id="last">Four</button></md-app-bar>');
    await page.waitForFunction(() => (document.querySelector('#last') as HTMLElement).hidden);
    await page.$eval('md-app-bar [slot="trailing"]', el => el.remove());
    await page.waitForFunction(() => !(document.querySelector('#last') as HTMLElement).hidden);
    await page.$eval('md-app-bar [slot="leading"]', el => el.remove());
    await page.waitForFunction(() => !!document.querySelector('md-app-bar')!.shadowRoot!.querySelector('[part="leading-icon"]'));
    await page.$eval('md-app-bar [slot="subtitle"]', el => el.remove()); await page.waitForChanges();
    expect(await page.$eval('md-app-bar', el => el.classList.contains('md-app-bar--with-subtitle'))).toBe(false);
  });

  it('search container focuses the field and emits input values, while disabled search cannot activate', async () => {
    const page = await newE2EPage(); await page.setContent('<md-app-bar variant="search" search-placeholder="Search library"></md-app-bar>');
    const bar = await page.find('md-app-bar'); const input = await bar.spyOnEvent('mdSearchInput'); const activated = await bar.spyOnEvent('mdSearchActivate');
    await (await page.find('md-app-bar >>> .md-app-bar__search')).click(); await page.keyboard.type('report'); await page.waitForChanges();
    expect(input.lastEvent.detail).toEqual({ value: 'report' }); expect(await bar.getProperty('searchValue')).toBe('report');
    await page.keyboard.press('Enter'); await page.waitForChanges(); expect(activated.lastEvent.detail).toEqual({ value: 'report' });
    const count = activated.events.length; bar.setProperty('searchDisabled', true); await page.waitForChanges();
    await (await page.find('md-app-bar >>> .md-app-bar__search')).click(); await page.keyboard.press('Enter'); await page.waitForChanges();
    expect(activated.events.length).toBe(count);
  });
});
