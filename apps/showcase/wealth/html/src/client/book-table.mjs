/**
 * Sorting, search and the segment facet for the overview's book table.
 *
 * `md-table` sorts nothing and filters nothing — `mdSortChange` is a REQUEST.
 * The React build answers it by re-reading `getHouseholds()`; this build
 * answers from the live rows themselves: all eight are in the document (there
 * is no pagination — eight households fit), so there is no `<template>` of
 * spares here, only re-ordering and DETACHING.
 *
 * DETACHED, NEVER HIDDEN. A hidden row is still a row — in
 * `querySelectorAll`, in the accessibility tree, in the census the parity
 * check takes — and the React build renders a shorter array, not a longer one
 * with holes. Non-matching rows are held in memory and come back in whatever
 * order the current sort dictates.
 *
 * THE COMPARISON MIRRORS THE KIT'S `by()` COMPARATOR, not an approximation of
 * it: raw values ride in `data-sort-*` (the cell text is localised and
 * compacted — "€1,2 mil." in Romanian — and sorting it lexically is wrong in a
 * different way per language), strings compare with `localeCompare('en')`, and
 * ties break on the row's `value` (the household id), because two households
 * with the same AUM must come out in the same order in every framework build.
 *
 * THE SEARCH MIRRORS `getHouseholds({ search })`: trimmed, folded with
 * `toLocaleLowerCase('en')`, matched against name AND id — the kit matches on
 * `id` too even though no column renders it. The matched run of the NAME is
 * wrapped in `<mark>` exactly as React's `<Highlight>` does: split on one
 * capture group, so every piece is written back as text, never as markup.
 */

/** The order the page was rendered in — restored when a sort is cleared. */
const DEFAULT_SORT = { column: 'totalAum', order: 'desc' };

/** Same colours and shape as `Highlight` in the React build's bits. */
const HIGHLIGHT_STYLE =
  'background:var(--md-sys-color-tertiary-container);' +
  'color:var(--md-sys-color-on-tertiary-container);' +
  'font-weight:500;padding-inline:1px;' +
  'border-radius:var(--md-sys-shape-corner-extra-small)';

const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** `text` with the query's matches marked. Returns HTML built only from escaped pieces. */
function highlight(text, needle) {
  if (!needle) return escapeHtml(text);
  const parts = String(text).split(
    new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'),
  );
  // One capture group makes the result alternate: odd indices are the matches.
  return parts
    .map((part, index) =>
      index % 2 === 1 ? `<mark style="${HIGHLIGHT_STYLE}">${escapeHtml(part)}</mark>` : escapeHtml(part),
    )
    .join('');
}

function readKey(row, column) {
  // Attribute names are lowercased by the parser, so `totalAum` was written as
  // `data-sort-totalaum` and has to be looked up that way.
  const raw = row.getAttribute(`data-sort-${column.toLowerCase()}`);
  if (raw === null) return '';
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : raw;
}

function sorted(rows, { column, order }) {
  const direction = order === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = readKey(a, column);
    const bv = readKey(b, column);
    const tie = () =>
      String(a.getAttribute('value')).localeCompare(String(b.getAttribute('value')), 'en');
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction || tie();
    return String(av).localeCompare(String(bv), 'en') * direction || tie();
  });
}

/** `{shown} of {total}` — written by the build, updated in place from here. */
function updateCount(toolbar, shown) {
  const template = toolbar?.getAttribute('data-count-template');
  if (!template) return;
  toolbar.setAttribute('supporting-text', template.replace('%shown%', String(shown)));
}

export function enhanceBookTable(root = document) {
  const table = root.querySelector('md-table[data-book]');
  if (!table || table.hasAttribute('data-bound')) return;
  table.setAttribute('data-bound', '');

  const container = table.closest('md-table-container');
  const toolbar = container?.querySelector('md-table-toolbar');
  const searchEl = container?.querySelector('[data-filter-search]');
  const segmentEl = container?.querySelector('[data-filter-segment]');
  const body = table.querySelector('md-table-body');
  const emptyTemplate = container?.parentElement?.querySelector('template[data-empty]');
  if (!body) return;

  // Captured once, in the order the server rendered (largest AUM first — the
  // same default the kit's selector applies with no filter).
  const all = [...body.children];

  let sort = { ...DEFAULT_SORT };
  let search = '';
  let segment = '';

  /** The rendered empty state, once there is one. React renders it or nothing. */
  let emptyEl = null;

  function apply() {
    const needle = search.trim().toLocaleLowerCase('en');

    const matching = all.filter((row) => {
      if (segment !== '' && row.dataset.segment !== segment) return false;
      if (!needle) return true;
      // Name AND id, joined the way the kit's `matches()` joins its haystack.
      return `${row.dataset.name} ${row.getAttribute('value')}`
        .toLocaleLowerCase('en')
        .includes(needle);
    });

    const visible = sorted(matching, sort);

    // The highlight follows the query for every row that can still show it —
    // and is stripped again when the query goes, on detached rows included, so
    // a row returning after a clear does not carry a stale mark.
    for (const row of all) {
      const anchor = row.querySelector('.drill');
      if (!anchor) continue;
      const name = row.dataset.name ?? '';
      if (needle) anchor.innerHTML = highlight(name, search.trim());
      else anchor.textContent = name;
    }

    // One fragment, one reflow; replaceChildren detaches whatever fell out.
    const fragment = document.createDocumentFragment();
    for (const row of visible) fragment.append(row);
    body.replaceChildren(fragment);

    table.setAttribute('sort-by', sort.column);
    table.setAttribute('sort-order', sort.order);
    table.setAttribute('row-count', String(visible.length));
    updateCount(toolbar, visible.length);

    /*
     * The empty state stays INSIDE the table (slot="empty"), because
     * emptiness here is always the reader's own filter and the controls to
     * undo it must not disappear with the rows. The message names the query
     * when there is one — `%query%` was left open in the baked string.
     */
    const isEmpty = visible.length === 0;
    if (isEmpty) table.setAttribute('empty', '');
    else table.removeAttribute('empty');

    if (isEmpty && !emptyEl && emptyTemplate) {
      emptyEl = emptyTemplate.content.firstElementChild?.cloneNode(true) ?? null;
      if (emptyEl) table.append(emptyEl);
    }
    if (emptyEl) {
      if (!isEmpty) {
        emptyEl.remove();
        emptyEl = null;
      } else {
        const message = emptyEl.querySelector('p');
        if (message) {
          message.textContent = needle
            ? (emptyTemplate.getAttribute('data-msg-search') || '').replace(
                '%query%',
                search.trim(),
              )
            : message.textContent;
        }
      }
    }
  }

  /*
   * The three-state cycle ends in `none`, where the table clears its own
   * `sort-by` and reports an empty column. That is "no sort chosen", not "no
   * order at all", so it falls back to the same default the unfiltered book
   * has. mdSortChange bubbles from the sort label, so one listener is enough.
   */
  table.addEventListener('mdSortChange', (event) => {
    const { column, order } = event.detail || {};
    sort = !column || order === 'none' ? { ...DEFAULT_SORT } : { column, order };
    apply();
  });

  // mdInput rather than mdChange: the field commits on blur, and a filter that
  // only applies when you leave it feels broken. The field stays uncontrolled;
  // its internal ✕ emits mdInput with an empty string, landing here like any
  // other keystroke.
  searchEl?.addEventListener('mdInput', (event) => {
    search = event.detail ?? '';
    apply();
  });

  segmentEl?.addEventListener('mdChange', (event) => {
    segment = event.detail ?? '';
    apply();
  });
}
