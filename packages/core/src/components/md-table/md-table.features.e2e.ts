/**
 * Real-browser coverage for the features the dev-readiness audit flagged as
 * untested: scrollbar presentations, the keep-height ratchet, keyboard
 * horizontal scrolling (WCAG 2.1.1), RTL scroll clamping, built-in FLIP
 * motion bracketing, pinColumn guards, and sort-label default-order.
 */
import { newE2EPage } from '@stencil/core/testing';

const FROZEN_WIDE = `
  <md-table-container max-height="160px" style="inline-size: 400px;">
    <md-table frozen-header label="t" column-template="150px 150px 150px 150px" min-width="600px">
      <md-table-head>
        <md-table-row>
          <md-table-cell head>A</md-table-cell><md-table-cell head>B</md-table-cell>
          <md-table-cell head>C</md-table-cell><md-table-cell head>D</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${Array.from({ length: 8 })
          .map(
            (_, i) =>
              `<md-table-row><md-table-cell>a${i}</md-table-cell><md-table-cell>b${i}</md-table-cell><md-table-cell>c${i}</md-table-cell><md-table-cell>d${i}</md-table-cell></md-table-row>`,
          )
          .join('')}
      </md-table-body>
    </md-table>
  </md-table-container>
`;

describe('md-table features (audit coverage)', () => {
  it('scrollbar="overlay" reserves no gutter; "gutter" reserves ~10px and hides the overlay', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN_WIDE);
    await page.waitForChanges();
    const probe = () =>
      page.evaluate(() => {
        const t = document.querySelector('md-table')!;
        const sc = t.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
        const track = t.shadowRoot!.querySelector('.md-table__vscroll') as HTMLElement;
        return {
          gutterPx: sc.offsetWidth - sc.clientWidth,
          gutterMode: getComputedStyle(sc).scrollbarGutter,
          overlayDisplay: getComputedStyle(track).display,
        };
      });
    const overlay = await probe();
    expect(overlay.gutterPx).toBe(0);
    expect(overlay.gutterMode).not.toBe('stable'); // no reserved gutter
    expect(overlay.overlayDisplay).not.toBe('none'); // body overflows → thumb shown

    await page.$eval('md-table', (el) => el.setAttribute('scrollbar', 'gutter'));
    await page.waitForChanges();
    const gutter = await probe();
    // NB: the physical px is environment-dependent (overlay-scrollbar
    // platforms reserve 0 even with scrollbar-gutter) — assert the CONTRACT:
    // gutter mode requests the stable gutter and disables the custom overlay.
    expect(gutter.gutterMode).toBe('stable');
    expect(gutter.overlayDisplay).toBe('none');
  });

  it('keep-height ratchet floors the frozen body at its initial height', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN_WIDE);
    await page.waitForChanges();
    // ratchet lands on the SECOND rAF after load
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))),
    );
    const state = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sc = t.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
      const before = sc.getBoundingClientRect().height;
      // hide all rows — an unfloored body would collapse to 0
      document.querySelectorAll('md-table-body md-table-row').forEach((r) => {
        (r as HTMLElement).style.display = 'none';
      });
      return { floor: sc.style.minBlockSize, before };
    });
    expect(parseInt(state.floor, 10)).toBeGreaterThan(100);
    await page.waitForChanges();
    const after = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      return t.shadowRoot!.querySelector('.md-table__body-scroll')!.getBoundingClientRect().height;
    });
    expect(Math.round(after)).toBeGreaterThanOrEqual(Math.round(state.before) - 1);
  });

  it('keyboard: ArrowRight / Cmd+End / Cmd+Home scroll the frozen body horizontally', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN_WIDE);
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sc = t.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
      sc.focus();
      const fire = (key: string, opts: KeyboardEventInit = {}) =>
        sc.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
      fire('ArrowRight');
      const afterArrow = sc.scrollLeft;
      fire('End', { metaKey: true });
      const atEnd = sc.scrollLeft;
      fire('Home', { metaKey: true });
      return { afterArrow, atEnd, home: sc.scrollLeft, max: sc.scrollWidth - sc.clientWidth };
    });
    expect(r.afterArrow).toBeGreaterThan(0);
    expect(r.atEnd).toBe(r.max);
    expect(r.home).toBe(0);
  });

  it('RTL: keyboard scrolling clamps to [-max, 0] and ArrowRight moves visually right', async () => {
    const page = await newE2EPage();
    await page.setContent(`<div dir="rtl">${FROZEN_WIDE}</div>`);
    await page.waitForChanges();
    const r = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sc = t.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
      sc.focus();
      const fire = (key: string, opts: KeyboardEventInit = {}) =>
        sc.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
      fire('End', { metaKey: true }); // logical end in RTL = scrollLeft 0
      const atEnd = sc.scrollLeft;
      fire('Home', { metaKey: true }); // logical home = -max
      const atHome = sc.scrollLeft;
      return { atEnd, atHome, max: sc.scrollWidth - sc.clientWidth };
    });
    expect(r.atEnd).toBe(0);
    expect(r.atHome).toBe(-r.max);
  });

  it('motion: animateNextChange() brackets a row reorder with a FLIP transition', async () => {
    const page = await newE2EPage();
    // Stencil's e2e browser forces prefers-reduced-motion (screenshot
    // stability) which no-ops the FLIP engine — stub the query off.
    await page.evaluateOnNewDocument(() => {
      const orig = window.matchMedia.bind(window);
      (window as { matchMedia: typeof window.matchMedia }).matchMedia = ((q: string) =>
        q.includes('prefers-reduced-motion')
          ? ({ matches: false, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
          : orig(q)) as typeof window.matchMedia;
    });
    await page.setContent(FROZEN_WIDE);
    await page.waitForChanges();
    const hasTransition = await page.evaluate(async () => {
      const t = document.querySelector('md-table') as HTMLMdTableElement;
      const body = document.querySelector('md-table-body')!;
      const first = body.querySelector('md-table-row')!;
      await t.animateNextChange();
      body.appendChild(first); // reorder: every row shifts a slot
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const rows = Array.from(body.querySelectorAll('md-table-row')) as HTMLElement[];
      // NB: a var()-based transition SHORTHAND serializes as empty longhands
      // in Chromium — willChange + the staggered delays are the reliable
      // markers that the FLIP engine armed and played.
      const animating = rows.filter((el) => el.style.willChange === 'transform');
      return {
        count: animating.length,
        delays: animating.map((el) => el.style.transitionDelay),
      };
    });
    expect(hasTransition.count).toBeGreaterThanOrEqual(2); // movers glide
    // Stagger contract WITHOUT the implementation constant: delays are
    // monotonically non-decreasing and at least two distinct values exist.
    const ms = hasTransition.delays.map((d: string) => parseFloat(d) || 0);
    expect(new Set(ms).size).toBeGreaterThanOrEqual(2);
    expect([...ms].sort((a: number, b: number) => a - b)).toEqual(ms);
  });

  it('pinColumn guards refuse repeat() templates and out-of-range columns', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table label="g" columns="3">
        <md-table-body>
          <md-table-row><md-table-cell>a</md-table-cell><md-table-cell>b</md-table-cell><md-table-cell>c</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    await page.waitForChanges();
    const t = await page.find('md-table');
    // columns=3 → repeat() template → pinning must refuse and return 'none'
    expect(await t.callMethod('pinColumn', 0, 'start')).toBeNull(); // guard refusal → null
  });

  it('pinColumn pins + unpins on an explicit template (stamps sticky + reorders)', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN_WIDE.replace('min-width="600px"', ''));
    await page.waitForChanges();
    const t = await page.find('md-table');
    expect(await t.callMethod('pinColumn', 2, 'start')).toBe('start');
    await page.waitForChanges();
    const firstHead = await page.evaluate(
      () => document.querySelector('md-table-head md-table-row md-table-cell')!.textContent,
    );
    expect(firstHead).toBe('C');
    expect(await t.callMethod('pinColumn', 2, 'none')).toBeNull(); // unpinned → null
  });

  it('sort-label default-order="desc" starts the cycle at desc', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table label="s" columns="1">
        <md-table-head>
          <md-table-row>
            <md-table-cell head><md-table-sort-label column="x" default-order="desc">X</md-table-sort-label></md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>1</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    await page.waitForChanges();
    const spy = await page.spyOnEvent('mdSortChange');
    await page.$eval('md-table-sort-label', (el: HTMLElement) => el.click());
    await page.waitForChanges();
    expect(spy.events[0].detail).toEqual({ column: 'x', order: 'desc' });
    await page.$eval('md-table-sort-label', (el: HTMLElement) => el.click());
    await page.waitForChanges();
    expect(spy.events[1].detail).toEqual({ column: 'x', order: 'asc' });
    await page.$eval('md-table-sort-label', (el: HTMLElement) => el.click());
    await page.waitForChanges();
    expect(spy.events[2].detail).toEqual({ column: '', order: 'none' });
  });

  it('data-last re-stamps after row reorders INSIDE the body (divider follows)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container>
        <md-table label="t" columns="1">
          <md-table-body id="b">
            <md-table-row><md-table-cell>one</md-table-cell></md-table-row>
            <md-table-row><md-table-cell>two</md-table-cell></md-table-row>
            <md-table-row><md-table-cell>three</md-table-cell></md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    `);
    await page.waitForChanges();
    const stamps = await page.evaluate(async () => {
      const body = document.getElementById('b')!;
      const initialLast = body.lastElementChild!.hasAttribute('data-last');
      // sort-style reorder: move the LAST row to the TOP (the reported bug —
      // slotchange happens inside md-table-body's shadow, invisible to
      // md-table without the relay, so the moved row kept its stamp and lost
      // its divider between itself and row 2)
      body.insertBefore(body.lastElementChild!, body.firstElementChild);
      await new Promise((r) => setTimeout(r, 100));
      const rows = Array.from(body.querySelectorAll('md-table-row'));
      return {
        initialLast,
        movedRowKeptStamp: rows[0].hasAttribute('data-last'),
        newLastStamped: rows[rows.length - 1].hasAttribute('data-last'),
      };
    });
    expect(stamps.initialLast).toBe(true);
    expect(stamps.movedRowKeptStamp).toBe(false);
    expect(stamps.newLastStamped).toBe(true);
  });


  it('pin-mode: stack overlaps pinned columns on scroll; static keeps them side-by-side', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container max-height="200px" style="inline-size: 360px;">
        <md-table frozen-header label="t" column-template="120px 120px 200px 200px 200px" min-width="840px">
          <md-table-head>
            <md-table-row>
              <md-table-cell head sticky="start">A</md-table-cell>
              <md-table-cell head sticky="start">B</md-table-cell>
              <md-table-cell head>C</md-table-cell><md-table-cell head>D</md-table-cell><md-table-cell head>E</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row>
              <md-table-cell sticky="start">a</md-table-cell>
              <md-table-cell sticky="start">b</md-table-cell>
              <md-table-cell>c</md-table-cell><md-table-cell>d</md-table-cell><md-table-cell>e</md-table-cell>
            </md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    `);
    await page.waitForChanges();
    const measure = () =>
      page.evaluate(async () => {
        const t = document.querySelector('md-table')!;
        const sc = t.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
        sc.scrollLeft = 200; // scroll past both pinned widths
        await new Promise((r) => setTimeout(r, 150));
        const cells = document.querySelectorAll('md-table-body md-table-cell');
        const a = cells[0].getBoundingClientRect();
        const b = cells[1].getBoundingClientRect();
        return { aX: Math.round(a.x), bX: Math.round(b.x), overlap: b.x < a.x + a.width - 2 };
      });

    const stack = await measure();
    expect(stack.overlap).toBe(true); // deck-of-cards: B slid over A

    await page.$eval('md-table', (el) => el.setAttribute('pin-mode', 'static'));
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));
    const stat = await measure();
    expect(stat.overlap).toBe(false); // side-by-side
    expect(stat.bX - stat.aX).toBe(120); // B offset by A's exact track width
  });

});
