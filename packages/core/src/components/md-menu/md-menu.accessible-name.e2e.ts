import { newE2EPage } from '@stencil/core/testing';

/**
 * The surface (`role="menu"`) is named by its anchor — the readme documents it.
 * It lives in md-menu's shadow root while the anchor is in the light DOM, so the
 * `aria-labelledby` IDREF alone never resolved and the menu had no name at all.
 */
describe('md-menu accessible name', () => {
  const menuName = async (page: any) => {
    const find = (n: any): any => (n.role === 'menu' ? n : (n.children || []).map(find).find(Boolean));
    return find(await page.accessibility.snapshot({ interestingOnly: false }))?.name ?? null;
  };

  it('names the open menu after its anchor, also after a close and reopen', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="a">Actions</button><md-menu anchor="a" quick><md-menu-item headline="One"></md-menu-item></md-menu>');
    const menu = await page.find('md-menu');
    await menu.callMethod('show');
    await page.waitForChanges();
    expect(await menuName(page)).toBe('Actions');
    await menu.callMethod('close');
    await page.waitForChanges();
    await menu.callMethod('show');
    await page.waitForChanges();
    expect(await menuName(page)).toBe('Actions');
  });

  it('a listbox-mode popup is not named by the anchor (its owner supplies the listbox)', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="a">Actions</button><md-menu anchor="a" listbox quick><md-menu-item presentation="option" headline="One"></md-menu-item></md-menu>');
    const menu = await page.find('md-menu');
    await menu.callMethod('show');
    await page.waitForChanges();
    expect(await page.evaluate(() => {
      const s = (document.querySelector('md-menu') as HTMLElement).shadowRoot!.querySelector('.md-menu__surface') as any;
      return [s.getAttribute('role'), (s.ariaLabelledByElements ?? []).length];
    })).toEqual(['presentation', 0]);
  });
});
