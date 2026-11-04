import { newE2EPage } from '@stencil/core/testing';

// Gate 7 (d5): the custom horizontal scroll thumb of a frozen-header table must stay inside its track in right-to-left.
// The thumb is absolutely positioned with no inline offset, so in RTL its static position is the track's RIGHT end;
// translating it by +(1 − p)·travel pushed it past the track (half outside at the start, fully outside at p = 0).
// Intent (updateHScroll comment): it starts at the right end and travels left as the content scrolls toward its end.
const head = `<md-table-head><md-table-row>${['A', 'B', 'C', 'D', 'E', 'F'].map((c) => `<md-table-cell head>${c}</md-table-cell>`).join('')}</md-table-row></md-table-head>`;
const body = `<md-table-body>${Array.from({ length: 6 }, (_, r) => `<md-table-row>${Array.from({ length: 6 }, (_, c) => `<md-table-cell>${r}-${c}</md-table-cell>`).join('')}</md-table-row>`).join('')}</md-table-body>`;
const markup = (dir: string) => `<div dir="${dir}" style="inline-size:600px"><md-table frozen-header min-width="1200px" style="--md-table-body-max-h:200px">${head}${body}</md-table></div>`;

const thumb = (page: import('@stencil/core/testing').E2EPage, scroll: 'start' | 'middle' | 'end') =>
  page.evaluate(async (where) => {
    const t = document.querySelector('md-table')!;
    const sr = t.shadowRoot!;
    const sc = sr.querySelector('.md-table__scroll--body, .md-table__body-scroll, [part="scroll"]') as HTMLElement | null
      ?? (Array.from(sr.querySelectorAll('div')).find((d) => d.scrollWidth > d.clientWidth + 1 && getComputedStyle(d).overflowX !== 'visible') as HTMLElement);
    const overflow = sc.scrollWidth - sc.clientWidth;
    const rtl = getComputedStyle(t).direction === 'rtl';
    const p = where === 'start' ? 0 : where === 'middle' ? 0.5 : 1;
    sc.scrollLeft = (rtl ? -1 : 1) * p * overflow;
    sc.dispatchEvent(new Event('scroll'));
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    const r = (el: Element) => { const q = el.getBoundingClientRect(); return { l: q.left, r: q.right }; };
    return { track: r(sr.querySelector('.md-table__hscroll')!), thumb: r(sr.querySelector('.md-table__hscroll-thumb')!) };
  }, scroll);

describe('md-table RTL horizontal scroll thumb', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`stays inside its track and starts at the inline start (${dir})`, async () => {
      const page = await newE2EPage();
      await page.setContent(markup(dir));
      await page.waitForChanges();
      const start = await thumb(page, 'start'), middle = await thumb(page, 'middle'), end = await thumb(page, 'end');
      for (const g of [start, middle, end]) {
        expect(g.thumb.l).toBeGreaterThanOrEqual(g.track.l - 0.5);
        expect(g.thumb.r).toBeLessThanOrEqual(g.track.r + 0.5);
      }
      // Inline start: the right end in RTL, the left end in LTR; the end of the content: the opposite end.
      if (dir === 'rtl') { expect(Math.abs(start.thumb.r - start.track.r)).toBeLessThanOrEqual(0.5); expect(Math.abs(end.thumb.l - end.track.l)).toBeLessThanOrEqual(0.5); }
      else { expect(Math.abs(start.thumb.l - start.track.l)).toBeLessThanOrEqual(0.5); expect(Math.abs(end.thumb.r - end.track.r)).toBeLessThanOrEqual(0.5); }
      const mid = (g: typeof middle) => (g.thumb.l + g.thumb.r) / 2 - (g.track.l + g.track.r) / 2;
      expect(Math.abs(mid(middle))).toBeLessThanOrEqual(1);
    });
  }
});
