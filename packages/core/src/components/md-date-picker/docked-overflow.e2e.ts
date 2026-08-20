/**
 * Regression: opening a docked selection menu (month/year) in a SHORT viewport
 * used to freeze the browser. positionDockedPanel measured the panel's CLAMPED
 * height to decide whether to clamp, so clamp → "fits" → unclamp → "overflows" →
 * clamp oscillated every render — an infinite render loop that re-rendered the
 * whole year list each cycle and hung the tab ("crashing the browser, not loading
 * the calendar"). resolveDockedPanelBlockSize now measures the UNCONSTRAINED
 * height (clamp lifted), so the decision settles in one pass.
 *
 * Headless forces prefers-reduced-motion, so the bloom snaps and the menu is live
 * immediately. A node-side timeout fails fast (instead of hanging) if it regresses.
 */
import { newE2EPage } from '@stencil/core/testing';

const withTimeout = <T>(label: string, p: Promise<T>, ms = 8000): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: page froze (render loop regressed)`)), ms)),
  ]);

describe('md-date-picker docked selection menu — no render-loop freeze on overflow', () => {
  it('opens the year menu in a short viewport, clamped into view, without looping', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 440, height: 400 }); // short: the ±100yr menu overflows
    await page.setContent(`
      <div style="height: 120px"></div>
      <md-date-picker variant="docked" label="Date" value="2025-08-17" open style="max-inline-size:280px"></md-date-picker>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));

    // Open the year menu via the caret's mdClick, then measure how much the panel
    // keeps mutating — an oscillation never settles (and usually freezes outright).
    const result = await withTimeout(
      'open-year-menu',
      page.evaluate(async () => {
        const host = document.querySelector('md-date-picker') as HTMLElement;
        const sr = host.shadowRoot!;
        const panel = () => sr.querySelector('.md-date-picker__panel') as HTMLElement;
        (sr.querySelector('[part="year-menu-button"]') as HTMLElement | null)?.dispatchEvent(
          new CustomEvent('mdClick', { bubbles: true, composed: true }),
        );
        await new Promise((r) => setTimeout(r, 60)); // let the menu mount

        let mutations = 0;
        const obs = new MutationObserver((recs) => (mutations += recs.length));
        obs.observe(panel(), { attributes: true, attributeFilter: ['style', 'class'] });
        await new Promise((r) => setTimeout(r, 900));
        obs.disconnect();

        const p = panel();
        return {
          yearMenu: !!sr.querySelector('[part="year-menu"]'),
          days: sr.querySelectorAll('.md-date-picker__day').length,
          panelH: p.offsetHeight,
          viewportH: window.innerHeight,
          mutations,
        };
      }),
    );

    expect(result.yearMenu).toBe(true); // the year list actually rendered
    expect(result.days).toBe(0); // it replaced the day grid (calendar view left)
    expect(result.panelH).toBeLessThanOrEqual(result.viewportH); // clamped into the viewport (scrolls, not oscillates)
    expect(result.mutations).toBeLessThan(30); // position settled — no infinite render loop
  });

  it('still positions the plain calendar without looping (guard the non-menu path)', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 440, height: 380 });
    await page.setContent(`
      <div style="height: 160px"></div>
      <md-date-picker variant="docked" label="Date" value="2025-08-17" open style="max-inline-size:280px"></md-date-picker>
    `);
    await page.waitForChanges();

    const result = await withTimeout(
      'calendar-settle',
      page.evaluate(async () => {
        const sr = (document.querySelector('md-date-picker') as HTMLElement).shadowRoot!;
        const panel = sr.querySelector('.md-date-picker__panel') as HTMLElement;
        let mutations = 0;
        const obs = new MutationObserver((recs) => (mutations += recs.length));
        obs.observe(panel, { attributes: true, attributeFilter: ['style', 'class'] });
        await new Promise((r) => setTimeout(r, 900));
        obs.disconnect();
        return { days: sr.querySelectorAll('.md-date-picker__day').length, mutations };
      }),
    );

    expect(result.days).toBe(42); // calendar loaded
    expect(result.mutations).toBeLessThan(30); // settled
  });
});
