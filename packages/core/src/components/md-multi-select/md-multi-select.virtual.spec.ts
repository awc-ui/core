import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdMultiSelect } from './md-multi-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { isWasmSupported } from '../../utils/wasm-option-store';

/**
 * The virtualized path — the WASM-backed store, the debounced filter, and
 * label resolution for selections outside the rendered window.
 *
 * Node supplies WebAssembly, so the store loads for real here (the same thing
 * the virtualization suite relies on). The debounce is the one place this differs
 * from md-select: the query is expensive, so a keystroke raises a spinner
 * immediately and the WASM call runs SEARCH_DEBOUNCE_MS later.
 */
const describeWasm = isWasmSupported() ? describe : describe.skip;
const DEBOUNCE_MS = 180;

async function create(attrs = 'virtualize="always"') {
  const page = await newSpecPage({
    components: [MdMultiSelect, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html: `<md-multi-select ${attrs}></md-multi-select>`,
  });
  await page.waitForChanges();
  return page;
}

type Multi = HTMLElement & {
  open: boolean;
  value: string[];
  loadOptions(source: unknown): Promise<void>;
  setQuery(q: string): Promise<void>;
  getLabels(values: string[]): Promise<Record<string, string>>;
  reset(): Promise<void>;
};

const el = (page: SpecPage) => page.root as Multi;
const vc = (page: SpecPage) =>
  (page.rootInstance as unknown as { vc: { active: boolean; filteredLength: number } }).vc;
const items = (page: SpecPage) =>
  Array.from(page.root!.shadowRoot!.querySelectorAll('md-menu-item')) as HTMLElement[];
const search = (page: SpecPage) =>
  page.root!.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement | null;

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Label ${i}` }));

/** Real timers on purpose — fake ones deadlock with waitForChanges. */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describeWasm('md-multi-select — virtualized', () => {
  describe('loading', () => {
    it('activates the store and reports the row count', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      await page.waitForChanges();
      expect(vc(page).active).toBe(true);
      expect(vc(page).filteredLength).toBe(500);
    });

    it('does not turn 500 rows into 500 nodes', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      el(page).open = true;
      await page.waitForChanges();
      expect(items(page).length).toBeLessThan(200);
      expect(vc(page).active).toBe(true);
    });

    it('renders every row on the plain path, for contrast', async () => {
      const page = await create('virtualize="never"');
      await el(page).loadOptions(rows(300));
      el(page).open = true;
      await page.waitForChanges();
      expect(vc(page).active).toBe(false);
      expect(items(page)).toHaveLength(300);
    });

    it('reserves the full scroll height with spacers', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      el(page).open = true;
      await page.waitForChanges();
      expect(page.root!.shadowRoot!.querySelector('.md-multi-select__vspacer')).toBeTruthy();
    });

    it('accepts a row factory, so a huge set never exists as JS objects', async () => {
      const page = await create();
      const getRow = jest.fn((i: number) => ({ value: `v${i}`, label: `L${i}` }));
      await el(page).loadOptions({ count: 10_000, getRow });
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(10_000);
    });

    it('replaces a previous dataset', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      await page.waitForChanges();
      await el(page).loadOptions(rows(9));
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(9);
    });

    it('drops the store when handed an empty set', async () => {
      const page = await create();
      await el(page).loadOptions(rows(50));
      await page.waitForChanges();
      expect(vc(page).active).toBe(true);
      await el(page).loadOptions([]);
      await page.waitForChanges();
      // Otherwise the previous rows stay active and rendering, and a consumer
      // cannot clear the list by handing over an empty one.
      expect(vc(page).active).toBe(false);
    });
  });

  describe('filter header', () => {
    it('renders on BOTH paths, unlike md-select', async () => {
      // md-select gates its header on `filterable && virtual`; this component
      // wires the same combobox for the plain-DOM list too and filters it
      // client-side. Worth pinning, because the two look interchangeable.
      const virtual = await create('filterable virtualize="always"');
      await el(virtual).loadOptions(rows(100));
      el(virtual).open = true;
      await virtual.waitForChanges();
      expect(search(virtual)).toBeTruthy();

      const plain = await create('filterable virtualize="never"');
      await el(plain).loadOptions(rows(10));
      el(plain).open = true;
      await plain.waitForChanges();
      expect(search(plain)).toBeTruthy();
    });

    it('filters the plain list synchronously, with no spinner', async () => {
      const page = await create('filterable virtualize="never"');
      await el(page).loadOptions(rows(20));
      el(page).open = true;
      await page.waitForChanges();

      const input = search(page)!;
      input.value = 'Label 1';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();

      // Cheap on this path, so it runs on the keystroke — no debounce, and no
      // spinner to clear afterwards.
      expect(page.root!.shadowRoot!.querySelector('[part="search-spinner"]')).toBeNull();
      expect(items(page).length).toBeLessThan(20);
    });

    it('narrows the list and restores it', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();

      await el(page).setQuery('Label 1');
      await page.waitForChanges();
      // "Label 1" matches 1 and 10-19.
      expect(vc(page).filteredLength).toBe(11);

      await el(page).setQuery('');
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(100);
    });

    it('reports no results for a query that matches nothing', async () => {
      const page = await create('filterable no-results-text="Nothing found"');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();
      await el(page).setQuery('zzzzzzz');
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(0);
    });
  });

  describe('debounced search', () => {
    it('raises the spinner at once and applies the query after the debounce', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();

      const input = search(page)!;
      input.value = 'Label 1';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await page.waitForChanges();

      // Immediately: the spinner is up but the expensive WASM query has not run.
      expect(page.root!.shadowRoot!.querySelector('[part="search-spinner"]')).toBeTruthy();
      expect(vc(page).filteredLength).toBe(100);

      await wait(DEBOUNCE_MS + 60);
      await page.waitForChanges();

      expect(vc(page).filteredLength).toBe(11);
      expect(page.root!.shadowRoot!.querySelector('[part="search-spinner"]')).toBeNull();
    });

    it('collapses a burst of keystrokes into one query', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();

      const input = search(page)!;
      for (const q of ['L', 'La', 'Label 2']) {
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await wait(DEBOUNCE_MS + 60);
      await page.waitForChanges();

      // Only the final query survives — "Label 2" matches 2 and 20-29.
      expect(vc(page).filteredLength).toBe(11);
    });
  });

  describe('selection', () => {
    it('resolves labels for a value far outside the window', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      await page.waitForChanges();
      const labels = await el(page).getLabels(['v400']);
      expect(labels.v400).toBe('Label 400');
    });

    it('keeps a selection through a filter that hides it', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).value = ['v50'];
      el(page).open = true;
      await page.waitForChanges();

      await el(page).setQuery('Label 9');
      await page.waitForChanges();
      // Filtering is a VIEW over the data; it must not deselect anything.
      expect(el(page).value).toEqual(['v50']);
    });

    it('clears every selection on reset', async () => {
      const page = await create();
      await el(page).loadOptions(rows(50));
      el(page).value = ['v1', 'v2'];
      await page.waitForChanges();
      await el(page).reset();
      await page.waitForChanges();
      expect(el(page).value).toEqual([]);
    });
  });
});
