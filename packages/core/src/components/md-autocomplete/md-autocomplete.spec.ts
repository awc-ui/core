import { newSpecPage } from '@stencil/core/testing';
import { MdAutocomplete } from './md-autocomplete';

async function create(html: string) {
  return newSpecPage({ components: [MdAutocomplete], html });
}

describe('md-autocomplete', () => {
  describe('rendering', () => {
    it('renders host with default classes', async () => {
      const page = await create('<md-autocomplete label="Country"></md-autocomplete>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-autocomplete');
      expect(page.root).toHaveClass('md-autocomplete--filled');
    });

    it('reflects variant + multiple', async () => {
      const page = await create('<md-autocomplete variant="outlined" multiple></md-autocomplete>');
      expect(page.root).toHaveClass('md-autocomplete--outlined');
      expect(page.root).toHaveClass('md-autocomplete--multiple');
    });

    it('renders trigger + menu', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('md-text-field')).toBeTruthy();
      expect(shadow?.querySelector('md-menu')).toBeTruthy();
    });

    it('exposes parts', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="field"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="caret"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="menu"]')).toBeTruthy();
    });
  });

  describe('filtering + options', () => {
    it('renders one md-menu-item per option', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'us', label: 'United States' },
        { value: 'gb', label: 'United Kingdom' },
      ];
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(2);
    });

    it('filters options by input value (case-insensitive substring)', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as {
        options: unknown[];
        inputValue: string;
      };
      root.options = [
        { value: 'us', label: 'United States' },
        { value: 'gb', label: 'United Kingdom' },
        { value: 'de', label: 'Germany' },
      ];
      // Filtering is gated on USER typing (mdInput from the field), so a
      // programmatically-set inputValue alone must NOT filter.
      root.inputValue = 'unit';
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item').length).toBe(3);
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'unit' }));
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(2);
    });

    it('applies a custom filterer when provided', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as {
        options: unknown[];
        inputValue: string;
        filterer: (opts: { label: string; value: string }[], state: { inputValue: string }) =>
          { label: string; value: string }[];
      };
      root.options = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];
      root.filterer = (opts, state) =>
        opts.filter((o) => o.label.startsWith(state.inputValue.toUpperCase().slice(0, 1)));
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'ch' }));
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(1);
    });

    it('respects limit-results', async () => {
      const page = await create('<md-autocomplete limit-results="2"></md-autocomplete>');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: '1', label: 'One' },
        { value: '2', label: 'Two' },
        { value: '3', label: 'Three' },
        { value: '4', label: 'Four' },
      ];
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item');
      expect(items?.length).toBe(2);
    });
  });

  describe('selection', () => {
    it('commits value on selection in single mode', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as {
        options: { value: string; label: string }[];
        value: string;
        inputValue: string;
      };
      root.options = [{ value: 'jp', label: 'Japan' }];
      await page.waitForChanges();
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const item = page.root?.shadowRoot?.querySelector('md-menu-item') as HTMLElement;
      item.dispatchEvent(new CustomEvent('mdClick'));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ detail: 'jp' }));
      expect(root.value).toBe('jp');
      expect(root.inputValue).toBe('Japan');
    });

    it('typing never uncommits the value in strict single mode (space after select)', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string };
      root.options = [{ value: 'fr', label: 'France' }];
      await page.waitForChanges();
      (page.root?.shadowRoot?.querySelector('md-menu-item') as HTMLElement).dispatchEvent(
        new CustomEvent('mdClick'),
      );
      await page.waitForChanges();
      expect(root.value).toBe('fr');
      // A stray keystroke (trailing space) must NOT deselect the option.
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'France ' }));
      await page.waitForChanges();
      expect(root.value).toBe('fr');
      // md-menu-item isn't upgraded in this spec page (it renders aria-selected
      // itself) — assert the reflected `selected` attribute instead.
      const item = page.root?.shadowRoot?.querySelector('md-menu-item');
      expect(item?.hasAttribute('selected')).toBe(true);
    });

    it('toggles selection in multi mode', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as {
        options: unknown[];
        value: string[];
      };
      root.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      await page.waitForChanges();
      const items = page.root?.shadowRoot?.querySelectorAll('md-menu-item') as
        unknown as NodeListOf<HTMLElement>;
      items[0].dispatchEvent(new CustomEvent('mdClick'));
      await page.waitForChanges();
      expect(root.value).toEqual(['a']);
      items[1].dispatchEvent(new CustomEvent('mdClick'));
      await page.waitForChanges();
      expect(root.value).toEqual(['a', 'b']);
      items[0].dispatchEvent(new CustomEvent('mdClick'));
      await page.waitForChanges();
      expect(root.value).toEqual(['b']);
    });

    it('chip-position="inline" slots the chips into the field with wrapping', async () => {
      const page = await create('<md-autocomplete multiple chip-position="inline"></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ];
      root.value = ['a', 'b'];
      await page.waitForChanges();
      const shadow = page.root?.shadowRoot;
      // Chips live in the field's `chips` slot, not below the field…
      const inline = shadow?.querySelector('md-text-field [slot="chips"]');
      expect(inline).toBeTruthy();
      expect(inline?.querySelectorAll('md-chip').length).toBe(2);
      expect(shadow?.querySelector('.md-autocomplete__chips')).toBeNull();
      // …and the field wraps them onto new rows. (md-text-field isn't upgraded
      // in this spec page, so chipsWrap lands as a JS property, not the
      // reflected chips-wrap attribute.)
      const tf = shadow?.querySelector('md-text-field') as unknown as
        (HTMLElement & { chipsWrap?: boolean }) | null;
      // Un-upgraded md-text-field: mock-doc may serialise the prop as a
      // lowercased attribute or a JS property depending on the type.
      expect(tf?.hasAttribute('chipswrap') || tf?.hasAttribute('chips-wrap') || tf?.chipsWrap === true).toBe(true);
    });

    it('renders chips for selected items in multi mode', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [{ value: 'a', label: 'Alpha' }];
      root.value = ['a'];
      await page.waitForChanges();
      const chips = page.root?.shadowRoot?.querySelectorAll('md-chip');
      expect(chips?.length).toBe(1);
      expect(chips?.[0].getAttribute('label')).toBe('Alpha');
    });
  });

  describe('loading + empty states', () => {
    it('renders the loading row when loading is true', async () => {
      const page = await create('<md-autocomplete loading></md-autocomplete>');
      const loading = page.root?.shadowRoot?.querySelector('[part="loading"]');
      expect(loading).toBeTruthy();
    });

    it('presents the busy UI while a dataset is packing (loadOptions in flight)', async () => {
      const page = await create('<md-autocomplete virtualize="always"></md-autocomplete>');
      const root = page.root as unknown as {
        loadOptions: (s: unknown[]) => Promise<void>;
      };
      const rows = Array.from({ length: 500 }, (_, i) => ({ value: `v${i}`, label: `Row ${i}` }));
      // Deterministic in-flight window: hold vc.load open until we release it
      // (the real WASM engine settles instantly in mock-doc).
      let release!: () => void;
      const vc = (page.rootInstance as unknown as {
        vc: { load: () => Promise<boolean>; setFixedRowHeight: () => void; setFilterMode: () => void };
        packing: boolean;
      }).vc;
      vc.setFixedRowHeight = () => undefined;
      vc.setFilterMode = () => undefined;
      vc.load = () => new Promise<boolean>((res) => (release = () => res(true)));
      const pending = root.loadOptions(rows); // NOT awaited — packing in flight
      // Two flushes: the @Method dispatch itself lands on the queue, so the
      // packing state flips after the first flush.
      await page.waitForChanges();
      await page.waitForChanges();
      // Busy UI while the WASM store loads…
      expect((page.rootInstance as unknown as { packing: boolean }).packing).toBe(true);
      expect(page.root?.shadowRoot?.querySelector('[part="loading-spinner"]')).toBeTruthy();
      expect(page.root?.getAttribute('aria-busy')).toBe('true');
      release();
      await pending;
      await page.waitForChanges();
      // …and it clears once the rows are ready (or the load settles).
      expect(page.root?.shadowRoot?.querySelector('[part="loading-spinner"]')).toBeNull();
      expect(page.root?.getAttribute('aria-busy')).toBe('false');
    });

    it('loading replaces the clear/caret cluster with the trigger spinner', async () => {
      const page = await create('<md-autocomplete loading clearable input-value="x"></md-autocomplete>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="loading-spinner"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="caret"]')).toBeNull();
      // The clear button STAYS (hidden + inert) so the trailing cluster — and
      // the field width — is identical across idle/busy/loaded states.
      const clear = shadow?.querySelector('[part="clear"]');
      expect(clear).toBeTruthy();
      expect(clear?.classList.contains('md-autocomplete__clear--hidden')).toBe(true);
      expect(clear?.getAttribute('aria-hidden')).toBe('true');
      // aria-busy conveys the busy state on the host.
      expect(page.root?.getAttribute('aria-busy')).toBe('true');
    });

    it('shows no-results-text for a filter miss, no-options-text for an empty dataset', async () => {
      const page = await create(
        '<md-autocomplete no-options-text="Nothing here" no-results-text="No match"></md-autocomplete>',
      );
      const menu = () => page.root?.shadowRoot?.querySelector('md-menu');
      // Empty dataset → no-options-text.
      await page.waitForChanges();
      expect(menu()?.getAttribute('empty-text')).toBe('Nothing here');
      // Non-empty dataset + non-matching TYPED query → no-results-text.
      (page.root as unknown as { options: unknown[] }).options = [{ value: 'a', label: 'A' }];
      await page.waitForChanges();
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'zzzzzz' }));
      await page.waitForChanges();
      expect(menu()?.getAttribute('empty-text')).toBe('No match');
    });
  });

  describe('accessibility', () => {
    it('exposes aria-haspopup but NO host aria-expanded (unsupported on a generic host)', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      expect(page.root?.getAttribute('aria-haspopup')).toBe('listbox');
      expect(page.root?.getAttribute('aria-expanded')).toBeNull();
    });

    it('promotes the real textbox to a combobox via md-text-field', async () => {
      const page = await create('<md-autocomplete label="Country"></md-autocomplete>');
      const field = page.root?.shadowRoot?.querySelector('md-text-field');
      // The role has to land on the element AT reads — the input md-text-field
      // renders — so it is handed over as a prop, not set on this host.
      // (md-text-field is not registered in this spec page, so Stencil writes
      // the props as lowercased attributes rather than element properties.)
      expect(field?.getAttribute('inputrole')).toBe('combobox');
      expect(field?.getAttribute('inputariaautocomplete')).toBe('list');
      expect(field?.hasAttribute('inputexpanded')).toBe(false);
    });

    it('tracks the popup state in the combobox expanded flag', async () => {
      const page = await create('<md-autocomplete label="Country"></md-autocomplete>');
      const field = () => page.root?.shadowRoot?.querySelector('md-text-field');
      expect(field()?.hasAttribute('inputexpanded')).toBe(false);
      (page.root as unknown as { open: boolean }).open = true;
      await page.waitForChanges();
      expect(field()?.hasAttribute('inputexpanded')).toBe(true);
    });

    it('exposes the dropdown as a named listbox of options', async () => {
      const page = await create('<md-autocomplete label="Country" multiple></md-autocomplete>');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'us', label: 'United States' },
      ];
      await page.waitForChanges();
      const listbox = page.root?.shadowRoot?.querySelector('[role="listbox"]');
      expect(listbox?.getAttribute('aria-label')).toBe('Country');
      expect(listbox?.getAttribute('aria-multiselectable')).toBe('true');
      const item = listbox?.querySelector('md-menu-item');
      expect(item?.getAttribute('presentation')).toBe('option');
    });

    it('normalises the legacy `description` alias to supporting-text', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      (page.root as unknown as { options: unknown[] }).options = [
        { value: 'a', label: 'Alpha', description: 'first letter' },
      ];
      await page.waitForChanges();
      const item = page.root?.shadowRoot?.querySelector('md-menu-item');
      expect(item?.getAttribute('supporting-text')).toBe('first letter');
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdAutocomplete],
        html: `<div dir="rtl"><md-autocomplete></md-autocomplete></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  describe('free-solo', () => {
    it('single: Enter commits the typed text and closes', async () => {
      const page = await create('<md-autocomplete free-solo></md-autocomplete>');
      const root = page.root as unknown as { value: string; open: boolean };
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'hello' }));
      await page.waitForChanges();
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect(root.value).toBe('hello');
      expect(root.open).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('multi: Enter appends, dedupes, and respects max-selected', async () => {
      const page = await create('<md-autocomplete free-solo multiple max-selected="2"></md-autocomplete>');
      const root = page.root as unknown as { value: string[]; inputValue: string };
      const spy = jest.fn();
      page.root?.addEventListener('mdChange', spy);
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      const type = (t: string) => field.dispatchEvent(new CustomEvent('mdInput', { detail: t }));
      const enter = () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      type('a'); enter();
      await page.waitForChanges();
      expect(root.value).toEqual(['a']);
      expect(root.inputValue).toBe('');
      type('a'); enter(); // dedupe — no re-commit
      await page.waitForChanges();
      expect(root.value).toEqual(['a']);
      expect(spy).toHaveBeenCalledTimes(1);
      type('b'); enter();
      await page.waitForChanges();
      expect(root.value).toEqual(['a', 'b']);
      type('c'); enter(); // blocked at the cap
      await page.waitForChanges();
      expect(root.value).toEqual(['a', 'b']);
      expect(root.inputValue).toBe('c');
    });

    it('whitespace-only input never commits', async () => {
      const page = await create('<md-autocomplete free-solo></md-autocomplete>');
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: '   ' }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await page.waitForChanges();
      expect((page.root as unknown as { value: string }).value).toBe('');
    });
  });

  describe('resync on close (strict single)', () => {
    it('selection resets the typing gate immediately (before mdClose lands)', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[] };
      root.options = [
        { value: 'us', label: 'United States' },
        { value: 'gb', label: 'United Kingdom' },
        { value: 'de', label: 'Germany' },
      ];
      await page.waitForChanges();
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'unit' }));
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item').length).toBe(2);
      (page.root?.shadowRoot?.querySelector('md-menu-item') as HTMLElement).dispatchEvent(
        new CustomEvent('mdClick'),
      );
      await page.waitForChanges();
      // NO mdClose dispatched — the gate must already be reset by the pick.
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item').length).toBe(3);
    });

    it('snaps the input back to the committed label and resets the typing gate', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string; inputValue: string };
      root.options = [
        { value: 'fr', label: 'France' },
        { value: 'de', label: 'Germany' },
      ];
      await page.waitForChanges();
      (page.root?.shadowRoot?.querySelector('md-menu-item') as HTMLElement).dispatchEvent(
        new CustomEvent('mdClick'),
      );
      await page.waitForChanges();
      expect(root.inputValue).toBe('France');
      // Type a diverging filter (menu opens, list filters)…
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'Germ' }));
      await page.waitForChanges();
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item').length).toBe(1);
      // …then the popup closes: input snaps back, gate resets → full list again.
      page.root?.shadowRoot?.querySelector('md-menu')?.dispatchEvent(new CustomEvent('mdClose'));
      await page.waitForChanges();
      expect(root.inputValue).toBe('France');
      expect(root.value).toBe('fr');
      expect(page.root?.shadowRoot?.querySelectorAll('md-menu-item').length).toBe(2);
    });

    it('leaves the input untouched on close in multiple / free-solo modes', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; inputValue: string };
      root.options = [{ value: 'a', label: 'Alpha' }];
      await page.waitForChanges();
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'Al' }));
      await page.waitForChanges();
      page.root?.shadowRoot?.querySelector('md-menu')?.dispatchEvent(new CustomEvent('mdClose'));
      await page.waitForChanges();
      expect(root.inputValue).toBe('Al');
    });
  });

  describe('keyboard: Backspace chip-pop', () => {
    it('removes the last chip when the multi input is empty', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      root.value = ['a', 'b'];
      await page.waitForChanges();
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      await page.waitForChanges();
      expect(root.value).toEqual(['a']);
      expect(page.root?.shadowRoot?.querySelectorAll('md-chip').length).toBe(1);
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      await page.waitForChanges();
      expect(root.value).toEqual([]);
    });

    it('does NOT pop while the input has text', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string[] };
      root.options = [{ value: 'a', label: 'A' }];
      root.value = ['a'];
      await page.waitForChanges();
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new CustomEvent('mdInput', { detail: 'x' }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      await page.waitForChanges();
      expect(root.value).toEqual(['a']);
    });
  });

  describe('clear action', () => {
    it('clears value + input, emits mdClear/mdChange/mdInput, and hides when empty', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string; inputValue: string };
      root.options = [{ value: 'jp', label: 'Japan' }];
      await page.waitForChanges();
      (page.root?.shadowRoot?.querySelector('md-menu-item') as HTMLElement).dispatchEvent(
        new CustomEvent('mdClick'),
      );
      await page.waitForChanges();
      const clearSpy = jest.fn(); const changeSpy = jest.fn(); const inputSpy = jest.fn();
      page.root?.addEventListener('mdClear', clearSpy);
      page.root?.addEventListener('mdChange', changeSpy);
      page.root?.addEventListener('mdInput', inputSpy);
      const clear = page.root?.shadowRoot?.querySelector('[part="clear"]') as HTMLElement;
      expect(clear.classList.contains('md-autocomplete__clear--hidden')).toBe(false);
      clear.dispatchEvent(new MouseEvent('click', { bubbles: false }));
      await page.waitForChanges();
      expect(root.value).toBe('');
      expect(root.inputValue).toBe('');
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(changeSpy).toHaveBeenCalledTimes(1);
      expect(inputSpy).toHaveBeenCalled();
      // Space stays reserved; the button is merely hidden + inert.
      expect(clear.classList.contains('md-autocomplete__clear--hidden')).toBe(true);
      expect(clear.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('disabled guards', () => {
    it('disabled: pointer + keyboard never open; showMenu() is a no-op', async () => {
      const page = await create('<md-autocomplete disabled></md-autocomplete>');
      const root = page.root as unknown as { open: boolean; showMenu: () => Promise<void> };
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();
      expect(root.open).toBe(false);
      await root.showMenu();
      await page.waitForChanges();
      expect(root.open).toBe(false);
    });

    it('soft-disabled: interaction guarded, but programmatic showMenu still works', async () => {
      const page = await create('<md-autocomplete soft-disabled></md-autocomplete>');
      const root = page.root as unknown as { open: boolean; showMenu: () => Promise<void> };
      const field = page.root?.shadowRoot?.querySelector('md-text-field') as HTMLElement;
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      await page.waitForChanges();
      expect(root.open).toBe(false);
      await root.showMenu();
      await page.waitForChanges();
      expect(root.open).toBe(true);
    });
  });

  describe('labels', () => {
    it('getLabels resolves known labels and falls back to the raw value', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as {
        options: unknown[]; value: string[]; getLabels: (v: string[]) => Promise<Record<string, string>>;
      };
      root.options = [{ value: 'a', label: 'Alpha' }];
      root.value = ['a'];
      await page.waitForChanges();
      expect(await root.getLabels(['a', 'ghost'])).toEqual({ a: 'Alpha', ghost: 'ghost' });
    });

    it('chip labels survive a dataset swap (labelMap persistence)', async () => {
      const page = await create('<md-autocomplete multiple></md-autocomplete>');
      const root = page.root as unknown as {
        options: unknown[]; value: string[]; getLabels: (v: string[]) => Promise<Record<string, string>>;
      };
      root.options = [{ value: 'a', label: 'Alpha' }];
      root.value = ['a'];
      await page.waitForChanges();
      root.options = [{ value: 'b', label: 'Beta' }]; // 'a' gone from the dataset
      await page.waitForChanges();
      expect((await root.getLabels(['a'])).a).toBe('Alpha');
    });
  });

  describe('runtime prop flips', () => {
    it('multiple flip reshapes the value in both directions', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as { value: string | string[]; multiple: boolean };
      root.value = 'x';
      await page.waitForChanges();
      root.multiple = true;
      await page.waitForChanges();
      expect(root.value).toEqual(['x']);
      root.multiple = false;
      await page.waitForChanges();
      expect(root.value).toBe('x');
    });

    it('programmatic single value reflects its label in the input while closed', async () => {
      const page = await create('<md-autocomplete></md-autocomplete>');
      const root = page.root as unknown as { options: unknown[]; value: string; inputValue: string };
      root.options = [{ value: 'de', label: 'Germany' }];
      await page.waitForChanges();
      root.value = 'de';
      await page.waitForChanges();
      expect(root.inputValue).toBe('Germany');
    });
  });

});
