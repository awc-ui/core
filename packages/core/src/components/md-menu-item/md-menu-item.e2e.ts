import { newE2EPage } from '@stencil/core/testing';

describe('md-menu-item e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-menu-item headline="Item"></md-menu-item>');
    const el = await page.find('md-menu-item');
    expect(el).toBeTruthy();
  });

  describe('divider', () => {
    /** Two rows in an open menu, the first carrying `divider`. */
    async function measure() {
      const page = await newE2EPage();
      await page.setContent(`
        <md-menu open variant="standard">
          <md-menu-item id="a" headline="Documentation and support" divider></md-menu-item>
          <md-menu-item id="b" headline="Sign out"></md-menu-item>
        </md-menu>
      `);
      await page.waitForChanges();

      return page.evaluate(() => {
        const a = document.querySelector('#a') as HTMLElement;
        const b = document.querySelector('#b') as HTMLElement;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const after = getComputedStyle(a, '::after');
        return {
          dividerRowHeight: ra.height,
          plainRowHeight: rb.height,
          gapBelowLine: rb.top - ra.bottom,
          lineHeight: after.height,
          lineColor: after.backgroundColor,
        };
      });
    }

    it('does not take the line out of its own row height', async () => {
      const m = await measure();
      // `min-block-size` is border-box: vertical padding on a divider row used
      // to shrink its content to 40px against every other row's 48px, lifting
      // the label off the list's rhythm and shortening its hit area.
      expect(m.dividerRowHeight).toBe(m.plainRowHeight);
    });

    it('sits flush between the two rows', async () => {
      const m = await measure();
      // Space belongs to the separate `gap` prop, not to `divider`. A margin
      // here left dead menu background that no row's hover surface could reach.
      expect(m.gapBelowLine).toBe(0);
    });

    it('still paints a 1px outline-variant line', async () => {
      const m = await measure();
      expect(m.lineHeight).toBe('1px');
      expect(m.lineColor).toBe('rgb(202, 196, 208)');
    });
  });
});

describe('md-menu-item coordinated checkbox and radio state', () => {
  it('replaces mixed checkbox ARIA with checked state and enforces one selected radio without closing keep-open items', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-menu quick open><md-menu-item id="mixed" type="checkbox" indeterminate keep-open headline="All" check-position="start"></md-menu-item><md-menu-item id="a" type="radio" selected keep-open headline="A"></md-menu-item><md-menu-item id="b" type="radio" keep-open headline="B"></md-menu-item></md-menu>');
    const mixed = await page.find('#mixed'); await mixed.focus(); await page.keyboard.press('Space'); await page.waitForChanges();
    expect(await mixed.getProperty('indeterminate')).toBe(true); expect(await mixed.getProperty('selected')).toBe(true);
    expect(mixed.getAttribute('aria-checked')).toBe('true');
    const b = await page.find('#b'); await b.focus(); await page.keyboard.press('Enter'); await page.waitForChanges();
    expect(await b.getProperty('selected')).toBe(true); expect(await (await page.find('#a')).getProperty('selected')).toBe(false);
    expect(await (await page.find('md-menu')).getProperty('open')).toBe(true);
  });
});
