import { newE2EPage, E2EPage } from '@stencil/core/testing';

async function createMenu(placement: 'up' | 'down' = 'up') {
  const page = await newE2EPage();
  await page.setContent(`
    <button id="outside" style="position:fixed;top:16px;left:16px">Outside</button>
    <md-fab id="actions" icon="add" label="Create"
      style="position:fixed;right:32px;${placement === 'up' ? 'bottom' : 'top'}:32px"></md-fab>
    <md-fab-menu anchor="actions" placement="${placement}" menu-label="Create a document" quick>
      <md-fab-menu-item id="note" icon="edit" label="Note"></md-fab-menu-item>
      <md-fab-menu-item id="photo" icon="photo" label="Photo"></md-fab-menu-item>
      <md-fab-menu-item id="upload">Upload file</md-fab-menu-item>
    </md-fab-menu>`);
  await page.waitForChanges();
  return page;
}

async function openWithKeyboard(page: E2EPage) {
  await page.$eval('#actions', element => (element as HTMLElement).focus());
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'note');
  await page.waitForChanges();
}

describe('md-fab-menu browser behavior', () => {
  it('opens from the keyboard, exposes its accessible relationship, and restores focus on Escape', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    const opened = await menu.spyOnEvent('mdOpen');
    const closed = await menu.spyOnEvent('mdClose');
    await openWithKeyboard(page);

    const anchor = await page.find('#actions');
    expect(opened).toHaveReceivedEventTimes(1);
    expect(menu.getAttribute('role')).toBe('menu');
    expect(menu.getAttribute('aria-label')).toBe('Create a document');
    expect(menu.getAttribute('aria-hidden')).toBe('false');
    expect(anchor.getAttribute('aria-expanded')).toBe('true');
    expect(anchor.getAttribute('aria-haspopup')).toBe('menu');
    expect(anchor.getAttribute('aria-controls')).toBe(menu.getAttribute('id'));
    expect(anchor.getAttribute('data-shape')).toBe('circle');

    await page.keyboard.press('Escape');
    await page.waitForChanges();
    expect(closed).toHaveReceivedEventTimes(1);
    expect(await menu.getProperty('open')).toBe(false);
    expect(menu.getAttribute('aria-hidden')).toBe('true');
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
    expect(anchor.getAttribute('data-shape')).toBeNull();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
    expect(await page.$$eval('md-fab-menu-item', items => items.map(item => item.getAttribute('tabindex')))).toEqual(['-1', '-1', '-1']);
  });

  it.each(['up', 'down'] as const)('roves in the visual direction for placement=%s and supports Home/End', async placement => {
    const page = await createMenu(placement);
    await openWithKeyboard(page);
    await page.keyboard.press(placement === 'up' ? 'ArrowUp' : 'ArrowDown');
    await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('photo');
    expect(await page.$$eval('md-fab-menu-item', items => items.map(item => item.getAttribute('tabindex')))).toEqual(['-1', '0', '-1']);

    await page.keyboard.press('End');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('upload');
    await page.keyboard.press('Home');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('note');
    await page.keyboard.press(placement === 'up' ? 'ArrowDown' : 'ArrowUp');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
  });

  it('uses the current property label for typeahead after a framework changes it', async () => {
    const page = await createMenu();
    await page.$eval('#photo', item => { (item as HTMLElement & { label: string }).label = 'Camera'; });
    await page.waitForChanges();
    await openWithKeyboard(page);
    await page.keyboard.type('ca');
    await page.waitForChanges();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('photo');
    expect((await page.find('#photo >>> [part="label"]')).textContent).toBe('Camera');
    expect(await (await page.find('md-fab-menu')).getProperty('open')).toBe(true);
  });

  it('dismisses an open pointer menu on an outside click and emits one close event', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    const closed = await menu.spyOnEvent('mdClose');
    await page.click('#actions');
    await page.waitForFunction(() => document.querySelector('md-fab-menu')?.getAttribute('aria-hidden') === 'false');
    // show() installs outside listeners on its next animation frame.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.click('#outside');
    await page.waitForChanges();
    expect(await menu.getProperty('open')).toBe(false);
    expect(closed).toHaveReceivedEventTimes(1);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
  });

  it('keeps its open actions aligned when the anchor moves without a window resize', async () => {
    const page = await createMenu();
    await openWithKeyboard(page);
    const right = () => page.evaluate(() => document.querySelector('md-fab-menu')!.shadowRoot!
      .querySelector('.md-fab-menu__container')!.getBoundingClientRect().right);
    await page.waitForFunction(() => {
      const menu = document.querySelector('md-fab-menu')!.shadowRoot!.querySelector('.md-fab-menu__container')!;
      return Math.abs(menu.getBoundingClientRect().right - document.getElementById('actions')!.getBoundingClientRect().right) < 1;
    });
    const before = await right();
    await page.$eval('#actions', anchor => { (anchor as HTMLElement).style.transform = 'translateX(-120px)'; });
    await page.waitForFunction(() => {
      const menu = document.querySelector('md-fab-menu')!.shadowRoot!.querySelector('.md-fab-menu__container')!;
      return Math.abs(menu.getBoundingClientRect().right - document.getElementById('actions')!.getBoundingClientRect().right) < 1;
    });
    expect(before - await right()).toBeCloseTo(120, 0);
  });
});
