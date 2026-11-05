import { newSpecPage } from '@stencil/core/testing';
import { MdAppBar } from './md-app-bar';

describe('md-app-bar dynamic content and search interaction', () => {
  it.each(['small', 'medium'])('refreshes authored slots for the %s title', async variant => {
    const page = await newSpecPage({ components: [MdAppBar], html: `<md-app-bar variant="${variant}" leading-icon="menu"><b slot="headline">Inbox</b><span slot="subtitle">Today</span><button slot="leading">Back</button></md-app-bar>` });
    const root = page.root!;
    for (const name of ['headline', 'subtitle', 'leading']) {
      const slot = root.shadowRoot!.querySelector(`slot[name="${name}"]`)!;
      slot.dispatchEvent(new Event('slotchange'));
    }
    await page.waitForChanges();
    expect(root).toHaveClass('md-app-bar--with-subtitle');
    expect(root.shadowRoot!.querySelector('[part="leading-icon"]')).toBeNull();
    root.querySelector('[slot="subtitle"]')!.remove();
    root.querySelector('[slot="leading"]')!.remove();
    for (const name of ['subtitle', 'leading']) root.shadowRoot!.querySelector(`slot[name="${name}"]`)!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges();
    expect(root).not.toHaveClass('md-app-bar--with-subtitle');
    expect(root.shadowRoot!.querySelector('[part="leading-icon"]')).not.toBeNull();
  });

  it('updates search slots and restores a formerly overflowed trailing action', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const page = await newSpecPage({ components: [MdAppBar], html: `<md-app-bar variant="search"><input slot="search"><button slot="search-trailing">Voice</button>${[1, 2, 3, 4].map(i => `<button slot="trailing" id="action-${i}">${i}</button>`).join('')}</md-app-bar>` });
      const root = page.root!;
      for (const name of ['search', 'search-trailing']) root.shadowRoot!.querySelector(`slot[name="${name}"]`)!.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect(root.shadowRoot!.querySelector('[part="search-content"]')).not.toBeNull();
      expect(root).toHaveClass('md-app-bar--with-search-trailing');
      expect((root.querySelector('#action-4') as HTMLElement).hidden).toBe(true);
      root.querySelector('#action-1')!.remove();
      root.shadowRoot!.querySelector('slot[name="trailing"]')!.dispatchEvent(new Event('slotchange'));
      await page.waitForChanges();
      expect((root.querySelector('#action-4') as HTMLElement).hidden).toBe(false);
    } finally { warn.mockRestore(); }
  });

  it('focuses the search surface, clears focus state on blur, and ignores disabled activation', async () => {
    const page = await newSpecPage({ components: [MdAppBar], html: '<md-app-bar variant="search"></md-app-bar>' });
    const root = page.root!;
    const input = root.shadowRoot!.querySelector('input')!;
    const focus = jest.spyOn(input, 'focus').mockImplementation(() => undefined);
    const activate = jest.fn(); root.addEventListener('mdSearchActivate', activate);
    page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    root.shadowRoot!.querySelector('.md-app-bar__search')!.dispatchEvent(new MouseEvent('click'));
    expect(focus).toHaveBeenCalledTimes(1);
    input.dispatchEvent(new FocusEvent('focus'));
    await page.waitForChanges();
    expect(root).toHaveClass('md-app-bar--search-focused');
    input.dispatchEvent(new FocusEvent('blur'));
    page.doc.dispatchEvent(new Event('pointerdown'));
    await page.waitForChanges();
    expect(root).not.toHaveClass('md-app-bar--search-focused');
    (root as HTMLMdAppBarElement).searchDisabled = true;
    await page.waitForChanges();
    root.shadowRoot!.querySelector('.md-app-bar__search')!.dispatchEvent(new MouseEvent('click'));
    input.dispatchEvent(new FocusEvent('focus'));
    expect(focus).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledTimes(1);
  });
});
