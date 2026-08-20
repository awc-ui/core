import { newE2EPage } from '@stencil/core/testing';

describe('md-list-item e2e', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-list-item headline="Item"></md-list-item>');
    const el = await page.find('md-list-item');
    expect(el).toBeTruthy();
  });

  /**
   * Regression: the segmented list-style's `:host-context()` block must
   * not declare `--_container-color`. If it does, its specificity
   * (pseudo-class + attribute + tag = 0,2,1) beats
   * `:host(.md-list-item--selected)` (0,2,0) and selected rows in
   * segmented lists fail to paint the secondary-container tint.
   *
   * We verify the cascade by reading the resolved value of the private
   * `--_container-color` custom property directly — this works without
   * design tokens loaded because the rules use literal hex fallbacks.
   */
  it('resolves --_container-color to the selected palette inside a segmented list', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-list list-style="segmented" selection-mode="single-select">
        <md-list-item headline="Photos" selected></md-list-item>
        <md-list-item headline="Videos"></md-list-item>
      </md-list>
    `);
    await page.waitForChanges();

    const [selectedColor, restingColor] = await page.evaluate(() => {
      const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '');
      const selected = document.querySelector('md-list-item[selected]') as HTMLElement;
      const resting = document.querySelector('md-list-item:not([selected])') as HTMLElement;
      return [
        norm(getComputedStyle(selected).getPropertyValue('--_container-color')),
        norm(getComputedStyle(resting).getPropertyValue('--_container-color')),
      ];
    });

    expect(selectedColor).toBeTruthy();
    expect(restingColor).toBeTruthy();
    expect(selectedColor).not.toBe(restingColor);
  });

  /**
   * Regression: the reorder drag handle carries both `.md-list-item__drag-handle`
   * (pointer-events: auto) and `.material-symbols-outlined` (pointer-events: none,
   * for the glyph font). Both are single-class selectors, so if the handle rule
   * does NOT outscore the icon-font rule the latter wins on source order, the
   * handle resolves to `pointer-events: none`, the pointer falls through to the
   * row, `pointerdown`'s composedPath never includes the handle, and the drag
   * never starts. The handle rule doubles up the `.material-symbols-outlined`
   * class to win the cascade; verify the resolved value AND that a shadow-aware
   * hit test at the handle's centre actually lands on the handle.
   */
  it('keeps the reorder drag handle hittable (pointer-events: auto)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-list reorderable>
        <md-list-item type="button" headline="One"></md-list-item>
        <md-list-item type="button" headline="Two"></md-list-item>
      </md-list>
    `);
    await page.waitForChanges();

    const result = await page.evaluate(() => {
      const item = document.querySelector('md-list-item') as HTMLElement;
      const handle = item.shadowRoot!.querySelector('[data-list-drag-handle]') as HTMLElement;
      const pointerEvents = getComputedStyle(handle).pointerEvents;
      const r = handle.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      // Shadow-aware deepest hit test (what a real pointer resolves to).
      let el = document.elementFromPoint(x, y) as Element | null;
      while (el && (el as HTMLElement).shadowRoot) {
        const inner = (el as HTMLElement).shadowRoot!.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
      }
      const hitIsHandle = !!el && el.getAttribute('data-list-drag-handle') === 'true';
      return { pointerEvents, hitIsHandle };
    });

    expect(result.pointerEvents).toBe('auto');
    expect(result.hitIsHandle).toBe(true);
  });
});
