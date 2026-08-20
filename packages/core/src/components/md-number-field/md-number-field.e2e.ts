import { newE2EPage } from '@stencil/core/testing';

/** Real-browser coverage for md-number-field — the ElementInternals form
 *  participation, real-input typing/stepping, press-and-hold repeats and
 *  wheel scrubbing that the JSDOM spec cannot verify. */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const value = (page: E2EPage) =>
  page.evaluate(
    () => (document.querySelector('md-number-field') as unknown as { value: number | null }).value,
  );

/** Focus the real inner input (two shadow roots deep). */
const focusInput = (page: E2EPage) =>
  page.evaluate(() => {
    const nf = document.querySelector('md-number-field')!;
    const tf = nf.shadowRoot!.querySelector('md-text-field')!;
    (tf.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
  });

const inputText = (page: E2EPage) =>
  page.evaluate(() => {
    const nf = document.querySelector('md-number-field')!;
    const tf = nf.shadowRoot!.querySelector('md-text-field')!;
    return (tf.shadowRoot!.querySelector('input') as HTMLInputElement).value;
  });

describe('md-number-field (e2e)', () => {
  describe('hydration', () => {
    it('renders and hydrates', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-number-field label="Quantity"></md-number-field>');
      const el = await page.find('md-number-field');
      expect(el).toHaveClass('hydrated');
      expect(el).toHaveClass('md-number-field--filled');
    });
  });

  describe('forms', () => {
    it('submits the raw value under `name`; empty submits NO entry', async () => {
      const page = await newE2EPage();
      await page.setContent('<form id="f"><md-number-field name="qty" label="Qty"></md-number-field></form>');
      await page.waitForChanges();
      const read = () =>
        page.evaluate(() => new FormData(document.getElementById('f') as HTMLFormElement).get('qty'));
      expect(await read()).toBeNull(); // null value → no FormData entry
      await page.evaluate(
        () => ((document.querySelector('md-number-field') as unknown as { value: number }).value = 5),
      );
      await page.waitForChanges();
      await wait(80);
      expect(await read()).toBe('5');
    });

    it('required with no value is invalid and blocks submit; filling fixes it', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<form id="f"><md-number-field name="qty" label="Qty" required></md-number-field></form>',
      );
      await page.waitForChanges();
      await wait(80);
      expect(
        await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity()),
      ).toBe(false);
      await page.evaluate(
        () => ((document.querySelector('md-number-field') as unknown as { value: number }).value = 3),
      );
      await page.waitForChanges();
      await wait(80);
      expect(
        await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity()),
      ).toBe(true);
    });

    it('a form reset restores the initial value', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<form id="f"><md-number-field name="qty" value="4"></md-number-field><button type="reset">Reset</button></form>',
      );
      await page.waitForChanges();
      await page.evaluate(
        () => ((document.querySelector('md-number-field') as unknown as { value: number }).value = 9),
      );
      await page.waitForChanges();
      await (await page.find('button[type="reset"]')).click();
      await page.waitForChanges();
      await wait(80);
      expect(await value(page)).toBe(4);
      expect(
        await page.evaluate(() => new FormData(document.getElementById('f') as HTMLFormElement).get('qty')),
      ).toBe('4');
    });
  });

  describe('typing + blur reformat', () => {
    it('typed text parses live; blur reformats with locale grouping', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-number-field label="Qty" locale="en-US"></md-number-field>');
      await focusInput(page);
      await page.keyboard.type('1234.5');
      await page.waitForChanges();
      expect(await value(page)).toBe(1234.5);
      expect(await inputText(page)).toBe('1234.5'); // typed text stays verbatim while editing
      await page.evaluate(() => {
        const nf = document.querySelector('md-number-field')!;
        const tf = nf.shadowRoot!.querySelector('md-text-field')!;
        (tf.shadowRoot!.querySelector('input') as HTMLInputElement).blur();
      });
      await page.waitForChanges();
      await wait(80);
      expect(await inputText(page)).toBe('1,234.5'); // blur reformats
      expect(await value(page)).toBe(1234.5);
    });

    it('the character filter blocks letters in the real input', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-number-field label="Qty" locale="en-US"></md-number-field>');
      await focusInput(page);
      await page.keyboard.type('1a2b3');
      await page.waitForChanges();
      expect(await inputText(page)).toBe('123');
      expect(await value(page)).toBe(123);
    });
  });

  describe('keyboard stepping (real input)', () => {
    it('ArrowUp/ArrowDown step; Shift uses largeStep; commits fire mdChange', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-number-field label="Qty" value="1"></md-number-field>');
      const el = await page.find('md-number-field');
      const changeSpy = await el.spyOnEvent('mdChange');
      await focusInput(page);
      await page.keyboard.press('ArrowUp');
      await page.waitForChanges();
      expect(await value(page)).toBe(2);
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await page.waitForChanges();
      expect(await value(page)).toBe(12);
      await page.keyboard.press('ArrowDown');
      await page.waitForChanges();
      expect(await value(page)).toBe(11);
      expect(changeSpy).toHaveReceivedEventTimes(3);
      expect(changeSpy.lastEvent.detail.reason).toBe('keyboard');
    });
  });

  describe('stepper buttons', () => {
    const stepperCenter = (page: E2EPage, part: 'increment' | 'decrement') =>
      page.evaluate((p: string) => {
        const nf = document.querySelector('md-number-field')!;
        const r = nf
          .shadowRoot!.querySelector(`md-icon-button[part="${p}"]`)!
          .getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, part);

    it('a click steps once; press-and-hold auto-repeats after the 400ms delay', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-number-field label="Qty" value="0"></md-number-field>');
      await page.waitForChanges();
      const { x, y } = await stepperCenter(page, 'increment');
      // Single click = exactly one tick (the pointerdown tick).
      await page.mouse.click(x, y);
      await page.waitForChanges();
      expect(await value(page)).toBe(1);
      // Hold: first tick + 400ms delay + ~60ms repeats.
      await page.mouse.move(x, y);
      await page.mouse.down();
      await wait(700);
      await page.mouse.up();
      await page.waitForChanges();
      const held = (await value(page)) as number;
      expect(held).toBeGreaterThan(3); // 1 (click) + 1 (down) + several repeats
      // Releasing stopped the ticking.
      await wait(200);
      expect(await value(page)).toBe(held);
    });

    it('steppers clamp at max and the increment button disables there', async () => {
      const page = await newE2EPage();
      await page.setContent('<md-number-field label="Qty" value="1" max="2"></md-number-field>');
      await page.waitForChanges();
      const { x, y } = await stepperCenter(page, 'increment');
      await page.mouse.click(x, y);
      await page.waitForChanges();
      await wait(80);
      expect(await value(page)).toBe(2);
      const disabled = await page.evaluate(() =>
        document
          .querySelector('md-number-field')!
          .shadowRoot!.querySelector('md-icon-button[part="increment"]')!
          .hasAttribute('disabled'),
      );
      expect(disabled).toBe(true);
    });
  });

  describe('wheel scrubbing', () => {
    it('wheel steps only while focused and with allow-wheel-scrub', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<md-number-field label="Qty" allow-wheel-scrub value="5"></md-number-field>',
      );
      const dispatchWheel = (deltaY: number) =>
        page.evaluate((d: number) => {
          document
            .querySelector('md-number-field')!
            .dispatchEvent(new WheelEvent('wheel', { deltaY: d, bubbles: true, cancelable: true }));
        }, deltaY);
      // Unfocused → inert.
      await dispatchWheel(100);
      await page.waitForChanges();
      expect(await value(page)).toBe(5);
      await focusInput(page);
      await dispatchWheel(100); // deltaY > 0 decrements
      await page.waitForChanges();
      expect(await value(page)).toBe(4);
      await dispatchWheel(-100);
      await page.waitForChanges();
      expect(await value(page)).toBe(5);
    });
  });

  describe('RTL', () => {
    it('split steppers mirror visually: decrement renders on the RIGHT in RTL', async () => {
      const page = await newE2EPage();
      await page.setContent(
        '<div dir="rtl" style="inline-size: 320px;"><md-number-field steppers="split" label="Qty" value="3"></md-number-field></div>',
      );
      await page.waitForChanges();
      const order = await page.evaluate(() => {
        const nf = document.querySelector('md-number-field')!;
        const dec = nf.shadowRoot!.querySelector('md-icon-button[part="decrement"]')!.getBoundingClientRect();
        const inc = nf.shadowRoot!.querySelector('md-icon-button[part="increment"]')!.getBoundingClientRect();
        const field = nf.shadowRoot!.querySelector('md-text-field')!.getBoundingClientRect();
        return { decLeft: dec.left, incLeft: inc.left, fieldLeft: field.left, fieldRight: field.right };
      });
      expect(order.decLeft).toBeGreaterThan(order.incLeft); // decrement right of increment
      expect(order.decLeft).toBeGreaterThanOrEqual(order.fieldRight - 1); // field sits between
      expect(order.incLeft).toBeLessThanOrEqual(order.fieldLeft); // increment on the left edge
    });
  });
});
