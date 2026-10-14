import { newE2EPage } from '@stencil/core/testing';

async function createItem(attributes = '', content = '') {
  const page = await newE2EPage();
  await page.setContent(`
    <button id="anchor" style="position:fixed;right:32px;bottom:32px">Create</button>
    <md-fab-menu anchor="anchor" open quick>
      <md-fab-menu-item id="item" ${attributes}>${content}</md-fab-menu-item>
    </md-fab-menu>`);
  await page.waitForChanges();
  return page;
}

describe('md-fab-menu-item browser behavior', () => {
  it('activates from slotted label content, emits a void event, and lets the menu dismiss', async () => {
    const page = await createItem('icon="upload"', '<span id="label">Upload document</span>');
    const item = await page.find('#item');
    const menu = await page.find('md-fab-menu');
    const activation = await item.spyOnEvent('mdClick');
    const delegated = await menu.spyOnEvent('mdClick');
    const closed = await menu.spyOnEvent('mdClose');

    await page.click('#label');
    await page.waitForChanges();
    expect(activation).toHaveReceivedEventTimes(1);
    expect(activation.lastEvent.detail).toBeNull();
    expect(delegated).toHaveReceivedEventTimes(1);
    expect(closed).toHaveReceivedEventTimes(1);
    expect(await menu.getProperty('open')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('anchor');
  });

  it.each(['Enter', 'Space'] as const)('activates exactly once from %s and restores the anchor focus', async key => {
    const page = await createItem('label="New note"');
    const item = await page.find('#item');
    const activation = await item.spyOnEvent('mdClick');
    await page.$eval('#item', element => (element as HTMLElement).focus());
    expect(item.getAttribute('role')).toBe('menuitem');
    await page.keyboard.press(key);
    await page.waitForChanges();
    expect(activation).toHaveReceivedEventTimes(1);
    expect(activation.lastEvent.detail).toBeNull();
    expect(await (await page.find('md-fab-menu')).getProperty('open')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('anchor');
  });

  it.each(['disabled', 'soft-disabled'])('blocks pointer and keyboard activation while %s, then works when enabled', async attribute => {
    const page = await createItem(`label="Upload" ${attribute}`);
    const item = await page.find('#item');
    const menu = await page.find('md-fab-menu');
    const activation = await item.spyOnEvent('mdClick');
    const closed = await menu.spyOnEvent('mdClose');
    expect(item.getAttribute('aria-disabled')).toBe('true');

    await page.click('#item');
    // Both disabled modes remain in this menu's roving order, but are inert.
    await page.$eval('#anchor', element => (element as HTMLElement).focus());
    await page.keyboard.press('ArrowUp');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('item');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.waitForChanges();
    expect(activation).not.toHaveReceivedEvent();
    expect(closed).not.toHaveReceivedEvent();
    expect(await menu.getProperty('open')).toBe(true);

    await page.$eval('#item', element => {
      const item = element as HTMLElement & { disabled: boolean; softDisabled: boolean };
      item.disabled = false;
      item.softDisabled = false;
    });
    await page.waitForChanges();
    expect(item.getAttribute('aria-disabled')).toBeNull();
    await page.click('#item');
    await page.waitForChanges();
    expect(activation).toHaveReceivedEventTimes(1);
    expect(closed).toHaveReceivedEventTimes(1);
  });
});
