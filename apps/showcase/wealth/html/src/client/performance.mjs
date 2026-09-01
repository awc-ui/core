/**
 * The overview's period picker.
 *
 * In the React build the picker re-slices the growth series through the kit's
 * `tail()` and re-reads the window's figures through `returnWindow()`. Here
 * all four windows were computed at BUILD time, in the page's own language:
 *
 *   - the chart payloads (series, x axis, subtitle) ride in `data-periods` on
 *     the line chart, and switching assigns them as JS properties — the same
 *     channel `client/charts.mjs` uses for the axes, and safe pre-upgrade
 *     because Stencil's lazy proxy keeps own properties;
 *
 *   - each window's figures block ships as a `<template data-period-dl>`, and
 *     switching clones the requested one in and REPLACES the live `dl` — the
 *     credit-risk stress screen's swap idiom. Replaced, not hidden: the live
 *     document must hold one `dl`, exactly as React renders one.
 *
 * The `valueFormatter` set by `configureCharts()` survives the swap — only the
 * series and the x axis change with the window; the y axis and its formatter
 * are identical at all four periods by construction (the floor is fixed and
 * every window ends at the same last point).
 *
 * `md-segmented-button-set` manages its own selection, so nothing here writes
 * `selected` back — the picker is the one control on the panel that owns its
 * own state.
 */

export function enhancePerformancePeriods(root = document) {
  const panel = root.querySelector('[data-performance]');
  const picker = panel?.querySelector('[data-period-picker]');
  const chart = panel?.querySelector('md-line-chart[data-periods]');
  if (!panel || !picker || picker.hasAttribute('data-bound')) return;
  picker.setAttribute('data-bound', '');

  let periods = {};
  try {
    periods = JSON.parse(chart?.dataset.periods || '{}');
  } catch {
    // A malformed payload is a build-time mistake, not a runtime condition;
    // the 24-month default is still on the page and still true.
    console.error('[wealth] unreadable data-periods on the performance chart');
    return;
  }

  const subtitle = panel.querySelector('.panel__sub');

  picker.addEventListener('mdChange', (event) => {
    const [value] = event.detail ?? [];
    const payload = value && periods[value];
    if (!payload) return;

    if (chart) {
      chart.series = payload.series;
      chart.xAxis = payload.xAxis;
    }
    if (subtitle) subtitle.textContent = payload.subtitle;

    const current = panel.querySelector('[data-period-facts]');
    const template = panel.querySelector(`template[data-period-dl="${value}"]`);
    const next = template?.content.firstElementChild?.cloneNode(true);
    if (current && next) {
      // The marker travels with the live block, not the template copy, so the
      // next switch can find whatever is standing here now.
      next.setAttribute('data-period-facts', '');
      current.replaceWith(next);
    }
  });
}
