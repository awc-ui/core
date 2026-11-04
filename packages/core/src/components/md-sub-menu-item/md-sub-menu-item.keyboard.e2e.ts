import { newE2EPage } from '@stencil/core/testing';

/**
 * Keyboard routing between a submenu row and the menu it opens.
 *
 * The nested `md-menu` is a light-DOM child of its row (`slot="submenu"`), so a
 * key pressed on any item INSIDE the flyout bubbles through the row's own
 * keydown handler on its way up. These tests pin what that row may and may not
 * do with keys that did not originate on it.
 */
const MENU = (dir = 'ltr') => `
  <div dir="${dir}">
    <button id="anchor">Actions</button>
    <md-menu anchor="anchor" quick open>
      <md-menu-item headline="Open"></md-menu-item>
      <md-sub-menu-item id="row" headline="Share" open-delay="0" close-delay="0">
        <md-menu slot="submenu" quick>
          <md-menu-item headline="Email"></md-menu-item>
          <md-menu-item headline="Link"></md-menu-item>
          <md-menu-item headline="Copy" type="checkbox" keep-open></md-menu-item>
        </md-menu>
      </md-sub-menu-item>
      <md-menu-item headline="Delete"></md-menu-item>
    </md-menu>
  </div>`;

const active = (page: any) => page.evaluate(() => document.activeElement?.getAttribute('headline') ?? document.activeElement?.tagName ?? null);
const nestedOpen = (page: any) => page.evaluate(() => (document.querySelector('#row md-menu') as HTMLMdMenuElement).open);

async function openSubmenu(page: any, openKey = 'ArrowRight') {
  await page.focus('#row');
  await page.keyboard.press(openKey);
  await page.waitForFunction(() => (document.querySelector('#row md-menu') as HTMLMdMenuElement).open);
  await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Email');
}

describe('md-sub-menu-item keyboard routing', () => {
  it('ArrowRight on an item inside the open submenu does not move focus back to its first item', async () => {
    const page = await newE2EPage();
    await page.setContent(MENU());
    await openSubmenu(page);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Link');
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 120));
    expect(await active(page)).toBe('Link');
    expect(await nestedOpen(page)).toBe(true);
  });

  it('Space on a checkbox item inside the submenu toggles it without re-opening the submenu or rippling the row', async () => {
    const page = await newE2EPage();
    await page.setContent(MENU());
    await openSubmenu(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.getAttribute('headline') === 'Copy');
    await page.evaluate(() => {
      // The child's own mdClick bubbles through the row (its light-DOM ancestor);
      // count only events the ROW itself emits.
      (window as any).__rowClicks = 0;
      const row = document.querySelector('#row')!;
      row.addEventListener('mdClick', (e) => { if (e.target === row) (window as any).__rowClicks++; });
      (window as any).__rowRipples = 0;
      const ripple = (document.querySelector('#row') as HTMLElement).shadowRoot!.querySelector('md-ripple') as any;
      ripple.trigger = async () => { (window as any).__rowRipples++; };
    });
    await page.keyboard.press(' ');
    await new Promise(r => setTimeout(r, 120));
    expect(await page.evaluate(() => (document.querySelector('[headline="Copy"]') as HTMLMdMenuItemElement).selected)).toBe(true);
    expect(await active(page)).toBe('Copy');
    // The row's own ripple must not have been triggered by a key that belongs to the child.
    expect(await page.evaluate(() => (window as any).__rowRipples)).toBe(0);
    expect(await page.evaluate(() => (window as any).__rowClicks)).toBe(0);
  });

  it('Escape inside the submenu closes only the submenu and returns focus to its row', async () => {
    const page = await newE2EPage();
    await page.setContent(MENU());
    await openSubmenu(page);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    expect(await nestedOpen(page)).toBe(false);
    expect(await page.evaluate(() => (document.querySelector('md-menu[anchor]') as HTMLMdMenuElement).open)).toBe(true);
    expect(await active(page)).toBe('Share');
    expect(await page.evaluate(() => document.querySelector('#row')!.getAttribute('aria-expanded'))).toBe('false');
  });

  it('mirrors the open and close keys in a right-to-left menu (the flyout opens to the left)', async () => {
    const page = await newE2EPage();
    await page.setContent(MENU('rtl'));
    await page.focus('#row');
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 120));
    expect(await nestedOpen(page)).toBe(false);
    await openSubmenu(page, 'ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 300));
    expect(await nestedOpen(page)).toBe(false);
    expect(await active(page)).toBe('Share');
  });

  it('left-to-right keys are unchanged: ArrowLeft does not open, ArrowRight opens, ArrowLeft closes', async () => {
    const page = await newE2EPage();
    await page.setContent(MENU());
    await page.focus('#row');
    await page.keyboard.press('ArrowLeft');
    await new Promise(r => setTimeout(r, 120));
    expect(await nestedOpen(page)).toBe(false);
    await openSubmenu(page, 'ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await new Promise(r => setTimeout(r, 300));
    expect(await nestedOpen(page)).toBe(false);
    expect(await active(page)).toBe('Share');
  });
});
