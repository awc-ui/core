/**
 * Sorting and paging for the counterparty table.
 *
 * `md-table` sorts nothing and `md-table-pagination` pages nothing — both are
 * display state plus a REQUEST. The host decides what the new order or slice is
 * and re-renders. The React build answers by re-reading `getCounterparties()`;
 * this build answers from the `<template data-rows>` beside the table, which
 * holds the whole book in the order the server rendered it.
 *
 * WHY A TEMPLATE AND NOT THE FIXTURE. Bundling the selectors would mean
 * shipping the fixture to the browser to re-derive rows that were already
 * formatted, in the right language, at build time. The template costs the same
 * bytes as the rows themselves and its contents are inert — not rendered, not
 * matched by `querySelectorAll`, no upgraded custom elements — so the live page
 * holds exactly the ten rows React's does.
 *
 * WHY `data-sort-*` AND NOT THE CELL TEXT. The visible text is localised and
 * compacted — "€1.2 md" in Romanian, "٤٫٩٪" in Arabic — and comparing that
 * lexically produces an order that is wrong in a different way in each of the
 * three languages. The raw value is stamped on the row at build time, so the
 * comparison is over numbers and untranslated names and every locale sorts
 * identically.
 */

/** The order and slice the server rendered, restored when a sort is cleared. */
const INITIAL = { column: 'ead', order: 'desc' } as const;
const PAGE_SIZE = 10;

function readKey(row: Element, column: string): string | number {
  // Attribute names are lowercased by the parser, so `expectedLoss` was written
  // as `data-sort-expectedloss` and has to be looked up that way.
  const raw = row.getAttribute(`data-sort-${column.toLowerCase()}`);
  if (raw === null) return '';
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : raw;
}

type Order = 'asc' | 'desc';
type Sort = { column: string; order: Order };
/** What `mdSortChange` actually reports — `none` means "cleared". */
type SortRequest = { column?: string; order?: Order | 'none' };

function sorted(rows: Element[], { column, order }: Sort): Element[] {
  const direction = order === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const av = readKey(a, column);
    const bv = readKey(b, column);
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    // localeCompare with no locale: these are untranslated legal names, and the
    // point is a stable order, not a locale-perfect collation of proper nouns.
    return String(av).localeCompare(String(bv)) * direction;
  });
}

export function enhancePagedTables(root: ParentNode = document): void {
  for (const table of root.querySelectorAll('md-table[data-paged]')) {
    if (table.hasAttribute('data-paged-bound')) continue;
    table.setAttribute('data-paged-bound', '');

    const container = table.closest('md-table-container');
    const pagination = container?.querySelector('md-table-pagination');
    const template = container?.parentElement?.querySelector<HTMLTemplateElement>(
      'template[data-rows]',
    );
    const body = table.querySelector('md-table-body');
    if (!container || !template || !body) continue;
    const rowBody = body;

    const all = [...template.content.children];
    const total = all.length;

    let sort: Sort = { ...INITIAL };
    let page = 0;
    let rowsPerPage = PAGE_SIZE;

    function render() {
      // A sort or a smaller page size can leave the reader stranded past the
      // last page; clamp rather than reset, so paging back is where they were.
      const last = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
      const safePage = Math.min(page, last);
      const start = safePage * rowsPerPage;
      const slice = sorted(all, sort).slice(start, start + rowsPerPage);

      // One fragment, one reflow, rather than ten appendChild calls.
      const fragment = document.createDocumentFragment();
      for (const row of slice) fragment.append(row.cloneNode(true));
      rowBody.replaceChildren(fragment);

      table.setAttribute('sort-by', sort.column);
      table.setAttribute('sort-order', sort.order);
      table.setAttribute('row-offset', String(start));
      table.setAttribute('row-count', String(total));
      if (pagination) pagination.setAttribute('page', String(safePage));
    }

    // mdSortChange bubbles from the sort label to the table, so one listener is
    // enough. Clearing a sort restores the order the page was rendered in.
    table.addEventListener('mdSortChange', (event) => {
      const { column, order } = (event as CustomEvent<SortRequest>).detail ?? {};
      sort = !column || !order || order === 'none' ? { ...INITIAL } : { column, order };
      render();
    });

    pagination?.addEventListener('mdPageChange', (event) => {
      page = (event as CustomEvent<{ page: number }>).detail?.page ?? 0;
      render();
    });

    pagination?.addEventListener('mdRowsPerPageChange', (event) => {
      const next = (event as CustomEvent<{ rowsPerPage: number }>).detail?.rowsPerPage;
      // The "all" option reports a sentinel rather than a count, and different
      // sentinels are plausible (-1, 0, the total). Anything that is not a
      // usable page size means the whole book.
      rowsPerPage = !next || next < 1 || next > total ? total : next;
      // No `page = 0` here: md-table-pagination has already reset the page and
      // emitted mdPageChange, which the handler above consumes. Resetting again
      // is the component's documented anti-pattern.
      render();
    });
  }
}
