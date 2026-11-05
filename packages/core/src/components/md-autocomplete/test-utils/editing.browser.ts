export async function exerciseAutocompleteEditing(supplied?: HTMLElement) {
  const field = (supplied ?? document.querySelector('md-autocomplete')) as HTMLMdAutocompleteElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 90) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await field.componentOnReady(); field.virtualize = 'never'; field.clearable = true;
  field.options = [{ value: 'a', label: 'Apple', supportingText: 'Red fruit' }, { value: 'p', label: 'Pear' }, { value: 'b', label: 'Banana', disabled: true }];
  await tick();
  const root = field.shadowRoot!;
  const input = () => root.querySelector('md-text-field')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const rows = () => Array.from(root.querySelectorAll<HTMLMdMenuItemElement>('md-menu-item'));
  const type = async (text: string) => {
    input().focus(); input().value = text; input().dispatchEvent(new Event('input', { bubbles: true, composed: true })); await tick();
  };
  const key = async (target: Element, key: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true })); await tick(180);
  };
  try {
    await type('red'); check(rows().length === 1 && rows()[0].headline === 'Apple', 'supporting text must participate in filtering');
    rows()[0].click(); await tick(250);
    check(field.value === 'a' && input().value === 'Apple', 'strict selection must commit the key and display its label');
    await type('unmatched'); check(field.value === 'a', 'editing a strict query must not discard the selected value');
    await key(input(), 'Escape'); check(input().value === 'Apple', 'closing a strict query must restore its selected label');
    await key(input(), 'ArrowDown');
    check(root.activeElement === rows()[0], 'Down from the trigger must focus the first enabled option');
    await key(rows()[0], 'p');
    check(field.inputValue === 'Applep', 'printable listbox keys must return typing to the input');
    await key(root.querySelector('[role="listbox"]')!, 'Backspace');
    check(field.inputValue === 'Apple', 'Backspace from the listbox must edit the query');
    await field.closeMenu(); await tick(250);
    root.querySelector<HTMLElement>('[part="clear"]')!.click(); await tick();
    check(field.value === '' && field.inputValue === '', 'clear must reset both committed value and query');
    field.multiple = true; field.freeSolo = true; field.maxSelected = 2; field.chipPosition = 'inline'; await tick();
    await type(' custom '); await key(input(), 'Enter');
    check(JSON.stringify(field.value) === '["custom"]' && input().value === '', 'free solo must trim and commit a chip');
    await type('custom'); await key(input(), 'Enter'); check((field.value as string[]).length === 1, 'free solo must deduplicate an existing value');
    await type('second'); await key(input(), 'Enter');
    await type('third'); await key(input(), 'Enter'); check(JSON.stringify(field.value) === '["custom","second"]', 'maxSelected must reject a third free-solo value');
    await type(''); await key(input(), 'Backspace'); check(JSON.stringify(field.value) === '["custom"]', 'Backspace with an empty query must remove the last chip');
    const chip = root.querySelector('md-chip') as HTMLMdChipElement;
    const remove = chip.shadowRoot!.querySelector<HTMLElement>('[part="remove"]')!;
    remove.click(); await tick(); check((field.value as string[]).length === 0, 'chip remove must update the selection');
    field.softDisabled = true; field.value = ['custom']; await tick();
    root.querySelector<HTMLElement>('[part="clear"]')!.click(); await tick(); check((field.value as string[]).length === 1, 'soft-disabled must preserve selections');
  } finally { field.softDisabled = false; await field.closeMenu(); }
}
export async function exerciseAutocompleteData(supplied?: HTMLElement) {
  const field = (supplied ?? document.querySelector('md-autocomplete')) as HTMLMdAutocompleteElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 90));
  await field.componentOnReady(); field.virtualize = 'never'; field.clearOnBlur = true;
  const input = () => field.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  try {
    field.options = '{bad'; await tick(); await field.showMenu(); await tick();
    check(!field.shadowRoot!.querySelector('md-menu-item'), 'malformed options must render no selectable rows');
    field.options = '{}'; await tick(); check(!field.shadowRoot!.querySelector('md-menu-item'), 'a JSON object cannot become an options array');
    field.options = '[{"value":"a","label":"Apple","description":"Red fruit"},{"value":"p","label":"Pear"}]'; await tick();
    check(field.shadowRoot!.querySelectorAll('md-menu-item').length === 2, 'valid JSON must recover the options list');
    await field.closeMenu(); await tick(); field.value = 'a'; await tick();
    check(input().value === 'Apple', 'a controlled single value must resolve its label');
    field.inputValue = 'uncommitted'; await tick(); input().focus(); input().blur(); await tick();
    check(field.inputValue === 'Apple', 'strict blur must restore the selected label');
    field.multiple = true; await tick(); check(JSON.stringify(field.value) === '["a"]', 'switching to multiple must retain the selected key');
    field.value = ['p', 'a']; await tick(); field.multiple = false; await tick();
    check((field.value as string | string[]) === 'p' && input().value === 'Pear', 'switching to single must keep the first selection and refresh its label');
    await field.loadOptions({ count: 2, getRow: (index: number) => ({ value: `v${index}`, label: `Choice ${index}` }) });
    field.value = 'v0'; await tick();
    check(input().value === 'Choice 0', 'factory options must resolve the controlled selection');
    check(JSON.stringify(await field.getLabels(['v0', 'missing'])) === '{"v0":"Choice 0","missing":"missing"}', 'selected factory options must resolve known labels and preserve unknown keys');
    field.value = ''; field.inputValue = ''; field.filterer = (rows: any[]) => rows.filter((row) => row.value === 'v1');
    await field.showMenu(); await tick();
    check(field.shadowRoot!.querySelectorAll('md-menu-item').length === 1, 'a consumer filter must control visible options');
    field.filterer = undefined; field.options = []; await tick();
    check(!field.shadowRoot!.querySelector('md-menu-item'), 'replacing with an empty dataset must remove stale options');
    field.disabled = true; await field.closeMenu(); await tick(); await field.showMenu(); check(!field.open, 'disabled showMenu must not reopen');
  } finally { field.disabled = false; field.filterer = undefined; await field.closeMenu(); }
}
