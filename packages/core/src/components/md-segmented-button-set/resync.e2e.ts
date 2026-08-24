import { newE2EPage } from '@stencil/core/testing';

/**
 * A set must re-assign its segments' positions when its children change.
 *
 * WHY THIS IS AN E2E TEST AND NOT A SPEC. The set learns about new children from
 * `slotchange`, and Stencil's mock DOM does not fire it — a spec version of this
 * passes the element count and then reports `segmentTotal: 1`, which reads like
 * the fix is broken when it is the environment that cannot see it. The symptom
 * is a rendered one anyway, so it belongs where rendering happens.
 *
 * WHAT GOES WRONG WITHOUT IT, and it is not a subtle stale index. A segment
 * defaults to `segmentIndex: 0` of `segmentTotal: 1`, which makes it BOTH first
 * and last — and first+last is styled as a lone pill, rounded on every edge. So
 * an unsynced set does not look slightly off: the joined bar comes apart into
 * separate pills, which is what a reader actually sees.
 *
 * Positions used to be assigned only in `componentDidLoad`, so this held for any
 * consumer that renders segments dynamically: options driven by state, a
 * framework re-render, or `replaceChildren()`. The showcase dock rebuilds its
 * controls that way and showed it on the first re-render after a navigation.
 */
describe('md-segmented-button-set · re-syncs when its children change', () => {
  /** index/total and the corner shape actually computed for each segment. */
  const readSegments = (page: Awaited<ReturnType<typeof newE2EPage>>) =>
    page.evaluate(() =>
      [...document.querySelectorAll('md-segmented-button')].map((seg) => ({
        index: (seg as unknown as { segmentIndex: number }).segmentIndex,
        total: (seg as unknown as { segmentTotal: number }).segmentTotal,
        first: seg.classList.contains('md-segmented-button--first'),
        last: seg.classList.contains('md-segmented-button--last'),
      })),
    );

  it('assigns positions when the children are there from the start', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set>
        <md-segmented-button value="a" label="A"></md-segmented-button>
        <md-segmented-button value="b" label="B"></md-segmented-button>
        <md-segmented-button value="c" label="C"></md-segmented-button>
      </md-segmented-button-set>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));

    expect(await readSegments(page)).toEqual([
      { index: 0, total: 3, first: true, last: false },
      { index: 1, total: 3, first: false, last: false },
      { index: 2, total: 3, first: false, last: true },
    ]);
  }, 60000);

  it('re-syncs when a segment is appended after load', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set>
        <md-segmented-button value="a" label="A"></md-segmented-button>
      </md-segmented-button-set>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));

    await page.evaluate(() => {
      const el = document.createElement('md-segmented-button');
      el.setAttribute('value', 'b');
      el.setAttribute('label', 'B');
      document.querySelector('md-segmented-button-set')!.appendChild(el);
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300));

    // The one that was alone must stop being a lone pill.
    expect(await readSegments(page)).toEqual([
      { index: 0, total: 2, first: true, last: false },
      { index: 1, total: 2, first: false, last: true },
    ]);
  }, 60000);

  it('re-syncs when every segment is replaced, and the corners follow', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-segmented-button-set>
        <md-segmented-button value="a" label="A"></md-segmented-button>
        <md-segmented-button value="b" label="B"></md-segmented-button>
      </md-segmented-button-set>
    `);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 200));

    await page.evaluate(() => {
      const set = document.querySelector('md-segmented-button-set')!;
      const made = ['x', 'y', 'z'].map((v) => {
        const el = document.createElement('md-segmented-button');
        el.setAttribute('value', v);
        el.setAttribute('label', v.toUpperCase());
        return el;
      });
      set.replaceChildren(...made);
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 400));

    expect(await readSegments(page)).toEqual([
      { index: 0, total: 3, first: true, last: false },
      { index: 1, total: 3, first: false, last: false },
      { index: 2, total: 3, first: false, last: true },
    ]);

    // And the thing a reader would actually notice: three joined segments, not
    // three pills. Only the outer edges are round, and the middle has no radius
    // at all — assert the rendered corners rather than only the bookkeeping.
    const corners = await page.evaluate(() =>
      [...document.querySelectorAll('md-segmented-button')].map(
        (seg) => getComputedStyle(seg).borderRadius,
      ),
    );
    expect(corners[1]).toBe('0px');
    expect(corners[0]).not.toBe(corners[1]);
    expect(corners[2]).not.toBe(corners[1]);
    // A lone pill has one radius on all four corners; these must not.
    expect(corners[0]).toContain(' ');
    expect(corners[2]).toContain(' ');
  }, 60000);
});
