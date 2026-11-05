import { newE2EPage } from '@stencil/core/testing';

type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Animation name and every transition duration of one shadow element. */
async function motionOf(page: E2EPage, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector('md-date-picker')!.shadowRoot!.querySelector(sel) as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { animation: cs.animationName, durations: cs.transitionDuration.split(',').map((d) => d.trim()) };
  }, selector);
}

async function reducedPage(html: string) {
  const page = await newE2EPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setContent(html);
  await page.waitForChanges();
  await pause(60);
  return page;
}

describe('md-date-picker honours prefers-reduced-motion', () => {
  it('the modal panel enters without its scale animation', async () => {
    const page = await reducedPage('<md-date-picker variant="modal" value="2025-06-15" open></md-date-picker>');
    expect((await motionOf(page, '[part="panel"]'))!.animation).toBe('none');
  });

  it('the docked panel enters without its bloom animation', async () => {
    const page = await reducedPage('<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>');
    expect((await motionOf(page, '[part="panel"]'))!.animation).toBe('none');
  });

  it('the visible docked nav chevrons and menu caret switch without fading', async () => {
    const page = await reducedPage('<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>');
    const chevron = await motionOf(page, '.md-date-picker__nav-chevron-slot > md-tooltip.md-date-picker__nav-chevron--visible');
    expect(chevron).not.toBeNull();
    expect(chevron!.durations.every((d) => d === '0s')).toBe(true);
    const caret = await motionOf(page, '.md-date-picker__menu-caret-glyph--visible');
    expect(caret).not.toBeNull();
    expect(caret!.durations.every((d) => d === '0s')).toBe(true);
  });

  it('the day grid returns from the modal year grid without the bloom animation', async () => {
    const page = await reducedPage('<md-date-picker variant="modal" value="2025-06-15" open></md-date-picker>');
    await page.evaluate(() => {
      (document.querySelector('md-date-picker')!.shadowRoot!.querySelector('[part~="month-toggle"]') as HTMLElement).click();
    });
    await page.waitForChanges();
    await pause(100);
    await page.evaluate(() => {
      const year = document.querySelector('md-date-picker')!.shadowRoot!.querySelector('[data-year="2027"]') as HTMLElement;
      year.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
    });
    await page.waitForChanges();
    await pause(30);
    const grid = await motionOf(page, '[part="calendar"]');
    expect(grid).not.toBeNull();
    expect(grid!.animation).toBe('none');
  });

  it('the day grid returns from the docked month menu without the bloom animation', async () => {
    const page = await reducedPage('<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>');
    await page.evaluate(() => {
      (document.querySelector('md-date-picker')!.shadowRoot!.querySelector('[part~="month-menu-button"]') as HTMLElement).click();
    });
    await page.waitForChanges();
    await pause(100);
    await page.evaluate(() => {
      const item = document.querySelector('md-date-picker')!.shadowRoot!.querySelectorAll('[part~="month-option"]')[2] as HTMLElement;
      item.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true }));
    });
    await page.waitForChanges();
    // The menu closes asynchronously; sample the day grid as soon as it is back.
    await page.waitForFunction(
      () => !!document.querySelector('md-date-picker')!.shadowRoot!.querySelector('[part="calendar"]'),
      { timeout: 2000 },
    );
    const grid = await motionOf(page, '[part="calendar"]');
    expect(grid).not.toBeNull();
    expect(grid!.animation).toBe('none');
  });

  it('guard: without reduced motion the modal panel does animate', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-date-picker variant="modal" value="2025-06-15" open></md-date-picker>');
    await page.waitForChanges();
    expect((await motionOf(page, '[part="panel"]'))!.animation).not.toBe('none');
  });
});
