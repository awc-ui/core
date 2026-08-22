import { newE2EPage } from '@stencil/core/testing';

describe('md-menu e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-menu></md-menu>');
    const el = await page.find('md-menu');
    expect(el).toBeTruthy();
  });

  // The anchor-watch contract: while open, the menu follows its ANCHOR moving
  // — not just scroll/resize. The real-world repro is opening a select inside
  // a bottom sheet that is still sliding in (a transform-animated ancestor
  // moves the anchor without firing scroll or resize); the menu used to keep
  // the anchor's mid-flight position. Simulated here by translating the
  // anchor's wrapper while the menu is open.
  it('follows the anchor when a transformed ancestor moves it while open', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="wrap" style="position: fixed; top: 40px; left: 20px;">
        <button id="trigger" style="width: 120px; height: 40px;">Open</button>
      </div>
      <md-menu anchor="trigger">
        <md-menu-item>Alpha</md-menu-item>
        <md-menu-item>Beta</md-menu-item>
      </md-menu>
    `);
    const menu = await page.find('md-menu');
    await menu.callMethod('show', { autoFocus: false });
    await page.waitForChanges();
    // Let the open-frame positioning and the watch's baseline frame run.
    await new Promise((r) => setTimeout(r, 100));

    const menuX = () =>
      page.evaluate(() => {
        const m = document.querySelector('md-menu') as HTMLElement;
        return Math.round(m.getBoundingClientRect().left);
      });
    const before = await menuX();

    // Move the anchor the way an animating overlay does: an ancestor
    // transform, which fires neither scroll nor resize.
    await page.evaluate(() => {
      document.getElementById('wrap')!.style.transform = 'translateX(180px)';
    });
    // A few frames for the rAF watch to notice and reposition.
    await new Promise((r) => setTimeout(r, 150));
    const after = await menuX();

    expect(after - before).toBe(180);
  });
});
