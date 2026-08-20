import { newE2EPage } from '@stencil/core/testing';

describe('md-navigation-rail e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    const rail = await page.find('md-navigation-rail');
    expect(rail).toBeTruthy();
    expect(rail.getAttribute('role')).toBe('navigation');
  });

  it('has role=navigation and the configured aria-label', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail label="Primary"></md-navigation-rail>');
    const rail = await page.find('md-navigation-rail');
    expect(rail.getAttribute('role')).toBe('navigation');
    expect(rail.getAttribute('aria-label')).toBe('Primary');
  });

  it('emits mdTabChange when a destination is selected', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab id="home" icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab id="search" icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    const rail = await page.find('md-navigation-rail');
    const ev = await rail.spyOnEvent('mdTabChange');
    const search = await page.find('#search');
    await search.click();
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
  });

  it('keyboard ArrowDown moves focus to next destination', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab id="t1" icon="home" label="Home" active></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t2" icon="search" label="Search"></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t3" icon="settings" label="Settings"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    await page.waitForChanges();

    const t1 = await page.find('#t1');
    await t1.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('t2');
  });

  it('keyboard Home jumps to first destination, End jumps to last', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary">
        <md-navigation-rail-tab id="t1" icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t2" icon="search" label="Search" active></md-navigation-rail-tab>
        <md-navigation-rail-tab id="t3" icon="settings" label="Settings"></md-navigation-rail-tab>
      </md-navigation-rail>
    `);
    await page.waitForChanges();

    const t2 = await page.find('#t2');
    await t2.focus();
    await page.keyboard.press('End');
    await page.waitForChanges();
    let focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('t3');

    await page.keyboard.press('Home');
    await page.waitForChanges();
    focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(focusedId).toBe('t1');
  });

  it('expand() / collapse() methods update the variant attribute', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail label="Primary"></md-navigation-rail>');
    const rail = await page.find('md-navigation-rail');

    await rail.callMethod('expand');
    await page.waitForChanges();
    expect(rail.getAttribute('variant')).toBe('expanded');

    await rail.callMethod('collapse');
    await page.waitForChanges();
    expect(rail.getAttribute('variant')).toBe('standard');
  });
});
