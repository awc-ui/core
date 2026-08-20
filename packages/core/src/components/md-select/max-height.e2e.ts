import { newE2EPage } from '@stencil/core/testing';

describe('md-select max-height', () => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  it('caps the menu height and scrolls long lists inside a scroll viewport', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Month" value="Jun" max-height="200" open>
        ${months.map((m) => `<md-select-option value="${m}">${m}</md-select-option>`).join('')}
      </md-select>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 150));
    await page.waitForChanges();

    const out = await page.evaluate(() => {
      const menu = document.querySelector('md-select')!.shadowRoot!.querySelector('md-menu')!;
      const msr = menu.shadowRoot!;
      const surface = msr.querySelector('.md-menu__surface') as HTMLElement;
      const viewport = msr.querySelector('.md-menu__scroll-shadow') as HTMLElement;
      return {
        hasScrollViewport: !!viewport,
        hasScrollClass: menu.classList.contains('md-menu--scroll'),
        surfaceH: surface.getBoundingClientRect().height,
        viewportClientH: viewport?.clientHeight ?? -1,
        viewportScrollH: viewport?.scrollHeight ?? -1,
      };
    });
    console.log('MAXH', JSON.stringify(out));

    expect(out.hasScrollViewport).toBe(true);
    expect(out.hasScrollClass).toBe(true);
    // Surface capped near 200 (plus the surface's 4px*2 padding).
    expect(out.surfaceH).toBeLessThanOrEqual(212);
    // Content overflows the viewport => it is scrollable.
    expect(out.viewportScrollH).toBeGreaterThan(out.viewportClientH);
  });

  it('still wraps in a scroll viewport when max-height is unset (viewport-bounded)', async () => {
    // Regular menus now scroll inside a bounded viewport when they would overflow the
    // viewport, so a long list never runs off-screen even without an explicit
    // max-height. The viewport is inert (no scrollbar) when the list fits.
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Month" value="Jun" open>
        ${months.map((m) => `<md-select-option value="${m}">${m}</md-select-option>`).join('')}
      </md-select>
    `);
    await page.waitForChanges();
    const hasViewport = await page.evaluate(() =>
      !!document.querySelector('md-select')!.shadowRoot!
        .querySelector('md-menu')!.shadowRoot!.querySelector('.md-menu__scroll-shadow'),
    );
    expect(hasViewport).toBe(true);
  });
});
