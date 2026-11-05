import { newE2EPage } from '@stencil/core/testing';

describe('md-menu public dismissal and dynamic contents', () => {
  it('persistent menus ignore outside clicks, maintain keyboard navigation, and resolve close cycles', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="anchor">Open</button><button id="outside" style="position:absolute;right:0">Outside</button><md-menu anchor="anchor" persistent quick><md-menu-item headline="Alpha"></md-menu-item><md-menu-item headline="Blocked" disabled></md-menu-item><md-menu-item headline="Zulu"></md-menu-item></md-menu>');
    const menu = await page.find('md-menu'); const opened = await menu.spyOnEvent('mdOpen');
    await menu.callMethod('show', { autoFocus: true }); await page.waitForChanges(); await page.click('#outside'); await page.waitForChanges();
    expect(await menu.getProperty('open')).toBe(true);
    const items = await page.findAll('md-menu-item'); await items[0].focus(); await page.keyboard.press('ArrowUp');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('headline'))).toBe('Zulu');
    await page.keyboard.press('Home'); await page.keyboard.press('z');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('headline'))).toBe('Zulu');
    await page.keyboard.press('Escape'); await menu.callMethod('whenClosed'); await page.waitForChanges(); expect(await menu.getProperty('open')).toBe(false);
    await menu.callMethod('show', { autoFocus: false }); await page.waitForChanges(); expect(opened).toHaveReceivedEventTimes(2);
    await menu.callMethod('close'); await menu.callMethod('whenClosed');
  });

  it('closes a peer menu but preserves persistent peers and measures newly inserted items', async () => {
    const page = await newE2EPage(); await page.setContent('<button id="a">A</button><button id="b">B</button><md-menu id="one" anchor="a" quick><md-menu-item headline="One"></md-menu-item></md-menu><md-menu id="two" anchor="b" quick></md-menu>');
    const one = await page.find('#one'); const two = await page.find('#two');
    await one.callMethod('show'); await two.callMethod('show'); await page.waitForChanges(); expect(await one.getProperty('open')).toBe(false);
    await page.$eval('#two', el => { const item = document.createElement('md-menu-item'); item.setAttribute('headline', 'Late option'); el.append(item); }); await page.waitForChanges();
    expect((await page.find('#two md-menu-item')).getAttribute('role')).toBe('menuitem');
    two.setProperty('persistent', true); await page.waitForChanges(); await one.callMethod('show'); await page.waitForChanges(); expect(await two.getProperty('open')).toBe(true);
    await two.callMethod('close'); await one.callMethod('close');
  });
});
