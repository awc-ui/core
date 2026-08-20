import { newE2EPage, E2EPage } from '@stencil/core/testing';

/**
 * WASM-backed virtualization for md-multi-select — the same engine md-select
 * uses, but multi-selectable. Runs in real Chromium so WebAssembly instantiates.
 * Covers windowed rendering, the header filter field, and multi-selection of
 * filtered rows.
 */
describe('md-multi-select virtualized e2e', () => {
  const TOTAL = 5000;

  async function mountAndOpen(page: E2EPage, n = TOTAL): Promise<void> {
    await page.setContent(
      '<md-multi-select label="Item" virtualize="always" filterable show-select-all max-height="320"></md-multi-select>',
    );
    await page.waitForChanges();
    await page.evaluate(async (count: number) => {
      const el = document.querySelector('md-multi-select') as HTMLElement & {
        loadOptions: (rows: Array<{ value: string; label: string }>) => Promise<void>;
      };
      await el.loadOptions(Array.from({ length: count }, (_, i) => ({ value: `v${i}`, label: `Option ${i}` })));
    }, n);
    await page.waitForChanges();
    (await page.find('md-multi-select')).setProperty('open', true);
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 250));
    await page.waitForChanges();
  }

  const rows = (page: E2EPage) =>
    page.evaluate(() => {
      const root = document.querySelector('md-multi-select')!.shadowRoot!;
      const items = Array.from(root.querySelectorAll('md-menu-item[data-vindex]')) as HTMLElement[];
      return {
        domCount: items.length,
        setsize: Number(items[0]?.getAttribute('aria-setsize') ?? -1),
        firstHeadline: (items[0] as unknown as { headline: string })?.headline ?? null,
      };
    });

  it('windows a large dataset: only visible rows in the DOM, full setsize reported', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    const info = await rows(page);
    expect(info.setsize).toBe(TOTAL);
    expect(info.domCount).toBeGreaterThan(0);
    expect(info.domCount).toBeLessThan(100); // a small window, not all 5000
    expect(info.firstHeadline).toBe('Option 0');
  });

  it('the header filter narrows the virtualized list', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    await page.evaluate(() => {
      const input = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
    });
    await page.keyboard.type('Option 4242');
    await new Promise((r) => setTimeout(r, 400));
    await page.waitForChanges();
    const info = await rows(page);
    expect(info.setsize).toBe(1);
    expect(info.firstHeadline).toBe('Option 4242');
  });

  it('multi-selects filtered rows and accumulates them in value', async () => {
    const page = await newE2EPage();
    await mountAndOpen(page);
    // filter to a single row, select it, clear the query, select another
    const pick = async (query: string) => {
      await page.evaluate((q: string) => {
        const ms = document.querySelector('md-multi-select') as unknown as { setQuery: (s: string) => Promise<void> };
        return ms.setQuery(q);
      }, query);
      await new Promise((r) => setTimeout(r, 350));
      await page.waitForChanges();
      await page.evaluate(() => {
        const it = document.querySelector('md-multi-select')!.shadowRoot!.querySelector('md-menu-item[data-vindex]') as HTMLElement;
        it?.click();
      });
      await new Promise((r) => setTimeout(r, 150));
      await page.waitForChanges();
    };
    await pick('Option 4242');
    await pick('Option 77');
    const value = await page.evaluate(() => (document.querySelector('md-multi-select') as unknown as { value: string[] }).value);
    expect(value).toContain('v4242');
    expect(value).toContain('v77');
    expect(value.length).toBe(2);
  });
});
