import { newE2EPage } from '@stencil/core/testing';

describe('md-menu-item activation scope', () => {
  it('returns focus to an anchor that lives in the same shadow root as the menu', async () => {
    const page = await newE2EPage();
    await page.setContent('<div id="spacer"></div>');
    await page.evaluate(() => {
      class ShadowHost extends HTMLElement {
        constructor() {
          super();
          const root = this.attachShadow({ mode: 'open' });
          root.innerHTML = '<button id="trigger">Actions</button>'
            + '<md-menu anchor="trigger" quick><md-menu-item headline="Rename"></md-menu-item><md-menu-item headline="Delete"></md-menu-item></md-menu>';
        }
      }
      customElements.define('x-shadow-menu-host', ShadowHost);
      document.body.appendChild(document.createElement('x-shadow-menu-host'));
    });
    await page.waitForChanges();
    await page.evaluate(async () => {
      const root = document.querySelector('x-shadow-menu-host')!.shadowRoot!;
      await (root.querySelector('md-menu') as HTMLMdMenuElement).show();
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('x-shadow-menu-host')!.shadowRoot!;
      return (root.activeElement as HTMLElement | null)?.getAttribute('headline') === 'Rename';
    });
    await page.evaluate(() => {
      const root = document.querySelector('x-shadow-menu-host')!.shadowRoot!;
      (root.querySelector('md-menu-item') as HTMLElement).click();
    });
    await page.waitForFunction(() => {
      const root = document.querySelector('x-shadow-menu-host')!.shadowRoot!;
      return !(root.querySelector('md-menu') as HTMLMdMenuElement).open;
    });
    expect(await page.evaluate(() => {
      const root = document.querySelector('x-shadow-menu-host')!.shadowRoot!;
      return root.activeElement?.id ?? document.activeElement?.tagName;
    })).toBe('trigger');
  });

  it('a radio item only deselects radios of its own menu and group, never ones inside a nested submenu', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-menu quick open>
        <md-menu-item id="r1" type="radio" headline="Small" keep-open></md-menu-item>
        <md-menu-item id="r2" type="radio" headline="Large" keep-open selected></md-menu-item>
        <md-sub-menu-item headline="Units" open-delay="0">
          <md-menu slot="submenu" quick>
            <md-menu-item id="s1" type="radio" headline="Metric" keep-open selected></md-menu-item>
            <md-menu-item id="s2" type="radio" headline="Imperial" keep-open></md-menu-item>
          </md-menu>
        </md-sub-menu-item>
        <md-menu-item-group label="Theme">
          <md-menu-item id="g1" type="radio" headline="Light" keep-open selected></md-menu-item>
          <md-menu-item id="g2" type="radio" headline="Dark" keep-open></md-menu-item>
        </md-menu-item-group>
      </md-menu>`);
    await page.evaluate(() => (document.querySelector('#r1') as HTMLElement).click());
    await page.waitForChanges();
    const sel = () => page.evaluate(() => ['r1', 'r2', 's1', 's2', 'g1', 'g2'].map(id => (document.querySelector('#' + id) as HTMLMdMenuItemElement).selected));
    expect(await sel()).toEqual([true, false, true, false, true, false]);
    // A submenu radio still keeps exclusivity inside its own menu.
    await page.evaluate(() => (document.querySelector('#s2') as HTMLElement).click());
    await page.waitForChanges();
    expect(await sel()).toEqual([true, false, false, true, true, false]);
    // A grouped radio keeps exclusivity inside its group only.
    await page.evaluate(() => (document.querySelector('#g2') as HTMLElement).click());
    await page.waitForChanges();
    expect(await sel()).toEqual([true, false, false, true, false, true]);
  });
});
