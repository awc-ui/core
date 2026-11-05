import { newE2EPage } from '@stencil/core/testing';

describe('md-sub-menu-item e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-sub-menu-item headline="Item"></md-sub-menu-item>');
    const el = await page.find('md-sub-menu-item');
    expect(el).toBeTruthy();
  });
});

describe('md-sub-menu-item nested menu interaction', () => {
  it('opens by keyboard, focuses its child, returns on ArrowLeft, and resets via collapse', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="anchor">Actions</button><md-menu anchor="anchor" quick open><md-sub-menu-item headline="Share" open-delay="0" close-delay="0"><md-menu slot="submenu" quick><md-menu-item headline="Email"></md-menu-item><md-menu-item headline="Link"></md-menu-item></md-menu></md-sub-menu-item><md-menu-item headline="Delete"></md-menu-item></md-menu>');
    const row = await page.find('md-sub-menu-item'); const nested = await page.find('md-sub-menu-item md-menu');
    await row.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => (document.querySelector('md-sub-menu-item md-menu') as HTMLMdMenuElement).open);
    await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Email');
    expect((await page.find('md-sub-menu-item')).getAttribute('aria-expanded')).toBe('true');
    await page.keyboard.press('ArrowLeft'); await page.waitForChanges();
    expect(await nested.getProperty('open')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('MD-SUB-MENU-ITEM');
    await page.keyboard.press('Enter'); await page.waitForChanges(); expect(await nested.getProperty('open')).toBe(true);
    await row.callMethod('collapse'); await page.waitForChanges(); expect(await nested.getProperty('open')).toBe(false);
    expect(row.getAttribute('data-md-focused')).toBeNull();
  });

  it('hover intent keeps the flyout open while entering it and collapses sibling flyouts', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="anchor">Actions</button><md-menu anchor="anchor" quick open><md-sub-menu-item id="first" headline="First" open-delay="0" close-delay="80"><md-menu slot="submenu" quick><md-menu-item headline="First child"></md-menu-item></md-menu></md-sub-menu-item><md-sub-menu-item id="second" headline="Second" open-delay="0" close-delay="0"><md-menu slot="submenu" quick><md-menu-item headline="Second child"></md-menu-item></md-menu></md-sub-menu-item></md-menu>');
    await page.hover('#first'); await page.waitForFunction(() => (document.querySelector('#first md-menu') as HTMLMdMenuElement).open);
    await page.hover('#first md-menu md-menu-item'); await new Promise(resolve => setTimeout(resolve, 120));
    expect(await (await page.find('#first md-menu')).getProperty('open')).toBe(true);
    await page.hover('#second'); await page.waitForFunction(() => (document.querySelector('#second md-menu') as HTMLMdMenuElement).open);
    await page.waitForChanges(); expect(await (await page.find('#first md-menu')).getProperty('open')).toBe(false);
    await page.hover('#anchor'); await page.waitForFunction(() => !(document.querySelector('#second md-menu') as HTMLMdMenuElement).open);
  });

  it('disabled submenu rows reject click, Enter, and hover without child activation', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-menu quick open><md-sub-menu-item disabled headline="Blocked" open-delay="0"><md-menu slot="submenu" quick><md-menu-item headline="Child"></md-menu-item></md-menu></md-sub-menu-item></md-menu>');
    const row = await page.find('md-sub-menu-item'); const clicks = await row.spyOnEvent('mdClick');
    await row.click(); await row.focus(); await page.keyboard.press('Enter'); await page.hover('md-sub-menu-item'); await page.waitForChanges();
    expect(clicks).not.toHaveReceivedEvent(); expect(await (await page.find('md-sub-menu-item md-menu')).getProperty('open')).toBe(false);
  });
});
