import { newE2EPage } from '@stencil/core/testing';

describe('md-select customization tokens & parts', () => {
  it('honours select-owned CSS custom properties', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Colour" clearable value="green"
        style="--md-select-width:300px; --md-select-caret-size:30px;
               --md-select-caret-color:rgb(233,69,96);
               --md-select-clear-color:rgb(0,128,0);
               --md-select-option-icon-color:rgb(10,20,30);">
        <md-select-option value="green" icon="circle">Green</md-select-option>
      </md-select>
    `);
    await page.waitForChanges();

    const out = await page.evaluate(() => {
      const sel = document.querySelector('md-select')!;
      const sr = sel.shadowRoot!;
      const caret = sr.querySelector('.md-select__caret') as HTMLElement;
      const clear = sr.querySelector('.md-select__clear') as HTMLElement;
      const optIcon = sr.querySelector('.md-select__option-icon') as HTMLElement;
      const cs = (el: HTMLElement) => getComputedStyle(el);
      return {
        hostWidth: sel.getBoundingClientRect().width,
        caretSize: cs(caret).fontSize,
        caretColor: cs(caret).color,
        clearIconColorVar: clear.style.getPropertyValue('--md-icon-button-icon-color')
          || cs(clear).getPropertyValue('--md-icon-button-icon-color'),
        optIconColor: cs(optIcon).color,
      };
    });
    console.log('TOKENS', JSON.stringify(out));

    expect(out.hostWidth).toBeCloseTo(300, 0);
    expect(out.caretSize).toBe('30px');
    expect(out.caretColor).toBe('rgb(233, 69, 96)');
    // custom properties preserve the author's token stream — compare whitespace-insensitively
    expect(out.clearIconColorVar.replace(/\s/g, '')).toBe('rgb(0,128,0)');
    expect(out.optIconColor).toBe('rgb(10, 20, 30)');
  });

  it('clear color falls back to caret color when unset', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Colour" clearable value="green"
        style="--md-select-caret-color:rgb(1,2,3);">
        <md-select-option value="green">Green</md-select-option>
      </md-select>
    `);
    await page.waitForChanges();
    const color = await page.evaluate(() => {
      const clear = document.querySelector('md-select')!.shadowRoot!
        .querySelector('.md-select__clear') as HTMLElement;
      return getComputedStyle(clear).getPropertyValue('--md-icon-button-icon-color').trim();
    });
    expect(color.replace(/\s/g, '')).toBe('rgb(1,2,3)');
  });

  it('exposes option / option-selected / field-container parts', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Colour" value="green">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green">Green</md-select-option>
      </md-select>
    `);
    await page.waitForChanges();
    const parts = await page.evaluate(() => {
      const sr = document.querySelector('md-select')!.shadowRoot!;
      const items = Array.from(sr.querySelectorAll('md-menu-item'));
      return {
        optionParts: items.map((i) => i.getAttribute('part')),
        hasFieldContainerExport: sr.querySelector('md-text-field')
          ?.getAttribute('exportparts'),
      };
    });
    expect(parts.optionParts).toEqual(['option', 'option option-selected']);
    expect(parts.hasFieldContainerExport).toContain('field-container');
  });
});
