import { newSpecPage } from '@stencil/core/testing';
import { MdNavigationRail } from './md-navigation-rail';
import { MdNavigationRailTab } from '../md-navigation-rail-tab/md-navigation-rail-tab';

describe('md-navigation-rail dynamic slots and overflow', () => {
  it('updates every optional slot and lifts its stacking context only while a descendant menu is open', async () => {
    const page = await newSpecPage({ components: [MdNavigationRail, MdNavigationRailTab], html: '<md-navigation-rail><md-navigation-rail-tab label="Home"></md-navigation-rail-tab><md-menu slot="footer"></md-menu></md-navigation-rail>' });
    const root = page.root!;
    for (const name of ['logo', 'logo-expanded', 'header', 'fab', 'footer-leading', 'footer-content']) {
      const child = page.doc.createElement('span'); child.setAttribute('slot', name); child.textContent = name; root.append(child);
      root.shadowRoot!.querySelector(`slot[name="${name}"]`)!.dispatchEvent(new Event('slotchange'));
    }
    root.shadowRoot!.querySelector('slot[name="footer"]')!.dispatchEvent(new Event('slotchange'));
    root.shadowRoot!.querySelector('slot:not([name])')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(root).toHaveClass('md-navigation-rail--with-logo-expanded');
    expect(root.shadowRoot!.querySelector('[part="header"]')!.hasAttribute('hidden')).toBe(false);
    expect(root.shadowRoot!.querySelector('[part="footer-profile"]')!.hasAttribute('hidden')).toBe(false);
    const menu = root.querySelector('md-menu') as HTMLMdMenuElement;
    menu.open = true; menu.dispatchEvent(new CustomEvent('mdOpen'));
    await page.waitForChanges(); expect(root).toHaveClass('md-navigation-rail--submenu-open');
    menu.open = false; menu.dispatchEvent(new CustomEvent('mdClose'));
    await page.waitForChanges(); expect(root).not.toHaveClass('md-navigation-rail--submenu-open');
    root.querySelector('md-navigation-rail-tab')!.dispatchEvent(new CustomEvent('mdSubmenuToggle', { bubbles: true, detail: { open: true } }));
    await page.waitForChanges(); expect(root).toHaveClass('md-navigation-rail--submenu-open');
    root.querySelector('md-navigation-rail-tab')!.dispatchEvent(new CustomEvent('mdSubmenuToggle', { bubbles: true, detail: { open: false } }));
    await page.waitForChanges(); expect(root).not.toHaveClass('md-navigation-rail--submenu-open');
  });

  it('selects overflowed destinations and responds to runtime maxVisible changes', async () => {
    const page = await newSpecPage({ components: [MdNavigationRail, MdNavigationRailTab], html: '<md-navigation-rail orientation="horizontal" max-visible="1"><md-navigation-rail-tab label="One" value="one"></md-navigation-rail-tab><md-navigation-rail-tab label="Two" value="two"></md-navigation-rail-tab><md-navigation-rail-tab label="Three" value="three"></md-navigation-rail-tab></md-navigation-rail>' });
    const root = page.root as HTMLMdNavigationRailElement;
    const menu = root.shadowRoot!.querySelector('md-menu') as HTMLMdMenuElement;
    menu.show = jest.fn(async () => { menu.open = true; }); menu.close = jest.fn(async () => { menu.open = false; });
    const trigger = root.shadowRoot!.querySelector('[part="overflow-trigger"]') || root.shadowRoot!.querySelector('.md-navigation-rail__overflow-trigger')!;
    trigger.dispatchEvent(new MouseEvent('click')); expect(menu.show).toHaveBeenCalledTimes(1);
    trigger.dispatchEvent(new MouseEvent('click')); expect(menu.close).toHaveBeenCalledTimes(1);
    const changed = jest.fn(); root.addEventListener('mdTabChange', changed);
    menu.querySelector('md-menu-item')!.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges();
    expect(root.activeIndex).toBe(1);
    expect(changed.mock.calls[0][0].detail).toEqual({ index: 1, value: 'two' });
    root.maxVisible = 3; await page.waitForChanges();
    expect(root.querySelectorAll('[data-overflowed]').length).toBe(0);
  });

  it('dismisses a modal expanded rail using its scrim', async () => {
    const page = await newSpecPage({ components: [MdNavigationRail], html: '<md-navigation-rail variant="expanded" modal></md-navigation-rail>' });
    const root = page.root as HTMLMdNavigationRailElement;
    root.shadowRoot!.querySelector('.md-navigation-rail__scrim')!.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges(); expect(root.variant).toBe('standard');
  });
});
