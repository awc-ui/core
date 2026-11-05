/** Browser contracts for modal focus ownership and native form participation. */
export async function exerciseTimeEnvironment(supplied?: HTMLElement, scenario: 'focus' | 'constraints' | 'dial' | 'initialization' = 'focus') {
  const picker = (supplied ?? document.querySelector('md-time-picker')) as HTMLMdTimePickerElement;
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  // The dialog's md-button / md-icon-button children hydrate asynchronously on a
  // cold first open (lazy bundles). Until they have, an action host has no
  // tabindex and the picker's next render can be held behind them, so the
  // keyboard and dial assertions below wait for the open dialog to hydrate.
  const hydrated = async (host: HTMLElement) => {
    const pending = Array.from(host.shadowRoot?.querySelectorAll<HTMLElement>('*') ?? [])
      .filter(node => typeof (node as HTMLElement & { componentOnReady?: unknown }).componentOnReady === 'function')
      .map(node => (node as HTMLElement & { componentOnReady: () => Promise<unknown> }).componentOnReady());
    await Promise.all(pending); await settle();
  };
  await picker.componentOnReady();
  const root = picker.shadowRoot!;
  const form = picker.closest('form')!;
  const fieldset = picker.closest('fieldset')!;
  const outside = form.querySelector<HTMLButtonElement>('#outside')!;
  const input = (part: string) => root.querySelector<HTMLInputElement>(`[part="input-${part}"]`)!;
  const key = (target: Element, name: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, composed: true, cancelable: true });
    target.dispatchEvent(event); return event;
  };
  const active = () => { let node = document.activeElement; while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement; return node; };
  const focus = (element: HTMLElement) => (element.shadowRoot?.querySelector<HTMLElement>('button,input') ?? element).focus();
  const overflow = document.body.style.overflow;
  let peer: HTMLMdTimePickerElement | undefined;
  try {
    if (scenario === 'focus') {
      outside.focus(); await picker.show(); await settle(); await hydrated(picker);
      const confirm = root.querySelector<HTMLElement>('[part="confirm-button"]')!;
      focus(confirm); key(confirm, 'Tab'); await settle();
      check(active() === input('hour'), 'Tab from the final action must wrap to the hour input');
      key(input('hour'), 'Tab', true); await settle();
      check(confirm === active() || confirm.shadowRoot?.contains(active()), 'Shift+Tab from the hour input must wrap to the final action');
      outside.focus(); key(outside, 'Tab'); await settle();
      check(active() === input('hour'), 'the next Tab must recover focus that escaped the modal');
      outside.focus(); key(outside, 'Tab', true); await settle();
      check(confirm === active() || confirm.shadowRoot?.contains(active()), 'reverse Tab must recover escaped focus at the final action');
      peer = document.createElement('md-time-picker'); peer.hideTrigger = true; peer.value = '14:30';
      form.append(peer); await peer.componentOnReady(); await peer.show(); await settle();
      // Moving a background dialog must re-arm its environment without stealing ownership.
      fieldset.append(picker); await settle();
      key(document.body, 'Escape'); await settle();
      check(!peer.open && picker.open, 'Escape must close only the last-opened picker after a background reparent');
      check(document.body.style.overflow === 'hidden', 'the underlying modal must retain its scroll lock');
      key(document.body, 'Escape'); await settle();
      check(!picker.open && document.body.style.overflow === overflow, 'closing the final modal must restore the prior scroll policy');
      outside.focus(); picker.hideTrigger = true; await settle(); await picker.show(); await settle(); await picker.hide(); await settle();
      check(active() === outside, 'a triggerless picker must return focus to its external opener');
      picker.hideTrigger = false; await picker.show(); await settle();
      fieldset.disabled = true; await settle();
      check(!picker.open, 'disabling the owning fieldset must cancel an open dialog');
    } else if (scenario === 'constraints') {
      picker.name = 'meeting'; picker.required = true; picker.value = '';
      picker.valueMissingLabel = 'Choose a meeting time'; await settle();
      let validity = await picker.getValidity();
      check(validity.valueMissing && validity.validationMessage === 'Choose a meeting time', 'required emptiness must use the consumer message');
      check(!(await picker.checkValidity()) && !(await picker.reportValidity()), 'silent and interactive checks must report the same invalid state');
      picker.min = '09:00'; picker.max = '17:00'; picker.value = '08:30';
      picker.rangeUnderflowLabel = 'Too early'; picker.rangeOverflowLabel = 'Too late'; await settle();
      validity = await picker.getValidity(); check(validity.rangeUnderflow && validity.validationMessage === 'Too early', 'lower bounds must expose underflow');
      picker.value = '18:00'; await settle();
      validity = await picker.getValidity(); check(validity.rangeOverflow && validity.validationMessage === 'Too late', 'upper bounds must expose overflow');
      picker.value = '9:05'; await settle();
      check(picker.value === '09:05' && new FormData(form).get('meeting') === '09:05', 'unpadded values must canonicalize before form submission');
      picker.value = '99:80'; await settle(); check(picker.value === '', 'out-of-range external values must normalize to empty');
      picker.value = 'invalid'; await settle(); check(picker.value === '', 'malformed external values must normalize to empty');
      picker.min = 'invalid'; picker.max = '25:99'; picker.value = '18:30'; await settle();
      check(await picker.checkValidity(), 'malformed constraints must not invent range errors');
      picker.min = '22:00'; picker.max = '06:00'; picker.rangeOutsideLabel = 'Outside night shift'; picker.value = '12:00'; await settle();
      validity = await picker.getValidity(); check(validity.rangeUnderflow && validity.rangeOverflow && validity.validationMessage === 'Outside night shift', 'the excluded middle of overnight ranges must use the overnight message');
      picker.min = ''; picker.max = ''; form.reset(); await settle();
      check(picker.value === '09:30' && new FormData(form).get('meeting') === '09:30', 'reset must restore the authored canonical time');
      picker.disabled = true; await settle(); check(!new FormData(form).has('meeting'), 'disabled time fields must not submit');
    } else if (scenario === 'initialization') {
      let opened = 0;
      peer = document.createElement('md-time-picker');
      peer.setAttribute('value', 'not-a-time'); peer.setAttribute('open', '');
      peer.setAttribute('label', 'Initially open meeting'); peer.required = true;
      peer.addEventListener('mdOpen', () => opened++);
      form.append(peer); await peer.componentOnReady(); await settle();
      check(peer.value === '' && (await peer.getValidity()).valueMissing, 'invalid authored values must initialize as empty required fields');
      check(peer.open && opened === 1 && peer.shadowRoot?.querySelector('[role="dialog"]'), 'an enabled authored open picker must mount its dialog and announce opening once');
      check(document.body.style.overflow === 'hidden', 'an initially open dialog must acquire the modal scroll lock');
      await peer.hide(); peer.remove(); await settle();
      check(document.body.style.overflow === overflow, 'removing an initially open picker after hide must restore scrolling');
      peer = document.createElement('md-time-picker');
      peer.setAttribute('value', '9:05'); peer.setAttribute('open', ''); peer.disabled = true;
      form.append(peer); await peer.componentOnReady(); await settle();
      check(peer.value === '09:05', 'valid unpadded authored values must initialize canonically');
      check(!peer.open && !peer.shadowRoot?.querySelector('[role="dialog"]'), 'an authored open flag must not open a disabled picker');
      peer.disabled = false; await settle(); await peer.show(); await settle();
      check(peer.open, 'an initially disabled picker must remain usable after enabling');
    } else {
      picker.variant = 'dial'; picker.responsive = false; picker.format = '24h'; picker.value = '23:55'; picker.minuteStep = 5;
      picker.orientation = 'horizontal'; await settle();
      const trigger = root.querySelector<HTMLElement>('[part="trigger"]')!;
      key(trigger, 'Enter'); await settle(); await hydrated(picker);
      check(picker.open && root.querySelector('[part="dial"]'), 'Enter on the trigger must open the authored dial');
      input('minute').focus(); await settle();
      check(root.querySelectorAll('.md-time-picker__dial-number').length === 12, 'minute selection must render twelve minute marks');
      key(input('minute'), 'ArrowUp'); await settle();
      check(input('minute').value === '00', 'minute stepping must wrap the visible dial hand');
      input('hour').focus(); await settle();
      check(root.querySelectorAll('.md-time-picker__dial-number').length === 24, '24-hour selection must render inner and outer rings');
      key(input('hour'), 'ArrowUp'); await settle(); check(input('hour').value === '0', '24-hour stepping must wrap across midnight');
      picker.value = '9:05'; await settle();
      check(input('hour').value === '9' && input('minute').value === '05', 'external updates must resynchronize an open dial and its input buffers');
      picker.format = '12h'; picker.orientation = 'vertical'; picker.periodLayout = 'horizontal'; await settle();
      check(root.querySelectorAll('.md-time-picker__dial-number').length === 12, '12-hour mode must remove the inner ring');
      key(root.querySelector('[part="period-am"]')!, 'ArrowLeft'); await settle();
      check(root.querySelector('[part="period-pm"]')!.getAttribute('aria-checked') === 'true', 'period keyboard movement must update the shared draft');
      picker.responsive = true; await settle();
      window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('orientationchange')); await settle();
      check(picker.open, 'viewport updates must preserve the editing session');
      picker.responsive = false; await settle();
      picker.disabled = true; await settle(); check(!picker.open, 'runtime disabling must cancel the draft');
      picker.disabled = false; picker.open = true; await settle();
      check(picker.open, 'the public open prop must reopen an enabled picker');
      picker.open = false; await settle(); check(!root.querySelector('[role="dialog"]'), 'clearing open must remove the modal');
    }
  } finally {
    fieldset.disabled = false; picker.disabled = false;
    await peer?.hide(); peer?.remove(); await picker.hide(); await settle();
  }
}
