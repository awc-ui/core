export async function exerciseSelectFiltering(supplied?: HTMLElement) {
  const select = (supplied ?? document.querySelector('md-select')) as HTMLMdSelectElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 80) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await select.componentOnReady(); select.virtualize = 'never'; select.filterable = true; select.clearable = true;
  await select.loadOptions({ count: 3, getRow: (index: number) => [
    { value: 'a', label: 'Apple', icon: 'nutrition', supportingText: 'Fresh' },
    { value: 'p', label: 'Pear' }, { value: 'b', label: 'Banana', disabled: true },
  ][index] }); await tick();
  const root = select.shadowRoot!;
  const rows = () => Array.from(root.querySelectorAll<HTMLMdMenuItemElement>('md-menu-item'));
  const changes: string[] = [];
  const record = (event: Event) => { if (event.target === select) changes.push((event as CustomEvent).detail); };
  select.addEventListener('mdChange', record);
  try {
    await select.setQuery('pe'); await select.show(); await tick(250);
    const search = root.querySelector<HTMLInputElement>('.md-select__search')!;
    check(search && search.value === 'pe' && rows().length === 1 && rows()[0].headline === 'Pear', 'a query set before opening must mirror into the field and filter rows');
    search.value = 'app'; search.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    check(rows().length === 1 && rows()[0].headline === 'Apple', 'typing must supersede the programmatic query');
    await rows()[0].componentOnReady(); rows()[0].click(); await tick(350);
    check(select.value === 'a' && !select.open && changes.join() === 'a', `selection must commit once and close: ${JSON.stringify({ value: select.value, open: select.open, changes })}`);
    await select.show(); await tick(250); check(rows().length === 3, 'reopening must clear the previous query');
    rows().find((row) => row.headline === 'Banana')!.click(); await tick();
    check(select.value === 'a' && select.open, 'disabled options must not commit or close');
    rows().find((row) => row.headline === 'Apple')!.click(); await tick(250);
    check(!select.open && changes.length === 1, 'reselecting the same value must close without a duplicate change');
    await select.reset(); await tick(); check(select.value === '' && changes.join() === 'a,', 'reset must emit the empty selection once');
    await select.reset(); check(changes.length === 2, 'resetting an empty select must remain silent');
    await select.loadOptions([]); await tick(); await select.show(); await tick(250);
    check(rows().length === 0, 'loading an empty dataset must remove old rows');
    await select.close(); await tick(200); select.disabled = true; await tick(); await select.show();
    check(!select.open, 'disabled select must not open');
  } finally { select.removeEventListener('mdChange', record); select.disabled = false; await select.close(); }
}

export async function exerciseOptionData(supplied?: HTMLElement) {
  const select = (supplied ?? document.querySelector('md-select')) as HTMLMdSelectElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
  await select.componentOnReady();
  const option = select.querySelector('md-select-option') as HTMLMdSelectOptionElement;
  await option.componentOnReady();
  const events: Event[] = [];
  const record = (event: Event) => events.push(event);
  option.addEventListener('mdSelectOptionChange', record);
  try {
    option.label = 'Revised'; option.value = 'revised'; option.disabled = true;
    option.selected = true; option.icon = 'star'; option.iconColor = 'red'; option.supportingText = 'Updated metadata'; await tick();
    check(option.getAttribute('aria-selected') === 'true' && option.getAttribute('aria-disabled') === 'true', 'carrier semantics must reflect selected and disabled state');
    const row = select.shadowRoot!.querySelector('md-menu-item') as HTMLMdMenuItemElement;
    check(row.headline === 'Revised' && row.disabled && row.supportingText === 'Updated metadata', 'parent must reread mutated option metadata');
    check(events.length === 7 && events.every((event) => event.bubbles && event.composed), 'each changed option property must announce a bubbling composed update');
    option.disabled = false; option.selected = false; await tick();
    check(option.getAttribute('aria-disabled') === 'false' && option.getAttribute('aria-selected') === 'false', 'clearing carrier flags must update semantics');
    option.remove(); await tick();
    check(events.length === 10, 'disconnect must announce the removed option');
    select.append(option); await tick();
    check(events.length === 11 && select.shadowRoot!.querySelector('md-menu-item'), 'reconnection must announce and restore the projected row');
  } finally { option.removeEventListener('mdSelectOptionChange', record); }
}
