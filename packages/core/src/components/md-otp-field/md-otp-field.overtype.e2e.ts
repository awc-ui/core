import { newE2EPage } from '@stencil/core/testing';

/**
 * A keystroke into a filled cell replaces that cell's character — the
 * component's select-on-focus contract. The last cell is the case focus
 * movement cannot cover: after the final digit focus stays put, the caret
 * sits after the character, and a correcting keystroke used to be dropped.
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

const state = (page: E2EPage) =>
  page.evaluate(() => {
    const otp = document.querySelector('md-otp-field') as HTMLElement & { value: string };
    const cells = Array.from(otp.shadowRoot!.querySelectorAll('input'));
    return {
      value: otp.value,
      cells: cells.map((c) => c.value).join(''),
      active: cells.indexOf(otp.shadowRoot!.activeElement as HTMLInputElement),
    };
  });

const setup = async () => {
  const page = await newE2EPage();
  await page.setContent('<md-otp-field label="Code" length="6"></md-otp-field>');
  await page.evaluate(() => {
    const otp = document.querySelector('md-otp-field')!;
    (window as unknown as { log: string[] }).log = [];
    for (const n of ['mdInput', 'mdComplete']) {
      otp.addEventListener(n, (e) =>
        (window as unknown as { log: string[] }).log.push(`${n}:${JSON.stringify((e as CustomEvent).detail)}`),
      );
    }
    (otp.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
  });
  await page.keyboard.type('123456', { delay: 20 });
  await page.waitForChanges();
  return page;
};

const log = (page: E2EPage) => page.evaluate(() => (window as unknown as { log: string[] }).log);

describe('md-otp-field overtype (e2e)', () => {
  it('typing into the filled last cell replaces its character', async () => {
    const page = await setup();
    expect(await state(page)).toEqual({ value: '123456', cells: '123456', active: 5 });
    await page.keyboard.type('7');
    await page.waitForChanges();
    expect(await state(page)).toEqual({ value: '123457', cells: '123457', active: 5 });
    expect((await log(page)).slice(-1)).toEqual(['mdInput:"123457"']);
  });

  it('a second correction in the last cell also lands', async () => {
    const page = await setup();
    await page.keyboard.type('7');
    await page.keyboard.type('8');
    await page.waitForChanges();
    expect((await state(page)).value).toBe('123458');
  });

  it('replacing in a middle cell after arrowing to it still replaces and advances', async () => {
    const page = await setup();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('9');
    await page.waitForChanges();
    expect(await state(page)).toEqual({ value: '129456', cells: '129456', active: 3 });
  });

  it('a filtered keystroke into the filled last cell keeps the character', async () => {
    const page = await setup();
    await page.keyboard.type('x');
    await page.waitForChanges();
    expect(await state(page)).toEqual({ value: '123456', cells: '123456', active: 5 });
  });
});
