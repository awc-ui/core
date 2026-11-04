import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): under prefers-reduced-motion the rows drop their
// background/state-layer transitions, but pinned cells kept a 150ms background
// transition (the pinned column lagged behind its row — the column-first flicker
// the row's timing comment is meant to prevent) and the frozen table's custom
// horizontal thumb kept its 150ms colour transition.
const markup = `<div style="inline-size:480px"><md-table frozen-header min-width="1200px" column-template="160px 1fr 1fr" style="--md-table-body-max-h:160px">
  <md-table-head><md-table-row><md-table-cell head sticky="start">Name</md-table-cell><md-table-cell head>A</md-table-cell><md-table-cell head>B</md-table-cell></md-table-row></md-table-head>
  <md-table-body>${Array.from({ length: 8 }, (_, i) => `<md-table-row><md-table-cell sticky="start">R${i}</md-table-cell><md-table-cell>a</md-table-cell><md-table-cell>b</md-table-cell></md-table-row>`).join('')}</md-table-body>
</md-table></div>`;

const durations = (page: import('@stencil/core/testing').E2EPage) =>
  page.evaluate(() => {
    const row = document.querySelector('md-table-body md-table-row')!;
    const cell = row.querySelector('md-table-cell[sticky]')!;
    const thumb = document.querySelector('md-table')!.shadowRoot!.querySelector('.md-table__hscroll-thumb')!;
    const secs = (v: string) => Math.max(...v.split(',').map((s) => parseFloat(s)));
    return {
      row: secs(getComputedStyle(row).transitionDuration),
      stickyCell: secs(getComputedStyle(cell).transitionDuration),
      hThumb: secs(getComputedStyle(thumb).transitionDuration),
    };
  });

describe('md-table family under prefers-reduced-motion', () => {
  it('drops the pinned-cell and scroll-thumb transitions like the rows', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent(markup);
    await page.waitForChanges();
    const d = await durations(page);
    expect(d.row).toBeLessThanOrEqual(0.0001);
    expect(d.stickyCell).toBeLessThanOrEqual(0.0001);
    expect(d.hThumb).toBeLessThanOrEqual(0.0001);
  });

  it('keeps the matched 150ms timing without the preference (guard)', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(markup);
    await page.waitForChanges();
    const d = await durations(page);
    expect(d.row).toBeCloseTo(0.15, 3);
    expect(d.stickyCell).toBeCloseTo(0.15, 3);
    expect(d.hThumb).toBeCloseTo(0.15, 3);
  });
});
