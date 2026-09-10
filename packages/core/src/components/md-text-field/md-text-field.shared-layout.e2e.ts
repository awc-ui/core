import { newE2EPage } from '@stencil/core/testing';

describe('md-text-field shared form layout', () => {
  it.each(['ltr', 'rtl'])('centres a label-less value and its icons at every density (%s)', async (direction) => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="${direction}">
      <md-text-field aria-label="Filter resources" placeholder="Filter by name" clearable value="server"
        style="--md-sys-motion-duration-medium1:0ms">
        <span slot="leading-icon">⌕</span>
      </md-text-field>
    </div>`);
    await page.waitForChanges();
    for (const density of [0, -1, -2, -3, -4]) {
      await page.$eval('md-text-field', (field: HTMLMdTextFieldElement, rung: number) => {
        field.density = rung as HTMLMdTextFieldElement['density'];
      }, density);
      await page.waitForChanges();
      for (const focused of [false, true]) {
        await page.$eval('md-text-field', (field: HTMLMdTextFieldElement, value: boolean) => { field.appearFocused = value; }, focused);
        await page.waitForChanges();
        const centres = await page.$eval('md-text-field', (field) => {
          const root = field.shadowRoot!;
          const centre = (selector: string) => {
            const box = root.querySelector(selector)!.getBoundingClientRect();
            return box.top + box.height / 2;
          };
          return [centre('.md-text-field__container'), centre('input'), centre('.md-text-field__icon--leading'), centre('.md-text-field__clear')];
        });
        for (const centre of centres) expect(Math.abs(centre - centres[0])).toBeLessThanOrEqual(1);
      }
    }
    // A dynamically added label must regain the two-row filled layout.
    await page.$eval('md-text-field', (field: HTMLMdTextFieldElement) => { field.label = 'Resources'; });
    await page.waitForChanges();
    const gap = await page.$eval('md-text-field', (field) => {
      const label = field.shadowRoot!.querySelector('label')!.getBoundingClientRect();
      const input = field.shadowRoot!.querySelector('input')!.getBoundingClientRect();
      return input.top - label.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(-1);
  });

  it.each(['#e6e0e9', '#36343b'])('keeps the filled surface visible when focused or a popup owns focus (%s)', async (surface) => {
    const page = await newE2EPage();
    await page.setContent(`<md-text-field label="Machine type" value="Standard"
      style="--md-sys-color-surface-container-highest:${surface};--md-sys-color-surface-container-high:rgb(9, 8, 7);--md-sys-motion-duration-medium1:0ms"></md-text-field>`);
    await page.waitForChanges();
    const fill = () => page.$eval('md-text-field', (field) => getComputedStyle(field.shadowRoot!.querySelector('[part="container"]')!).backgroundColor);
    const resting = await fill();
    await page.$eval('md-text-field', (field: HTMLMdTextFieldElement) => field.setFocus());
    await page.waitForChanges();
    expect(await fill()).toBe(resting);
    await page.$eval('md-text-field', (field: HTMLMdTextFieldElement) => {
      (field.shadowRoot!.querySelector('input') as HTMLInputElement).blur();
      field.appearFocused = true;
    });
    await page.waitForChanges();
    expect(await fill()).toBe(resting);
    await page.$eval('md-text-field', (field: HTMLElement) => field.style.setProperty('--md-text-field-container-color', 'rgb(30, 60, 90)'));
    await page.waitForChanges();
    expect(await fill()).toBe('rgb(30, 60, 90)');
  });
});
