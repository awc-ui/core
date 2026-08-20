import { newE2EPage } from '@stencil/core/testing';

describe('md-select clearable trailing layout', () => {
  it('keeps clear + caret adjacent and inside the field', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Colour" clearable value="blue" style="width:320px">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green">Green</md-select-option>
        <md-select-option value="blue">Blue</md-select-option>
      </md-select>
    `);
    await page.waitForChanges();

    const rects = await page.evaluate(() => {
      const sel = document.querySelector('md-select')!;
      const sr = sel.shadowRoot!;
      const trailing = sr.querySelector('.md-select__trailing') as HTMLElement;
      const clear = sr.querySelector('.md-select__clear') as HTMLElement;
      const caret = sr.querySelector('.md-select__caret') as HTMLElement;
      const field = sr.querySelector('md-text-field')!.shadowRoot!
        .querySelector('.md-text-field__container') as HTMLElement;
      const r = (el: HTMLElement) => { const b = el.getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width }; };
      return { trailing: r(trailing), clear: r(clear), caret: r(caret), field: r(field) };
    });
    console.log('RECTS', JSON.stringify(rects, null, 2));

    // Cluster must size to content (both icons + gap), not be squashed to 24px.
    expect(rects.trailing.width).toBeGreaterThan(40);
    // Clear sits immediately left of the caret (gap ~2px, allow a little slack).
    const gap = rects.caret.left - rects.clear.right;
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(8);
    // Caret stays inside the field container (not overflowing the right edge).
    expect(rects.caret.right).toBeLessThanOrEqual(rects.field.right + 0.5);
  });

  it('uses md-icon-button for the clear affordance', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Colour" clearable value="blue">
        <md-select-option value="blue">Blue</md-select-option>
      </md-select>
    `);
    await page.waitForChanges();
    const tag = await page.evaluate(
      () => document.querySelector('md-select')!.shadowRoot!
        .querySelector('.md-select__clear')?.tagName.toLowerCase(),
    );
    expect(tag).toBe('md-icon-button');
  });

  it('clicking clear empties the value without opening the menu', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-select label="Colour" clearable value="blue">
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="blue">Blue</md-select-option>
      </md-select>
    `);
    await page.waitForChanges();
    const change = await page.spyOnEvent('mdChange');
    const open = await page.spyOnEvent('mdOpen');

    const clear = await page.find('md-select >>> .md-select__clear');
    await clear.click();
    await page.waitForChanges();

    expect(await (await page.find('md-select')).getProperty('value')).toBe('');
    expect(change).toHaveReceivedEventDetail('');
    expect(open).not.toHaveReceivedEvent();
  });
});
