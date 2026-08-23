/**
 * The overview's sector bars are doors.
 *
 * `md-bar-chart` reports `mdBarClick` with the index of the bar. The hrefs were
 * written into `data-drill` in plot order, already carrying this page's locale
 * segment, so nothing here has to re-derive either the bar order or the
 * language — it looks the target up and navigates.
 *
 * A real navigation rather than a router push: this build is a document per
 * route, so that is what a click on a door is supposed to do.
 */

export function enhanceChartDrilldowns(root: ParentNode = document): void {
  for (const chart of root.querySelectorAll<HTMLElement>('[data-drill]')) {
    if (chart.hasAttribute('data-drill-bound')) continue;
    chart.setAttribute('data-drill-bound', '');

    const targets = (chart.dataset.drill || '').split(' ').filter(Boolean);
    chart.addEventListener('mdBarClick', (event) => {
      const href = targets[(event as CustomEvent<{ dataIndex: number }>).detail?.dataIndex ?? -1];
      if (href) location.assign(href);
    });
  }
}
