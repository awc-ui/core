/** Exercises the public cell input pipeline with browser input and clipboard events. */
export async function exerciseOtpEditing(supplied?: HTMLElement) {
  const otp = (supplied ?? document.querySelector('md-otp-field')) as HTMLMdOtpFieldElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 30));
  await otp.componentOnReady();
  otp.length = 4;
  otp.validationType = 'alphanumeric';
  otp.transform = 'uppercase';
  otp.groupSize = 2;
  await otp.clear();
  await tick();
  const cells = () => Array.from(otp.shadowRoot!.querySelectorAll<HTMLInputElement>('input'));
  const active = () => cells().indexOf(otp.shadowRoot!.activeElement as HTMLInputElement);
  const input = async (index: number, value: string) => {
    cells()[index].focus(); cells()[index].value = value;
    cells()[index].dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  };
  const key = async (index: number, value: string) => {
    cells()[index].focus();
    cells()[index].dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    await tick();
  };
  const invalid: Array<{ attempted: string; reason: string }> = [];
  const onInvalid = (event: Event) => invalid.push((event as CustomEvent).detail);
  otp.addEventListener('mdInvalidInput', onInvalid);
  try {
    await input(3, 'a');
    check(otp.value === 'A' && active() === 1, 'typing beyond the fill point must fill the first empty cell');
    await input(1, '!');
    check(otp.value === 'A' && cells()[1].value === '', 'rejected characters must restore the visible cell');
    check(invalid.length === 1 && invalid[0].attempted === '!' && invalid[0].reason === 'input-change', 'invalid input must identify its source');
    await input(1, 'b2c');
    check(otp.value === 'AB2C' && active() === 3, 'a partial burst must distribute across remaining cells');
    check(otp.shadowRoot!.querySelectorAll('[part="separator"]').length === 1, 'grouping must insert one separator');
    cells()[1].click();
    check(cells()[1].selectionStart === 0 && cells()[1].selectionEnd === 1, 'clicking a filled cell must select its character');
    await key(2, 'Home'); check(active() === 0, 'Home must focus the first cell');
    await key(0, 'ArrowLeft'); check(active() === 0, 'Left must clamp at the first cell');
    await key(0, 'End'); check(active() === 3, 'End must focus the last cell');
    await key(3, 'ArrowRight'); check(active() === 3, 'Right must clamp at the last cell');
    await key(3, 'ArrowLeft'); check(active() === 2, 'Left must focus the previous cell');
    await key(1, 'Delete'); check(otp.value === 'A2C', 'Delete must remove a filled cell and close the gap');
    await key(1, 'Backspace'); check(otp.value === 'AC' && active() === 1, 'Backspace in a filled cell must remove it without moving focus');
    await key(2, 'Backspace'); check(otp.value === 'A' && active() === 1, 'Backspace in an empty cell must remove the previous character');
    await input(0, ''); check(otp.value === '', 'native cut must remove the character');
    await input(3, ''); check(otp.value === '', 'deleting beyond the fill point must remain empty');
    otp.readOnly = true; otp.value = 'AB'; await tick();
    await input(0, 'Z'); await key(0, 'Delete'); await key(1, 'Backspace');
    check(otp.value === 'AB' && cells()[0].value === 'A', 'readonly must reject edits and restore cell text');
    otp.readOnly = false; otp.disabled = true; await tick();
    await input(0, 'Z'); await key(0, 'Delete');
    check(otp.value === 'AB', 'disabled must reject edits');
    otp.disabled = false; await tick();
    await otp.setFocus(); await tick();
    check(active() === 2, `setFocus must focus the first empty cell: ${JSON.stringify({ value: otp.value, active: active(), disabled: cells().map((cell) => cell.disabled) })}`);
    otp.mask = true; await tick();
    check(cells().every((cell) => cell.type === 'password'), 'mask must apply to every cell');
  } finally {
    otp.removeEventListener('mdInvalidInput', onInvalid);
    otp.disabled = false; otp.readOnly = false; otp.mask = false;
    await otp.clear();
  }
}

export async function exerciseOtpPaste(supplied?: HTMLElement) {
  const otp = (supplied ?? document.querySelector('md-otp-field')) as HTMLMdOtpFieldElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 30));
  await otp.componentOnReady();
  otp.length = 4; otp.validationType = 'numeric'; otp.transform = 'none';
  await otp.clear(); await tick();
  const inputs = () => Array.from(otp.shadowRoot!.querySelectorAll<HTMLInputElement>('input'));
  const events: Array<{ type: string; detail: unknown }> = [];
  const record = (event: Event) => events.push({ type: event.type, detail: (event as CustomEvent).detail });
  const names = ['mdInput', 'mdChange', 'mdComplete', 'mdInvalidInput'];
  names.forEach((name) => otp.addEventListener(name, record));
  const paste = async (text: string) => {
    const data = new DataTransfer(); data.setData('text', text);
    inputs()[2].dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    await tick();
  };
  try {
    await paste(' 12x 34 ');
    check(otp.value === '1234', 'paste must strip whitespace and invalid characters from the entire code');
    check(events.map((event) => event.type).join(',') === 'mdInvalidInput,mdInput,mdChange,mdComplete', 'complete paste must report rejection, input, commit, then completion');
    check((events[0].detail as { reason: string }).reason === 'input-paste', 'paste rejection must retain its source');
    check((events[3].detail as { value: string }).value === '1234', 'completion must contain the completed code');
    events.length = 0;
    await paste('1234');
    check(events.length === 1 && events[0].type === 'mdComplete', 're-pasting a complete code must retry completion without a duplicate change');
    await paste('!'); check(otp.value === '1234', 'a fully rejected paste must preserve the code');
    otp.readOnly = true; await tick(); await paste('5678'); check(otp.value === '1234', 'readonly paste must be ignored');
    otp.readOnly = false; otp.disabled = true; await tick(); await paste('5678'); check(otp.value === '1234', 'disabled paste must be ignored');
    otp.disabled = false; await otp.clear(); await tick(); events.length = 0;
    inputs()[0].value = '9876';
    inputs()[0].dispatchEvent(new Event('input', { bubbles: true })); await tick();
    check(otp.value === '9876' && inputs().map((cell) => cell.value).join('') === '9876', 'SMS autofill must distribute a whole code');
    check(events.map((event) => event.type).join(',') === 'mdInput,mdChange,mdComplete', 'SMS autofill must complete once');
    otp.validationType = 'alpha'; otp.transform = 'uppercase'; await tick(); await paste('a1 b2 c3d');
    check(otp.value === 'ABCD', 'alpha mode must transform and filter the same paste pipeline');
    otp.validationType = 'none'; await tick(); await paste('a! b?');
    check(otp.value === 'A!B?', 'unrestricted mode must preserve punctuation');
  } finally {
    names.forEach((name) => otp.removeEventListener(name, record));
    otp.disabled = false; otp.readOnly = false; await otp.clear();
  }
}
