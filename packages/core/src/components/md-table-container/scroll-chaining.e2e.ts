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
 * Vertical containment is still correct in the capped case, where
 * `max-height` makes the viewport a real vertical scroll port: reaching the
 * last row must not start scrolling the page.
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

  it('re-contains the vertical axis when max-height makes it a scroll port', async () => {
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
    expect(behavior.x).toBe('contain');
    expect(behavior.y).toBe('contain');
  }, 60000);
});
