import { newE2EPage } from '@stencil/core/testing';

describe('md-button-group reduced motion', () => {
  // The standard variant's press motion animates the pressed button's and its neighbours' padding (Web Animations).
  async function animationsAfterPress(reduce: boolean) {
    const page = await newE2EPage();
    if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-button-group variant="standard"><md-button toggle>Day</md-button><md-button toggle selected>Week</md-button><md-button toggle>Month</md-button></md-button-group>');
    await page.waitForChanges();
    const r = await page.evaluate(() => { const b = document.querySelector('md-button')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(r.x, r.y); await page.mouse.down();
    const count = (await page.evaluate(() => Array.from(document.querySelectorAll('md-button')).reduce((n, el) => n + el.getAnimations().filter((a) => a.playState === 'running').length, 0))) as number;
    await page.mouse.up();
    return count;
  }
  it('does not run the press motion', async () => {
    expect(await animationsAfterPress(true)).toBe(0);
  });
  it('runs the press motion without reduced motion (guard)', async () => {
    expect(await animationsAfterPress(false)).toBeGreaterThan(0);
  });
});
