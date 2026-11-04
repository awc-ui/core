/** Public browser interactions shared by the component stories and E2E runner. */
export async function exerciseSliderTransactions(supplied?: HTMLElement, scenario: 'range' | 'vertical' | 'form' = 'range') {
  const slider = (supplied ?? document.querySelector('md-slider')) as HTMLMdSliderElement;
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await slider.componentOnReady();
  const root = slider.shadowRoot!;
  const inputs = () => Array.from(root.querySelectorAll<HTMLInputElement>('input'));
  const changes: Array<{ value?: number; valueStart?: number; valueEnd?: number }> = [];
  const ends: Array<{ thumb: string }> = [];
  slider.addEventListener('mdChange', event => changes.push((event as CustomEvent).detail));
  slider.addEventListener('mdDragEnd', event => ends.push((event as CustomEvent).detail));
  const inputValue = async (index: number, value: number, commit = true) => {
    const input = inputs()[index];
    input.focus(); input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    if (commit) { input.dispatchEvent(new Event('change', { bubbles: true })); await settle(); }
  };
  const pointer = (type: string, value: number) => {
    const rail = root.querySelector<HTMLElement>('.md-slider__rail')!;
    const rect = rail.getBoundingClientRect();
    check(rect.width > 0 && rect.height > 0, 'the rendered rail must have measurable dimensions');
    const ratio = (value - slider.min) / (slider.max - slider.min);
    const vertical = slider.orientation === 'vertical';
    const rtl = getComputedStyle(slider).direction === 'rtl';
    rail.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 31,
      clientX: vertical ? rect.left + rect.width / 2 : rtl ? rect.right - ratio * rect.width : rect.left + ratio * rect.width,
      clientY: vertical ? rect.bottom - ratio * rect.height : rect.top + rect.height / 2,
    }));
  };

  if (scenario === 'range') {
    slider.range = true; slider.min = 0; slider.max = 100; slider.step = 10;
    slider.valueStart = 20; slider.valueEnd = 80;
    slider.ariaLabelStart = 'Minimum price'; slider.ariaLabelEnd = 'Maximum price';
    slider.valueStartText = '20 dollars'; slider.valueEndText = '80 dollars';
    slider.valueIndicator = true; slider.stops = true;
    await settle();
    check(inputs()[0].getAttribute('aria-label') === 'Minimum price', 'start thumb must use its explicit label');
    check(inputs()[1].getAttribute('aria-valuetext') === '80 dollars', 'end thumb must expose its value description');
    await inputValue(0, 90);
    check(slider.valueStart === 90 && slider.valueEnd === 90, 'crossing the end with the start input must move both bounds');
    await inputValue(1, 10);
    check(slider.valueStart === 10 && slider.valueEnd === 10, 'crossing the start with the end input must move both bounds');
    slider.valueStart = 20; slider.valueEnd = 80; slider.controlled = true;
    await settle();
    await inputValue(0, 40, false);
    check(slider.valueStart === 20, 'controlled input must not mutate its authored start value');
    check(inputs()[0].getAttribute('aria-valuenow') === '40', 'controlled input must expose its live preview');
    inputs()[0].dispatchEvent(new Event('change', { bubbles: true })); await settle();
    check(changes.at(-1)?.valueStart === 40, 'the commit event must include the proposed range');
    check(inputs()[0].getAttribute('aria-valuenow') === '20', 'an unaccepted controlled proposal must return to the prop');
    await inputValue(1, 60, false);
    check(slider.valueEnd === 80, 'controlled end input must not mutate its authored value');
    inputs()[1].dispatchEvent(new Event('change', { bubbles: true })); await settle();
    check(changes.at(-1)?.valueEnd === 60, 'end proposals must reach the consumer');
    slider.controlled = false; slider.dir = 'rtl'; slider.step = 0; await settle();
    pointer('pointerdown', 90); pointer('pointermove', 10); pointer('pointercancel', 10); await settle();
    check(Math.abs(slider.valueStart - 10) < 0.001 && Math.abs(slider.valueEnd - 90) < 0.001, 'RTL rail dragging must preserve source-space range values');
    check(ends.at(-1)?.thumb === 'start', 'crossing from the end must hand the gesture to the start');
    slider.valueStart = 50; slider.valueEnd = 50; await settle();
    pointer('pointerdown', 50); pointer('lostpointercapture', 50); await settle();
    check(ends.at(-1)?.thumb === 'end', 'coincident handles must choose the end at their shared value');
    const before = changes.length;
    slider.disabled = true; await settle();
    pointer('pointerdown', 0); pointer('pointermove', 100); pointer('pointerup', 100);
    check(changes.length === before, 'disabled rail gestures must not commit changes');
  } else if (scenario === 'vertical') {
    slider.range = false; slider.orientation = 'vertical'; slider.min = 0; slider.max = 100;
    slider.style.setProperty('--md-slider-track-length', '240px');
    slider.value = 40; slider.step = 10; slider.controlled = true;
    slider.stops = true; slider.valueIndicator = true; slider.variant = 'centered';
    slider.size = 'md'; slider.insetIcon = true; slider.icon = 'volume_up';
    await settle();
    pointer('pointerdown', 70); pointer('pointermove', 90); await settle();
    check(slider.value === 40, 'controlled vertical dragging must preserve the value prop');
    check(inputs()[0].getAttribute('aria-valuenow') === '90', 'vertical dragging must announce the live value');
    pointer('pointerup', 90); await settle();
    check(changes.at(-1)?.value === 90 && slider.value === 40, 'vertical release must publish the proposal without accepting it');
    slider.controlled = false; await settle();
    pointer('pointerdown', 30); pointer('pointermove', 20); pointer('lostpointercapture', 20); await settle();
    check(slider.value === 20 && changes.at(-1)?.value === 20, 'lost capture must commit the uncontrolled vertical value');
    check(ends.at(-1)?.thumb === 'single', 'vertical drag end must identify its single thumb');
    check(root.querySelector('.md-slider__inset--on-active'), 'a centered reading below the midpoint places the inset on the active segment');
    slider.range = true; slider.valueStart = 20; slider.valueEnd = 80; await settle();
    check(inputs().length === 2 && inputs().every(input => input.getAttribute('aria-orientation') === 'vertical'), 'vertical range mode must expose two vertical inputs');
    pointer('pointerdown', 50); pointer('pointermove', 60); pointer('pointerup', 60); await settle();
    check(slider.valueStart === 60 && slider.valueEnd === 80, 'an equidistant range press must pick the lower thumb');
    slider.min = 50; slider.max = 50; await settle();
    check(slider.style.getPropertyValue('--_start-pct') === '0%', 'equal bounds must produce a finite zero position');
    check(root.querySelectorAll('.md-slider__tick').length === 0, 'a zero-span rail must not generate duplicate stops');
  } else {
    const form = slider.closest('form')!;
    check(form, 'this contract requires a real owning form');
    slider.range = true; slider.name = ''; slider.nameStart = 'minimum'; slider.nameEnd = 'maximum';
    slider.valueStart = 25; slider.valueEnd = 75;
    await settle();
    check(new FormData(form).get('minimum') === '25' && new FormData(form).get('maximum') === '75', 'separately named thumbs must submit both readings');
    slider.name = 'price'; slider.nameStart = ''; slider.nameEnd = ''; await settle();
    check(JSON.stringify(new FormData(form).getAll('price')) === '["25","75"]', 'shared names must submit both ordered values');
    slider.disabled = true; await settle();
    check(!new FormData(form).has('price'), 'disabled ranges must not contribute to form submission');
    slider.disabled = false; slider.range = false; slider.name = 'volume'; slider.value = 65;
    slider.sliderAriaLabel = 'Volume'; slider.valueText = 'Comfortable'; await settle();
    check(new FormData(form).get('volume') === '65', 'switching to single mode must publish one reading');
    check(inputs()[0].getAttribute('aria-label') === 'Volume' && inputs()[0].getAttribute('aria-valuetext') === 'Comfortable', 'single mode must expose consumer-provided accessibility text');
    form.reset(); await settle();
    check(slider.value === 30 && new FormData(form).get('volume') === '30', 'form reset must restore the authored single value');
    slider.name = ''; await settle();
    check(Array.from(new FormData(form)).length === 0, 'removing all names must stop form contribution');
  }
}
