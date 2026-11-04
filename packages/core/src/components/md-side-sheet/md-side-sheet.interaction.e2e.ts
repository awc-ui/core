import { newE2EPage } from '@stencil/core/testing';

describe('md-side-sheet modal and inline interaction', () => {
  it('back leaves the modal open; close resolves whenClosed and restores focus', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="opener">Open</button><md-side-sheet variant="modal" headline="Details" show-back><button id="inside">Inside</button></md-side-sheet>');
    await page.click('#opener');
    const sheet = await page.find('md-side-sheet'); const back = await sheet.spyOnEvent('mdBack'); const cancel = await sheet.spyOnEvent('mdCancel');
    await sheet.callMethod('show'); await page.waitForChanges();
    await (await page.find('md-side-sheet >>> .md-side-sheet__back md-icon-button')).click(); await page.waitForChanges();
    expect(back).toHaveReceivedEventTimes(1); expect(await sheet.getProperty('open')).toBe(true);
    await (await page.find('md-side-sheet >>> .md-side-sheet__close md-icon-button')).click(); await sheet.callMethod('whenClosed'); await page.waitForChanges();
    expect(cancel).toHaveReceivedEventTimes(1); expect(await sheet.getProperty('open')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('opener');
  });

  it('protects modal dismissal, then switches to an inline region without document Escape handling', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-side-sheet variant="modal" open scrim-dismissible="false"><button>Action</button></md-side-sheet>');
    const sheet = await page.find('md-side-sheet');
    await page.keyboard.press('Escape'); await page.mouse.click(10, 10); await page.waitForChanges();
    expect(await sheet.getProperty('open')).toBe(true);
    sheet.setProperty('scrimDismissible', true); await page.waitForChanges(); await page.keyboard.press('Escape'); await sheet.callMethod('whenClosed');
    sheet.setProperty('variant', 'standard'); await page.waitForChanges(); await sheet.callMethod('show'); await page.waitForChanges();
    await page.keyboard.press('Escape'); await page.waitForChanges();
    expect(await sheet.getProperty('open')).toBe(true);
    expect((await page.find('md-side-sheet >>> [part="container"]')).getAttribute('role')).toBe('region');
    expect(await page.find('md-side-sheet >>> [part="scrim"]')).toBeNull();
  });

  it('discovers late action content and stops rendering it when its slot changes', async () => {
    const page = await newE2EPage(); await page.setContent('<md-side-sheet open bottom-divider headline="Filters"></md-side-sheet>');
    await page.$eval('md-side-sheet', el => { const button = document.createElement('button'); button.slot = 'actions'; button.textContent = 'Apply'; el.append(button); });
    await page.waitForFunction(() => !!document.querySelector('md-side-sheet')!.shadowRoot!.querySelector('[part="actions"]'));
    expect(await page.find('md-side-sheet >>> [part="divider-bottom"]')).not.toBeNull();
    await page.$eval('md-side-sheet button', el => el.removeAttribute('slot'));
    await page.waitForFunction(() => !document.querySelector('md-side-sheet')!.shadowRoot!.querySelector('[part="actions"]'));
  });
});

describe('md-side-sheet keyboard focus trap', () => {
  it('wraps Tab and Shift+Tab between real slotted controls, excluding hidden sentinels', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="outside">Outside</button><md-side-sheet variant="modal" closeable="false"><button id="first">First</button><div><button id="last">Last</button></div></md-side-sheet>');
    const sheet = await page.find('md-side-sheet'); await sheet.callMethod('show');
    await page.waitForFunction(() => document.activeElement?.id === 'first');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    await page.waitForFunction(() => document.activeElement?.id === 'last');
    await page.keyboard.press('Tab'); await page.waitForFunction(() => document.activeElement?.id === 'first');
    await page.$eval('#outside', el => (el as HTMLElement).focus());
    await page.waitForFunction(() => document.activeElement?.id === 'first');
    expect(await sheet.getProperty('open')).toBe(true);
  });
});
