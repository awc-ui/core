import { newE2EPage } from '@stencil/core/testing';

/*
 * A horizontal rail lays the FAB out in the bar's row. The vertical rule that
 * stretches the FAB wrapper to the rail's width (`inline-size: 100%`) must not
 * apply there: a full-width wrapper pushes every destination and the footer past
 * the bar's end, where the container clips them.
 */
describe('md-navigation-rail horizontal FAB', () => {
  it.each(['ltr', 'rtl'])('keeps the destinations inside a bar that hosts a FAB (%s)', async (dir) => {
    const page = await newE2EPage();
    await page.setContent(`
      <div dir="${dir}" style="inline-size:720px">
        <md-navigation-rail label="Primary" orientation="horizontal" active-index="0">
          <md-fab slot="fab" icon="edit" aria-label="Compose"></md-fab>
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="mail" label="Mail"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>`);
    await page.waitForChanges();
    const g = await page.evaluate(() => {
      const rail = document.querySelector('md-navigation-rail')!;
      const sr = rail.shadowRoot!;
      const box = (el: Element) => el.getBoundingClientRect();
      const container = box(sr.querySelector('[part="container"]')!);
      const fabWrap = box(sr.querySelector('[part="fab"]')!);
      const fab = box(rail.querySelector('md-fab')!);
      const tabs = Array.from(rail.querySelectorAll('md-navigation-rail-tab')).map((t) => box(t));
      return {
        container: { left: container.left, right: container.right },
        fabWrapWidth: fabWrap.width,
        fabWidth: fab.width,
        tabs: tabs.map((t) => ({ left: t.left, right: t.right })),
      };
    });
    expect(g.fabWrapWidth).toBeLessThan(g.container.right - g.container.left - 3 * 80);
    for (const t of g.tabs) {
      expect(t.left).toBeGreaterThanOrEqual(g.container.left - 0.5);
      expect(t.right).toBeLessThanOrEqual(g.container.right + 0.5);
    }
  });
});
