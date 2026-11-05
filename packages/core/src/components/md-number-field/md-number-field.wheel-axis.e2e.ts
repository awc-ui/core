import { newE2EPage } from '@stencil/core/testing';

/**
 * Wheel scrubbing must read the scroll axis. A horizontal scroll (trackpad
 * pan, tilt wheel) is not a step request: it has to leave the value alone and
 * let the page scroll. Shift+wheel is the one horizontal case that is a step,
 * because Chromium and WebKit deliver Shift+vertical-wheel as `deltaX`.
 */
type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;

const value = (page: E2EPage) =>
  page.evaluate(
    () => (document.querySelector('md-number-field') as unknown as { value: number | null }).value,
  );

const focusInput = (page: E2EPage) =>
  page.evaluate(() => {
    const nf = document.querySelector('md-number-field')!;
    const tf = nf.shadowRoot!.querySelector('md-text-field')!;
    (tf.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
  });

/** Dispatch a wheel event on the host; returns whether default was prevented. */
const wheel = (page: E2EPage, init: WheelEventInit) =>
  page.evaluate((i: WheelEventInit) => {
    const ev = new WheelEvent('wheel', { ...i, bubbles: true, cancelable: true });
    document.querySelector('md-number-field')!.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, init as unknown as Record<string, unknown>);

const setup = async () => {
  const page = await newE2EPage();
  await page.setContent(
    '<md-number-field label="Qty" allow-wheel-scrub value="50" large-step="10"></md-number-field>',
  );
  await focusInput(page);
  await page.waitForChanges();
  return page;
};

describe('md-number-field wheel axis (e2e)', () => {
  it('ignores a pure horizontal scroll and leaves it to the page', async () => {
    const page = await setup();
    const prevented = await wheel(page, { deltaX: 100, deltaY: 0 });
    await page.waitForChanges();
    expect(await value(page)).toBe(50);
    expect(prevented).toBe(false);
    const prevented2 = await wheel(page, { deltaX: -100, deltaY: 0 });
    await page.waitForChanges();
    expect(await value(page)).toBe(50);
    expect(prevented2).toBe(false);
  });

  it('Shift+wheel delivered as deltaX steps by large-step in the wheel direction', async () => {
    const page = await setup();
    // Shift + wheel down → Chromium reports deltaX > 0. Down decrements.
    expect(await wheel(page, { deltaX: 100, deltaY: 0, shiftKey: true })).toBe(true);
    await page.waitForChanges();
    expect(await value(page)).toBe(40);
    // Shift + wheel up → deltaX < 0 → increments.
    expect(await wheel(page, { deltaX: -100, deltaY: 0, shiftKey: true })).toBe(true);
    await page.waitForChanges();
    expect(await value(page)).toBe(50);
  });

  it('Shift+wheel delivered as deltaY keeps working (large step)', async () => {
    const page = await setup();
    await wheel(page, { deltaY: 100, shiftKey: true });
    await page.waitForChanges();
    expect(await value(page)).toBe(40);
  });

  it('a zero-delta wheel is ignored', async () => {
    const page = await setup();
    const prevented = await wheel(page, { deltaX: 0, deltaY: 0 });
    await page.waitForChanges();
    expect(await value(page)).toBe(50);
    expect(prevented).toBe(false);
  });

  it('a diagonal scroll follows the vertical component', async () => {
    const page = await setup();
    await wheel(page, { deltaX: 40, deltaY: -100 });
    await page.waitForChanges();
    expect(await value(page)).toBe(51);
  });
});
