import { newE2EPage } from '@stencil/core/testing';

/**
 * Coverage includes real LAYOUT measurements — the original family passed
 * every test while rendering as a collapsed single line, because nothing
 * asserted geometry.
 */
describe('md-table e2e', () => {
  const GRID_3X3 = `
    <md-table label="Users" columns="3" style="width: 600px">
      <md-table-head>
        <md-table-row>
          <md-table-cell head scope="col">A</md-table-cell>
          <md-table-cell head scope="col">B</md-table-cell>
          <md-table-cell head scope="col">C</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        <md-table-row><md-table-cell>A1</md-table-cell><md-table-cell>B1</md-table-cell><md-table-cell>C1</md-table-cell></md-table-row>
        <md-table-row><md-table-cell>A2</md-table-cell><md-table-cell>B2</md-table-cell><md-table-cell>C2</md-table-cell></md-table-row>
      </md-table-body>
    </md-table>`;

  it('renders a basic table with rows and cells', async () => {
    const page = await newE2EPage();
    await page.setContent(GRID_3X3);
    const table = await page.find('md-table');
    // role="table" lives on the shadow structural wrapper (content model).
    const role = await page.evaluate(
      () => !!document.querySelector('md-table')!.shadowRoot!.querySelector('[role="table"]'),
    );
    expect(role).toBe(true);
    const ariaLabel = await page.evaluate(
      () => document.querySelector('md-table')!.shadowRoot!.querySelector('[role="table"]')!.getAttribute('aria-label'),
    );
    expect(ariaLabel).toBe('Users');
  });

  it('LAYOUT: cells form a real 3-column grid (columns align, rows stack)', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 600 });
    await page.setContent(GRID_3X3);
    await page.waitForChanges();
    const geo = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('md-table-cell')).map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      });
      const rows = Array.from(document.querySelectorAll('md-table-row')).map((row) => {
        const r = row.getBoundingClientRect();
        return { y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) };
      });
      return { cells, rows };
    });
    // 9 cells in 3 columns of 3 distinct x positions
    const xs = [...new Set(geo.cells.map((c) => c.x))].sort((a, b) => a - b);
    expect(xs.length).toBe(3);
    // 3 rows at 3 distinct y positions (header + 2 body)
    const ys = [...new Set(geo.cells.map((c) => c.y))];
    expect(ys.length).toBe(3);
    // columns share widths (~200px for 600px/3)
    expect(Math.abs(geo.cells[0].w - 200)).toBeLessThanOrEqual(2);
    // every cell has real height (not collapsed)
    geo.cells.forEach((c) => expect(c.h).toBeGreaterThanOrEqual(40));
    // rows are REAL boxes spanning the full width
    geo.rows.forEach((r) => expect(r.w).toBeGreaterThanOrEqual(590));
    // header row is 56px; body rows are 52px (standard density)
    expect(geo.rows[0].h).toBeGreaterThanOrEqual(56);
    expect(Math.abs(geo.rows[1].h - 52)).toBeLessThanOrEqual(1);
  });

  it('LAYOUT: a bare table (no columns/template) derives tracks from the first row', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 900, height: 600 });
    await page.setContent(`
      <md-table style="width: 600px">
        <md-table-body>
          <md-table-row><md-table-cell>A1</md-table-cell><md-table-cell>B1</md-table-cell></md-table-row>
          <md-table-row><md-table-cell>A2</md-table-cell><md-table-cell>B2</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>`);
    await page.waitForChanges();
    const geo = await page.evaluate(() =>
      Array.from(document.querySelectorAll('md-table-cell')).map((c) => {
        const r = c.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) };
      }),
    );
    const xs = [...new Set(geo.map((c) => c.x))];
    const ys = [...new Set(geo.map((c) => c.y))];
    expect(xs.length).toBe(2); // 2 columns — NOT one collapsed line
    expect(ys.length).toBe(2); // 2 stacked rows
    expect(Math.abs(geo[0].w - 300)).toBeLessThanOrEqual(2);
  });

  it('VISUAL: striped, hover and selected paint the row surface', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table striped columns="1" style="width: 400px">
        <md-table-body>
          <md-table-row id="r0"><md-table-cell>zero</md-table-cell></md-table-row>
          <md-table-row id="r1"><md-table-cell>one</md-table-cell></md-table-row>
          <md-table-row id="r2" selected><md-table-cell>two</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>`);
    await page.waitForChanges();
    const probe = await page.evaluate(() => {
      const bg = (id: string) => getComputedStyle(document.getElementById(id)!).backgroundColor;
      return { r0: bg('r0'), r1: bg('r1'), r2: bg('r2') };
    });
    expect(probe.r1).not.toBe(probe.r0); // stripe on odd body row
    expect(probe.r2).not.toBe(probe.r0); // selection tint
    // hover state layer appears on pointer over
    const r0 = await page.find('#r0');
    await r0.hover();
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));
    const hoverOpacity = await page.evaluate(() => {
      const row = document.getElementById('r0')!;
      return getComputedStyle(row, '::before').opacity;
    });
    expect(parseFloat(hoverOpacity)).toBeGreaterThan(0.9); // layer faded in
  });

  it('STICKY: header row sticks while the container scrolls', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 700, height: 500 });
    await page.setContent(`
      <div style="height: 200px; overflow: auto" id="scroller">
        <md-table sticky-header columns="1" style="width: 400px">
          <md-table-head>
            <md-table-row><md-table-cell head>Head</md-table-cell></md-table-row>
          </md-table-head>
          <md-table-body>
            ${Array.from({ length: 20 }, (_, i) => `<md-table-row><md-table-cell>row ${i}</md-table-cell></md-table-row>`).join('')}
          </md-table-body>
        </md-table>
      </div>`);
    await page.waitForChanges();
    const stickyPos = await page.evaluate(() => {
      const headRow = document.querySelector('md-table-head md-table-row')!;
      return getComputedStyle(headRow).position;
    });
    expect(stickyPos).toBe('sticky');
    const drift = await page.evaluate(() => {
      const scroller = document.getElementById('scroller')!;
      const headRow = document.querySelector('md-table-head md-table-row')!;
      const before = headRow.getBoundingClientRect().top;
      scroller.scrollTop = 300;
      const after = headRow.getBoundingClientRect().top;
      return Math.abs(after - before);
    });
    expect(drift).toBeLessThanOrEqual(1); // pinned while content scrolled
  });

  it('FROZEN HEADER: inside a container with max-height, the scrollbar is on the body only', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 700, height: 500 });
    await page.setContent(`
      <md-table-container max-height="200px" style="inline-size: 400px">
        <md-table frozen-header columns="1">
          <md-table-head>
            <md-table-row><md-table-cell head>Head</md-table-cell></md-table-row>
          </md-table-head>
          <md-table-body>
            ${Array.from({ length: 30 }, (_, i) => `<md-table-row><md-table-cell>row ${i}</md-table-cell></md-table-row>`).join('')}
          </md-table-body>
        </md-table>
      </md-table-container>`);
    await page.waitForChanges();
    const probe = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sr = t.shadowRoot!;
      const bodyScroll = sr.querySelector('.md-table__body-scroll') as HTMLElement | null;
      const headGrid = sr.querySelector('.md-table__grid--head') as HTMLElement | null;
      const cont = document.querySelector('md-table-container')!;
      const contScroll = cont.shadowRoot!.querySelector('.md-table-container__scroll') as HTMLElement;
      if (!bodyScroll || !headGrid) return { frozen: false };
      const headTop = headGrid.getBoundingClientRect().top;
      bodyScroll.scrollTop = 300;
      return {
        frozen: true,
        // only the body scrolls (its own scrollbar); the container wrapper doesn't
        bodyHasVScroll: bodyScroll.scrollHeight > bodyScroll.clientHeight,
        containerScrollOverflowY: getComputedStyle(contScroll).overflowY,
        headDrift: Math.abs(headGrid.getBoundingClientRect().top - headTop),
      };
    });
    expect(probe.frozen).toBe(true);
    expect(probe.bodyHasVScroll).toBe(true);
    expect(probe.containerScrollOverflowY).toBe('visible'); // container doesn't scroll
    expect(probe.headDrift).toBeLessThanOrEqual(1); // header pinned while body scrolls
  });

  it('FROZEN HEADER is EXPLICIT: the frozen-header prop freezes (no sticky-header needed)', async () => {
    const page = await newE2EPage();
    await page.setViewport({ width: 700, height: 500 });
    await page.setContent(`
      <md-table-container max-height="200px" style="inline-size: 400px">
        <md-table frozen-header columns="1">
          <md-table-head>
            <md-table-row><md-table-cell head>Head</md-table-cell></md-table-row>
          </md-table-head>
          <md-table-body>
            ${Array.from({ length: 30 }, (_, i) => `<md-table-row><md-table-cell>row ${i}</md-table-cell></md-table-row>`).join('')}
          </md-table-body>
        </md-table>
      </md-table-container>`);
    await page.waitForChanges();
    const probe = await page.evaluate(() => {
      const t = document.querySelector('md-table')!;
      const sr = t.shadowRoot!;
      const bodyScroll = sr.querySelector('.md-table__body-scroll') as HTMLElement | null;
      const headGrid = sr.querySelector('.md-table__grid--head') as HTMLElement | null;
      const cont = document.querySelector('md-table-container')!;
      if (!bodyScroll || !headGrid) return { frozen: false };
      const headTop = headGrid.getBoundingClientRect().top;
      bodyScroll.scrollTop = 300;
      return {
        frozen: true,
        containerFrozenClass: cont.classList.contains('md-table-container--frozen-header'),
        headDrift: Math.abs(headGrid.getBoundingClientRect().top - headTop),
      };
    });
    expect(probe.frozen).toBe(true);
    expect(probe.containerFrozenClass).toBe(true); // gates stay in lockstep
    expect(probe.headDrift).toBeLessThanOrEqual(1);
  });

  it('emits mdSortChange when sort label is clicked and pushes state back into labels', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table columns="2">
        <md-table-head>
          <md-table-row>
            <md-table-cell head scope="col">
              <md-table-sort-label column="name">Name</md-table-sort-label>
            </md-table-cell>
            <md-table-cell head scope="col">
              <md-table-sort-label column="age">Age</md-table-sort-label>
            </md-table-cell>
          </md-table-row>
        </md-table-head>
      </md-table>
    `);
    const table = await page.find('md-table');
    const ev = await table.spyOnEvent('mdSortChange');
    const label = await page.find('md-table-sort-label');
    await label.click();
    await page.waitForChanges();
    expect(ev).toHaveReceivedEventDetail({ column: 'name', order: 'asc' });
    // pushed state: clicked label is active asc, the other stays none
    const labels = await page.findAll('md-table-sort-label');
    expect(await labels[0].getProperty('active')).toBe(true);
    expect(await labels[0].getProperty('order')).toBe('asc');
    expect(await labels[1].getProperty('active')).toBe(false);
    // second click cycles to desc
    await label.click();
    await page.waitForChanges();
    expect(await labels[0].getProperty('order')).toBe('desc');
    // third click clears
    await label.click();
    await page.waitForChanges();
    expect(await labels[0].getProperty('active')).toBe(false);
  });

  it('selectAll() selects body rows only (header rows never join selection)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table selection="multiple" columns="1">
        <md-table-head>
          <md-table-row id="head-row"><md-table-cell head>H</md-table-cell></md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row value="1"><md-table-cell>1</md-table-cell></md-table-row>
          <md-table-row value="2"><md-table-cell>2</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    const table = await page.find('md-table');
    const ev = await table.spyOnEvent('mdSelectionChange');
    await table.callMethod('selectAll');
    await page.waitForChanges();

    expect(await (await page.find('#head-row')).getProperty('selected')).toBe(false);
    const state = await table.callMethod('getSelection');
    expect(state.count).toBe(2);
    expect(state.total).toBe(2);
    expect(state.all).toBe(true);
    // bulk op → exactly ONE selection event, not one per row
    expect(ev).toHaveReceivedEventTimes(1);
  });

  it('SELECTION SYNC: model state is pushed back into the slotted checkboxes', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table selection="multiple" columns="2">
        <md-table-head>
          <md-table-row>
            <md-table-cell head padding="checkbox"><md-checkbox id="all"></md-checkbox></md-table-cell>
            <md-table-cell head>Name</md-table-cell>
          </md-table-row>
        </md-table-head>
        <md-table-body>
          <md-table-row id="r1" value="1"><md-table-cell padding="checkbox"><md-checkbox class="cb"></md-checkbox></md-table-cell><md-table-cell>A</md-table-cell></md-table-row>
          <md-table-row id="r2" value="2"><md-table-cell padding="checkbox"><md-checkbox class="cb"></md-checkbox></md-table-cell><md-table-cell>B</md-table-cell></md-table-row>
          <md-table-row id="r3" value="3"><md-table-cell padding="checkbox"><md-checkbox class="cb"></md-checkbox></md-table-cell><md-table-cell>C</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>
    `);
    // Wire exactly like the Selectable story: header → toggleSelectAll, row → selected.
    await page.evaluate(() => {
      const tbl = document.querySelector('md-table') as HTMLElement & { toggleSelectAll(): Promise<void> };
      document.getElementById('all')!.addEventListener('mdChange', () => void tbl.toggleSelectAll());
      document.querySelectorAll('.cb').forEach((cb) =>
        cb.addEventListener('mdChange', (e) => {
          const row = (e.target as HTMLElement).closest('md-table-row') as HTMLElement & { selected: boolean };
          row.selected = (e as CustomEvent).detail.checked;
        }),
      );
    });
    await page.waitForChanges();

    const checked = (sel: string) =>
      page.$eval(sel, (el) => (el as unknown as { checked: boolean }).checked);
    const headState = () =>
      page.$eval('#all', (el) => {
        const cb = el as unknown as { checked: boolean; indeterminate: boolean };
        return { checked: cb.checked, indeterminate: cb.indeterminate };
      });

    // 1) header checkbox → selects every child row's checkbox
    await page.click('#all');
    await page.waitForChanges();
    expect(await checked('#r1 md-checkbox')).toBe(true);
    expect(await checked('#r2 md-checkbox')).toBe(true);
    expect(await checked('#r3 md-checkbox')).toBe(true);
    expect(await headState()).toEqual({ checked: true, indeterminate: false });

    // 2) unchecking one child row → header goes indeterminate
    await page.click('#r2 md-checkbox');
    await page.waitForChanges();
    expect(await checked('#r2 md-checkbox')).toBe(false);
    expect(await (await page.find('#r2')).getProperty('selected')).toBe(false);
    expect(await headState()).toEqual({ checked: false, indeterminate: true });

    // 3) re-checking it → header fully checked again
    await page.click('#r2 md-checkbox');
    await page.waitForChanges();
    expect(await headState()).toEqual({ checked: true, indeterminate: false });

    // 4) header again → clears every child row
    await page.click('#all');
    await page.waitForChanges();
    expect(await checked('#r1 md-checkbox')).toBe(false);
    expect(await checked('#r3 md-checkbox')).toBe(false);
    expect(await headState()).toEqual({ checked: false, indeterminate: false });
  });

  it('expandable row springs open via grid-rows (height grows, no display:none)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table columns="1">
        <md-table-body>
          <md-table-row id="ex" expandable>
            <md-table-cell>row</md-table-cell>
            <div slot="expanded" style="height: 80px">details</div>
          </md-table-row>
        </md-table-body>
      </md-table>`);
    await page.waitForChanges();
    const heightOf = () =>
      page.evaluate(() => {
        const region = document.getElementById('ex')!.shadowRoot!.querySelector('.md-table-row__expanded')!;
        return region.getBoundingClientRect().height;
      });
    expect(await heightOf()).toBeLessThanOrEqual(1); // collapsed (0fr)
    const row = await page.find('#ex');
    await row.callMethod('toggle');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 700));
    expect(await heightOf()).toBeGreaterThanOrEqual(80); // sprung open
  });

  it('DIVIDER: inside a container, only the final row drops its border (no line over the rounded corner)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container>
        <md-table columns="1">
          <md-table-body>
            <md-table-row id="d0"><md-table-cell>0</md-table-cell></md-table-row>
            <md-table-row id="d1"><md-table-cell>1</md-table-cell></md-table-row>
            <md-table-row id="d2"><md-table-cell>2</md-table-cell></md-table-row>
          </md-table-body>
        </md-table>
      </md-table-container>`);
    await page.waitForChanges();
    const border = (id: string) =>
      page.evaluate((i) => getComputedStyle(document.getElementById(i)!).borderBottomWidth, id);
    // mid-list rows keep their divider…
    expect(await border('d0')).toBe('1px');
    expect(await border('d1')).toBe('1px');
    // …the last row (stamped data-last) drops it so it can't cross the container's corner
    expect(await border('d2')).toBe('0px');
    expect(await (await page.find('#d2')).getAttribute('data-last')).toBe('true');
    expect(await (await page.find('#d0')).getAttribute('data-last')).toBe(null);
  });

  it('DIVIDER: a bare md-table (no rounded container) keeps its last-row border', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table columns="1">
        <md-table-body>
          <md-table-row id="s0"><md-table-cell>0</md-table-cell></md-table-row>
          <md-table-row id="s1"><md-table-cell>1</md-table-cell></md-table-row>
        </md-table-body>
      </md-table>`);
    await page.waitForChanges();
    const border = (id: string) =>
      page.evaluate((i) => getComputedStyle(document.getElementById(i)!).borderBottomWidth, id);
    expect(await border('s1')).toBe('1px'); // no container → no corner → keep border
    expect(await (await page.find('#s1')).getAttribute('data-last')).toBe(null);
  });

  it('DIVIDER: with a slot="bottom" pagination bar, the last data row KEEPS its divider', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container>
        <md-table columns="1">
          <md-table-body>
            <md-table-row id="p0"><md-table-cell>0</md-table-cell></md-table-row>
            <md-table-row id="p1"><md-table-cell>1</md-table-cell></md-table-row>
          </md-table-body>
        </md-table>
        <md-table-pagination slot="bottom" count="10" rows-per-page="2"></md-table-pagination>
      </md-table-container>`);
    await page.waitForChanges();
    const border = (id: string) =>
      page.evaluate((i) => getComputedStyle(document.getElementById(i)!).borderBottomWidth, id);
    // pagination owns the rounded corner → the last row must keep its separator
    expect(await border('p1')).toBe('1px');
    expect(await (await page.find('#p1')).getAttribute('data-last')).toBe(null);
  });

  it('DIVIDER: with a footer, the foot row is last and clean; body rows keep dividers', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-table-container>
        <md-table columns="1">
          <md-table-body>
            <md-table-row id="b0"><md-table-cell>a</md-table-cell></md-table-row>
            <md-table-row id="b1"><md-table-cell>b</md-table-cell></md-table-row>
          </md-table-body>
          <md-table-foot>
            <md-table-row id="ft"><md-table-cell foot>total</md-table-cell></md-table-row>
          </md-table-foot>
        </md-table>
      </md-table-container>`);
    await page.waitForChanges();
    const border = (id: string) =>
      page.evaluate((i) => getComputedStyle(document.getElementById(i)!).borderBottomWidth, id);
    expect(await border('b0')).toBe('1px'); // between body rows
    expect(await (await page.find('#ft')).getAttribute('data-last')).toBe('true');
    expect(await border('ft')).toBe('0px'); // foot has no bottom divider at the corner
  });
});
