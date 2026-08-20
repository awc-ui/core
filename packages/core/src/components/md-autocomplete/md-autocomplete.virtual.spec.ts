import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdAutocomplete } from './md-autocomplete';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { isWasmSupported } from '../../utils/wasm-option-store';

/**
 * The virtualized path. Unlike md-select and md-multi-select, this component
 * decides from the DATA it already has — `virtualize="auto"` switches over
 * above a threshold — and packs asynchronously, so a query typed while the
 * pack is still running has to survive and apply to the fresh dataset.
 */
const describeWasm = isWasmSupported() ? describe : describe.skip;
const THRESHOLD = 200;

async function create(attrs = '') {
  const page = await newSpecPage({
    components: [MdAutocomplete, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html: `<md-autocomplete ${attrs}></md-autocomplete>`,
  });
  await page.waitForChanges();
  return page;
}

type Auto = HTMLElement & {
  open: boolean;
  value: string | string[];
  inputValue: string;
  options: Array<{ value: string; label: string }>;
  loadOptions(source: unknown): Promise<void>;
  getLabels(values: string[]): Promise<Record<string, string>>;
};

const el = (page: SpecPage) => page.root as Auto;
const vc = (page: SpecPage) =>
  (page.rootInstance as unknown as { vc: { active: boolean; filteredLength: number } }).vc;
const items = (page: SpecPage) =>
  Array.from(page.root!.shadowRoot!.querySelectorAll('md-menu-item')) as HTMLElement[];

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `Label ${i}` }));

/** Give the async pack a turn to settle. */
const settle = async (page: SpecPage) => {
  await new Promise((r) => setTimeout(r, 30));
  await page.waitForChanges();
};

describeWasm('md-autocomplete — virtualized', () => {
  describe('choosing the path', () => {
    it('stays on plain DOM below the threshold', async () => {
      const page = await create();
      el(page).options = rows(THRESHOLD - 1);
      await settle(page);
      expect(vc(page).active).toBe(false);
    });

    it('switches to the store above it', async () => {
      const page = await create();
      el(page).options = rows(THRESHOLD + 50);
      await settle(page);
      expect(vc(page).active).toBe(true);
      expect(vc(page).filteredLength).toBe(THRESHOLD + 50);
    });

    it('honours virtualize="always" for a small set', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(10);
      await settle(page);
      expect(vc(page).active).toBe(true);
    });

    it('honours virtualize="never" for a large one', async () => {
      const page = await create('virtualize="never"');
      el(page).options = rows(500);
      el(page).open = true;
      await settle(page);
      expect(vc(page).active).toBe(false);
      // Every row is a node on the plain path.
      expect(items(page)).toHaveLength(500);
    });

    it('drops the store when the options go away', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(50);
      await settle(page);
      expect(vc(page).active).toBe(true);
      el(page).options = [];
      await settle(page);
      // An empty set falls back to the plain path rather than leaving the old
      // rows active.
      expect(vc(page).active).toBe(false);
    });

    it('replaces a previous dataset', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(300);
      await settle(page);
      el(page).options = rows(12);
      await settle(page);
      expect(vc(page).filteredLength).toBe(12);
    });
  });

  describe('rendering', () => {
    it('does not turn 500 rows into 500 nodes', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(500);
      el(page).open = true;
      await settle(page);
      expect(items(page).length).toBeLessThan(200);
      expect(vc(page).active).toBe(true);
    });

    it('reserves the full scroll height with spacers', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(500);
      el(page).open = true;
      await settle(page);
      expect(page.root!.shadowRoot!.querySelector('.md-autocomplete__vspacer')).toBeTruthy();
    });
  });

  describe('filtering', () => {
    it('narrows the list to matches', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(100);
      el(page).open = true;
      await settle(page);

      const inst = page.rootInstance as unknown as { vc: { setQuery(q: string): void } };
      inst.vc.setQuery('Label 1');
      await page.waitForChanges();
      // "Label 1" matches 1 and 10-19.
      expect(vc(page).filteredLength).toBe(11);
    });

    it('restores the whole list when the query clears', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(100);
      el(page).open = true;
      await settle(page);

      const inst = page.rootInstance as unknown as { vc: { setQuery(q: string): void } };
      inst.vc.setQuery('Label 1');
      await page.waitForChanges();
      inst.vc.setQuery('');
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(100);
    });
  });

  describe('labels', () => {
    it('resolves a value far outside the rendered window', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(500);
      await settle(page);
      const labels = await el(page).getLabels(['v400']);
      expect(labels.v400).toBe('Label 400');
    });

    it('omits an unknown value on this path — unlike the plain one', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(50);
      await settle(page);
      // The two paths DISAGREE. Plain-DOM getLabels falls back to the value
      // itself (`labelMap.get(v) ?? v`), which is what free-solo relies on to
      // display a value that matches no option; the virtualized branch returns
      // only what the store knows, so the same call yields nothing. Pinned as
      // it behaves today rather than silently changed — with free-solo AND
      // virtualization together, a typed value has no label to render.
      await expect(el(page).getLabels(['not-an-option'])).resolves.toEqual({});
    });
  });

  describe('form reset', () => {
    it('clears the live query as well as the value', async () => {
      const page = await create('virtualize="always"');
      el(page).options = rows(100);
      el(page).open = true;
      await settle(page);

      const inst = page.rootInstance as unknown as {
        vc: { setQuery(q: string): void };
        formResetCallback(): void;
      };
      inst.vc.setQuery('Label 1');
      await page.waitForChanges();
      expect(vc(page).filteredLength).toBe(11);

      inst.formResetCallback();
      await page.waitForChanges();
      // Stale filter state must not survive a reset, or the list comes back
      // still narrowed.
      expect(vc(page).filteredLength).toBe(100);
    });
  });
});
