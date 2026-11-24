import { newE2EPage } from '@stencil/core/testing';

describe('md-table-toolbar e2e', () => {
  it('animates entering selection mode without replaying when the count changes', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`
      <md-table-toolbar num-selected="2" style="--md-sys-motion-spring-effects-default-duration: 10s"></md-table-toolbar>
    `);

    const caption = () => page.evaluate(() => {
      const label = document.querySelector('md-table-toolbar')!.shadowRoot!.querySelector('[part="selection-caption"]')!;
      return { text: label.textContent!.trim(), animation: getComputedStyle(label).animationName };
    });
    expect(await caption()).toEqual({ text: '2 selected', animation: 'none' });

    await page.evaluate(async () => {
      for (let frame = 0; frame < 3; frame++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      }
    });
    const toolbar = await page.find('md-table-toolbar');
    await toolbar.setProperty('numSelected', 0);
    await page.waitForChanges();
    await toolbar.setProperty('numSelected', 1);
    await page.waitForChanges();
    expect(await caption()).toEqual({ text: '1 selected', animation: 'md-table-toolbar-fade' });

    await page.evaluate(() => {
      const label = document.querySelector('md-table-toolbar')!.shadowRoot!.querySelector('[part="selection-caption"]')!;
      label.getAnimations().find((animation) => (animation as CSSAnimation).animationName === 'md-table-toolbar-fade')?.finish();
    });
    await page.waitForFunction(() => {
      const label = document.querySelector('md-table-toolbar')!.shadowRoot!.querySelector('[part="selection-caption"]')!;
      return getComputedStyle(label).animationName === 'none';
    });
    await toolbar.setProperty('numSelected', 3);
    await page.waitForChanges();
    expect(await caption()).toEqual({ text: '3 selected', animation: 'none' });
  });

  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-toolbar headline="Users"></md-table-toolbar>');
    const el = await page.find('md-table-toolbar');
    expect(el).toBeTruthy();
    expect(el.getAttribute('role')).toBe('toolbar');
  });

  it('switches to selection mode when num-selected > 0', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-table-toolbar headline="Users" num-selected="2"></md-table-toolbar>');
    const tb = await page.find('md-table-toolbar');
    const cls = await tb.getProperty('className');
    expect(cls).toContain('md-table-toolbar--selection-mode');
  });
});
