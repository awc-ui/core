import { newE2EPage } from '@stencil/core/testing';

/*
 * md-tab-panels must follow EVERY selection path of its md-tabs. A consumer (or a
 * framework wrapper) writing `activeTabIndex` changes the active tab without an
 * mdTabChange event, and the region kept showing the previous panel.
 */
describe('md-tab-panels follows programmatic selection', () => {
  const html = `
    <md-tabs><md-tab label="One"></md-tab><md-tab label="Two"></md-tab><md-tab label="Three"></md-tab></md-tabs>
    <md-tab-panels><md-tab-panel>P1</md-tab-panel><md-tab-panel>P2</md-tab-panel><md-tab-panel>P3</md-tab-panel></md-tab-panels>`;
  const state = (page: any) => page.evaluate(() => ({
    tab: Array.from(document.querySelectorAll('md-tab')).findIndex(t => t.hasAttribute('active')),
    panel: Array.from(document.querySelectorAll('md-tab-panel')).findIndex(p => p.hasAttribute('active')),
    inert: Array.from(document.querySelectorAll('md-tab-panel')).map(p => p.hasAttribute('inert')),
  }));

  it('shows the panel of an activeTabIndex property write', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: any) => { el.activeTabIndex = 2; });
    await page.waitForChanges();
    expect(await state(page)).toEqual({ tab: 2, panel: 2, inert: [true, true, false] });
  });

  it('shows the panel of an active-tab-index attribute write', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    await page.waitForChanges();
    await page.$eval('md-tabs', (el: any) => el.setAttribute('active-tab-index', '1'));
    await page.waitForChanges();
    expect(await state(page)).toEqual({ tab: 1, panel: 1, inert: [true, false, true] });
  });

  it('still follows clicks (mdTabChange path)', async () => {
    const page = await newE2EPage();
    await page.setContent(html);
    await page.waitForChanges();
    await (await page.find('md-tab:nth-of-type(3)')).click();
    await page.waitForChanges();
    expect(await state(page)).toEqual({ tab: 2, panel: 2, inert: [true, true, false] });
  });
});
