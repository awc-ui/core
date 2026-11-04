import { newE2EPage } from '@stencil/core/testing';

/*
 * The logo wrapper is `hidden` when neither `logo` nor `logo-expanded` is slotted.
 * The horizontal layout must not resurrect it: an empty brand gutter would push the
 * destinations off the bar's start edge.
 */
describe('md-navigation-rail horizontal logo gutter', () => {
  const geometry = () => {
    const rail = document.querySelector('md-navigation-rail')!;
    const sr = rail.shadowRoot!;
    const logo = sr.querySelector('[part="logo"]') as HTMLElement;
    const container = sr.querySelector('[part="container"]') as HTMLElement;
    const destinations = sr.querySelector('[part="destinations"]') as HTMLElement;
    return {
      logoHidden: logo.hasAttribute('hidden'),
      logoDisplay: getComputedStyle(logo).display,
      logoWidth: logo.getBoundingClientRect().width,
      destinationsOffset: destinations.getBoundingClientRect().left - container.getBoundingClientRect().left,
    };
  };

  it.each(['ltr', 'rtl'])('collapses the empty logo wrapper in a horizontal rail (%s)', async (dir) => {
    const page = await newE2EPage();
    await page.setContent(`
      <div dir="${dir}" style="inline-size:560px">
        <md-navigation-rail label="Primary" orientation="horizontal" active-index="0">
          <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
          <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
        </md-navigation-rail>
      </div>`);
    await page.waitForChanges();
    const g = await page.evaluate(geometry);
    expect(g.logoHidden).toBe(true);
    expect(g.logoDisplay).toBe('none');
    expect(g.logoWidth).toBe(0);
  });

  it('keeps a slotted logo visible in a horizontal rail', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary" orientation="horizontal" active-index="0" style="inline-size:560px">
        <svg slot="logo" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24"/></svg>
        <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    const g = await page.evaluate(geometry);
    expect(g.logoHidden).toBe(false);
    expect(g.logoDisplay).toBe('flex');
    expect(g.logoWidth).toBeGreaterThan(24);
  });
});
