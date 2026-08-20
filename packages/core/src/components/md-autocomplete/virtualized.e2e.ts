import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * Real-WASM coverage for the virtualized `md-autocomplete`: windowed
 * rendering, scroll re-window, the debounced in-input filter, the pack
 * lifecycle (busy -> ready), and off-window label resolution. Mirrors the
 * proven md-select/md-multi-select virtualized suites.
 */
describe('md-autocomplete virtualized e2e', () => {
  const TOTAL = 5000;

  async function mountAndOpen(page: E2EPage, n = TOTAL): Promise<void> {
    await page.setContent(
      '<md-autocomplete label="Item" virtualize="always" row-height="48" max-height="320"></md-autocomplete>',
    );
    await page.waitForChanges();
    await page.evaluate(async (count: number) => {
      const el = document.querySelector('md-autocomplete') as HTMLElement & {
        loadOptions: (rows: Array<{ value: string; label: string }>) => Promise<void>;
      };
      const rows = Array.from({ length: count }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` }));
      await el.loadOptions(rows);
    }, n);
    await page.waitForChanges();
    const el = await page.find('md-autocomplete');
    el.setProperty('open', true);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    await page.waitForChanges();
  }

  function windowInfo(page: E2EPage) {
    return page.evaluate(() => {
      const root = document.querySelector('md-autocomplete')!.shadowRoot!;
      const items = Array.from(root.querySelectorAll('md-menu-item[data-vindex]')) as HTMLElement[];
      const vindices = items.map((it) => Number(it.getAttribute('data-vindex')));
      const headlines = items.map((it) => (it as unknown as { headline: string }).headline);
      const spacers = Array.from(root.querySelectorAll('.md-autocomplete__vspacer')) as HTMLElement[];
      return {
        domCount: items.length,
        firstVindex: vindices[0] ?? -1,
        lastVindex: vindices[vindices.length - 1] ?? -1,
        firstHeadline: headlines[0] ?? null,
        spacerPx: spacers.reduce((sum, sp) => sum + sp.offsetHeight, 0),
      };
    });
  }

  it('windows the dataset: a small DOM slice + spacers preserving the full height', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    const info = await windowInfo(page);
    expect(info.domCount).toBeGreaterThan(0);
    expect(info.domCount).toBeLessThan(120);
    expect(info.firstVindex).toBe(0);
    expect(info.firstHeadline).toBe('Option 0');
    // Total scrollable content ~= TOTAL * rowHeight.
    expect(info.spacerPx).toBeGreaterThan(100_000);
  });

  it('re-windows on scroll', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    await page.evaluate(async () => {
      const el = document.querySelector('md-autocomplete')!;
      const menu = el.shadowRoot!.querySelector('md-menu') as HTMLElement & {
        getScrollViewport: () => Promise<HTMLElement | null>;
      };
      const vp = await menu.getScrollViewport();
      if (vp) {
        vp.scrollTop = 4000;
        vp.dispatchEvent(new Event('scroll'));
      }
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.waitForChanges();
    const info = await windowInfo(page);
    expect(info.firstVindex).toBeGreaterThan(20);
    expect(info.lastVindex).toBeLessThan(TOTAL);
  });

  it('typing in the INPUT filters through the debounced engine query', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    await page.evaluate(() => {
      const el = document.querySelector('md-autocomplete')!;
      const input = el.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      input.value = 'Option 4999';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    });
    await new Promise((r) => setTimeout(r, 600)); // debounce + engine query
    await page.waitForChanges();
    const info = await windowInfo(page);
    expect(info.domCount).toBe(1);
    expect(info.firstHeadline).toBe('Option 4999');
  });

  it('pack lifecycle: busy clears, the caret replaces the spinner, list is live', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    const state = await page.evaluate(() => {
      const el = document.querySelector('md-autocomplete')!;
      return {
        ariaBusy: el.getAttribute('aria-busy'),
        spinner: !!el.shadowRoot!.querySelector('[part="loading-spinner"]'),
        caret: !!el.shadowRoot!.querySelector('[part="caret"]'),
        rows: el.shadowRoot!.querySelectorAll('md-menu-item[data-vindex]').length,
      };
    });
    expect(state.ariaBusy).toBe('false');
    expect(state.spinner).toBe(false);
    expect(state.caret).toBe(true);
    expect(state.rows).toBeGreaterThan(0);
  });

  it('resolves off-window labels via getLabels()', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    const labels = await page.evaluate(async () => {
      const el = document.querySelector('md-autocomplete') as HTMLElement & {
        getLabels: (v: string[]) => Promise<Record<string, string>>;
      };
      return el.getLabels(['v4999', 'v0']);
    });
    expect(labels).toEqual({ v4999: 'Option 4999', v0: 'Option 0' });
  });
});
