/**
 * Progressive enhancement for the watchlist filters.
 *
 * Every signal is in the HTML, so with JavaScript off the reader gets the whole
 * watchlist rather than an empty table and three dead controls.
 *
 * Filtering DETACHES the rows that do not match rather than hiding them, which
 * is what the React build does when it re-renders a shorter array. A hidden row
 * is still a row: still in `querySelectorAll`, still in the accessibility tree,
 * still counted by `row-count`. Since the six builds are meant to render the
 * same document, "the same" has to mean the same elements, not the same
 * picture. The detached rows are held in memory and put back in their original
 * order when the filter widens again.
 *
 * The match is against `data-severity` / `data-sector` on the row, not the cell
 * text, for the same reason the sort is: the text is localised, and a filter
 * that compares translated strings works in English and quietly fails in the
 * other two languages.
 */

/** `{shown} of {total}` — written by the build, updated in place from here. */
function updateCount(el, shown) {
  const template = el?.getAttribute('data-count-template');
  if (!template) return;
  el.setAttribute('label', template.replace('%shown%', String(shown)));
}

export function enhanceWatchlistFilters() {
  // Everything is looked up from the document. These used to be scoped to a
  // `<div data-watchlist>`, which made the queries tidy and quietly swallowed
  // the screen's flex `gap`: the wrapper became the single flex item and its
  // two panels had no gap between them. The wrapper is gone.
  const severityEl = document.querySelector('[data-filter-severity]');
  const sectorEl = document.querySelector('[data-filter-sector]');
  const clearEl = document.querySelector('[data-filter-clear]');
  const body = document.querySelector('md-table-body');
  const countEl = document.querySelector('[data-count]');
  const emptyTemplate = document.querySelector('template[data-empty]');
  const tableEl = document.querySelector('md-table-container');
  if (!severityEl || severityEl.hasAttribute('data-bound')) return;
  severityEl.setAttribute('data-bound', '');

  /** The rendered empty state, once there is one. React renders it or the table. */
  let emptyEl = null;

  // Captured once, in the order the server rendered — which is already highest
  // severity first, then largest exposure. Re-inserting from this list restores
  // that order however the reader narrowed and widened the filters.
  const all = body ? [...body.children] : [];

  let severities = [];
  let sector = '';

  function apply() {
    const matching = all.filter(
      (row) =>
        (severities.length === 0 || severities.includes(row.dataset.severity || '')) &&
        (sector === '' || row.dataset.sector === sector),
    );

    if (body) {
      const fragment = document.createDocumentFragment();
      for (const row of matching) fragment.append(row);
      body.replaceChildren(fragment);
    }

    updateCount(countEl, matching.length);

    // Swap the table FOR the empty state — one or the other is in the document,
    // never both, which is what the React build renders. Leaving an empty grid
    // with a header and nothing under it reads as a broken page; leaving a
    // hidden empty state in the document is an element React does not have.
    const isEmpty = matching.length === 0;
    if (tableEl) tableEl.hidden = isEmpty;
    if (isEmpty && !emptyEl && emptyTemplate) {
      emptyEl = emptyTemplate.content.firstElementChild?.cloneNode(true) ?? null;
      if (emptyEl) emptyTemplate.parentElement?.insertBefore(emptyEl, emptyTemplate);
    } else if (!isEmpty && emptyEl) {
      emptyEl.remove();
      emptyEl = null;
    }
  }

  severityEl?.addEventListener('mdChange', (event) => {
    severities = event.detail || [];
    apply();
  });

  sectorEl?.addEventListener('mdChange', (event) => {
    sector = event.detail || '';
    apply();
  });

  clearEl?.addEventListener('click', () => {
    severities = [];
    sector = '';
    // The custom elements own their own visual state, so a reset has to be
    // pushed back into them — nothing re-renders here to do it for us.
    severityEl?.querySelectorAll('md-segmented-button').forEach((segment) => {
      segment.selected = false;
    });
    if (sectorEl) sectorEl.value = '';
    apply();
  });
}
