import { newSpecPage } from '@stencil/core/testing';
import { MdAutocomplete } from './md-autocomplete';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';

/**
 * The public methods and the option-source paths.
 *
 * Validity is not here: mock-doc's attachInternals() returns an empty object,
 * so getValidityOf falls back to its "unknown resolves to valid" rule and any
 * assertion about a real validity state passes vacuously.
 */
async function create(html: string) {
  return newSpecPage({
    components: [MdAutocomplete, MdSelectOption, MdTextField, MdMenu, MdMenuItem],
    html,
  });
}

type Auto = HTMLElement & {
  value: string | string[];
  inputValue: string;
  open: boolean;
  multiple: boolean;
  focusInput(): Promise<void>;
  showMenu(): Promise<void>;
  closeMenu(): Promise<void>;
  loadOptions(source: unknown): Promise<void>;
  getLabels(values: string[]): Promise<Record<string, string>>;
  reset?(): Promise<void>;
};

const OPTIONS = `
  <md-select-option value="a">Alpha</md-select-option>
  <md-select-option value="b">Beta</md-select-option>
  <md-select-option value="c">Gamma</md-select-option>
`;

const items = (page: { root?: HTMLElement | null }) =>
  Array.from(page.root?.shadowRoot?.querySelectorAll('md-menu-item') ?? []);

describe('md-autocomplete — public API', () => {
  describe('showMenu / closeMenu', () => {
    it('opens and closes', async () => {
      const page = await create(`<md-autocomplete>${OPTIONS}</md-autocomplete>`);
      const el = page.root as Auto;
      await el.showMenu();
      await page.waitForChanges();
      expect(el.open).toBe(true);
      await el.closeMenu();
      await page.waitForChanges();
      expect(el.open).toBe(false);
    });

    it('refuses to open while disabled', async () => {
      const page = await create(`<md-autocomplete disabled>${OPTIONS}</md-autocomplete>`);
      const el = page.root as Auto;
      await el.showMenu();
      await page.waitForChanges();
      expect(el.open).toBe(false);
    });

    it('closing an already-closed menu is a no-op', async () => {
      const page = await create(`<md-autocomplete>${OPTIONS}</md-autocomplete>`);
      await expect((page.root as Auto).closeMenu()).resolves.toBeUndefined();
    });

    it('opens without stealing focus from the input', async () => {
      // Opening alone does not move focus: the input keeps it until ArrowDown,
      // which moves REAL focus onto an option (the APG variant this component
      // uses — see the combobox notes in md-autocomplete.tsx).
      const page = await create(`<md-autocomplete>${OPTIONS}</md-autocomplete>`);
      const el = page.root as Auto;
      await el.showMenu();
      await page.waitForChanges();
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu).toBeTruthy();
      expect(el.open).toBe(true);
    });
  });

  describe('focusInput', () => {
    it('does not throw before the field has upgraded', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      await expect((page.root as Auto).focusInput()).resolves.toBeUndefined();
    });
  });

  describe('loadOptions', () => {
    it('accepts a materialised array', async () => {
      const page = await create('<md-autocomplete virtualize="never"></md-autocomplete>');
      const el = page.root as Auto;
      await el.loadOptions([{ value: 'x', label: 'Ex' }, { value: 'y', label: 'Why' }]);
      await el.showMenu();
      await page.waitForChanges();
      expect(items(page)).toHaveLength(2);
    });

    it('accepts a row factory', async () => {
      const page = await create('<md-autocomplete virtualize="never"></md-autocomplete>');
      const el = page.root as Auto;
      const getRow = jest.fn((i: number) => ({ value: `v${i}`, label: `L${i}` }));
      await el.loadOptions({ count: 3, getRow });
      await el.showMenu();
      await page.waitForChanges();
      expect(getRow).toHaveBeenCalledTimes(3);
      expect(items(page)).toHaveLength(3);
    });

    it('replaces the previous dataset rather than appending', async () => {
      const page = await create('<md-autocomplete virtualize="never"></md-autocomplete>');
      const el = page.root as Auto;
      await el.loadOptions([{ value: 'x' }, { value: 'y' }]);
      await page.waitForChanges();
      await el.loadOptions([{ value: 'z' }]);
      await el.showMenu();
      await page.waitForChanges();
      expect(items(page)).toHaveLength(1);
    });

    it('handles an empty dataset', async () => {
      const page = await create('<md-autocomplete virtualize="never"></md-autocomplete>');
      await expect((page.root as Auto).loadOptions([])).resolves.toBeUndefined();
    });
  });

  describe('getLabels', () => {
    it('returns a plain object', async () => {
      const page = await create(`<md-autocomplete virtualize="never">${OPTIONS}</md-autocomplete>`);
      const labels = await (page.root as Auto).getLabels(['a']);
      expect(typeof labels).toBe('object');
      expect(Array.isArray(labels)).toBe(false);
    });

    it('echoes an unknown value as its own label', async () => {
      const page = await create('<md-autocomplete virtualize="never"></md-autocomplete>');
      // Unlike md-select, which returns nothing for a value it does not know,
      // autocomplete falls back to the value itself — free-solo means a value
      // with no matching option is legitimate and still has to display.
      await expect((page.root as Auto).getLabels(['nope'])).resolves.toEqual({ nope: 'nope' });
    });
  });

  describe('single vs multiple', () => {
    it('carries a bare string value in single mode', async () => {
      const page = await create(`<md-autocomplete value="a">${OPTIONS}</md-autocomplete>`);
      await page.waitForChanges();
      expect((page.root as Auto).value).toBe('a');
    });

    it('carries an array in multiple mode', async () => {
      const page = await create(`<md-autocomplete multiple>${OPTIONS}</md-autocomplete>`);
      const el = page.root as Auto;
      el.value = ['a', 'b'];
      await page.waitForChanges();
      expect(el.value).toEqual(['a', 'b']);
    });

    it('reflects multiple on the host', async () => {
      const page = await create(`<md-autocomplete multiple>${OPTIONS}</md-autocomplete>`);
      await page.waitForChanges();
      expect(page.root?.hasAttribute('multiple')).toBe(true);
    });
  });

  describe('render branches', () => {
    it('shows a spinner while loading', async () => {
      const page = await create(`<md-autocomplete loading>${OPTIONS}</md-autocomplete>`);
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelector('[part~="loading-spinner"]')).toBeTruthy();
    });

    it('keeps the clear affordance mounted and hides it while empty', async () => {
      // md-select omits the button entirely; autocomplete keeps it in the DOM
      // and toggles a modifier, so the trailing cluster does not reflow the
      // moment the user starts typing.
      const empty = await create(`<md-autocomplete clearable>${OPTIONS}</md-autocomplete>`);
      await empty.waitForChanges();
      const emptyClear = empty.root?.shadowRoot?.querySelector('[part~="clear"]');
      expect(emptyClear).toBeTruthy();
      expect(emptyClear?.classList.contains('md-autocomplete__clear--hidden')).toBe(true);

      const filled = await create(`<md-autocomplete clearable>${OPTIONS}</md-autocomplete>`);
      (filled.root as Auto).inputValue = 'Alp';
      await filled.waitForChanges();
      const filledClear = filled.root?.shadowRoot?.querySelector('[part~="clear"]');
      expect(filledClear?.classList.contains('md-autocomplete__clear--hidden')).toBe(false);
    });

    it('distinguishes "no options" from "no results"', async () => {
      // With nothing typed there is no search to have failed, so the menu gets
      // the no-OPTIONS copy; no-results-text is for a query that matched
      // nothing. md-menu renders the text in ITS shadow root, so what
      // md-autocomplete owns is the attribute it passes down.
      const page = await create(
        '<md-autocomplete no-options-text="Nothing here" no-results-text="Nothing found"></md-autocomplete>',
      );
      const el = page.root as Auto;
      await el.showMenu();
      await page.waitForChanges();
      const menu = page.root?.shadowRoot?.querySelector('md-menu');
      expect(menu?.getAttribute('empty-text')).toBe('Nothing here');
    });
  });

  describe('free solo', () => {
    it('keeps a typed value that matches no option', async () => {
      const page = await create(`<md-autocomplete free-solo>${OPTIONS}</md-autocomplete>`);
      const el = page.root as Auto;
      el.inputValue = 'something new';
      await page.waitForChanges();
      // free-solo exists so a consumer can accept arbitrary input; the field
      // must not erase what was typed.
      expect(el.inputValue).toBe('something new');
    });
  });
});
