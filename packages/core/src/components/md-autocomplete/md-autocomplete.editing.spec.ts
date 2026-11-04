import { newSpecPage } from '@stencil/core/testing';
import { MdAutocomplete } from './md-autocomplete';
import { MdTextField } from '../md-text-field/md-text-field';

describe('md-autocomplete editable listbox', () => {
  it('connects the actual textbox to the open listbox through ARIA element reflection and clears it on close', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete, MdTextField], html: '<md-autocomplete label="Produce"></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    host.options = [{ value: 'a', label: 'Apple' }]; await page.waitForChanges();
    const field = host.shadowRoot!.querySelector('md-text-field') as HTMLMdTextFieldElement;
    const input = await field.getInputElement();
    let references: Element[] | null = null;
    const writes = jest.fn((value: Element[] | null) => { references = value; });
    // mock-doc lacks the browser's ARIA element-reference property. Model only
    // that platform seam; the component and textbox are both real Stencil views.
    Object.defineProperty(input!, 'ariaControlsElements', { configurable: true, get: () => references, set: writes });
    await host.showMenu(); await page.waitForChanges();
    expect(references).toEqual([host.shadowRoot!.querySelector('[role="listbox"]')]);
    const count = writes.mock.calls.length;
    host.label = 'Updated produce'; await page.waitForChanges();
    expect(writes).toHaveBeenCalledTimes(count);
    await host.closeMenu(); await page.waitForChanges(); expect(references).toBeNull();
  });
  it('accepts JSON option attributes and recovers from invalid or non-array datasets', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete virtualize="never"></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      host.options = JSON.stringify([{ value: 'a', label: 'Apple', description: 'Red fruit', icon: 'nutrition', iconColor: 'red' }]); await page.waitForChanges();
      const row = host.shadowRoot!.querySelector('md-menu-item')!;
      expect(row.getAttribute('headline')).toBe('Apple'); expect(row.getAttribute('supporting-text')).toBe('Red fruit');
      host.options = 'not JSON'; await page.waitForChanges();
      expect(host.shadowRoot!.querySelectorAll('md-menu-item')).toHaveLength(0); expect(warning).toHaveBeenCalledTimes(1);
      host.options = '{}'; await page.waitForChanges(); expect(host.shadowRoot!.querySelectorAll('md-menu-item')).toHaveLength(0);
      host.options = ' '; await page.waitForChanges(); expect(host.shadowRoot!.querySelectorAll('md-menu-item')).toHaveLength(0);
      await host.loadOptions({ count: 1, getRow: () => ({ value: 'p', label: 'Pear' }) }); await page.waitForChanges();
      expect(host.shadowRoot!.querySelector('md-menu-item')!.getAttribute('headline')).toBe('Pear');
    } finally { warning.mockRestore(); }
  });

  it('limits free-solo chips, ignores duplicate commits, removes tokens and supports single free-solo values', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete multiple free-solo max-selected="1" chip-position="inline"></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    host.value = []; await page.waitForChanges();
    const field = () => host.shadowRoot!.querySelector('md-text-field')!;
    const enter = async (value: string) => {
      field().dispatchEvent(new CustomEvent('mdInput', { detail: value }));
      field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await page.waitForChanges();
    };
    await enter('  '); expect(host.value).toEqual([]);
    await enter('custom'); expect(host.value).toEqual(['custom']);
    await enter('custom'); expect(host.value).toEqual(['custom']);
    await enter('second'); expect(host.value).toEqual(['custom']);
    const chip = host.shadowRoot!.querySelector('md-chip')!;
    host.softDisabled = true; await page.waitForChanges(); chip.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true, cancelable: true }));
    expect(host.value).toEqual(['custom']);
    host.softDisabled = false; await page.waitForChanges(); chip.dispatchEvent(new CustomEvent('mdRemove', { bubbles: true, cancelable: true })); await page.waitForChanges();
    expect(host.value).toEqual([]);
    host.multiple = false; await page.waitForChanges(); await enter(' single ');
    expect(host.value).toBe('single'); expect(host.open).toBe(false);
  });

  it('keeps multi-option checks synchronized when maxSelected rejects a pick and when an existing pick is toggled off', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete multiple max-selected="1"></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    host.options = [{ value: 'a', label: 'Apple' }, { value: 'p', label: 'Pear' }, { value: 'b', label: 'Banana', disabled: true }]; await page.waitForChanges();
    const pick = async (index: number) => {
      const row = host.shadowRoot!.querySelectorAll('md-menu-item')[index] as HTMLMdMenuItemElement;
      row.selected = true;
      row.dispatchEvent(new CustomEvent('mdClick', { bubbles: true, composed: true })); await page.waitForChanges(); return row;
    };
    await pick(0); expect(host.value).toEqual(['a']);
    expect((await pick(1)).selected).toBe(false); expect(host.value).toEqual(['a']);
    await pick(2); expect(host.value).toEqual(['a']);
    await pick(0); expect(host.value).toEqual([]);
  });
  it('redirects listbox typing and Backspace to filtering while leaving navigation and shortcuts alone', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete label="Fruit"></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    host.options = [{ value: 'apple', label: 'Apple' }, { value: 'pear', label: 'Pear' }];
    await page.waitForChanges();
    const input = jest.fn(); host.addEventListener('mdInput', input);
    const list = () => host.shadowRoot!.querySelector('[role="listbox"]')!;
    const key = async (key: string, options: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
      list().dispatchEvent(event); await page.waitForChanges(); return event;
    };
    expect((await key('p')).defaultPrevented).toBe(true);
    expect(host.inputValue).toBe('p');
    await key('e');
    expect(host.inputValue).toBe('pe');
    expect(host.shadowRoot!.querySelectorAll('md-menu-item').length).toBe(1);
    expect(host.shadowRoot!.querySelector('md-menu-item')!.getAttribute('headline')).toBe('Pear');
    await key('Backspace'); expect(host.inputValue).toBe('p');
    expect(host.shadowRoot!.querySelectorAll('md-menu-item').length).toBe(2);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) expect((await key('x', { [modifier]: true })).defaultPrevented).toBe(false);
    expect((await key('Tab')).defaultPrevented).toBe(false);
    expect(host.inputValue).toBe('p');
    expect(input.mock.calls.map(([event]) => event.detail)).toEqual(['p', 'pe', 'p']);
  });

  it('resynchronizes a strict label on blur and clears single or multiple values through the clear control', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete clearable clear-on-blur></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    host.options = [{ value: 'apple', label: 'Apple' }]; host.value = 'apple';
    await page.waitForChanges();
    const field = () => host.shadowRoot!.querySelector('md-text-field')!;
    host.inputValue = 'uncommitted'; await page.waitForChanges();
    field().dispatchEvent(new Event('blur')); await page.waitForChanges();
    expect(host.inputValue).toBe('Apple');
    const cleared = jest.fn(); host.addEventListener('mdClear', cleared);
    const clear = () => host.shadowRoot!.querySelector<HTMLElement>('[part="clear"]')!.click();
    host.softDisabled = true; await page.waitForChanges(); clear(); await page.waitForChanges();
    expect(host.value).toBe('apple'); expect(cleared).not.toHaveBeenCalled();
    host.softDisabled = false; await page.waitForChanges(); clear(); await page.waitForChanges();
    expect(host.value).toBe(''); expect(host.inputValue).toBe('');
    host.multiple = true; host.value = ['apple']; await page.waitForChanges();
    expect(host.shadowRoot!.querySelector('[part="chips"]')).not.toBeNull();
    clear(); await page.waitForChanges();
    expect(host.value).toEqual([]); expect(cleared).toHaveBeenCalledTimes(2);
  });

  it('reshapes the controlled value when switching between single and multiple selection', async () => {
    const page = await newSpecPage({ components: [MdAutocomplete], html: '<md-autocomplete></md-autocomplete>' });
    const host = page.root as HTMLMdAutocompleteElement;
    host.value = 'first'; await page.waitForChanges(); host.multiple = true; await page.waitForChanges();
    expect(host.value).toEqual(['first']);
    host.value = ['first', 'second']; await page.waitForChanges(); host.multiple = false; await page.waitForChanges();
    expect(host.value).toBe('first');
    host.value = ''; await page.waitForChanges(); host.multiple = true; await page.waitForChanges();
    expect(host.value).toEqual([]);
    host.multiple = false; await page.waitForChanges(); expect(host.value).toBe('');
  });
});
