import { newE2EPage } from '@stencil/core/testing';

const tabNames = async (page: any): Promise<string[]> => {
  const out: string[] = [];
  const walk = (n: any) => { if (!n) return; if (n.role === 'tab') out.push(n.name); (n.children || []).forEach(walk); };
  walk(await page.accessibility.snapshot());
  return out;
};

/*
 * WCAG 4.1.2: with label-behavior="selected" the inactive destinations hide their label
 * visually, but they must keep it as their accessible name (the icon glyph is aria-hidden).
 */
describe('md-navigation-tab accessible name', () => {
  it('inactive destinations keep their name when labels show only on the selected one', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-navigation-bar label-behavior="selected"><md-navigation-tab label="Home" icon="home"></md-navigation-tab><md-navigation-tab label="Mail" icon="mail"></md-navigation-tab><md-navigation-tab icon="person" label-behavior="selected"><span>Profile</span></md-navigation-tab></md-navigation-bar>`);
    await page.waitForChanges();
    expect(await tabNames(page)).toEqual(['Home', 'Mail', 'Profile']);
  });

  it('keeps the visual hiding of inactive labels', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-navigation-bar label-behavior="selected"><md-navigation-tab label="Home" icon="home"></md-navigation-tab><md-navigation-tab label="Mail" icon="mail"></md-navigation-tab></md-navigation-bar>`);
    await page.waitForChanges();
    const opacity = await page.evaluate(() => Array.from(document.querySelectorAll('md-navigation-tab')).map(t => getComputedStyle(t.shadowRoot!.querySelector('[part="label"]')!).opacity));
    expect(opacity).toEqual(['1', '0']);
  });
});
