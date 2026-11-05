export async function exerciseColorChannels(supplied?: HTMLElement) {
  const picker = (supplied || document.querySelector('md-color-picker')) as any;
  await picker.componentOnReady();
  const originalDirection = picker.parentElement.getAttribute('dir');
  const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const part = (name: string) => picker.shadowRoot.querySelector('[part="' + name + '"]') as HTMLElement;
  const input = (name: string) => part('field-' + name).querySelector('input')!;
  const change = async (name: string, value: string) => {
    input(name).value = value;
    input(name).dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  };
  const key = async (surface: HTMLElement, key: string, shiftKey = false) => {
    surface.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
    await settle();
  };
  try {
  picker.alpha = true; picker.format = 'rgb'; picker.value = '#FF0000';
  await settle();
  await change('g', '255'); assert(picker.value === 'rgb(255, 255, 0)', 'green channel must produce yellow');
  await change('b', '255'); assert(picker.value === 'rgb(255, 255, 255)', 'blue channel must produce white');
  await change('r', '-20'); assert(picker.value === 'rgb(0, 255, 255)', 'RGB channel must clamp at zero');
  await change('a', '0.5'); assert(picker.value === 'rgba(0, 255, 255, 0.5)', 'numeric alpha must be included in RGB output');
  await change('a', '8'); assert(picker.value === 'rgb(0, 255, 255)', 'numeric alpha must clamp at one');

  picker.format = 'hsl'; picker.value = '#FF0000'; await settle();
  await change('h', '120'); assert(picker.value === 'hsl(120, 100%, 50%)', 'hue channel must select green');
  await change('s', '0'); assert(picker.value === 'hsl(0, 0%, 50%)', 'zero saturation must produce gray');
  await change('l', '100'); assert(picker.value === 'hsl(0, 0%, 100%)', 'lightness must reach white');
  await change('a', '0.5'); assert(picker.value === 'hsla(0, 0%, 100%, 0.5)', 'HSL output must retain alpha');

  picker.format = 'hex'; picker.value = '#FF0000'; await settle();
  const hex = input('hex');
  hex.value = 'not-hex'; hex.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  assert(hex.getAttribute('aria-invalid') === 'true' && picker.value === '#FF0000', 'invalid hex must not commit');
  hex.dispatchEvent(new Event('blur')); await settle();
  assert(hex.value === '#FF0000' && !hex.hasAttribute('aria-invalid'), 'blur must restore the last valid color');
  hex.value = '0f08'; hex.dispatchEvent(new Event('input', { bubbles: true })); await settle();
  assert(picker.value === '#00FF0088', 'short hex alpha must retain all four channels');
  hex.focus(); await key(hex, 'Enter');
  assert(picker.shadowRoot.activeElement !== hex, 'Enter must commit and blur the hex field');

  for (const direction of ['ltr', 'rtl']) {
    picker.parentElement.dir = direction; picker.value = '#FF0000'; await settle();
    const hue = part('hue'), alpha = part('alpha'), plate = part('plate');
    await key(hue, 'Home'); await key(hue, direction === 'ltr' ? 'ArrowRight' : 'ArrowLeft', true);
    assert(hue.getAttribute('aria-valuenow') === '15', 'shift hue step must follow inline direction');
    await key(hue, direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight');
    assert(hue.getAttribute('aria-valuenow') === '14', 'unmodified hue step must move one degree');
    await key(hue, 'End'); assert(hue.getAttribute('aria-valuenow') === '0', 'hue endpoint must wrap to red');
    await key(alpha, 'Home'); assert(alpha.getAttribute('aria-valuenow') === '0', 'alpha Home must be transparent');
    await key(alpha, direction === 'ltr' ? 'ArrowRight' : 'ArrowLeft', true);
    assert(alpha.getAttribute('aria-valuenow') === '0.1', 'shift alpha step must be ten percent');
    await key(alpha, direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight');
    assert(alpha.getAttribute('aria-valuenow') === '0.09', 'unmodified alpha step must be one percent');
    await key(alpha, 'End'); assert(alpha.getAttribute('aria-valuenow') === '1', 'alpha End must be opaque');
    await key(plate, 'Home'); await key(plate, 'PageUp');
    assert(picker.value === '#FFFFFF', 'zero saturation and full value must be white');
    await key(plate, 'End'); await key(plate, 'PageDown');
    assert(picker.value === '#000000', 'minimum value must be black');
    await key(plate, 'PageUp'); await key(plate, 'ArrowDown', true);
    assert(picker.value === '#E60000', 'shift value step must reduce red by ten percent');
    await key(plate, 'ArrowUp', true); assert(picker.value === '#FF0000', 'value step must recover red');
    await key(plate, direction === 'ltr' ? 'ArrowLeft' : 'ArrowRight', true);
    assert(picker.value === '#FF1919', 'shift saturation step must reduce saturation by ten percent');
    await key(plate, direction === 'ltr' ? 'ArrowRight' : 'ArrowLeft', true);
    assert(picker.value === '#FF0000', 'opposite saturation step must recover red');
    for (const surface of [plate, hue, alpha]) {
      const before = picker.value; await key(surface, 'Tab'); assert(picker.value === before, 'unhandled keys must not change color');
    }
  }

  picker.presets = ['#FF0000', '#00FF00', '#0000FF']; await settle();
  const presets = picker.shadowRoot.querySelectorAll('[part="preset"]');
  await key(presets[1], 'Enter'); assert(picker.value === '#00FF00', 'Enter must select the green preset');
  await key(presets[2], ' '); assert(picker.value === '#0000FF', 'Space must select the blue preset');
  picker.disabled = true; await settle();
  for (const surface of [part('plate'), part('hue'), part('alpha')]) await key(surface, 'ArrowRight');
  await key(presets[0], 'Enter');
  assert(picker.value === '#0000FF', 'disabled controls must reject keyboard and preset changes');
  } finally {
    picker.disabled = false;
    if (originalDirection === null) picker.parentElement.removeAttribute('dir');
    else picker.parentElement.setAttribute('dir', originalDirection);
    await settle();
  }
}

export async function exerciseColorPopover(supplied?: HTMLElement) {
  const picker = (supplied || document.querySelector('md-color-picker')) as any;
  await picker.componentOnReady();
  const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  let trigger = picker.querySelector('[slot="trigger"]') as HTMLButtonElement;
  const outside = picker.parentElement.querySelector('[data-outside]') as HTMLElement;
  trigger.click(); await settle();
  assert(picker.open && trigger.getAttribute('aria-expanded') === 'true', 'slotted trigger must open the popover and announce it');
  picker.dismissOnOutsideClick = false; await settle();
  outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true })); await settle();
  assert(picker.open, 'outside clicks must respect the opt-in dismissal setting');
  picker.dismissOnOutsideClick = true; await settle();
  picker.shadowRoot.querySelector('[part="plate"]').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
  await settle(); assert(picker.open, 'interaction inside the shadow panel must not dismiss it');
  outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true })); await settle();
  assert(!picker.open && trigger.getAttribute('aria-expanded') === 'false', 'outside dismissal must update the consumer trigger');
  await picker.show(); await settle();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); await settle();
  assert(!picker.open, 'Escape must dismiss an open popover');
  const oldTrigger = trigger;
  trigger = document.createElement('button'); trigger.slot = 'trigger'; trigger.type = 'button'; trigger.textContent = 'Replacement trigger';
  oldTrigger.replaceWith(trigger); await settle();
  oldTrigger.click(); await settle(); assert(!picker.open, 'replaced trigger must lose its listener');
  trigger.click(); await settle(); assert(picker.open && trigger.getAttribute('aria-haspopup') === 'dialog', 'replacement trigger must become functional');
  await picker.close(); await settle();
  picker.disabled = true; await settle(); trigger.click(); await picker.show(); await settle();
  assert(!picker.open, 'disabled popovers must refuse consumer and imperative opening');
  picker.disabled = false; await settle();
  await picker.show(); await picker.close(); await settle();
  assert(!picker.open, 'closing before the deferred outside-listener attachment must stay closed');
}
export async function exerciseColorValues(supplied?: HTMLElement) {
  const picker = (supplied ?? document.querySelector('md-color-picker')) as HTMLMdColorPickerElement;
  const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
  const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 35));
  await picker.componentOnReady(); picker.format = 'hex'; picker.alpha = true;
  const hex = () => picker.shadowRoot!.querySelector<HTMLInputElement>('[part="field-hex"] input')!;
  const cases = [
    ['#f00', '#FF0000'], ['#0f08', '#00FF0088'], ['#0000ff', '#0000FF'], ['#abcdef40', '#ABCDEF40'],
    ['rgb(255, 0, 255)', '#FF00FF'], ['rgb(0 255 255 / 50%)', '#00FFFF80'],
    ['rgba(255,255,0,0.25)', '#FFFF0040'], ['hsl(120,100%,50%)', '#00FF00'],
    ['hsla(240,100%,50%,25%)', '#0000FF40'], ['hsl(60 100% 50% / 0.5)', '#FFFF0080'],
    ['hsl(180,100%,50%)', '#00FFFF'], ['hsl(300,100%,50%)', '#FF00FF'], ['#808080', '#808080'],
  ];
  const inputs: string[] = []; const record = (event: Event) => inputs.push((event as CustomEvent).detail.value);
  picker.addEventListener('mdInput', record);
  try {
    for (const [value, expected] of cases) {
      picker.value = value; await tick();
      check(hex().value === expected && hex().getAttribute('aria-invalid') !== 'true', `controlled ${value} must display ${expected}`);
    }
    check(inputs.length === 0, 'controlled value updates must remain silent');
    picker.value = ''; await tick();
    check(hex().value === '#808080' && inputs.length === 0, 'an unset controlled value must retain the displayed color without creating an edit');
    for (const value of ['#12', '#12345', '#1234567', '#ggg', 'red', 'rgb(nope)', 'hsl(nope)']) {
      picker.value = value; await tick();
      check(hex().getAttribute('aria-invalid') === 'true' && hex().value === '#808080', `invalid ${value} must retain the last valid color and expose the error`);
    }
    picker.value = 'rgba(300,10,20,5)'; await tick();
    check(hex().value === '#FF0A14' && hex().getAttribute('aria-invalid') !== 'true', 'valid replacement must clamp channels and recover from an invalid value');
  } finally { picker.removeEventListener('mdInput', record); }
}
