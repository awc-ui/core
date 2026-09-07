/** Swap chart data in place so keyboard focus stays on the selected control. */
export function enhanceBalanceHistory(root = document) {
  const panel = root.querySelector('[data-balance-history]');
  const picker = panel?.querySelector('[data-history-picker]');
  if (!panel || !picker || picker.hasAttribute('data-bound')) return;
  const periods = JSON.parse(panel.dataset.periods || '{}');
  picker.setAttribute('data-bound', '');
  picker.addEventListener('mdSelectionChange', (event) => {
    const payload = periods[event.detail?.values?.[0]];
    if (!payload) return;
    const chart = panel.querySelector('md-area-chart');
    if (chart) {
      chart.series = payload.series;
      chart.xAxis = payload.xAxis;
    }
    const subtitle = panel.querySelector('.panel__sub');
    if (subtitle) subtitle.textContent = payload.subtitle;
    const change = panel.querySelector('[data-history-change] bdi');
    if (change) {
      change.textContent = payload.change;
      change.className = `num ${payload.direction}`;
    }
  });
}
