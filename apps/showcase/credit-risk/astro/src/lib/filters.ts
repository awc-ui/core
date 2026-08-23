/**
 * Progressive enhancement for the watchlist filters.
 *
 * The React build filters by re-rendering a smaller array. There is no
 * re-render here, so every signal is in the HTML and filtering hides rows that
 * do not match. That ordering matters: the page is complete before the script
 * runs, so with JavaScript off the reader gets the whole watchlist rather than
 * an empty table and three dead controls.
 *
 * The match is against `data-severity` / `data-sector` on the row, not the cell
 * text, for the same reason the sort is: the text is localised, and a filter
 * that compares translated strings works in English and quietly fails in the
 * other two languages.
 *
 * An empty severity selection means "all" — which is also exactly what the
 * segmented set reports when the last segment is cleared, so no separate "all"
 * segment is needed and the reset button restores precisely that state.
 */

interface Elements {
  severity: HTMLElement | null;
  sector: HTMLElement | null;
  clear: HTMLElement | null;
  rows: HTMLElement[];
  count: HTMLElement | null;
  empty: HTMLElement | null;
  table: HTMLElement | null;
}

/** `{shown} of {total}` — rendered by the server, updated in place from here. */
function updateCount(el: HTMLElement | null, shown: number): void {
  if (!el) return;
  const template = el.getAttribute('data-count-template');
  if (!template) return;
  el.setAttribute('label', template.replace('%shown%', String(shown)));
}

export function enhanceWatchlistFilters(): void {
  const root = document.querySelector('[data-watchlist]');
  if (!root || root.hasAttribute('data-bound')) return;
  root.setAttribute('data-bound', '');

  const el: Elements = {
    severity: root.querySelector('[data-filter-severity]'),
    sector: root.querySelector('[data-filter-sector]'),
    clear: root.querySelector('[data-filter-clear]'),
    rows: Array.from(root.querySelectorAll('md-table-row[data-severity]')),
    count: root.querySelector('[data-count]'),
    empty: root.querySelector('[data-empty]'),
    table: root.querySelector('md-table-container'),
  };

  let severities: string[] = [];
  let sector = '';

  function apply(): void {
    let shown = 0;
    for (const row of el.rows) {
      const matches =
        (severities.length === 0 || severities.includes(row.dataset.severity ?? '')) &&
        (sector === '' || row.dataset.sector === sector);
      row.hidden = !matches;
      if (matches) shown += 1;
    }
    updateCount(el.count, shown);
    // Swap the table for the empty state rather than leaving an empty grid with
    // a header and nothing under it, which reads as a broken page.
    if (el.table) el.table.hidden = shown === 0;
    if (el.empty) el.empty.hidden = shown !== 0;
  }

  el.severity?.addEventListener('mdChange', (event) => {
    severities = ((event as CustomEvent<string[]>).detail ?? []) as string[];
    apply();
  });

  el.sector?.addEventListener('mdChange', (event) => {
    sector = ((event as CustomEvent<string>).detail ?? '') as string;
    apply();
  });

  el.clear?.addEventListener('click', () => {
    severities = [];
    sector = '';
    // The custom elements own their own visual state, so a reset has to be
    // pushed back into them — nothing re-renders here to do it for us.
    el.severity?.querySelectorAll('md-segmented-button').forEach((segment) => {
      (segment as unknown as { selected: boolean }).selected = false;
    });
    if (el.sector) (el.sector as unknown as { value: string }).value = '';
    apply();
  });
}
