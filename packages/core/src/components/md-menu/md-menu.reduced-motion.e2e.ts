import { newE2EPage } from '@stencil/core/testing';

/**
 * Under `prefers-reduced-motion: reduce` the menu surface must not scale or fade
 * in and out. Every other overlay in the library drops its open/close motion
 * there (md-menu-item and md-sub-menu-item already do for their own rows); the
 * menu surface itself was the one still animating `scaleY(0.8) → none`.
 */
describe('md-menu reduced motion', () => {
  const surface = (page: any) => page.evaluate(() => {
    const s = (document.querySelector('md-menu') as HTMLElement).shadowRoot!.querySelector('.md-menu__surface') as HTMLElement;
    const cs = getComputedStyle(s);
    return { duration: cs.transitionDuration, transform: cs.transform, opacity: cs.opacity };
  });

  it('opens and closes without surface motion when reduced motion is requested', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<button id="a">Open</button><md-menu anchor="a"><md-menu-item headline="One"></md-menu-item></md-menu>');
    // Closed: no residual scale either, so nothing can animate on the way in.
    let s = await surface(page);
    expect(s.duration.split(',').every((d: string) => parseFloat(d) === 0)).toBe(true);
    expect(s.transform).toBe('none');
    await page.evaluate(() => (document.querySelector('md-menu') as HTMLMdMenuElement).show());
    await page.waitForChanges();
    s = await surface(page);
    expect(s.duration.split(',').every((d: string) => parseFloat(d) === 0)).toBe(true);
    expect(s.opacity).toBe('1');
    await page.evaluate(() => (document.querySelector('md-menu') as HTMLMdMenuElement).close());
    await page.waitForChanges();
    s = await surface(page);
    expect(s.duration.split(',').every((d: string) => parseFloat(d) === 0)).toBe(true);
    expect(s.transform).toBe('none');
  });

  it('keeps the standard motion when reduced motion is not requested', async () => {
    const page = await newE2EPage();
    await page.setContent('<button id="a">Open</button><md-menu anchor="a"><md-menu-item headline="One"></md-menu-item></md-menu>');
    const s = await surface(page);
    expect(s.duration.split(',').map((d: string) => parseFloat(d))).toEqual([0.15, 0.15]);
    expect(s.transform).not.toBe('none');
  });
});
