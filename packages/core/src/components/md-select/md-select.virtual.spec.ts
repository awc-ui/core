import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdSelect } from './md-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { isWasmSupported } from '../../utils/wasm-option-store';

/**
 * The virtualized path — the WASM-backed store, the windowed listbox, and the
 * filter header that only exists there.
 *
 * This is the larger half of md-select and had no coverage. I had previously
 * assumed it was unreachable from a spec; it is not. Node supplies WebAssembly
 * and the store loads for real, exactly as the virtualization suite already
 * relies on.
 */
const describeWasm = isWasmSupported() ? describe : describe.skip;

async function create(attrs = 'virtualize="always"') {
  const page = await newSpecPage({
    components: [MdSelect, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html: `<md-select ${attrs}></md-select>`,
  });
  await page.waitForChanges();
  return page;
}

type Select = HTMLElement & {
  open: boolean;
  value: string;
  loadOptions(source: unknown): Promise<void>;
  setQuery(q: string): Promise<void>;
  getLabels(values: string[]): Promise<Record<string, string>>;
  reset(): Promise<void>;
};

const el = (page: SpecPage) => page.root as Select;
const vc = (page: SpecPage) =>
  (page.rootInstance as unknown as { vc: { active: boolean; filteredLength: number } }).vc;
const items = (page: SpecPage) =>
  Array.from(page.root!.shadowRoot!.querySelectorAll('md-menu-item')) as HTMLElement[];
const search = (page: SpecPage) =>
  page.root!.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement | null;

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Label ${i}` }));

describeWasm('md-select — virtualized', () => {
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
      // The point of the whole path. The rendered WINDOW is empty here because
      // the controller attaches to md-menu's scroll viewport, which needs real
      // layout — but the plain path below renders all 500, so the contrast is
      // the assertion that matters.
      expect(items(page).length).toBeLessThan(200);
      expect(vc(page).active).toBe(true);
    });

    it('reserves the full scroll height with spacers', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      el(page).open = true;
      await page.waitForChanges();
      // Without these the scrollbar would only span the rendered window.
      expect(page.root!.shadowRoot!.querySelector('.md-select__vspacer')).toBeTruthy();
    });

    it('accepts a row factory, so a huge set never exists as JS objects', async () => {
      const page = await create();
      const getRow = jest.fn((i: number) => ({ value: `v${i}`, label: `L${i}` }));
      await el(page).loadOptions({ count: 10_000, getRow });
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(10_000);
    });

    it('falls back to the plain path when virtualization is off', async () => {
      const page = await create('virtualize="never"');
      await el(page).loadOptions(rows(500));
      el(page).open = true;
      await page.waitForChanges();
      expect(vc(page).active).toBe(false);
      // Every row is a node on the plain path.
      expect(items(page)).toHaveLength(500);
    });

    it('replaces a previous dataset', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      await page.waitForChanges();
      await el(page).loadOptions(rows(7));
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(7);
    });
  });

  describe('filter header', () => {
    it('renders on both paths — only the filtering engine differs', async () => {
      const virtual = await create('filterable virtualize="always"');
      await el(virtual).loadOptions(rows(100));
      el(virtual).open = true;
      await virtual.waitForChanges();
      expect(search(virtual)).toBeTruthy();

      const plain = await create('filterable virtualize="never"');
      await el(plain).loadOptions(rows(10));
      el(plain).open = true;
      await plain.waitForChanges();
      // The plain path filters the rendered options client-side rather than in
      // the WASM engine, but it is the same search field and the same prop.
      expect(search(plain)).toBeTruthy();
    });

    it('is a combobox pointing at the listbox', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();
      const input = search(page)!;
      expect(input.getAttribute('role')).toBe('combobox');
      expect(input.getAttribute('aria-expanded')).toBe('true');
      // The listbox wrapper is rendered in md-select's OWN shadow root so this
      // IDREF resolves — the menu surface is only presentational.
      const controls = input.getAttribute('aria-controls')!;
      expect(page.root!.shadowRoot!.querySelector(`#${controls}`)).toBeTruthy();
    });

    it('narrows the list as the query is typed', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();

      await el(page).setQuery('Label 1');
      await page.waitForChanges();

      // "Label 1" matches 1 and 10-19.
      expect(vc(page).filteredLength).toBe(11);
    });

    it('restores the full list when the query is cleared', async () => {
      const page = await create('filterable');
      await el(page).loadOptions(rows(100));
      el(page).open = true;
      await page.waitForChanges();
      await el(page).setQuery('Label 1');
      await page.waitForChanges();
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
      const menu = page.root!.shadowRoot!.querySelector('md-menu');
      expect(menu?.getAttribute('empty-text')).toBe('Nothing found');
    });
  });

  describe('values', () => {
    it('resolves labels through the store, including outside the window', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      await page.waitForChanges();
      // Row 400 is nowhere near the rendered window; the store still knows it.
      const labels = await el(page).getLabels(['v400']);
      expect(labels.v400).toBe('Label 400');
    });

    it('shows the selected label in the trigger', async () => {
      const page = await create();
      await el(page).loadOptions(rows(500));
      el(page).value = 'v250';
      await page.waitForChanges();
      // The label is handed down as a PROPERTY, not an attribute.
      const field = page.root!.shadowRoot!.querySelector('md-text-field') as HTMLElement & { value?: string };
      expect(field?.value).toBe('Label 250');
    });

    it('clears back to empty on reset', async () => {
      const page = await create();
      await el(page).loadOptions(rows(50));
      el(page).value = 'v10';
      await page.waitForChanges();
      await el(page).reset();
      await page.waitForChanges();
      expect(el(page).value).toBe('');
    });
  });

  describe('teardown', () => {
    it('drops the provider when the dataset goes away', async () => {
      const page = await create();
      await el(page).loadOptions(rows(50));
      await page.waitForChanges();
      expect(vc(page).active).toBe(true);
      await el(page).loadOptions([]);
      await page.waitForChanges();
      // An empty set is not worth virtualizing.
      expect(vc(page).active).toBe(false);
    });
  });
});
