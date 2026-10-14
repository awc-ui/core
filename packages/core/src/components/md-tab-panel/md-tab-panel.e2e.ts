import { newE2EPage } from '@stencil/core/testing';

describe('md-tab-panel browser visibility and focus', () => {
  it('hides inactive content while preserving its layout box and entered form state', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-tab-panel active aria-label="Profile"><div style="height:120px"><input id="name" aria-label="Name"></div></md-tab-panel>');
    await page.waitForChanges();
    await page.focus('#name');
    await page.keyboard.type('Ada');
    const before = await page.evaluate(() => document.querySelector('md-tab-panel')!.getBoundingClientRect().height);
    expect(before).toBeGreaterThanOrEqual(120);
    const panel = await page.find('md-tab-panel');
    await panel.setProperty('active', false);
    await page.waitForChanges();
    const hidden = await page.evaluate(() => {
      const host = document.querySelector('md-tab-panel')!;
      return { height: host.getBoundingClientRect().height, visibility: getComputedStyle(document.getElementById('name')!).visibility,
        value: (document.getElementById('name') as HTMLInputElement).value, tabIndex: host.tabIndex };
    });
    expect(hidden).toEqual({ height: before, visibility: 'hidden', value: 'Ada', tabIndex: -1 });
    await panel.setProperty('active', true);
    await page.waitForChanges();
    expect(await page.evaluate(() => ({ visibility: getComputedStyle(document.getElementById('name')!).visibility,
      value: (document.getElementById('name') as HTMLInputElement).value }))).toEqual({ visibility: 'visible', value: 'Ada' });
    expect(panel.getAttribute('role')).toBe('tabpanel');
  });

  it('includes only active panel content in the native Tab sequence', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <button id="before">Before</button>
      <md-tab-panel id="panel" aria-label="Settings"><button id="inside">Save settings</button></md-tab-panel>
      <button id="after">After</button>`);
    await page.waitForChanges();
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
    const panel = await page.find('md-tab-panel');
    await panel.setProperty('active', true);
    await page.waitForChanges();
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('panel');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('inside');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('after');
  });
});
