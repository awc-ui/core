import { newE2EPage } from '@stencil/core/testing';

/**
 * A wide table must not trap the page's vertical scroll.
 *
 * The scroll viewport is horizontal-only by default (`overflow-y: hidden`),
 * but it carried `overscroll-behavior: contain`, which sets BOTH axes.
 * Containment on an axis the element cannot scroll still blocks scroll
 * CHAINING on that axis, so a vertical wheel anywhere over a wide table
 * stopped the page dead — a reader who scrolled onto a table could not
 * scroll back off it.
 *
 * Vertical containment is wrong in the CAPPED case too, which was the second
 * half of this bug. A capped table is a real vertical scroll port, but it is
 * still inline page content: a reader who scrolls up through it and reaches
 * the first row expects the page to keep going, and containment strands them
 * mid-document. Containment belongs to surfaces that float ABOVE the page —
 * md-menu and md-search's results panel keep it, because scrolling those must
 * not move the page behind them.
 *
 * Horizontal containment stays on the container, which genuinely does scroll
 * horizontally: a sideways flick at the end of a wide table must not trigger
 * back-navigation.
 */
const WIDE_TABLE = `
  <md-table-container id="tc" style="inline-size: 300px;">
    <md-table>
      <md-table-head>
        <md-table-row>
          ${Array.from({ length: 8 }, (_, i) => `<md-table-cell>Column ${i + 1}</md-table-cell>`).join('')}
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${Array.from(
          { length: 12 },
          (_, r) =>
            `<md-table-row>${Array.from(
              { length: 8 },
              (_, c) => `<md-table-cell>r${r}c${c} wide cell</md-table-cell>`,
            ).join('')}</md-table-row>`,
        ).join('')}
      </md-table-body>
    </md-table>
  </md-table-container>`;

describe('md-table-container · does not trap page scroll', () => {
  it('a vertical wheel over a wide table still scrolls the page', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<div style="block-size: 400px;">spacer above</div>
       ${WIDE_TABLE}
       <div style="block-size: 1600px;">spacer below</div>`,
    );
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 300));

    // Park the pointer over the table, then wheel vertically.
    const box = await page.evaluate(() => {
      const r = document.getElementById('tc')!.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.wheel({ deltaY: 300 });
    await new Promise(r => setTimeout(r, 400));

    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);

    // And back up again — the direction the trapped user could not go.
    await page.mouse.wheel({ deltaY: -300 });
    await new Promise(r => setTimeout(r, 400));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }, 60000);

  it('keeps horizontal containment so a sideways flick does not chain', async () => {
    const page = await newE2EPage();
    await page.setContent(WIDE_TABLE);
    await page.waitForChanges();

    const behavior = await page.evaluate(() => {
      const el = document
        .getElementById('tc')!
        .shadowRoot!.querySelector('.md-table-container__scroll') as HTMLElement;
      const cs = getComputedStyle(el);
      return { x: cs.overscrollBehaviorX, y: cs.overscrollBehaviorY };
    });

    expect(behavior.x).toBe('contain');
    expect(behavior.y).toBe('auto');
  }, 60000);

  // A capped table scrolls vertically itself. Reaching its FIRST row must
  // hand the gesture back to the page: containment there strands the reader
  // inside the table with no way to scroll back up short of moving the
  // pointer off it. Containment is for surfaces that float above the page
  // (md-menu, md-search results), not for inline page content.
  it('chains to the page once a capped table is scrolled to its top', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<div style="block-size: 600px;">spacer above</div>
       ${WIDE_TABLE.replace('id="tc"', 'id="tc" max-height="150px"')}
       <div style="block-size: 1600px;">spacer below</div>`,
    );
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 300));

    // Get the page down so there is somewhere to scroll back up to.
    await page.evaluate(() => window.scrollTo(0, 500));
    await new Promise(r => setTimeout(r, 200));
    expect(await page.evaluate(() => window.scrollY)).toBe(500);

    const box = await page.evaluate(() => {
      const r = document.getElementById('tc')!.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.move(box.x, box.y);

    // Drive the inner scroller to its own top first.
    await page.mouse.wheel({ deltaY: -200 });
    await new Promise(r => setTimeout(r, 300));
    const innerTop = await page.evaluate(() => {
      const el = document
        .getElementById('tc')!
        .shadowRoot!.querySelector('.md-table-container__scroll') as HTMLElement;
      return el.scrollTop;
    });
    expect(innerTop).toBe(0);

    // Now keep going: the page must take over instead of stopping dead.
    await page.mouse.wheel({ deltaY: -300 });
    await new Promise(r => setTimeout(r, 400));
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(500);
  }, 60000);

  it('leaves the vertical axis chaining even when max-height makes it a scroll port', async () => {
    const page = await newE2EPage();
    // Via the max-height PROP: that is what adds the --scrollable class and
    // turns the viewport into a real vertical scroll port. Inline CSS alone
    // sizes the box without the component knowing.
    await page.setContent(WIDE_TABLE.replace('id="tc"', 'id="tc" max-height="200px"'));
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 300));

    const behavior = await page.evaluate(() => {
      const el = document
        .getElementById('tc')!
        .shadowRoot!.querySelector('.md-table-container__scroll') as HTMLElement;
      const cs = getComputedStyle(el);
      return { x: cs.overscrollBehaviorX, y: cs.overscrollBehaviorY, overflowY: cs.overflowY };
    });

    expect(behavior.overflowY).toBe('auto');
    // Horizontal containment stays: the container really does scroll
    // horizontally, and a sideways flick at the end must not trigger
    // back-navigation. Vertical must chain — see the wheel test above.
    expect(behavior.x).toBe('contain');
    expect(behavior.y).toBe('auto');
  }, 60000);
});
