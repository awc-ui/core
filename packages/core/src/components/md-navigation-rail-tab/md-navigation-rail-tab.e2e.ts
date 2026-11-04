import { newE2EPage } from '@stencil/core/testing';

describe('md-navigation-rail-tab e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail-tab label="Home" icon="home"></md-navigation-rail-tab>');
    const tab = await page.find('md-navigation-rail-tab');
    expect(tab).toBeTruthy();
    expect(tab.getAttribute('role')).toBe('tab');
  });

  it('emits mdTabClick on user click', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail-tab label="Home" value="home"></md-navigation-rail-tab>');
    const tab = await page.find('md-navigation-rail-tab');
    const ev = await tab.spyOnEvent('mdTabClick');
    await tab.click();
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
    expect(ev).toHaveReceivedEventDetail({ value: 'home' });
  });

  it('does not emit mdTabClick when disabled', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail-tab label="Home" disabled></md-navigation-rail-tab>');
    const tab = await page.find('md-navigation-rail-tab');
    const ev = await tab.spyOnEvent('mdTabClick');
    await tab.click();
    await page.waitForChanges();
    expect(ev).not.toHaveReceivedEvent();
  });

  it('renders link semantics when href is set', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail-tab label="Home" href="/home" active></md-navigation-rail-tab>');
    const tab = await page.find('md-navigation-rail-tab');
    expect(tab.getAttribute('role')).toBe('link');
    expect(tab.getAttribute('aria-current')).toBe('page');
  });

  it('keyboard Enter emits mdTabClick', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail-tab label="Home" active></md-navigation-rail-tab>');
    const tab = await page.find('md-navigation-rail-tab');
    const ev = await tab.spyOnEvent('mdTabClick');
    await tab.focus();
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
  });

  it('keyboard Space emits mdTabClick', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-navigation-rail-tab label="Home" active></md-navigation-rail-tab>');
    const tab = await page.find('md-navigation-rail-tab');
    const ev = await tab.spyOnEvent('mdTabClick');
    await tab.focus();
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(ev).toHaveReceivedEvent();
  });
});

describe('md-navigation-rail-tab owned submenu', () => {
  it('opens its menu by keyboard, announces toggles, and clears a picked child selection', async () => {
    const page = await newE2EPage(); await page.setContent('<md-navigation-rail><md-navigation-rail-tab label="Workspace" icon="folder"><md-menu slot="submenu" quick><md-menu-item headline="Shared" value="shared"></md-menu-item></md-menu></md-navigation-rail-tab><md-navigation-rail-tab label="Home" icon="home"></md-navigation-rail-tab></md-navigation-rail>');
    const tab = await page.find('md-navigation-rail-tab'); const toggled = await tab.spyOnEvent('mdSubmenuToggle');
    await tab.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => (document.querySelector('md-navigation-rail-tab md-menu') as HTMLMdMenuElement).open);
    expect(toggled.lastEvent.detail).toMatchObject({ open: true });
    await (await page.find('md-menu-item')).click(); await page.waitForChanges();
    await tab.callMethod('clearSubmenuSelection'); await page.waitForChanges();
    expect(await (await page.find('md-menu-item')).getProperty('selected')).toBe(false);
    await (await page.find('md-navigation-rail')).callMethod('expand'); await page.waitForChanges();
    expect(await tab.getProperty('expanded')).toBe(true);
    await (await page.find('md-navigation-rail')).callMethod('collapse'); await page.waitForChanges();
    expect(await tab.getProperty('expanded')).toBe(false);
  });
});
