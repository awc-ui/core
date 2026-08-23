/**
 * Progressive enhancement for the watchlist filters.
 *
 * Every signal is in the HTML, so with JavaScript off the reader gets the whole
 * watchlist rather than an empty table and three dead controls.
 *
 * Filtering DETACHES the rows that do not match rather than hiding them, which
 * is what the React build does when it re-renders a shorter array. A hidden row
 * is still a row: still in `querySelectorAll`, still in the accessibility tree,
 * still counted. Since the six builds are meant to render the same document,
 * "the same" has to mean the same elements, not the same picture. The detached
 * rows are held in memory and put back in their original order — highest
 * severity first, then largest exposure — when the filter widens again.
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
  body: HTMLElement | null;
  /** Every row, in the order the server rendered. Rows leave and re-enter the DOM. */
  rows: HTMLElement[];
  count: HTMLElement | null;
  /** The empty state waits in here; React renders it INSTEAD of the table. */
  emptyTemplate: HTMLTemplateElement | null;
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
  // Everything is looked up from the document. These used to be scoped to a
  // `<div data-watchlist>`, which made the queries tidy and quietly swallowed
  // the screen's flex `gap`: the wrapper became the single flex item and its
  // two panels had no gap between them. The wrapper is gone.
  const el: Elements = {
    severity: document.querySelector('[data-filter-severity]'),
    sector: document.querySelector('[data-filter-sector]'),
    clear: document.querySelector('[data-filter-clear]'),
    body: document.querySelector('md-table-body'),
    rows: Array.from(document.querySelectorAll('md-table-row[data-severity]')),
    count: document.querySelector('[data-count]'),
    emptyTemplate: document.querySelector('template[data-empty]'),
    table: document.querySelector('md-table-container'),
  };

  if (!el.severity || el.severity.hasAttribute('data-bound')) return;
  el.severity.setAttribute('data-bound', '');

  let severities: string[] = [];
  let sector = '';
  /** The rendered empty state, once there is one. */
  let emptyEl: Element | null = null;

  function apply(): void {
    const matching = el.rows.filter(
      (row) =>
        (severities.length === 0 || severities.includes(row.dataset.severity ?? '')) &&
        (sector === '' || row.dataset.sector === sector),
    );

    if (el.body) {
      const fragment = document.createDocumentFragment();
      for (const row of matching) fragment.append(row);
      el.body.replaceChildren(fragment);
    }

    updateCount(el.count, matching.length);

    // Swap the table FOR the empty state — one or the other is in the document,
    // never both, which is what the React build renders. Leaving an empty grid
    // with a header and nothing under it reads as a broken page; leaving a
    // hidden empty state in the document is an element React does not have.
    const isEmpty = matching.length === 0;
    if (el.table) el.table.hidden = isEmpty;
    if (isEmpty && !emptyEl && el.emptyTemplate) {
      emptyEl = (el.emptyTemplate.content.firstElementChild?.cloneNode(true) as Element) ?? null;
      if (emptyEl) el.emptyTemplate.parentElement?.insertBefore(emptyEl, el.emptyTemplate);
    } else if (!isEmpty && emptyEl) {
      emptyEl.remove();
      emptyEl = null;
    }
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
