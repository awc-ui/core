import { newE2EPage } from '@stencil/core/testing';

describe('md-slider e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-slider></md-slider>');
    const el = await page.find('md-slider');
    expect(el).toBeTruthy();
  });

  /* ── Form association ────────────────────────────────────
     setFormValue is a no-op under the spec-test ElementInternals mock, so the
     whole contract has to be proven in a real browser. */

  it('submits its value under `name`, like a native range input', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f"><md-slider name="volume" value="60"></md-slider></form>
    `);
    await page.waitForChanges();
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('f') as HTMLFormElement).entries()],
    );
    expect(entries).toEqual([['volume', '60']]);
  });

  it('tracks the value as it changes', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f"><md-slider name="volume" value="60"></md-slider></form>
    `);
    await page.waitForChanges();
    const el = await page.find('md-slider');
    el.setProperty('value', 25);
    await page.waitForChanges();
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('f') as HTMLFormElement).entries()],
    );
    expect(entries).toEqual([['volume', '25']]);
  });

  it('submits nothing without a name', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-slider value="60"></md-slider></form>');
    await page.waitForChanges();
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('f') as HTMLFormElement).entries()],
    );
    expect(entries).toEqual([]);
  });

  it('submits both ends of a range — under one name, or two', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-slider range name="price" value-start="20" value-end="80"></md-slider>
        <md-slider range name="d" name-start="from" name-end="to"
                   value-start="5" value-end="9"></md-slider>
      </form>
    `);
    await page.waitForChanges();
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('f') as HTMLFormElement).entries()],
    );
    expect(entries).toEqual([
      ['price', '20'],
      ['price', '80'],
      ['from', '5'],
      ['to', '9'],
    ]);
  });

  it('is skipped by the form while disabled', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f"><md-slider name="volume" value="60" disabled></md-slider></form>
    `);
    await page.waitForChanges();
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('f') as HTMLFormElement).entries()],
    );
    expect(entries).toEqual([]);
  });

  it('returns to its authored value on form reset', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f"><md-slider name="volume" value="60"></md-slider></form>
    `);
    await page.waitForChanges();
    const el = await page.find('md-slider');
    el.setProperty('value', 10);
    await page.waitForChanges();

    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await page.waitForChanges();

    expect(await el.getProperty('value')).toBe(60);
    const entries = await page.evaluate(() =>
      [...new FormData(document.getElementById('f') as HTMLFormElement).entries()],
    );
    expect(entries).toEqual([['volume', '60']]);
  });
});
