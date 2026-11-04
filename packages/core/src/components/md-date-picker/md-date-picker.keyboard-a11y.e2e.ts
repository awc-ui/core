import { newE2EPage } from '@stencil/core/testing';

type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ISO date of the day cell that currently holds focus inside the picker. */
async function focusedDay(page: E2EPage): Promise<string | null> {
  return page.evaluate(() => {
    const root = document.querySelector('md-date-picker')!.shadowRoot!;
    return (root.activeElement as HTMLElement | null)?.getAttribute('data-date') ?? null;
  });
}

async function focusedYear(page: E2EPage): Promise<string | null> {
  return page.evaluate(() => {
    const root = document.querySelector('md-date-picker')!.shadowRoot!;
    return (root.activeElement as HTMLElement | null)?.getAttribute('data-year') ?? null;
  });
}

async function openModal(page: E2EPage, dir: 'ltr' | 'rtl') {
  await page.setContent(
    `<div dir="${dir}"><md-date-picker variant="modal" value="2025-06-18" open></md-date-picker></div>`,
  );
  await page.waitForChanges();
  await pause(400);
}

async function focusDay(page: E2EPage, iso: string) {
  await page.evaluate((d) => {
    const root = document.querySelector('md-date-picker')!.shadowRoot!;
    (root.querySelector(`[data-date="${d}"]`) as HTMLElement).focus();
  }, iso);
  await pause(100);
}

async function press(page: E2EPage, key: string) {
  await page.keyboard.press(key as any);
  await page.waitForChanges();
  await pause(150);
}

describe('md-date-picker day grid arrows follow the visual direction', () => {
  it('LTR: ArrowRight is the next day and ArrowLeft the previous day', async () => {
    const page = await newE2EPage();
    await openModal(page, 'ltr');
    await focusDay(page, '2025-06-18');
    await press(page, 'ArrowRight');
    expect(await focusedDay(page)).toBe('2025-06-19');
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowLeft');
    expect(await focusedDay(page)).toBe('2025-06-17');
  });

  it('RTL: the grid is mirrored, so ArrowRight moves to the previous day and ArrowLeft to the next', async () => {
    const page = await newE2EPage();
    await openModal(page, 'rtl');
    // Tuesday the 17th is painted to the RIGHT of Wednesday the 18th in the mirrored row.
    const geometry = await page.evaluate(() => {
      const root = document.querySelector('md-date-picker')!.shadowRoot!;
      const box = (d: string) => {
        const r = (root.querySelector(`[data-date="${d}"]`) as HTMLElement).getBoundingClientRect();
        return { top: Math.round(r.top), left: r.left };
      };
      return { d17: box('2025-06-17'), d18: box('2025-06-18') };
    });
    expect(geometry.d17.top).toBe(geometry.d18.top);
    expect(geometry.d17.left).toBeGreaterThan(geometry.d18.left);
    await focusDay(page, '2025-06-18');
    await press(page, 'ArrowRight');
    expect(await focusedDay(page)).toBe('2025-06-17');
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowLeft');
    expect(await focusedDay(page)).toBe('2025-06-19');
  });
});

async function openYearGrid(page: E2EPage, dir: 'ltr' | 'rtl') {
  await openModal(page, dir);
  await page.evaluate(() => {
    const root = document.querySelector('md-date-picker')!.shadowRoot!;
    (root.querySelector('[part~="month-toggle"]') as HTMLElement).click();
  });
  await page.waitForChanges();
  await pause(500);
}

describe('md-date-picker modal year grid is a keyboard grid', () => {
  it('exposes a single tab stop (roving tabindex) on the current year', async () => {
    const page = await newE2EPage();
    await openYearGrid(page, 'ltr');
    const stops = await page.evaluate(() => {
      const root = document.querySelector('md-date-picker')!.shadowRoot!;
      const years = Array.from(root.querySelectorAll<HTMLElement>('[data-year]'));
      return {
        total: years.length,
        tabbable: years.filter((y) => y.getAttribute('tabindex') === '0').map((y) => y.getAttribute('data-year')),
      };
    });
    expect(stops.total).toBeGreaterThan(20);
    expect(stops.tabbable).toEqual(['2025']);
  });

  it('LTR: arrows move by one year across and three years down; Enter picks', async () => {
    const page = await newE2EPage();
    await openYearGrid(page, 'ltr');
    expect(await focusedYear(page)).toBe('2025');
    await press(page, 'ArrowRight');
    expect(await focusedYear(page)).toBe('2026');
    await press(page, 'ArrowDown');
    expect(await focusedYear(page)).toBe('2029');
    await press(page, 'ArrowLeft');
    expect(await focusedYear(page)).toBe('2028');
    await press(page, 'ArrowUp');
    expect(await focusedYear(page)).toBe('2025');
    const tabbable = await page.evaluate(() =>
      Array.from(document.querySelector('md-date-picker')!.shadowRoot!.querySelectorAll<HTMLElement>('[data-year]'))
        .filter((y) => y.getAttribute('tabindex') === '0').map((y) => y.getAttribute('data-year')),
    );
    expect(tabbable).toEqual(['2025']);
    await press(page, 'ArrowRight');
    await press(page, 'Enter');
    await pause(500);
    const header = await page.evaluate(() => {
      const root = document.querySelector('md-date-picker')!.shadowRoot!;
      return { years: root.querySelectorAll('[data-year]').length, toggle: (root.querySelector('[part~="month-toggle"]') as HTMLElement).textContent };
    });
    expect(header.years).toBe(0);
    expect(header.toggle).toContain('2026');
    // The picked cell unmounts with the grid; focus lands on the day grid, not <body>.
    expect(await focusedDay(page)).toBe('2026-06-01');
  });

  it('Home / End move within the row, Ctrl+Home / Ctrl+End to the ends of the min/max range', async () => {
    const page = await newE2EPage();
    await page.setContent(
      '<md-date-picker variant="modal" value="2025-06-18" min="2020-01-01" max="2030-12-31" open></md-date-picker>',
    );
    await page.waitForChanges();
    await pause(400);
    await page.evaluate(() => {
      (document.querySelector('md-date-picker')!.shadowRoot!.querySelector('[part~="month-toggle"]') as HTMLElement).click();
    });
    await page.waitForChanges();
    await pause(500);
    // Rows run 2020-2022, 2023-2025, 2026-2028, 2029-2030.
    expect(await focusedYear(page)).toBe('2025');
    await press(page, 'Home');
    expect(await focusedYear(page)).toBe('2023');
    await press(page, 'End');
    expect(await focusedYear(page)).toBe('2025');
    await page.keyboard.down('Control');
    await press(page, 'End');
    await page.keyboard.up('Control');
    expect(await focusedYear(page)).toBe('2030');
    await press(page, 'ArrowDown');
    expect(await focusedYear(page)).toBe('2030');
    await page.keyboard.down('Control');
    await press(page, 'Home');
    await page.keyboard.up('Control');
    expect(await focusedYear(page)).toBe('2020');
    await press(page, 'ArrowUp');
    expect(await focusedYear(page)).toBe('2020');
  });

  it('RTL: ArrowRight moves to the previous year in the mirrored grid', async () => {
    const page = await newE2EPage();
    await openYearGrid(page, 'rtl');
    expect(await focusedYear(page)).toBe('2025');
    await press(page, 'ArrowRight');
    expect(await focusedYear(page)).toBe('2024');
    await press(page, 'ArrowLeft');
    await press(page, 'ArrowLeft');
    expect(await focusedYear(page)).toBe('2026');
  });
});
