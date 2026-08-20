import { newE2EPage, E2EPage } from '@stencil/core/testing';
import axe from 'axe-core';

/**
 * WAI-ARIA conformance for the WASM-virtualized `md-select`. The popup is a
 * combobox + listbox (not a menu): the search input is `role="combobox"`, the
 * surface is `role="listbox"`, rows are `role="option"`, and keyboard nav is
 * conveyed through `aria-activedescendant` on the input (focus never leaves it),
 * which is the robust pattern for a listbox whose rows are virtualized.
 */
describe('md-select virtualized · WAI-ARIA', () => {
  async function mountAndOpen(page: E2EPage, n = 5000): Promise<void> {
    await page.setContent(
      '<md-select label="Item" virtualize="always" filterable max-height="320"></md-select>',
    );
    await page.waitForChanges();
    await page.evaluate(async (count: number) => {
      const el = document.querySelector('md-select') as HTMLElement & {
        loadOptions: (rows: Array<{ value: string; label: string }>) => Promise<void>;
      };
      await el.loadOptions(
        Array.from({ length: count }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` })),
      );
    }, n);
    await page.waitForChanges();
    const el = await page.find('md-select');
    el.setProperty('open', true);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    await page.waitForChanges();
  }

  it('exposes the combobox + listbox + option contract', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    const aria = await page.evaluate(() => {
      const root = document.querySelector('md-select')!.shadowRoot!;
      const input = root.querySelector('.md-select__search') as HTMLElement;
      // The listbox is a wrapper in md-select's shadow root (so aria-controls /
      // aria-activedescendant resolve); the menu surface is only presentation.
      const listbox = root.querySelector('.md-select__listbox') as HTMLElement;
      const opt = root.querySelector('md-menu-item[data-vindex="0"]') as HTMLElement;
      return {
        comboRole: input.getAttribute('role'),
        comboExpanded: input.getAttribute('aria-expanded'),
        comboHaspopup: input.getAttribute('aria-haspopup'),
        comboAutocomplete: input.getAttribute('aria-autocomplete'),
        comboControls: input.getAttribute('aria-controls'),
        listboxId: listbox?.id,
        listboxRole: listbox?.getAttribute('role'),
        listboxName: listbox?.getAttribute('aria-label'),
        optRole: opt.getAttribute('role'),
        optSelectedPresent: opt.hasAttribute('aria-selected'),
        optHasCheckedAttr: opt.hasAttribute('aria-checked'),
        optSetsize: Number(opt.getAttribute('aria-setsize')),
        optPosinset: Number(opt.getAttribute('aria-posinset')),
        optId: opt.id,
      };
    });

    expect(aria.comboRole).toBe('combobox');
    expect(aria.comboExpanded).toBe('true');
    expect(aria.comboHaspopup).toBe('listbox');
    expect(aria.comboAutocomplete).toBe('list');
    expect(aria.listboxRole).toBe('listbox');
    expect(aria.listboxName).toBeTruthy();
    // aria-controls resolves to the listbox (same shadow root).
    expect(aria.comboControls).toBe(aria.listboxId);
    expect(aria.listboxId).toBeTruthy();
    expect(aria.optRole).toBe('option');
    expect(aria.optSelectedPresent).toBe(true); // aria-selected, not aria-checked
    expect(aria.optHasCheckedAttr).toBe(false);
    expect(aria.optSetsize).toBe(5000);
    expect(aria.optPosinset).toBe(1);
    expect(aria.optId).toBeTruthy();
  }, 60000);

  it('moves aria-activedescendant to the active option on ArrowDown (focus stays on the input)', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    const result = await page.evaluate(async () => {
      const root = document.querySelector('md-select')!.shadowRoot!;
      const input = root.querySelector('.md-select__search') as HTMLElement;
      const menu = root.querySelector('md-menu') as HTMLElement;
      // A single ArrowDown from the freshly-opened combobox.
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => setTimeout(r, 30));

      const adId = input.getAttribute('aria-activedescendant');
      const active = adId ? root.getElementById(adId) : null;
      const focusStillOnInput =
        root.activeElement === input || document.activeElement?.shadowRoot?.activeElement === input;
      return {
        adId,
        activeResolves: !!active,
        activeVindex: active?.getAttribute('data-vindex'),
        activeHasRing: !!active?.hasAttribute('data-md-focused'),
        activeRole: active?.getAttribute('role') ?? null,
        focusStillOnInput,
      };
    });

    expect(result.adId).toBeTruthy(); // points at an option
    expect(result.activeResolves).toBe(true); // the IDREF resolves in this root
    expect(result.activeVindex).toBe('0'); // first ArrowDown lands on the FIRST item
    expect(result.activeHasRing).toBe(true); // visual ring matches the a11y active
    expect(result.activeRole).toBe('option');
    expect(result.focusStillOnInput).toBe(true); // focus never left the combobox
  }, 60000);

  it('selects the active option on Enter', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    const value = await page.evaluate(async () => {
      const sel = document.querySelector('md-select') as HTMLElement & { value: string };
      const menu = sel.shadowRoot!.querySelector('md-menu') as HTMLElement;
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
      return sel.value;
    });

    // First ArrowDown lands on the first option (index 0); Enter commits it.
    expect(value).toBe('v0');
  }, 60000);

  it('has no axe violations while open', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);

    // Inject axe-core into the page (it understands shadow DOM) and sweep the
    // open select, including the combobox/listbox/options.
    await page.evaluate(axe.source);
    const violations = await page.evaluate(async () => {
      const results = await (
        window as unknown as { axe: typeof axe }
      ).axe.run(document.querySelector('md-select')!, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        // The virtualized scroll viewport has no focusable descendants (options
        // use aria-activedescendant, not tabindex). axe flags it as a
        // non-keyboard-reachable scroll region, but the combobox IS the keyboard
        // affordance: while it holds focus, ArrowUp/Down/Home/End/PageUp/Down
        // scroll the entire list. So this static check is a false positive here.
        rules: { 'scrollable-region-focusable': { enabled: false } },
      });
      return results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => n.target.join(' ')),
        summary: v.nodes[0]?.failureSummary,
      }));
    });


    if (violations.length) console.log('AXE VIOLATIONS:', JSON.stringify(violations, null, 2));
    expect(violations).toEqual([]);
  }, 60000);
});
