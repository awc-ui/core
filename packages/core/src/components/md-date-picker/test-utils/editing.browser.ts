export async function exerciseDateKeyboard(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-date-picker')) as HTMLMdDatePickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await picker.componentOnReady();
  picker.variant = 'docked'; picker.locale = 'en-US'; picker.value = '2025-06-15';
  picker.min = '2024-01-01'; picker.max = '2026-12-31';
  await tick(); await picker.show(); await tick(300);
  const root = picker.shadowRoot!;
  const day = (date: string) => root.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
  const key = async (from: string, to: string, key: string, shiftKey = false) => {
    const cell = day(from); check(cell, `calendar must render ${from}`);
    cell.focus(); cell.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, composed: true, cancelable: true }));
    await tick(160);
    const target = day(to);
    check(target && (target as HTMLMdButtonElement).groupTabindex === 0, `${key} must move the calendar cursor to ${to}`);
  };
  try {
    await key('2025-06-15', '2025-06-16', 'ArrowRight');
    await key('2025-06-16', '2025-06-15', 'ArrowLeft');
    await key('2025-06-15', '2025-06-22', 'ArrowDown');
    await key('2025-06-22', '2025-06-15', 'ArrowUp');
    await key('2025-06-15', '2025-06-01', 'Home');
    await key('2025-06-01', '2025-06-30', 'End');
    await key('2025-06-30', '2025-07-30', 'PageDown');
    await key('2025-07-30', '2025-06-30', 'PageUp');
    await key('2025-06-30', '2026-06-30', 'PageDown', true);
    await key('2026-06-30', '2025-06-30', 'PageUp', true);
    picker.isDateDisabled = (date: Date) => date.getDate() === 30; await tick();
    day('2025-06-30').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })); await tick();
    check(picker.open && picker.value === '2025-06-15', 'a consumer-disabled date must not commit from Enter');
    await key('2025-06-30', '2025-06-29', 'ArrowLeft');
    day('2025-06-29').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true })); await tick();
    check(picker.value === '2025-06-15' && picker.open, 'Space must stage the date without committing');
    day('2025-06-29').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })); await tick(300);
    check(picker.value === '2025-06-29' && !picker.open, 'Enter must commit the staged date and close');
  } finally { picker.isDateDisabled = undefined; await picker.close(); }
}

export async function exerciseDateMenus(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-date-picker')) as HTMLMdDatePickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 300) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await picker.componentOnReady(); picker.variant = 'docked'; picker.locale = 'en-US';
  picker.value = '2025-06-15'; picker.min = '2024-01-01'; picker.max = '2026-12-31'; await tick(40);
  const root = picker.shadowRoot!;
  const click = async (selector: string) => {
    const element = root.querySelector<HTMLElement>(selector); check(element, `missing date control ${selector}`);
    (element!.shadowRoot?.querySelector<HTMLElement>('button') ?? element!).click(); await tick();
  };
  const pick = async (part: string, label: string) => {
    const row = Array.from(root.querySelectorAll<HTMLMdMenuItemElement>(`[part="${part}"] md-menu-item`)).find((item) => item.headline === label);
    check(row, `missing ${part} option ${label}`);
    const selected = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { picker.removeEventListener('mdMenuSelect', done); reject(new Error(`selection did not finish: ${label}`)); }, 3000);
      const done = () => { clearTimeout(timeout); resolve(); };
      picker.addEventListener('mdMenuSelect', done, { once: true });
    });
    row!.click(); await selected; await tick();
  };
  const events: Array<{ type: string; detail: any }> = [];
  const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent).detail });
  ['mdMenuOpen', 'mdMenuSelect', 'mdViewChange'].forEach((name) => picker.addEventListener(name, record));
  try {
    await picker.show(); await tick();
    await click('[part="month-menu-button"]');
    check(root.querySelectorAll('[part~="month-option"]').length === 12, 'month menu must expose all twelve months');
    await pick('month-menu', 'August');
    check(root.querySelector('[data-date="2025-08-15"]'), 'month selection must render August in the same year');
    check(picker.value === '2025-06-15', 'month navigation must not change the committed date');
    await click('[part="year-menu-button"]');
    check(root.querySelectorAll('[part~="year-option"]').length === 3, 'year list must respect finite min and max years');
    await pick('year-menu', '2026');
    check(root.querySelector('[data-date="2026-08-15"]'), 'year selection must retain the viewed month');
    await click('[part="prev-month-button"]');
    check(root.querySelector('[data-date="2026-07-15"]'), 'previous-month control must move one month');
    await click('[part="next-month-button"]');
    check(root.querySelector('[data-date="2026-08-15"]'), 'next-month control must restore August');
    await picker.close(); await tick();
    picker.variant = 'modal'; await tick(40); await picker.show(); await tick();
    await click('[part="month-toggle"]');
    check(root.querySelector('[part="year-grid"]'), 'modal month heading must reveal the year grid');
    await click('[data-year="2024"]');
    check(root.querySelector('[data-date="2024-06-15"]'), 'modal year selection must preserve the original month');
    check(events.some((entry) => entry.type === 'mdMenuOpen') && events.filter((entry) => entry.type === 'mdMenuSelect').length === 3, 'menu interactions must expose public open and selection events');
  } finally {
    ['mdMenuOpen', 'mdMenuSelect', 'mdViewChange'].forEach((name) => picker.removeEventListener(name, record));
    await picker.close();
  }
}

export async function exerciseDateTyping(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-date-picker')) as HTMLMdDatePickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await picker.componentOnReady(); picker.variant = 'modal-input'; picker.locale = 'en-GB'; picker.dateSeparator = '.';
  picker.value = '2025-06-15'; picker.min = '2025-01-01'; picker.max = '2025-12-31'; await tick();
  const root = picker.shadowRoot!;
  const input = (part = 'field') => root.querySelector(`[part="${part}"]`)!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const type = async (text: string, part = 'field') => {
    const el = input(part); el.focus(); el.value = text; el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })); await tick(300);
  };
  const click = async (part: string) => {
    const host = root.querySelector<HTMLElement>(`[part="${part}"]`)!;
    (host.shadowRoot?.querySelector<HTMLElement>('button') ?? host).click(); await tick(300);
  };
  try {
    await picker.focusInput(); check(input().value === '15.06.2025', 'field must display the locale and configured separator');
    await type('31.02.2025'); check(picker.error && picker.value === '2025-06-15', 'impossible dates must preserve the prior committed value');
    await type('16.06.2025'); check(!picker.error && picker.value === '2025-06-16', 'valid typing must clear errors and commit ISO');
    picker.isDateDisabled = (date: Date) => date.getDate() === 17; await tick();
    await type('17.06.2025'); check(picker.error && picker.value === '2025-06-16', 'consumer-disabled typed dates must be rejected');
    await type(''); check(!picker.error && picker.value === '', 'empty input must clear both value and error');
    picker.value = '2025-06-15'; await tick(); await picker.show(); await tick(300);
    await click('mode-toggle');
    check(root.querySelector('[part="entry-input"]'), 'mode toggle must expose the dialog text entry');
    await type('30.02.2025', 'entry-input'); check(picker.error && picker.open, 'invalid dialog text must keep the dialog open');
    await type('18.06.2025', 'entry-input'); check(picker.value === '2025-06-18' && !picker.open, 'valid dialog Enter must commit and close');
    picker.clearable = true; await tick(); await click('clear-button'); check(picker.value === '', 'clear affordance must clear without opening');
    picker.value = '2025-06-15'; picker.disabled = true; await tick(); await picker.clear(); await picker.show();
    check(picker.value === '2025-06-15' && !picker.open, 'disabled picker must reject imperative clear and opening');
  } finally { picker.disabled = false; picker.isDateDisabled = undefined; await picker.close(); }
}
export async function exerciseDateFormats(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-date-picker')) as HTMLMdDatePickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
  await picker.componentOnReady(); picker.variant = 'modal-input'; picker.min = ''; picker.max = ''; picker.dateSeparator = '/'; await tick();
  const input = () => picker.shadowRoot!.querySelector('[part="field"]')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const enter = async (text: string) => {
    input().focus(); input().value = text; input().dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })); await tick();
  };
  const cases: Array<[string, string, string]> = [
    ['en-US', '06122025', '2025-06-12'], ['en-US', '06172025', '2025-06-17'],
    ['en-US', '17012025', '2025-01-17'], ['en-US', '12062025', '2025-12-06'],
    ['en-GB', '12062025', '2025-06-12'], ['en-US', '6122025', '2025-06-12'],
    ['en-US', '1012025', '2025-10-01'], ['en-GB', '1012025', '2025-01-10'],
    ['en-US', '0112025', '2025-01-01'], ['en-GB', '3/4/2025', '2025-04-03'],
    ['en-US', '2025/6/15', '2025-06-15'], ['en-US', '17/1/2025', '2025-01-17'],
  ];
  for (const [locale, text, expected] of cases) {
    picker.locale = locale; await tick(); await enter(text);
    check(!picker.error && picker.value === expected, `${locale} typed ${text} must commit ${expected}; received ${picker.value}`);
  }
  const before = picker.value;
  for (const text of ['9912025', '17172025', '2/30/2025', '0/5/2025', '32/1/2025', '12345', '2025-02-30', 'June twenty']) {
    await enter(text); check(picker.error && picker.value === before, `invalid ${text} must preserve the committed date`);
  }
  picker.locale = 'de-DE'; picker.dateSeparator = '.'; await tick();
  await enter('01.05.2025'); check(picker.value === '2025-05-01', 'explicit dot separator must follow day-first locale');
  await enter('01/05/2025'); check(picker.error && picker.value === '2025-05-01', 'a different separator must not bypass the configured format');
  await enter('2025-06-15'); check(!picker.error && picker.value === '2025-06-15', 'ISO input must remain accepted with a custom separator');
  picker.min = '2025-06-10'; picker.max = '2025-06-20'; await tick();
  await enter('2025-06-09'); check(picker.error && picker.value === '2025-06-15', 'typed dates before min must be rejected');
  await enter('2025-06-21'); check(picker.error && picker.value === '2025-06-15', 'typed dates after max must be rejected');
  await enter('2025-06-20'); check(!picker.error && picker.value === '2025-06-20', 'inclusive upper bound must be accepted');
}

export async function exerciseDateMenuKeyboard(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-date-picker')) as HTMLMdDatePickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = (ms = 550) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  await picker.componentOnReady(); picker.variant = 'docked'; picker.value = '2025-06-15'; picker.min = '1900-01-01'; picker.max = '2100-12-31'; await tick(50);
  const root = picker.shadowRoot!;
  const key = async (target: Element, key: string, extras: KeyboardEventInit = {}) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...extras })); await tick();
  };
  try {
    await picker.show(); await tick();
    const field = root.querySelector('[part="field"]')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    field.focus(); await key(field, 'm', { shiftKey: true });
    check(root.querySelector('[part="month-menu"]'), 'Shift+M from the trigger must open month navigation');
    const month = root.querySelector<HTMLMdMenuItemElement>('[part="month-menu"] [part*="selected"]')!;
    check(root.activeElement === month, 'month navigation must focus the selected month after bloom');
    await key(month, 'y', { shiftKey: true });
    check(root.querySelector('[part="year-menu"]') && !root.querySelector('[part="month-menu"]'), 'Shift+Y must replace the month menu with the year menu');
    const year = root.querySelector<HTMLMdMenuItemElement>('[part="year-menu"] [part*="selected"]')!;
    check(root.activeElement === year, 'year navigation must focus the selected year');
    const menuRect = root.querySelector('[part="year-menu"]')!.getBoundingClientRect();
    const yearRect = year.getBoundingClientRect();
    check(yearRect.top >= menuRect.top - 1 && yearRect.bottom <= Math.min(menuRect.bottom, window.innerHeight) + 1,
      `the focused year must be visible inside the long menu: ${JSON.stringify({ menu: { top: menuRect.top, bottom: menuRect.bottom }, year: { top: yearRect.top, bottom: yearRect.bottom } })}`);
    await key(year, 'Escape');
    check(picker.open && !root.querySelector('[part="year-menu"]'), 'Escape in a selection menu must return to the calendar without closing the picker');
    const focusedDay = () => Array.from(root.querySelectorAll<HTMLMdButtonElement>('[data-date]')).find((day) => day.groupTabindex === 0)!;
    await key(focusedDay(), 'ArrowDown', { altKey: true });
    check(focusedDay().getAttribute('data-date') === '2025-07-15', 'Alt+Down must provide PageDown month navigation');
    await key(focusedDay(), 'Unidentified', { code: 'PageUp' });
    check(focusedDay().getAttribute('data-date') === '2025-06-15', 'PageUp code must work when the browser key is unidentified');
    picker.outsideClickDismissible = false; await tick(50);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true })); await tick(50);
    check(picker.open, 'outside-dismiss opt-out must retain the open calendar');
    picker.outsideClickDismissible = true; await tick(50);
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true })); await tick();
    check(!picker.open && picker.value === '2025-06-15', 'outside dismissal must discard navigation without changing the value');
  } finally { await picker.close(); }
}
