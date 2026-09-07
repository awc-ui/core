/** Templates retain the exact localized content rendered by the other ports. */
export function enhanceRebalanceQueue(root = document) {
  const panel = root.querySelector('[data-rebalance-queue]');
  const picker = panel?.querySelector('[data-rebalance-picker]');
  if (!panel || !picker || picker.hasAttribute('data-bound')) return;
  picker.setAttribute('data-bound', '');
  picker.addEventListener('mdSelectionChange', (event) => {
    const filter = event.detail?.values?.[0];
    if (!['all', 'breach', 'drifted'].includes(filter)) return;
    const template = panel.querySelector(`template[data-rebalance-template="${filter}"]`);
    const results = panel.querySelector('[data-rebalance-results]');
    if (template && results)
      results.replaceWith(template.content.firstElementChild.cloneNode(true));
    const countTemplate = panel.querySelector(
      `template[data-rebalance-count-template="${filter}"]`,
    );
    const count = panel.querySelector('[data-rebalance-count]');
    if (countTemplate && count) count.replaceChildren(countTemplate.content.cloneNode(true));
  });
}
