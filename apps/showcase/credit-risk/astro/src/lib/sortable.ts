/**
 * Progressive enhancement for the server-rendered tables.
 *
 * `md-table` sorts nothing by itself. `sort-by` / `sort-order` are display
 * state, and `mdSortChange` is a REQUEST: the host decides what the new order
 * is and re-renders. The React build answers it by re-reading the selector that
 * owns the data. There is no re-render here, so this reorders the rows already
 * in the DOM.
 *
 * WHY `data-sort-*` AND NOT THE CELL TEXT. The visible text is localised and
 * compacted — "€1.2 md" in Romanian, "٤٫٩٪" in Arabic — and comparing that
 * lexically produces an order that is wrong in a different way in each of the
 * three languages. The raw value is stamped on the row at build time, so the
 * comparison is over numbers and untranslated names, and every locale sorts
 * identically.
 *
 * Rows arrive already sorted by exposure descending, so with JavaScript off the
 * table is still in the order a credit officer wants. This only ever improves
 * on that.
 */

type Order = 'asc' | 'desc' | 'none';

interface SortDetail {
  column?: string;
  order?: Order;
}

/** The order the server rendered in, restored when a sort is cleared. */
const INITIAL = { column: 'ead', order: 'desc' as const };

function readKey(row: Element, column: string): string | number {
  // Attribute names are lowercased by the parser, so `expectedLoss` was written
  // as `data-sort-expectedloss` and has to be looked up that way.
  const raw = row.getAttribute(`data-sort-${column.toLowerCase()}`);
  if (raw === null) return '';
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : raw;
}

function sortRows(table: Element, column: string, order: Order): void {
  const body = table.querySelector('md-table-body');
  if (!body) return;

  const rows = Array.from(body.children);
  if (rows.length < 2) return;

  const resolved = order === 'none' ? INITIAL : { column, order };
  const direction = resolved.order === 'asc' ? 1 : -1;

  const sorted = rows.slice().sort((a, b) => {
    const av = readKey(a, resolved.column);
    const bv = readKey(b, resolved.column);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    // localeCompare with no locale: these are untranslated legal names, and the
    // point is a stable order, not a locale-perfect collation of proper nouns.
    return String(av).localeCompare(String(bv)) * direction;
  });

  // One fragment, one reflow, rather than twenty-four appendChild calls.
  const fragment = document.createDocumentFragment();
  for (const row of sorted) fragment.append(row);
  body.append(fragment);

  table.setAttribute('sort-by', resolved.column);
  table.setAttribute('sort-order', resolved.order);
}

/**
 * Wire every `<md-table data-sortable>` on the page.
 *
 * `mdSortChange` bubbles from the sort label to the table, so one listener per
 * table is enough. Safe to call more than once: the flag on the element stops a
 * second listener being attached, which would sort twice per click and land
 * back where it started.
 */
export function enhanceSortableTables(root: ParentNode = document): void {
  for (const table of root.querySelectorAll('md-table[data-sortable]')) {
    if (table.hasAttribute('data-sort-bound')) continue;
    table.setAttribute('data-sort-bound', '');
    table.addEventListener('mdSortChange', (event) => {
      const detail = (event as CustomEvent<SortDetail>).detail ?? {};
      if (!detail.column) return;
      sortRows(table, detail.column, detail.order ?? 'none');
    });
  }
}
