import { newE2EPage } from '@stencil/core/testing';

/**
 * A menu inside a transformed ancestor must still land on its anchor.
 *
 * md-menu's host is `position: fixed` and every measurement it makes — anchor
 * rects, the viewport clamp — is in viewport coordinates. But an ancestor
 * carrying a transform (or filter, perspective, backdrop-filter, contain:
 * paint/layout) becomes the CONTAINING BLOCK for its fixed descendants, and
 * those offsets are then resolved against that element's padding box instead
 * of the viewport.
 *
 * That is not a corner case: md-bottom-sheet keeps `transform: translateY(0)`
 * while open — translateY(0) still establishes a containing block — so a
 * select inside an open filter sheet dropped its menu a full sheet-height
 * below the field, off the bottom of the screen. Dialogs, side sheets and any
 * app-level animated wrapper do the same.
 *
 * The correction has to walk the FLATTENED tree, not `parentElement`: slotted
 * content keeps its light-DOM parent chain, so a menu inside a select slotted
 * into a sheet would otherwise walk select -> sheet host -> body and never
 * see the transformed container living in the sheet's shadow root.
 */
describe('md-menu · transformed ancestors', () => {
  it('lands on its anchor inside a transformed wrapper', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div id="wrap" style="transform: translateY(120px); margin: 40px;">
        <button id="trigger" style="width: 140px; height: 36px;">Open</button>
        <md-menu anchor="trigger">
          <md-menu-item headline="Alpha"></md-menu-item>
          <md-menu-item headline="Beta"></md-menu-item>
        </md-menu>
      </div>
    `);
    const menu = await page.find('md-menu');
    await menu.callMethod('show', { autoFocus: false });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 250));

    const geom = await page.evaluate(() => {
      const t = document.getElementById('trigger')!.getBoundingClientRect();
      const m = document.querySelector('md-menu')!.getBoundingClientRect();
      return {
        dx: Math.round(m.left - t.left),
        gapBelowTrigger: Math.round(m.top - t.bottom),
        onScreen: m.top >= 0 && m.left >= 0 && m.bottom <= window.innerHeight + 1,
      };
    });

    // Left-aligned with the trigger, just below it, fully visible. Before the
    // fix the menu was pushed down by the wrapper's 120px translate.
    expect(geom.dx).toBe(0);
    expect(geom.gapBelowTrigger).toBeGreaterThanOrEqual(0);
    expect(geom.gapBelowTrigger).toBeLessThanOrEqual(12);
    expect(geom.onScreen).toBe(true);
  }, 60000);

  it('a select inside an open bottom sheet drops its menu on the field', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-bottom-sheet id="sheet" variant="modal" headline="Filter products">
        <div style="padding: 16px">
          <md-select id="sel" label="Brand" value="all">
            <md-select-option value="all">All brands</md-select-option>
            <md-select-option value="acme">Acme</md-select-option>
          </md-select>
        </div>
      </md-bottom-sheet>
    `);
    await page.waitForChanges();
    const sheet = await page.find('md-bottom-sheet');
    await sheet.callMethod('show');
    // Let the slide-in transition finish so this tests the RESTING transform,
    // not a mid-animation position.
    await new Promise(r => setTimeout(r, 700));

    await page.evaluate(() => {
      (document.getElementById('sel') as HTMLElement & { open: boolean }).open = true;
    });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 500));

    const geom = await page.evaluate(() => {
      const sel = document.getElementById('sel')!;
      const menu = sel.shadowRoot!.querySelector('md-menu')!;
      const f = sel.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      return {
        dx: Math.round(m.left - f.left),
        onScreen: m.top >= 0 && m.bottom <= window.innerHeight + 1,
        // Vertically adjacent to the field on one side or the other: the menu
        // flips above when the field sits near the bottom of the viewport.
        adjacent:
          Math.abs(m.top - f.bottom) <= 12 || Math.abs(m.bottom - f.top) <= f.height + 12,
      };
    });

    expect(geom.dx).toBe(0);
    expect(geom.onScreen).toBe(true);
    expect(geom.adjacent).toBe(true);
  }, 60000);

  it('is a no-op when the viewport really is the containing block', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <div style="margin: 60px;">
        <button id="trigger" style="width: 140px; height: 36px;">Open</button>
        <md-menu anchor="trigger">
          <md-menu-item headline="Alpha"></md-menu-item>
        </md-menu>
      </div>
    `);
    const menu = await page.find('md-menu');
    await menu.callMethod('show', { autoFocus: false });
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 250));

    const geom = await page.evaluate(() => {
      const t = document.getElementById('trigger')!.getBoundingClientRect();
      const m = document.querySelector('md-menu')!.getBoundingClientRect();
      return { dx: Math.round(m.left - t.left), gap: Math.round(m.top - t.bottom) };
    });

    expect(geom.dx).toBe(0);
    expect(geom.gap).toBeGreaterThanOrEqual(0);
    expect(geom.gap).toBeLessThanOrEqual(12);
  }, 60000);
});
