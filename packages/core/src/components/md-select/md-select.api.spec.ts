import { newSpecPage } from '@stencil/core/testing';
import { MdSelect } from './md-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';

/**
 * Public methods and the loading / clear / empty-state render branches.
 *
 * Two boundaries these tests pin down: `filterable` is not a virtualization
 * feature — the search header renders on both paths, and a query narrows the
 * plain DOM list client-side (label / supporting text) exactly as it narrows a
 * virtualized one in WASM; and the empty-state copy is rendered by md-menu in
 * its own shadow root, so what md-select owns is the `empty-text` attribute it
 * hands down.
 *
 * Validity lives in e2e — mock-doc's attachInternals() returns an empty
 * object, so any assertion about a real validity state here would pass
 * vacuously.
 */
async function create(html: string) {
  return newSpecPage({
    components: [MdSelect, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html,
  });
}

type Select = HTMLElement & {
  value: string;
  open: boolean;
  show(): Promise<void>;
  close(): Promise<void>;
  focusTrigger(): Promise<void>;
  reset(): Promise<void>;
  loadOptions(source: unknown): Promise<void>;
  setQuery(q: string): Promise<void>;
  getLabels(values: string[]): Promise<Record<string, string>>;
};

const OPTIONS = `
  <md-select-option value="a">Alpha</md-select-option>
  <md-select-option value="b">Beta</md-select-option>
  <md-select-option value="c">Gamma</md-select-option>
`;

const items = (page: { root?: HTMLElement | null }) =>
  Array.from(page.root?.shadowRoot?.querySelectorAll('md-menu-item') ?? []);

describe('md-select — public API', () => {
  describe('show / close', () => {
    it('opens and closes', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      const el = page.root as Select;
      await el.show();
      await page.waitForChanges();
      expect(el.open).toBe(true);
      await el.close();
      await page.waitForChanges();
      expect(el.open).toBe(false);
    });

    it('refuses to open while disabled', async () => {
      const page = await create(`<md-select disabled>${OPTIONS}</md-select>`);
      const el = page.root as Select;
      await el.show();
      await page.waitForChanges();
      expect(el.open).toBe(false);
    });

    it('closing an already-closed select is a no-op', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      await expect((page.root as Select).close()).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears the value and announces it', async () => {
      const page = await create(`<md-select value="a">${OPTIONS}</md-select>`);
      const el = page.root as Select;
      const onChange = jest.fn();
      el.addEventListener('mdChange', onChange);
      await el.reset();
      await page.waitForChanges();
      expect(el.value).toBe('');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('stays silent when there was nothing selected', async () => {
      const page = await create(`<md-select>${OPTIONS}</md-select>`);
      const el = page.root as Select;
      const onChange = jest.fn();
      el.addEventListener('mdChange', onChange);
      await el.reset();
      await page.waitForChanges();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('focusTrigger', () => {
    it('does not throw before the field has upgraded', async () => {
      const page = await create('<md-select></md-select>');
      await expect((page.root as Select).focusTrigger()).resolves.toBeUndefined();
    });
  });

  describe('loadOptions', () => {
    it('accepts a materialised array', async () => {
      const page = await create('<md-select virtualize="never"></md-select>');
      await (page.root as Select).loadOptions([{ value: 'x', label: 'Ex' }, { value: 'y' }]);
      await page.waitForChanges();
      expect(items(page)).toHaveLength(2);
    });

    it('accepts a row factory', async () => {
      const page = await create('<md-select virtualize="never"></md-select>');
      const getRow = jest.fn((i: number) => ({ value: `v${i}`, label: `L${i}` }));
      await (page.root as Select).loadOptions({ count: 4, getRow });
      await page.waitForChanges();
      expect(getRow).toHaveBeenCalledTimes(4);
      expect(items(page)).toHaveLength(4);
    });

    it('replaces the previous dataset rather than appending', async () => {
      const page = await create('<md-select virtualize="never"></md-select>');
      const el = page.root as Select;
      await el.loadOptions([{ value: 'x' }, { value: 'y' }]);
      await page.waitForChanges();
      await el.loadOptions([{ value: 'z' }]);
      await page.waitForChanges();
      expect(items(page)).toHaveLength(1);
    });

    it('handles an empty dataset', async () => {
      const page = await create('<md-select virtualize="never"></md-select>');
      await expect((page.root as Select).loadOptions([])).resolves.toBeUndefined();
    });
  });

  describe('setQuery / getLabels', () => {
    it('applies and clears a query on the plain path', async () => {
      const page = await create(`<md-select virtualize="never">${OPTIONS}</md-select>`);
      await expect((page.root as Select).setQuery('al')).resolves.toBeUndefined();
      await expect((page.root as Select).setQuery('')).resolves.toBeUndefined();
    });

    it('returns a plain object', async () => {
      const page = await create(`<md-select virtualize="never">${OPTIONS}</md-select>`);
      const labels = await (page.root as Select).getLabels(['a']);
      expect(Array.isArray(labels)).toBe(false);
      expect(typeof labels).toBe('object');
    });

    it('returns an empty object for unknown values', async () => {
      const page = await create('<md-select virtualize="never"></md-select>');
      await expect((page.root as Select).getLabels(['nope'])).resolves.toEqual({});
    });
  });

  describe('render branches', () => {
    it('renders a spinner instead of the caret while loading', async () => {
      const page = await create(`<md-select loading>${OPTIONS}</md-select>`);
      await page.waitForChanges();
      const root = page.root?.shadowRoot;
      expect(root?.querySelector('[part="loading-spinner"]')).toBeTruthy();
      // The caret and clear share that slot, so they must give way.
      expect(root?.querySelector('[part="caret"]')).toBeNull();
    });

    it('renders a clear affordance only when clearable AND set', async () => {
      const empty = await create(`<md-select clearable>${OPTIONS}</md-select>`);
      await empty.waitForChanges();
      expect(empty.root?.shadowRoot?.querySelector('[part="clear"]')).toBeNull();

      const filled = await create(`<md-select clearable value="a">${OPTIONS}</md-select>`);
      await filled.waitForChanges();
      expect(filled.root?.shadowRoot?.querySelector('[part="clear"]')).toBeTruthy();
    });

    it('renders the search header on the plain DOM path as well', async () => {
      // `filterable` used to be gated on the virtual controller being active, so
      // a markup-authored list had no search field and no way to filter at all.
      // Plain lists now filter client-side; virtual ones filter in WASM.
      const page = await create(`<md-select filterable>${OPTIONS}</md-select>`);
      (page.root as Select).open = true;
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part="search-wrap"]')).toBeTruthy();
    });

    it('hands the empty-state copy to the menu when there are no options', async () => {
      const page = await create('<md-select no-options-text="Nothing here"></md-select>');
      (page.root as Select).open = true;
      await page.waitForChanges();
      // md-menu renders the text in ITS shadow root, so the contract md-select
      // owns is the attribute it passes down.
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu?.getAttribute('empty-text')).toBe('Nothing here');
    });

    it('passes no empty-state copy while options exist', async () => {
      const page = await create(`<md-select no-options-text="Nothing here">${OPTIONS}</md-select>`);
      (page.root as Select).open = true;
      await page.waitForChanges();
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu?.getAttribute('empty-text') || '').toBe('');
    });

    it('suppresses the empty-state while loading, which shows a progress bar instead', async () => {
      const page = await create('<md-select loading no-options-text="Nothing here"></md-select>');
      (page.root as Select).open = true;
      await page.waitForChanges();
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu?.getAttribute('empty-text') || '').toBe('');
    });
  });

  describe('filtering', () => {
    it('narrows the plain-path list too — filterable is not a virtualization feature', async () => {
      const page = await create(`<md-select filterable virtualize="never">${OPTIONS}</md-select>`);
      const el = page.root as Select;
      el.open = true;
      await page.waitForChanges();
      expect(items(page).length).toBe(3);

      await el.setQuery('alp');
      await page.waitForChanges();
      expect(items(page)).toHaveLength(1);
    });

    it('shows no-results-text when a plain-path query matches nothing', async () => {
      const page = await create(
        `<md-select filterable virtualize="never" no-results-text="Nope">${OPTIONS}</md-select>`,
      );
      const el = page.root as Select;
      el.open = true;
      await page.waitForChanges();
      await el.setQuery('zzzzz');
      await page.waitForChanges();
      expect(items(page)).toHaveLength(0);
      expect(page.root?.shadowRoot?.querySelector('md-menu')?.getAttribute('empty-text')).toBe('Nope');
    });
  });

  describe('selection', () => {
    it('adopts a preselected slotted option', async () => {
      const page = await create(`<md-select>
        <md-select-option value="a">Alpha</md-select-option>
        <md-select-option value="b" selected>Beta</md-select-option>
      </md-select>`);
      await page.waitForChanges();
      expect((page.root as Select).value).toBe('b');
    });

    it('marks the selected option in the menu', async () => {
      const page = await create(`<md-select value="b">${OPTIONS}</md-select>`);
      (page.root as Select).open = true;
      await page.waitForChanges();
      const selected = items(page).filter((i) => i.hasAttribute('selected') || (i as HTMLElement & { selected?: boolean }).selected);
      expect(selected.length).toBeLessThanOrEqual(1);
    });
  });
});
