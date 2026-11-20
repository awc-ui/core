import { newE2EPage } from '@stencil/core/testing';

/**
 * Proves the portable `containsFocus` walk kept `:focus-within` semantics in a
 * REAL browser — specifically the case that motivated the pseudo-class in the
 * first place: for a button/link row, DOM focus lands on the primary element
 * INSIDE the row's shadow tree, not on the row host, and the list must still
 * resolve that row as the current one.
 */
describe('md-list roving focus (real browser)', () => {
  const LIST = `
    <md-list>
      <md-list-item id="r1" headline="One" type="button"></md-list-item>
      <md-list-item id="r2" headline="Two" type="button"></md-list-item>
      <md-list-item id="r3" headline="Three" type="button"></md-list-item>
    </md-list>
  `;

  it('resolves the current row when focus is inside its shadow tree', async () => {
    const page = await newE2EPage();
    await page.setContent(LIST);
    await page.waitForChanges();

    const focusedInsideShadow = await page.evaluate(() => {
      const row = document.querySelector('#r2') as HTMLElement;
      const inner = row.shadowRoot?.querySelector('[tabindex]') as HTMLElement | null;
      inner?.focus();
      return {
        // The row's shadow root delegates focus, so document.activeElement
        // reports the HOST while real focus sits on the inner element. That is
        // precisely why a plain `:focus` check will not do.
        hostIsActive: document.activeElement === row,
        innerIsActive: row.shadowRoot?.activeElement === inner,
        rowHoldsFocus: row.matches(':focus-within'),
      };
    });
    expect(focusedInsideShadow.hostIsActive).toBe(true);
    expect(focusedInsideShadow.innerIsActive).toBe(true);
    expect(focusedInsideShadow.rowHoldsFocus).toBe(true);

    // ArrowDown from row 2 must land on row 3, which only works if the list
    // resolved row 2 as current.
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();

    const nowFocused = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('md-list-item'));
      return rows.findIndex((r) => r.matches(':focus-within'));
    });
    expect(nowFocused).toBe(2);
  });

  it('steps through every row without skipping', async () => {
    const page = await newE2EPage();
    await page.setContent(LIST);
    await page.waitForChanges();
    // The list listens on its own host, so a keystroke only reaches it once
    // focus is inside — otherwise it goes to <body>. The row HOST carries no
    // tabindex, so focus has to be put on its inner primary element.
    await page.evaluate(() => {
      const row = document.querySelector('#r1') as HTMLElement;
      (row.shadowRoot?.querySelector('[tabindex]') as HTMLElement | null)?.focus();
    });
    await page.waitForChanges();

    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForChanges();
      seen.push(
        await page.evaluate(() =>
          Array.from(document.querySelectorAll('md-list-item')).findIndex((r) =>
            r.matches(':focus-within'),
          ),
        ),
      );
    }
    // One row per keystroke, starting from row 0 — a double-advance would skip.
    expect(seen).toEqual([1, 2, 0]);
  });

  it('wraps from the last row back to the first', async () => {
    const page = await newE2EPage();
    await page.setContent(LIST);
    await page.waitForChanges();
    await page.evaluate(() => {
      const row = document.querySelector('#r1') as HTMLElement;
      (row.shadowRoot?.querySelector('[tabindex]') as HTMLElement | null)?.focus();
    });
    await page.waitForChanges();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForChanges();
    }
    const idx = await page.evaluate(() =>
      Array.from(document.querySelectorAll('md-list-item')).findIndex((r) =>
        r.matches(':focus-within'),
      ),
    );
    expect(idx).toBe(0);
  });

  /* gate-7 r3-25: after an expandable row of a selection list was a roving stop, Tab from the active first row used to stop on
     that row's host again (a stamped tabindex). The roving tabindex leaves one host stop: Tab goes on to the row's caret. */
  it('leaves no stale tab stop on an expandable row a selection list roved', async () => {
    const page = await newE2EPage();
    await page.setContent(`<button id="before">before</button>
      <md-list selection-mode="single-select">
        <md-list-item id="a" headline="Alpha"></md-list-item>
        <md-list-item id="d" headline="Delta" expandable><md-list-item slot="expanded-content" headline="Child"></md-list-item></md-list-item>
        <md-list-item id="c" headline="Charlie"></md-list-item>
      </md-list><button id="after">after</button>`);
    await page.waitForChanges();
    const focus = () => page.evaluate(() => {
      let el: Element | null = document.activeElement; const path: string[] = [];
      while (el) { path.push(el.id || el.getAttribute('part') || el.tagName.toLowerCase()); el = el.shadowRoot?.activeElement ?? null; }
      return path.join('>');
    });
    const stops = () => page.evaluate(() => Array.from(document.querySelectorAll('md-list > md-list-item')).map(i => i.getAttribute('tabindex')));
    await page.focus('#before');
    await page.keyboard.press('Tab');
    expect(await focus()).toBe('a');
    await page.keyboard.press('ArrowDown');
    await page.waitForChanges();
    expect(await focus()).toBe('d');
    expect(await stops()).toEqual(['-1', '0', '-1']);
    await page.keyboard.press('Home');
    await page.waitForChanges();
    expect(await focus()).toBe('a');
    expect(await stops()).toEqual(['0', null, '-1']);
    await page.keyboard.press('Tab');
    await page.waitForChanges();
    expect(await focus()).toBe('d>expand-button');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    await page.waitForChanges();
    // Focus entering d's caret made d the roving stop (mdRequestActivation), so Shift+Tab returns to d's host.
    expect(await focus()).toBe('d');
  });

  /* gate-7 r3-26: the collapsed panel of an expandable row kept its slotted rows in the tab order (its `hidden` attribute is
     overridden by the panel's `display: grid`): Tab from the caret entered an invisible row. */
  it('keeps the content of a collapsed expandable row out of the tab order', async () => {
    const page = await newE2EPage();
    await page.setContent(`<button id="before">before</button>
      <md-list selection-mode="single-select">
        <md-list-item id="a" headline="Alpha"></md-list-item>
        <md-list-item id="d" headline="Delta" expandable><md-list-item id="d0" slot="expanded-content" headline="Child"></md-list-item></md-list-item>
      </md-list><button id="after">after</button>`);
    await page.waitForChanges();
    const focus = () => page.evaluate(() => {
      let el: Element | null = document.activeElement; const path: string[] = [];
      while (el) { path.push(el.id || el.getAttribute('part') || el.tagName.toLowerCase()); el = el.shadowRoot?.activeElement ?? null; }
      return path.join('>');
    });
    const childVisibility = () => page.evaluate(() => getComputedStyle(document.getElementById('d0')!).visibility);
    await page.focus('#before');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForChanges();
    expect(await focus()).toBe('d>expand-button');
    expect(await childVisibility()).toBe('hidden');
    await page.keyboard.press('Tab');
    expect(await focus()).toBe('after');
    // Expanded, the content is visible at once and its row is the stop after the caret.
    await page.evaluate(() => { (document.getElementById('d') as HTMLElement & { expanded: boolean }).expanded = true; });
    await page.waitForChanges();
    expect(await childVisibility()).toBe('visible');
    await page.focus('#d');
    await page.keyboard.press('Tab');
    expect(await focus()).toBe('d>expand-button');
    await page.keyboard.press('Tab');
    expect(await focus()).toBe('d0');
  });
});
