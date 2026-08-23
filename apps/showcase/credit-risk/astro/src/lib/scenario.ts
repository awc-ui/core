/**
 * The stress screen's scenario selector.
 *
 * One scenario's two panels are live; the other two ride along in `<template>`
 * elements. Switching clones the requested pair in and replaces what is there,
 * which is the same DOM the React build produces when its state changes — same
 * cards, same table, same rows, nothing hidden.
 *
 * The panels are replaced rather than shown and hidden on purpose. Hiding leaves
 * three copies of every card and table in the accessibility tree and in
 * `querySelectorAll`, and this app's whole claim is that the six builds render
 * the same document. It also avoids the trap that broke the first version: a
 * `[hidden]` element that also carries a `display`-setting class is not hidden
 * at all, because the class wins over the user-agent rule.
 *
 * Everything is looked up from the document. The panels used to sit inside a
 * `<div data-stress>` that made the scoping tidy — and quietly swallowed the
 * screen's flex `gap`, because the wrapper became the single flex item and its
 * children had no gap rule of their own. The cards ran together with no space
 * between them, on this build and on the plain-HTML one, and nowhere else.
 */

/** Swap one marked panel for the same panel from the requested scenario. */
function swap(scenario: string, slot: 'facts' | 'table'): void {
  const current = document.querySelector(`[data-stress-${slot}]`);
  const template = document.querySelector<HTMLTemplateElement>(
    `template[data-scenario="${scenario}"][data-slot="${slot}"]`,
  );
  if (!current || !template) return;

  const next = template.content.firstElementChild?.cloneNode(true) as Element | undefined;
  if (!next) return;
  // The marker travels with the live panel, not with the template copy, so the
  // next switch can find whatever is standing here now.
  next.setAttribute(`data-stress-${slot}`, '');
  current.replaceWith(next);
}

export function enhanceScenarioSelector(): void {
  const selector = document.querySelector('[data-scenario-selector]');
  if (!selector || selector.hasAttribute('data-bound')) return;
  if (!document.querySelector('[data-stress-facts]')) return;
  selector.setAttribute('data-bound', '');

  selector.addEventListener('mdChange', (event) => {
    const [value] = (event as CustomEvent<string[]>).detail ?? [];
    if (!value) return;
    swap(value, 'facts');
    swap(value, 'table');
  });
}
