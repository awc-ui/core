/**
 * The stress screen's scenario selector.
 *
 * All three scenarios are rendered; this shows one and hides the rest. The
 * selector lives in the screen head (outside the sections it controls), so it
 * is looked up from the document rather than from within the stress container.
 */

export function enhanceScenarioSelector(): void {
  const selector = document.querySelector('[data-scenario-selector]');
  const container = document.querySelector('[data-stress]');
  if (!selector || !container || selector.hasAttribute('data-bound')) return;
  selector.setAttribute('data-bound', '');

  const sections = Array.from(
    container.querySelectorAll<HTMLElement>('section[data-scenario]'),
  );

  selector.addEventListener('mdChange', (event) => {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (!value) return;
    for (const section of sections) {
      section.hidden = section.dataset.scenario !== value;
    }
  });
}
