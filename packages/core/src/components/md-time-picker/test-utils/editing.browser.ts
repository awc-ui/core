export async function exerciseTimeEditing(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-time-picker')) as HTMLMdTimePickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
  await picker.componentOnReady(); picker.format = '24h'; picker.variant = 'input'; picker.value = '23:55'; picker.minuteStep = 5;
  await tick(); await picker.show(); await tick();
  const root = picker.shadowRoot!;
  const input = (part: string) => root.querySelector<HTMLInputElement>(`[part="input-${part}"]`)!;
  const key = async (target: Element, key: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true })); await tick();
  };
  const type = async (part: string, value: string) => {
    input(part).focus(); input(part).value = value;
    input(part).dispatchEvent(new Event('input', { bubbles: true })); await tick();
  };
  const click = async (part: string) => {
    const target = root.querySelector<HTMLElement>(`[part="${part}"]`)!;
    (target.shadowRoot?.querySelector<HTMLElement>('button') ?? target).click(); await tick();
  };
  try {
    await key(input('hour'), 'ArrowUp'); check(input('hour').value === '0', '24h hour stepping must wrap at midnight');
    await key(input('hour'), 'ArrowDown'); check(input('hour').value === '23', '24h reverse stepping must wrap to 23');
    await key(input('minute'), 'ArrowUp'); check(input('minute').value === '00', 'minute stepping must wrap at 60');
    await key(input('minute'), 'ArrowDown'); check(input('minute').value === '55', 'minute reverse stepping must use minuteStep');
    await type('hour', '99'); await type('minute', '7x2');
    check(input('hour').getAttribute('aria-invalid') === 'true' && input('minute').getAttribute('aria-invalid') === 'true', 'invalid buffers must expose separate errors');
    await click('confirm-button'); check(picker.open && picker.value === '23:55', 'invalid input must not commit stale draft values');
    await type('hour', '07'); input('hour').blur(); await tick();
    check(input('hour').value === '07', 'a valid hour must not be overwritten while the minute is invalid');
    await type('minute', '12'); await key(input('minute'), 'ArrowUp');
    check(input('minute').value === '15', 'minute arrows must snap a non-grid value before stepping');
    await key(input('minute'), 'Enter'); check(!picker.open && picker.value === '07:15', 'Enter must commit both valid buffers');
    picker.format = '12h'; picker.value = '12:15'; await tick(); await picker.show(); await tick();
    await key(root.querySelector('[part="period-pm"]')!, 'Home');
    check(root.querySelector('[part="period-am"]')!.getAttribute('aria-checked') === 'true', 'Home must select AM');
    await key(root.querySelector('[part="period-am"]')!, 'End');
    check(root.querySelector('[part="period-pm"]')!.getAttribute('aria-checked') === 'true', 'End must select PM');
    await key(root.querySelector('[part="period-pm"]')!, 'ArrowUp');
    check(root.querySelector('[part="period-am"]')!.getAttribute('aria-checked') === 'true', 'period arrows must move and select');
    await type('hour', '12'); await click('confirm-button'); check(picker.value === '00:15', '12 AM must commit midnight in the ISO value');
    await picker.show(); await tick(); await type('hour', '8'); await click('cancel-button');
    check(!picker.open && picker.value === '00:15', 'Cancel must discard the draft');
    picker.min = '22:00'; picker.max = '06:00'; picker.value = '12:00'; await tick();
    const invalid = await picker.getValidity();
    check(!invalid.valid && invalid.rangeUnderflow && invalid.rangeOverflow, 'the excluded middle of an overnight range must expose both range flags');
    picker.value = '23:30'; await tick(); check(await picker.checkValidity(), 'the late half of an overnight window must be valid');
    picker.value = '05:30'; await tick(); check(await picker.checkValidity(), 'the early half of an overnight window must be valid');
    picker.required = true; picker.value = ''; await tick(); check(!(await picker.checkValidity()), 'required must reject an empty time');
    picker.disabled = true; await tick(); await picker.show(); check(!picker.open, 'disabled picker must not open');
  } finally { picker.disabled = false; await picker.hide(); }
}
