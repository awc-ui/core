import { newE2EPage } from '@stencil/core/testing';

type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const NAMES = ['mdOpen', 'mdClose', 'mdCancel', 'mdChange', 'mdSelected', 'mdInput'];

/** Mount a picker and record, at the document, every picker-family event that reaches the page. */
async function mount(html: string): Promise<E2EPage> {
  const page = await newE2EPage();
  await page.setContent(html);
  await page.waitForChanges();
  await page.evaluate((names: string[]) => {
    const w = window as unknown as { log: { name: string; origin: string; detail: unknown }[] };
    w.log = [];
    for (const name of names) {
      document.addEventListener(name, (e) => {
        const origin = (e.composedPath()[0] as Element).localName;
        w.log.push({ name, origin, detail: (e as CustomEvent).detail ?? null });
      });
    }
  }, NAMES);
  await pause(400);
  return page;
}

const log = (page: E2EPage) =>
  page.evaluate(() => (window as unknown as { log: { name: string; origin: string; detail: unknown }[] }).log);

async function focusDay(page: E2EPage, iso: string) {
  await page.evaluate((d) => {
    (document.querySelector('md-date-picker')!.shadowRoot!.querySelector(`[data-date="${d}"]`) as HTMLElement).focus();
  }, iso);
  await pause(100);
}

async function press(page: E2EPage, key: string) {
  await page.keyboard.press(key as any);
  await page.waitForChanges();
  await pause(150);
}

describe('md-date-picker emits each event once', () => {
  it('Escape dismisses the modal with exactly one mdCancel and one mdClose', async () => {
    const page = await mount('<md-date-picker variant="modal" value="2025-06-18" open></md-date-picker>');
    await focusDay(page, '2025-06-18');
    await press(page, 'Escape');
    await pause(400);
    const names = (await log(page)).map((e) => e.name);
    expect(names.filter((n) => n === 'mdCancel')).toHaveLength(1);
    expect(names.filter((n) => n === 'mdClose')).toHaveLength(1);
  });

  it('Enter on a focused day emits one mdSelected, then one mdChange, and nothing after the commit', async () => {
    const page = await mount('<md-date-picker variant="modal" value="2025-06-18" open></md-date-picker>');
    await focusDay(page, '2025-06-18');
    await press(page, 'ArrowDown');
    await press(page, 'Enter');
    await pause(400);
    const names = (await log(page)).map((e) => e.name).filter((n) => n === 'mdSelected' || n === 'mdChange');
    expect(names).toEqual(['mdSelected', 'mdChange']);
  });

  it('Space on a focused day stages it with one mdSelected', async () => {
    const page = await mount('<md-date-picker variant="modal" value="2025-06-18" open></md-date-picker>');
    await focusDay(page, '2025-06-18');
    await press(page, 'ArrowDown');
    await press(page, ' ');
    const selected = (await log(page)).filter((e) => e.name === 'mdSelected');
    expect(selected).toHaveLength(1);
    expect((selected[0].detail as { value: string }).value).toBe('2025-06-25');
  });

  it('typing in the trigger field reaches the page only as the picker\'s own mdInput / mdChange', async () => {
    const page = await mount('<md-date-picker variant="modal-input" value="2025-06-18"></md-date-picker>');
    await page.evaluate(() => {
      const tf = document.querySelector('md-date-picker')!.shadowRoot!.querySelector('md-text-field')!;
      const input = tf.shadowRoot!.querySelector('input')!;
      input.focus();
      input.select();
    });
    await page.keyboard.type('12/25/2025');
    await press(page, 'Enter');
    // Blur: the field's own change on blur must not commit the same value again.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await pause(300);
    const events = (await log(page)).filter((e) => e.name === 'mdInput' || e.name === 'mdChange');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.origin === 'md-date-picker')).toBe(true);
    expect(events.every((e) => typeof e.detail === 'object' && e.detail !== null)).toBe(true);
    const changes = events.filter((e) => e.name === 'mdChange');
    expect(changes).toHaveLength(1);
    expect((changes[0].detail as { value: string }).value).toBe('2025-12-25');
  });
});
