export async function exerciseNumberEditing(supplied?: HTMLElement) {
  const field = (supplied ?? document.querySelector('md-number-field')) as HTMLMdNumberFieldElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 30));
  await field.componentOnReady();
  field.locale = 'en-US'; field.min = -10; field.max = 20; field.step = 1;
  field.smallStep = 0.25; field.largeStep = 5; field.value = 2;
  await tick();
  const input = () => field.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const key = async (key: string, extras: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...extras });
    input().dispatchEvent(event); await tick(); return event;
  };
  const type = async (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input', { bubbles: true, composed: true })); await tick();
  };
  const changes: Array<{ value: number | null; reason: string }> = [];
  const record = (event: Event) => changes.push((event as CustomEvent).detail);
  field.addEventListener('mdChange', record);
  try {
    await field.setFocus(); await field.select();
    check(input().selectionStart === 0 && input().selectionEnd === input().value.length, 'select() must select the formatted number');
    await key('ArrowUp'); check(field.value === 3, 'ArrowUp must use step');
    await key('ArrowDown', { altKey: true }); check(field.value === 2.75, 'Alt+Down must use smallStep');
    await key('ArrowUp', { shiftKey: true }); check(field.value === 7.75, 'Shift+Up must use largeStep');
    await key('Home'); check(field.value === -10, 'Home must commit the lower bound');
    await key('End'); check(field.value === 20, 'End must commit the upper bound');
    await field.stepDown(3); await tick(); check(field.value === 17, 'stepDown(times) must multiply the step');
    await field.stepUp(100); await tick(); check(field.value === 20, 'imperative stepping must clamp to max');
    field.snapOnStep = true; field.value = 2.2; await tick();
    await key('ArrowUp'); check(field.value === 3, 'snapOnStep must snap upward to the step grid');
    await key('ArrowDown'); check(field.value === 2, 'snapOnStep must snap downward');
    check((await key('x')).defaultPrevented, 'unformatted alphabetic characters must be blocked');
    check(!(await key('x', { ctrlKey: true })).defaultPrevented, 'editing shortcuts must pass through');
    check(!(await key('x', { isComposing: true })).defaultPrevented, 'IME composition must pass through');
    await type('garbage'); check(field.value === 2 && input().value === '2', 'garbage paste must restore the accepted display');
    await type('-'); check(field.value === 2 && input().value === '-', 'an incomplete sign must remain editable without replacing the numeric value');
    await type('19.5'); check(field.value === 19.5 && input().value === '19.5', 'typing must preserve decimal text');
    await type('99'); await key('Enter'); check(field.value === 20 && input().value === '20', 'commit must clamp typed values');
    field.allowOutOfRange = true; await tick(); await type('-99'); await key('Enter');
    check(field.value === -99 && input().value === '-99', 'allowOutOfRange must retain the typed value and display on commit');
    field.allowOutOfRange = false; field.snapOnStep = false; field.value = 2; field.allowWheelScrub = true; await tick();
    await field.setFocus(); await tick();
    const wheel = async (deltaY: number, extra: WheelEventInit = {}) => {
      input().dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, composed: true, cancelable: true, ...extra })); await tick();
    };
    await wheel(-1); check(field.value === 3, 'focused wheel-up must increment');
    await wheel(1, { altKey: true }); check(field.value === 2.75, 'wheel modifiers must select smallStep');
    await wheel(-1, { shiftKey: true }); check(field.value === 7.75, 'wheel Shift must select largeStep');
    await wheel(-1, { ctrlKey: true }); check(field.value === 7.75, 'pinch zoom must not change the value');
    field.readOnly = true; await tick(); await key('ArrowUp'); await wheel(-1);
    check(field.value === 7.75, 'readonly must block keyboard and wheel stepping');
    field.readOnly = false; field.disabled = true; await tick(); await key('ArrowDown');
    check(field.value === 7.75, 'disabled must block keyboard stepping');
    field.disabled = false; field.locale = 'de-DE'; field.formatOptions = { minimumFractionDigits: 2, maximumFractionDigits: 2 }; field.value = 12.5; await tick();
    check(input().value === '12,50', 'locale and format options must reformat the visible number');
    await type('3,25'); await key('Enter'); check(field.value === 3.25 && input().value === '3,25', 'localized separators must parse on commit');
    await type(''); await key('Enter'); check(field.value === null, 'clearing must commit null');
    check(changes.some((entry) => entry.reason === 'wheel') && changes.some((entry) => entry.reason === 'keyboard') && changes.some((entry) => entry.reason === 'input-blur'), 'change details must distinguish interaction sources');
  } finally {
    field.removeEventListener('mdChange', record); field.readOnly = false; field.disabled = false;
    field.value = 3.25;
  }
}
export async function exerciseNumberFormats(supplied?: HTMLElement) {
  const field = (supplied ?? document.querySelector('md-number-field')) as HTMLMdNumberFieldElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 40));
  await field.componentOnReady(); field.min = undefined; field.max = undefined;
  const input = () => field.shadowRoot!.querySelector('md-text-field')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const enter = async (text: string) => {
    input().focus(); input().value = text; input().dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true })); await tick();
  };
  const cases: Array<[string, Intl.NumberFormatOptions, number]> = [
    ['en-US', { style: 'percent', maximumFractionDigits: 2 }, 0.125],
    ['fr-FR', { style: 'currency', currency: 'EUR' }, -1234.5],
    ['ar-EG', { maximumFractionDigits: 2 }, -12.5],
    ['en-US', { style: 'unit', unit: 'kilometer', unitDisplay: 'short' }, 25],
  ];
  for (const [locale, options, value] of cases) {
    field.locale = locale; field.formatOptions = options; field.value = value; await tick();
    const formatted = new Intl.NumberFormat(locale, options).format(value);
    check(input().value === formatted, `format must match ${locale} ${options.style ?? 'decimal'}`);
    field.value = 0; await tick(); await enter(formatted);
    check(field.value === value, `formatted paste must round-trip ${locale} ${options.style ?? 'decimal'}`);
  }
  field.locale = 'en-US'; field.value = 12.5;
  for (const options of ['{"minimumFractionDigits":2}', '{bad', '[]', ' ', '{"style":"currency"}']) {
    field.formatOptions = options; await tick();
    check(input().value === (options.includes('minimumFractionDigits') ? '12.50' : '12.5'), 'invalid formatting configuration must fall back to the plain locale without losing the value');
  }
  field.formatOptions = undefined; field.step = 0; field.value = null; await tick();
  await field.stepUp(); await tick(); check(field.value === 1, 'an invalid zero step must fall back to one from an empty value');
  field.step = 1; field.snapOnStep = true; field.smallStep = 0.25; field.value = 1.1; await tick();
  input().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, composed: true, cancelable: true })); await tick();
  check(field.value === 1.25, 'Alt stepping must snap to the nearest small-step grid');
}
