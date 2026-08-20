import { newE2EPage, E2EPage } from '@stencil/core/testing';

/** Focus a specific cell input inside the shadow root. */
const focusCell = (page: E2EPage, index = 0) =>
  page.evaluate((i: number) => {
    const inputs = document.querySelector('md-otp-field')!.shadowRoot!.querySelectorAll('input');
    (inputs[i] as HTMLInputElement).focus();
  }, index);

/** Index of the cell that currently holds focus (-1 = none). */
const activeIndex = (page: E2EPage) =>
  page.evaluate(() => {
    const sr = document.querySelector('md-otp-field')!.shadowRoot!;
    return Array.from(sr.querySelectorAll('input')).indexOf(sr.activeElement as HTMLInputElement);
  });

const formValue = (page: E2EPage, name = 'code') =>
  page.evaluate((n: string) => {
    const fd = new FormData(document.getElementById('f') as HTMLFormElement);
    return fd.get(n) as string | null;
  }, name);

describe('md-otp-field (e2e)', () => {
  it('hydrates and renders its cells', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-otp-field></md-otp-field>');
    const el = await page.find('md-otp-field');
    expect(el).toHaveClass('hydrated');
    const cells = await page.findAll('md-otp-field >>> [part="cell"]');
    expect(cells).toHaveLength(6);
  });

  // ─── Form participation (ElementInternals, real browser) ───

  it('submits the typed code under name, auto-advancing across cells', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-otp-field name="code"></md-otp-field></form>');
    expect(await formValue(page)).toBeNull(); // empty → NO entry

    await focusCell(page, 0);
    await page.keyboard.type('123456');
    await page.waitForChanges();

    const el = await page.find('md-otp-field');
    expect(await el.getProperty('value')).toBe('123456');
    expect(await formValue(page)).toBe('123456');
    // last cell keeps focus after completion
    expect(await activeIndex(page)).toBe(5);
  });

  it('required blocks submit until complete; incomplete-label gates a started code', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-otp-field name="code" required incomplete-label="Finish entering the code."></md-otp-field>
      </form>`);
    const check = () =>
      page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());

    expect(await check()).toBe(false); // empty required

    await focusCell(page, 0);
    await page.keyboard.type('123');
    await page.waitForChanges();
    expect(await check()).toBe(false); // started but incomplete
    const validity = await page.evaluate(async () => {
      const el = document.querySelector('md-otp-field') as HTMLElement & {
        getValidity: () => Promise<{ valid: boolean; validationMessage: string }>;
      };
      return el.getValidity();
    });
    expect(validity.valid).toBe(false);
    expect(validity.validationMessage).toBe('Finish entering the code.');

    await page.keyboard.type('456');
    await page.waitForChanges();
    expect(await check()).toBe(true); // complete → valid
  });

  it('auto-submit requests form submission when the code completes', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-otp-field name="code" auto-submit></md-otp-field></form>');
    await page.evaluate(() => {
      (window as unknown as { submitted: number }).submitted = 0;
      document.getElementById('f')!.addEventListener('submit', (e) => {
        e.preventDefault();
        (window as unknown as { submitted: number }).submitted++;
      });
    });
    await focusCell(page, 0);
    await page.keyboard.type('987654');
    await page.waitForChanges();
    expect(await page.evaluate(() => (window as unknown as { submitted: number }).submitted)).toBe(1);
  });

  it('a reset button clears the code', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-otp-field name="code"></md-otp-field>
        <button type="reset" id="r">reset</button>
      </form>`);
    await focusCell(page, 0);
    await page.keyboard.type('12');
    await page.waitForChanges();
    expect(await formValue(page)).toBe('12');

    await (await page.find('#r')).click();
    await page.waitForChanges();
    const el = await page.find('md-otp-field');
    expect(await el.getProperty('value')).toBe('');
    expect(await formValue(page)).toBeNull();
  });

  // ─── Keyboard (real focus movement) ───

  it('Backspace walks back through the cells, clearing as it goes', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-otp-field></md-otp-field>');
    await focusCell(page, 0);
    await page.keyboard.type('123');
    await page.waitForChanges();
    expect(await activeIndex(page)).toBe(3); // advanced past the last typed cell

    await page.keyboard.press('Backspace'); // empty cell → walk back, clear cell 2
    await page.waitForChanges();
    await page.keyboard.press('Backspace'); // clear cell 1
    await page.waitForChanges();

    const el = await page.find('md-otp-field');
    expect(await el.getProperty('value')).toBe('1');
    expect(await activeIndex(page)).toBe(1);
  });

  // ─── Paste (real ClipboardEvent + DataTransfer) ───

  it('paste on any cell replaces the whole value and fires mdComplete', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-otp-field></md-otp-field>');
    const el = await page.find('md-otp-field');
    const complete = await el.spyOnEvent('mdComplete');

    await page.evaluate(() => {
      const input = document
        .querySelector('md-otp-field')!
        .shadowRoot!.querySelectorAll('input')[2] as HTMLInputElement;
      const dt = new DataTransfer();
      dt.setData('text/plain', '987654');
      input.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    });
    await page.waitForChanges();

    expect(await el.getProperty('value')).toBe('987654');
    expect(complete).toHaveReceivedEventDetail({ value: '987654' });
    expect(await activeIndex(page)).toBe(5);
  });

  // ─── Commit on group blur ───

  it('emits mdChange when focus leaves the whole group', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-otp-field></md-otp-field><button id="out">out</button>');
    const el = await page.find('md-otp-field');
    const change = await el.spyOnEvent('mdChange');

    await focusCell(page, 0);
    await page.keyboard.type('12');
    await page.waitForChanges();
    expect(change).not.toHaveReceivedEvent(); // moving between cells is not a commit

    await page.evaluate(() => (document.getElementById('out') as HTMLElement).focus());
    await page.waitForChanges();
    expect(change).toHaveReceivedEventDetail('12');
  });
});
