import { newE2EPage } from '@stencil/core/testing';

describe('md-bottom-sheet user dismissal and lifecycle', () => {
  it('locks scrolling, focuses content, restores the opener, and emits exact lifecycle events', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="open">Open</button><md-bottom-sheet headline="Settings" closeable><input id="field"><button slot="actions">Save</button></md-bottom-sheet>');
    await page.click('#open');
    const sheet = await page.find('md-bottom-sheet');
    const opened = await sheet.spyOnEvent('mdOpen'); const closed = await sheet.spyOnEvent('mdClose'); const cancel = await sheet.spyOnEvent('mdCancel');
    await sheet.callMethod('show');
    await page.waitForFunction(() => document.body.style.overflow === 'hidden');
    await page.waitForChanges(); await new Promise(resolve => setTimeout(resolve, 350));
    const close = await page.find('md-bottom-sheet >>> .md-bottom-sheet__close md-icon-button');
    await close.click(); await page.waitForChanges();
    expect(await sheet.getProperty('open')).toBe(false);
    expect(opened).toHaveReceivedEventTimes(1); expect(closed).toHaveReceivedEventTimes(1); expect(cancel).toHaveReceivedEventTimes(1);
    expect(await page.evaluate(() => ({ overflow: document.body.style.overflow, focus: document.activeElement?.id }))).toEqual({ overflow: '', focus: 'open' });
    await sheet.callMethod('show'); await page.waitForChanges(); await page.keyboard.press('Escape'); await page.waitForChanges();
    expect(cancel).toHaveReceivedEventTimes(2);
  });

  it('distinguishes a protected scrim from explicit Escape dismissal', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bottom-sheet variant="detached" open scrim-dismissible="false" aria-label="Tools"><p>Content</p></md-bottom-sheet>');
    const sheet = await page.find('md-bottom-sheet'); const cancel = await sheet.spyOnEvent('mdCancel');
    await page.mouse.click(10, 10); await page.waitForChanges();
    expect(await sheet.getProperty('open')).toBe(true); expect(cancel).not.toHaveReceivedEvent();
    sheet.setProperty('scrimDismissible', true); await page.waitForChanges();
    await page.mouse.click(10, 10); await page.waitForChanges();
    expect(await sheet.getProperty('open')).toBe(false); expect(cancel).toHaveReceivedEventTimes(1);
  });

  it('snaps a short drag back and dismisses only after a drag beyond the threshold', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bottom-sheet open headline="Drag"><div style="height:250px">Details</div></md-bottom-sheet>');
    const sheet = await page.find('md-bottom-sheet'); const cancel = await sheet.spyOnEvent('mdCancel');
    await page.waitForFunction(() => document.querySelector('md-bottom-sheet')!.shadowRoot!.querySelector('[part="container"]')!.getBoundingClientRect().height > 200);
    await new Promise(resolve => setTimeout(resolve, 350));
    const box = await page.$eval('md-bottom-sheet', el => { const r = el.shadowRoot!.querySelector('[part="drag-handle"]')!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 }); await page.mouse.up();
    await page.waitForChanges(); expect(await sheet.getProperty('open')).toBe(true); expect(cancel).not.toHaveReceivedEvent();
    expect(await page.$eval('md-bottom-sheet', el => (el.shadowRoot!.querySelector('[part="container"]') as HTMLElement).style.transform)).toBe('');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 140, { steps: 8 }); await page.mouse.up();
    await page.waitForChanges(); expect(await sheet.getProperty('open')).toBe(false); expect(cancel).toHaveReceivedEventTimes(1);
  });

  it('supports late action removal and clears the global scroll lock on disconnect', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-bottom-sheet open closeable bottom-divider><button slot="close">Custom close</button><button slot="actions">Apply</button></md-bottom-sheet>');
    await page.$eval('md-bottom-sheet [slot="actions"]', el => el.remove());
    await page.waitForChanges();
    expect(await page.find('md-bottom-sheet >>> [part="actions"]')).toBeNull();
    await page.$eval('md-bottom-sheet', el => el.remove());
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
});
