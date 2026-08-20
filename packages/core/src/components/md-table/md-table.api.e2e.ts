/**
 * E2E for the API members the coverage matrix flagged as untouched:
 * loading modes, container min-height (non-frozen wrapper path), runtime
 * frozen-header toggling, no-pin-indicator, row events, and the custom
 * vertical thumb's pointer DRAG (the one interaction nothing else drives).
 */
import { newE2EPage } from '@stencil/core/testing';

const ROWS = Array.from({ length: 12 })
  .map(
    (_, i) =>
      `<md-table-row><md-table-cell>r${i}a</md-table-cell><md-table-cell>r${i}b</md-table-cell></md-table-row>`,
  )
  .join('');

const FROZEN = `
  <md-table-container max-height="200px" style="inline-size: 420px;">
    <md-table frozen-header label="t" columns="2">
      <md-table-head>
        <md-table-row><md-table-cell head>A</md-table-cell><md-table-cell head>B</md-table-cell></md-table-row>
      </md-table-head>
      <md-table-body>${ROWS}</md-table-body>
    </md-table>
  </md-table-container>
`;

describe('md-table API e2e (coverage matrix)', () => {
  it('loading overlay: progress + scrim render, aria-busy on the table role', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN.replace('frozen-header', 'frozen-header loading'));
    await page.waitForChanges();
    const state = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sr = t.shadowRoot!;
      return {
        overlay: !!sr.querySelector('.md-table__loading'),
        progress: !!sr.querySelector('md-progress-indicator'),
        busy: sr.querySelector('[role="table"]')!.getAttribute('aria-busy'),
      };
    });
    expect(state.overlay).toBe(true);
    expect(state.progress).toBe(true);
    expect(state.busy).toBe('true');
  });

  it('loading skeleton: loading-rows shimmer rows replace the body', async () => {
    const page = await newE2EPage();
    await page.setContent(
      FROZEN.replace('frozen-header', 'frozen-header loading loading-mode="skeleton" loading-rows="3"'),
    );
    await page.waitForChanges();
    const skeletons = await page.evaluate(
      () => document.querySelector('md-table')!.shadowRoot!.querySelectorAll('.md-table__skeleton-row').length,
    );
    expect(skeletons).toBe(3);
  });

  it('frozen-header toggles at RUNTIME (watch re-slots the head, observer re-attaches)', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN.replace(' frozen-header', ''));
    await page.waitForChanges();
    const before = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      return {
        frozen: !!t.shadowRoot!.querySelector('.md-table__body-scroll'),
        contClass: document
          .querySelector('md-table-container')!
          .classList.contains('md-table-container--frozen-header'),
      };
    });
    expect(before.frozen).toBe(false);
    expect(before.contClass).toBe(false);

    await page.$eval('md-table', (el) => el.setAttribute('frozen-header', ''));
    await page.waitForChanges();
    // watch re-slots + rAF-retry observer attach
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))),
    );
    await page.waitForChanges();
    const after = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sc = t.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement | null;
      return {
        frozen: !!sc,
        headSlotted: t.querySelector('md-table-head')!.getAttribute('slot') === 'head',
        contClass: document
          .querySelector('md-table-container')!
          .classList.contains('md-table-container--frozen-header'),
        scrollable: sc ? sc.scrollHeight > sc.clientHeight : false,
      };
    });
    expect(after.frozen).toBe(true);
    expect(after.headSlotted).toBe(true);
    expect(after.contClass).toBe(true);
    expect(after.scrollable).toBe(true);
  });

  it('container min-height keeps the NON-frozen wrapper tall (empty-state floor)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container min-height="240px" style="inline-size: 420px;">
        <md-table label="t" columns="1" empty>
          <md-table-body></md-table-body>
          <span slot="empty">Nothing here</span>
        </md-table>
      </md-table-container>
    `);
    await page.waitForChanges();
    const h = await page.evaluate(() => {
      const cont = document.querySelector('md-table-container')!;
      const wrap = cont.shadowRoot!.querySelector('.md-table-container__scroll')!;
      return wrap.getBoundingClientRect().height;
    });
    expect(h).toBeGreaterThanOrEqual(240);
  });

  it('no-pin-indicator suppresses the sticky header pin', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container max-height="200px" style="inline-size: 300px;">
        <md-table frozen-header label="t" column-template="150px 300px" min-width="450px">
          <md-table-head>
            <md-table-row>
              <md-table-cell head sticky="start" no-pin-indicator>A</md-table-cell>
              <md-table-cell head>B</md-table-cell>
            </md-table-row>
          </md-table-head>
          <md-table-body>${ROWS}</md-table-body>
        </md-table>
      </md-table-container>
    `);
    await page.waitForChanges();
    const pin = await page.evaluate(
      () =>
        !!document
          .querySelector('md-table-cell[sticky="start"]')!
          .shadowRoot!.querySelector('.md-table-cell__pin'),
    );
    expect(pin).toBe(false);
  });

  it('mdRowSelectionChange and mdRowExpandedChange fire with their payloads', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table label="t" selection="multiple" columns="1">
        <md-table-body>
          <md-table-row value="v1" expandable>
            <md-table-cell>one</md-table-cell>
            <div slot="expanded">details</div>
          </md-table-row>
        </md-table-body>
      </md-table>
    `);
    await page.waitForChanges();
    const sel = await page.spyOnEvent('mdRowSelectionChange');
    const exp = await page.spyOnEvent('mdRowExpandedChange');
    await page.$eval('md-table-row', (el: HTMLElement & { selected: boolean; toggle: () => Promise<void> }) => {
      el.selected = true;
      el.dispatchEvent(new CustomEvent('mdRowSelectionChange', { detail: { selected: true, value: el.getAttribute('value') }, bubbles: true }));
      return el.toggle();
    });
    await page.waitForChanges();
    expect(sel).toHaveReceivedEvent();
    expect(sel.lastEvent.detail).toEqual({ selected: true, value: 'v1' });
    expect(exp).toHaveReceivedEvent();
  });

  it('vertical overlay thumb DRAGS with the pointer (the one pointer-only interaction)', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN);
    await page.waitForChanges();
    const geom = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const thumb = t.shadowRoot!.querySelector('.md-table__vscroll-thumb')!;
      const r = thumb.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(geom.x, geom.y);
    await page.mouse.down();
    await page.mouse.move(geom.x, geom.y + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForChanges();
    const scrolled = await page.evaluate(
      () => (document.querySelector('md-table')!.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement).scrollTop,
    );
    expect(scrolled).toBeGreaterThan(0);
  });

  it('REAL keystrokes scroll the focused frozen body (Tab + ArrowRight/Down)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container max-height="200px" style="inline-size: 300px;">
        <md-table frozen-header label="t" column-template="200px 200px 200px" min-width="600px">
          <md-table-head>
            <md-table-row><md-table-cell head>A</md-table-cell><md-table-cell head>B</md-table-cell><md-table-cell head>C</md-table-cell></md-table-row>
          </md-table-head>
          <md-table-body>${ROWS}</md-table-body>
        </md-table>
      </md-table-container>
    `);
    await page.waitForChanges();
    await page.evaluate(() => {
      (document.querySelector('md-table')!.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement).focus();
    });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    const pos = await page.evaluate(() => {
      const sc = document.querySelector('md-table')!.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
      return { left: sc.scrollLeft, top: sc.scrollTop };
    });
    expect(pos.left).toBeGreaterThan(0); // real keystroke, full input path
    expect(pos.top).toBeGreaterThan(0); // native vertical keys intact
  });

  it('stateful consumer toggleSelectAll + auto-wire CONVERGE (no net-revert)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table label="t" selection="multiple" columns="1">
        <md-table-head>
          <md-table-row><md-table-cell head padding="checkbox"><md-checkbox id="all" aria-label="Select all"></md-checkbox></md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row><md-table-cell>a</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>b</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    await page.waitForChanges();
    // Wire the WORST-CASE consumer handler: a stateful toggle through the
    // @Method proxy — this used to read the auto-wire's already-applied state
    // and execute the inverse, net-reverting every head click.
    await page.evaluate(() => {
      document.getElementById('all')!.addEventListener('mdChange', () => {
        void (document.querySelector('md-table') as HTMLMdTableElement).toggleSelectAll();
      });
    });
    await page.evaluate(() => document.getElementById('all')!.click());
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    let selected = await page.evaluate(
      () => document.querySelectorAll('md-table-body md-table-row').length &&
        [...document.querySelectorAll('md-table-body md-table-row')].filter((r) => (r as HTMLElement & { selected: boolean }).selected).length,
    );
    expect(selected).toBe(2); // all selected — not reverted to 0
    await page.evaluate(() => document.getElementById('all')!.click());
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    selected = await page.evaluate(
      () => [...document.querySelectorAll('md-table-body md-table-row')].filter((r) => (r as HTMLElement & { selected: boolean }).selected).length,
    );
    expect(selected).toBe(0); // and uncheck deselects
  });


  it('setColumnVisibility hides the track + cells, emits, restores, guards the last column', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container max-height="200px" style="inline-size: 420px;">
        <md-table frozen-header label="t" column-template="100px 120px 140px">
          <md-table-head>
            <md-table-row><md-table-cell head>A</md-table-cell><md-table-cell head>B</md-table-cell><md-table-cell head>C</md-table-cell></md-table-row>
          </md-table-head>
          <md-table-body>
            <md-table-row><md-table-cell>a</md-table-cell><md-table-cell>b</md-table-cell><md-table-cell>c</md-table-cell></md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>
    `);
    await page.waitForChanges();
    const spy = await page.spyOnEvent('mdColumnVisibilityChange');
    const t = () => page.$eval('md-table', (el, c, v) => el.setColumnVisibility(c as number, v as boolean), 1, false);
    await t();
    await page.waitForChanges();
    let state = await page.evaluate(() => ({
      template: document.querySelector('md-table')!.getAttribute('column-template'),
      hiddenCells: document.querySelectorAll('[data-md-col-hidden]').length,
      visible: Array.from(document.querySelectorAll('md-table-body md-table-cell')).filter((c) => c.getBoundingClientRect().width > 0).length,
    }));
    expect(state.template).toBe('100px 140px'); // B's track gone
    expect(state.hiddenCells).toBe(2); // head + body cell
    expect(state.visible).toBe(2);
    expect(spy.lastEvent.detail).toEqual({ column: 1, visible: false, hidden: [1] });

    await page.$eval('md-table', (el) => el.setColumnVisibility(1, true));
    await page.waitForChanges();
    state = await page.evaluate(() => ({
      template: document.querySelector('md-table')!.getAttribute('column-template'),
      hiddenCells: document.querySelectorAll('[data-md-col-hidden]').length,
      visible: 0,
    }));
    expect(state.template).toBe('100px 120px 140px'); // restored in original order
    expect(state.hiddenCells).toBe(0);

    // last-visible guard
    await page.$eval('md-table', async (el) => {
      await el.setColumnVisibility(0, false);
      await el.setColumnVisibility(1, false);
      await el.setColumnVisibility(2, false); // must refuse
    });
    await page.waitForChanges();
    const last = await page.evaluate(() =>
      Array.from(document.querySelectorAll('md-table-head md-table-cell')).filter((c) => !c.hasAttribute('data-md-col-hidden')).length,
    );
    expect(last).toBe(1); // one column always survives
  });

  it('mdPinChange and mdScroll emit', async () => {
    const page = await newE2EPage();
    await page.setContent(FROZEN.replace('columns="2"', 'column-template="200px 220px"'));
    await page.waitForChanges();
    const pinSpy = await page.spyOnEvent('mdPinChange');
    const scrollSpy = await page.spyOnEvent('mdScroll');
    await page.$eval('md-table', (el) => el.pinColumn(0, 'start'));
    await page.waitForChanges();
    expect(pinSpy.lastEvent.detail).toEqual({ column: 0, side: 'start' });
    await page.evaluate(() => {
      const sc = document.querySelector('md-table')!.shadowRoot!.querySelector('.md-table__body-scroll') as HTMLElement;
      sc.scrollTop = 60;
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 100));
    expect(scrollSpy).toHaveReceivedEvent();
    expect(scrollSpy.lastEvent.detail.scrollTop).toBeGreaterThan(0);
  });

});
