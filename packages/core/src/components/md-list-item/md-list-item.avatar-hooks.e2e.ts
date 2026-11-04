import { newE2EPage } from '@stencil/core/testing';

// The documented avatar hooks must reach the internal md-avatar for initials avatars too
// (md-avatar's name palette otherwise overrides the forwarded container/label colours).
describe('md-list-item leading avatar hooks', () => {
  const read = (page: any, sel: string) => page.$eval(sel, (el: any) => {
    const av = el.shadowRoot.querySelector('md-avatar'); const ini = av.shadowRoot.querySelector('[part="initials"]');
    return { bg: getComputedStyle(av).backgroundColor, label: getComputedStyle(ini || av).color };
  });
  it('applies --md-list-item-leading-avatar-color / -label-color to name and label avatars', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-list style="width:360px">
      <md-list-item id="named" headline="Ada" leading-avatar-name="Ada Lovelace" style="--md-list-item-leading-avatar-color: rgb(1, 2, 3); --md-list-item-leading-avatar-label-color: rgb(250, 240, 230)"></md-list-item>
      <md-list-item id="label" headline="JD" leading-avatar-label="JD" style="--md-list-item-leading-avatar-color: rgb(4, 5, 6); --md-list-item-leading-avatar-label-color: rgb(7, 8, 9)"></md-list-item>
      <md-list-item id="plain" headline="Plain" leading-avatar-name="Ada Lovelace"></md-list-item></md-list>
      <div id="probe" style="background: var(--md-sys-color-primary-container, #eaddff); color: var(--md-sys-color-on-primary-container, #21005d)"></div>`);
    await page.waitForChanges();
    expect(await read(page, '#named')).toEqual({ bg: 'rgb(1, 2, 3)', label: 'rgb(250, 240, 230)' });
    expect(await read(page, '#label')).toEqual({ bg: 'rgb(4, 5, 6)', label: 'rgb(7, 8, 9)' });
    // Without the hooks the row uses the documented M3 list tones (primary-container /
    // on-primary-container), not md-avatar's name-derived palette.
    const tone = await page.$eval('#probe', (el: any) => ({ bg: getComputedStyle(el).backgroundColor, label: getComputedStyle(el).color }));
    expect(await read(page, '#plain')).toEqual(tone);
  });
});
