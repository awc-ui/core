import { newE2EPage } from '@stencil/core/testing';

/**
 * Cross-component form participation. These controls are form-associated
 * custom elements (ElementInternals.setFormValue) and md-button drives
 * submit/reset via the associated form. This behaviour can ONLY be verified
 * in a real browser — the spec-test mock for ElementInternals is a no-op,
 * so newSpecPage cannot catch a regression here.
 */
async function captureSubmit(page: any) {
  await page.evaluate(() => {
    const form = document.querySelector('form') as HTMLFormElement;
    (window as any).__fd = null;
    form.addEventListener(
      'submit',
      (e) => {
        e.preventDefault();
        (window as any).__fd = Array.from(new FormData(form).entries());
      },
      { once: true },
    );
  });
}

describe('form participation', () => {
  it('md-select submits its value when md-button type=submit is clicked', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form>
        <md-select name="colour" label="Colour" value="green">
          <md-select-option value="red">Red</md-select-option>
          <md-select-option value="green">Green</md-select-option>
          <md-select-option value="blue">Blue</md-select-option>
        </md-select>
        <md-button type="submit">Submit</md-button>
      </form>
    `);
    await captureSubmit(page);
    await (await page.find('md-button')).click();
    await page.waitForChanges();
    expect(await page.evaluate(() => (window as any).__fd)).toEqual([['colour', 'green']]);
  });

  it('md-multi-select submits each selected value as a repeated pair', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form>
        <md-multi-select name="tags" label="Tags">
          <md-select-option value="a" selected>A</md-select-option>
          <md-select-option value="b" selected>B</md-select-option>
          <md-select-option value="c">C</md-select-option>
        </md-multi-select>
        <md-button type="submit">Submit</md-button>
      </form>
    `);
    await captureSubmit(page);
    await (await page.find('md-button')).click();
    await page.waitForChanges();
    expect(await page.evaluate(() => (window as any).__fd)).toEqual([
      ['tags', 'a'],
      ['tags', 'b'],
    ]);
  });

  it('md-rating submits its numeric value', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form>
        <md-rating name="score" value="4"></md-rating>
        <md-button type="submit">Submit</md-button>
      </form>
    `);
    await captureSubmit(page);
    await (await page.find('md-button')).click();
    await page.waitForChanges();
    expect(await page.evaluate(() => (window as any).__fd)).toEqual([['score', '4']]);
  });

  it('md-autocomplete submits its value', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form>
        <md-autocomplete name="fruit" label="Fruit" value="apple"></md-autocomplete>
        <md-button type="submit">Submit</md-button>
      </form>
    `);
    await captureSubmit(page);
    await (await page.find('md-button')).click();
    await page.waitForChanges();
    expect(await page.evaluate(() => (window as any).__fd)).toEqual([['fruit', 'apple']]);
  });

  it('md-button type=reset restores controls to their initial value', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form>
        <md-select name="colour" value="green">
          <md-select-option value="red">Red</md-select-option>
          <md-select-option value="green">Green</md-select-option>
          <md-select-option value="blue">Blue</md-select-option>
        </md-select>
        <md-button type="reset">Reset</md-button>
      </form>
    `);
    // Mutate away from the initial value, then reset.
    const sel = await page.find('md-select');
    sel.setProperty('value', 'blue');
    await page.waitForChanges();
    expect(await sel.getProperty('value')).toBe('blue');

    await (await page.find('md-button')).click();
    await page.waitForChanges();
    expect(await sel.getProperty('value')).toBe('green');
  });
});
