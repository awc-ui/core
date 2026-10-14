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
    await page.keyboard.press(placement === 'up' ? 'ArrowDown' : 'ArrowUp');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('photo');
    await page.keyboard.press(placement === 'up' ? 'ArrowUp' : 'ArrowDown');
    await page.keyboard.press(placement === 'up' ? 'ArrowUp' : 'ArrowDown');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('note');
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

  it('preserves pointer activation focus and dismisses from outside or from its anchor', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    const closed = await menu.spyOnEvent('mdClose');
    await page.click('#actions');
    await page.waitForFunction(() => document.querySelector('md-fab-menu')?.getAttribute('aria-hidden') === 'false');
    // show() installs outside listeners on its next animation frame.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
    await page.click('#outside');
    await page.waitForChanges();
    expect(await menu.getProperty('open')).toBe(false);
    expect(closed).toHaveReceivedEventTimes(1);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');

    // A pointer click on an already-focused anchor moves focus into the menu.
    await page.click('#actions');
    await page.waitForFunction(() => document.activeElement?.id === 'note');
    await page.click('#actions');
    await page.waitForChanges();
    expect(await menu.getProperty('open')).toBe(false);
    expect(closed).toHaveReceivedEventTimes(2);
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

  it('continues from externally focused items and supports Tab, Shift+Tab, and leaving the last action', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    const closed = await menu.spyOnEvent('mdClose');
    await openWithKeyboard(page);

    // Assistive technology/framework focus can enter another item directly.
    await page.$eval('#photo', item => (item as HTMLElement).focus());
    await page.waitForChanges();
    expect(await page.$$eval('md-fab-menu-item', items => items.map(item => item.getAttribute('tabindex')))).toEqual(['-1', '0', '-1']);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('upload');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('photo');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('note');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
    expect(await menu.getProperty('open')).toBe(true);

    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('note');
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await page.waitForChanges();
    expect(await menu.getProperty('open')).toBe(false);
    expect(closed).toHaveReceivedEventTimes(1);
    expect(await page.$$eval('md-fab-menu-item', items => items.map(item => item.getAttribute('tabindex')))).toEqual(['-1', '-1', '-1']);
  });

  it('completes animated close before whenClosed resolves and restores the latest authored FAB icon', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    menu.setProperty('quick', false);
    await page.waitForChanges();
    const opened = await menu.spyOnEvent('mdOpen');
    const closed = await menu.spyOnEvent('mdClose');
    await openWithKeyboard(page);
    await page.waitForFunction(() => document.getElementById('actions')!.shadowRoot!
      .querySelector('[part="icon"]')?.textContent === 'close');
    expect(await (await page.find('#actions')).getProperty('icon')).toBe('add');

    // Repeated show is idempotent; the authored icon may change while the menu
    // temporarily presents its own close glyph.
    await menu.callMethod('show');
    await page.$eval('#actions', element => { (element as HTMLElement & { icon: string }).icon = 'edit'; });
    const transition = await page.evaluate(async () => {
      const menu = document.querySelector('md-fab-menu') as HTMLElement & {
        open: boolean; close(): Promise<void>; whenClosed(): Promise<void>;
      };
      const finished = menu.whenClosed();
      await menu.close();
      await menu.close();
      const openWhileClosing = menu.open;
      await finished;
      return { openWhileClosing, openAfterCompletion: menu.open, hidden: menu.getAttribute('aria-hidden') };
    });
    await page.waitForChanges();
    expect(transition).toEqual({ openWhileClosing: true, openAfterCompletion: false, hidden: 'true' });
    expect(opened).toHaveReceivedEventTimes(1);
    expect(closed).toHaveReceivedEventTimes(1);
    await page.waitForFunction(() => document.getElementById('actions')!.shadowRoot!
      .querySelector('[part="icon"]')?.textContent === 'edit');
    expect(await (await page.find('#actions')).getProperty('icon')).toBe('edit');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
  });

  it('cancels an in-progress close when show is called again without firing a false close event', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    menu.setProperty('quick', false);
    await page.waitForChanges();
    const opened = await menu.spyOnEvent('mdOpen');
    const closed = await menu.spyOnEvent('mdClose');
    await openWithKeyboard(page);
    const resumed = await page.evaluate(async () => {
      const menu = document.querySelector('md-fab-menu') as HTMLElement & {
        open: boolean; show(): Promise<void>; close(): Promise<void>; whenClosed(): Promise<void>;
      };
      let completed = false;
      void menu.whenClosed().then(() => { completed = true; });
      await menu.close();
      await menu.show();
      // Cross the documented 180ms closing deadline: the old timer must not
      // dismiss the resumed menu or complete its still-active lifecycle.
      await new Promise(resolve => setTimeout(resolve, 240));
      return { open: menu.open, closing: menu.classList.contains('md-fab-menu--closing'), completed };
    });
    await page.waitForChanges();
    expect(resumed).toEqual({ open: true, closing: false, completed: false });
    expect(opened).toHaveReceivedEventTimes(1);
    expect(closed).not.toHaveReceivedEvent();
    await page.click('#note');
    await menu.callMethod('whenClosed');
    await page.waitForChanges();
    expect(await menu.getProperty('open')).toBe(false);
    expect(closed).toHaveReceivedEventTimes(1);
  });

  it('settles pending closure and releases the anchor presentation/listeners when removed', async () => {
    const page = await createMenu();
    const menu = await page.find('md-fab-menu');
    const closed = await menu.spyOnEvent('mdClose');
    await openWithKeyboard(page);
    await page.waitForFunction(() => document.getElementById('actions')!.shadowRoot!
      .querySelector('[part="icon"]')?.textContent === 'close');

    await page.evaluate(async () => {
      const menu = document.querySelector('md-fab-menu') as HTMLElement & { whenClosed(): Promise<void> };
      const completion = menu.whenClosed();
      menu.remove();
      await completion;
    });
    await page.waitForFunction(() => document.getElementById('actions')!.shadowRoot!
      .querySelector('[part="icon"]')?.textContent === 'add');
    expect(await page.$eval('#actions', anchor => ({
      shape: anchor.getAttribute('data-shape'),
      morphing: anchor.hasAttribute('data-icon-morphing'),
      color: (anchor as HTMLElement).style.getPropertyValue('--md-fab-container-color'),
    }))).toEqual({ shape: null, morphing: false, color: '' });
    await page.click('#actions');
    await page.waitForChanges();
    // A leaked anchor click listener would close the detached, still-open menu.
    expect(closed).not.toHaveReceivedEvent();
    expect(await page.evaluate(() => document.querySelector('md-fab-menu'))).toBeNull();
  });

  it('opens a custom focusable anchor with Space and closes it with Escape', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="actions" role="button" tabindex="0" style="position:fixed;right:32px;bottom:32px;padding:16px">Create</div>
      <md-fab-menu anchor="actions" quick>
        <md-fab-menu-item id="note" label="Note"></md-fab-menu-item>
        <md-fab-menu-item label="Photo"></md-fab-menu-item>
      </md-fab-menu>`);
    const menu = await page.find('md-fab-menu');
    const opened = await menu.spyOnEvent('mdOpen');
    const closed = await menu.spyOnEvent('mdClose');
    await page.$eval('#actions', element => (element as HTMLElement).focus());
    await page.keyboard.press('Space');
    await page.waitForFunction(() => document.activeElement?.id === 'note');
    await page.waitForChanges();
    expect(opened).toHaveReceivedEventTimes(1);
    expect((await page.find('#actions')).getAttribute('aria-expanded')).toBe('true');
    // Escape on the anchor is a separate route from Escape on a menu item.
    await page.$eval('#actions', element => (element as HTMLElement).focus());
    await page.keyboard.press('Escape');
    await page.waitForChanges();
    expect(closed).toHaveReceivedEventTimes(1);
    expect(await menu.getProperty('open')).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('actions');
  });

  it.each(['top', 'bottom'] as const)('chooses the available side for a %s anchor and aligns the RTL leading edge', async edge => {
    const page = await newE2EPage();
    await page.setContent(`
      <button id="actions" style="position:fixed;left:48px;${edge}:24px;width:96px;height:40px">Create</button>
      <md-fab-menu anchor="actions" placement="auto" dir="rtl" quick>
        <md-fab-menu-item id="note" label="New document"></md-fab-menu-item>
        <md-fab-menu-item label="Upload file"></md-fab-menu-item>
      </md-fab-menu>`);
    await openWithKeyboard(page);
    await page.waitForFunction(() => {
      const container = document.querySelector('md-fab-menu')!.shadowRoot!.querySelector('.md-fab-menu__container') as HTMLElement;
      const anchor = document.getElementById('actions')!;
      return container.style.left !== '' && Math.abs(container.getBoundingClientRect().left - anchor.getBoundingClientRect().left) < 1;
    });
    const placement = await page.evaluate(() => {
      const menu = document.querySelector('md-fab-menu')!;
      const popup = menu.shadowRoot!.querySelector('.md-fab-menu__container')!.getBoundingClientRect();
      const anchor = document.getElementById('actions')!.getBoundingClientRect();
      return { down: menu.classList.contains('md-fab-menu--down'), up: menu.classList.contains('md-fab-menu--up'),
        leftDifference: popup.left - anchor.left, gapBelow: popup.top - anchor.bottom, gapAbove: anchor.top - popup.bottom };
    });
    expect(placement.down).toBe(edge === 'top');
    expect(placement.up).toBe(edge === 'bottom');
    expect(placement.leftDifference).toBeCloseTo(0, 0);
    expect(edge === 'top' ? placement.gapBelow : placement.gapAbove).toBeCloseTo(8, 0);
    // The anchor's direction-aware arrow moves into the nearest action.
    await page.$eval('#actions', element => (element as HTMLElement).focus());
    await page.keyboard.press(edge === 'top' ? 'ArrowDown' : 'ArrowUp');
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('note');
  });
});
