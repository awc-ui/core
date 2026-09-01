/**
 * The holdings screen's behaviour: filters, chips, both menus, both tables'
 * sort and paging, the tab-sensitive sort group and export target, and the CSV
 * export.
 *
 * WHAT THIS FILE IS ALLOWED TO DO, AND WHAT IT IS NOT.
 *
 * `md-table` sorts nothing and pages nothing, `md-search` narrows nothing and
 * `md-multi-select` filters no rows — every one of them is display state plus a
 * REQUEST, and the host answers it. The React build answers by re-reading
 * `getPositions()` / `getInstruments()`; this build answers from the rows the
 * server already wrote, by RE-ORDERING and DETACHING them. That is the same
 * division `client/book-table.mjs` draws for the overview's book table, and the
 * same one credit-risk's `client/table.mjs` draws for a paged one.
 *
 * It therefore never COMPUTES a figure. Sorting compares raw values, filtering
 * compares raw keys, paging slices an array — none of that is arithmetic about
 * the domain. Anything that would be (the region / currency / mover roll-ups
 * React re-derives from the filtered rows) is left alone and the screen module
 * says so where it renders them: summing market values here would be exactly the
 * arithmetic-in-a-component the kit exists to prevent.
 *
 * DETACHED, NEVER HIDDEN. A hidden row is still a row — in `querySelectorAll`,
 * in the accessibility tree, in the census the parity check takes — and the
 * React build renders a shorter array, not a longer one with holes. Rows that
 * fall out of the filter or off the page are held in memory and come back in
 * whatever order the current sort dictates.
 *
 * RAW KEYS, NEVER CELL TEXT. The visible text is localised and compacted —
 * "€1,2 mil." in Romanian, "٤٫٩٪" in Arabic — and comparing that lexically is
 * wrong in a different way in each of the three languages. Every comparison
 * reads a `data-sort-*` / `data-class` / `data-region` stamp written at build
 * time from the kit's own record.
 *
 * NO ENGLISH. Every string this file puts on screen was translated at build time
 * and travels on the element it belongs to: the count templates on the toolbars,
 * the search labels on `md-search`, the chip-row labels on the row itself, the
 * asset-class and region names on the option and menu rows already in the
 * document, the CSV headers on the tables.
 */

/* --------------------------------------------------------------- utilities */

/** Same colours and shape as `highlight()` in `lib/bits.mjs`. */
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

/** `text` with the query's matches marked. Built only from escaped pieces. */
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
  // Attribute names are lowercased by the parser, so `marketValueEur` was
  // written as `data-sort-marketvalueeur` and has to be looked up that way.
  const raw = row.getAttribute(`data-sort-${column.toLowerCase()}`);
  if (raw === null) return '';
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : raw;
}

/**
 * The kit's `by()` comparator, mirrored rather than approximated: numbers
 * compare numerically, strings with `localeCompare('en')` over the UNTRANSLATED
 * value, and ties break on the row's `value` (the record id) so two rows with
 * the same figure come out in the same order in every framework build.
 */
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

/** `{shown} of {total}` — written by the build, refilled in place from here. */
function fillCount(el, attribute, target, shown, total) {
  const template = el?.getAttribute(attribute);
  if (!template) return;
  el.setAttribute(target, template.replace('%shown%', String(shown)).replace('%total%', String(total)));
}

/**
 * The kit's `matches()` haystack, for the search box.
 *
 * `getPositions` matches on ticker, instrument name and id, and
 * `getInstruments` on ticker, name and id — the same three fields, and the id is
 * rendered in no column, which is why the household cell is NOT part of it and
 * is never marked.
 */
function haystack(row) {
  return `${row.dataset.ticker} ${row.dataset.name} ${row.getAttribute('value')}`.toLocaleLowerCase(
    'en',
  );
}

/* ------------------------------------------------------------------ tables */

/**
 * One table: its rows, its sort, its page.
 *
 * The first page is live in `md-table-body` and the rest wait in
 * `<template data-rows>`; the two are merged ONCE here, in the order the server
 * rendered, and from then on the same nodes are moved in and out of the body.
 * Cloning on every render would re-upgrade a sparkline per row per page turn and
 * throw away any expanded detail the reader had opened.
 */
function bindTable(container) {
  const table = container.querySelector('md-table[data-holdings-table]');
  const body = table?.querySelector('md-table-body');
  const toolbar = container.querySelector('md-table-toolbar');
  const pagination = container.querySelector('md-table-pagination');
  const template = container.querySelector('template[data-rows]');
  if (!table || !body) return null;

  const [column, order] = (table.dataset.defaultSort || '').split(':');
  const defaultSort = { column, order };

  // The live first page plus the spares, in the server's order. `adoptNode`
  // rather than `cloneNode`: these become the page's real rows.
  const all = [...body.children];
  if (template) {
    for (const row of [...template.content.children]) all.push(document.adoptNode(row));
  }
  const total = all.length;

  const state = {
    sort: { ...defaultSort },
    page: 0,
    rowsPerPage: Number(table.closest('md-table-container')?.querySelector('md-table-pagination')?.getAttribute('rows-per-page')) || 25,
    /** The rows the current filters keep, in the current sort's order. */
    matching: all,
  };

  function render(query = '') {
    const needle = query.trim();

    // The highlight follows the query for every row that can still show it, and
    // is stripped again when the query goes — on detached rows included, so a
    // row returning after a clear does not carry a stale mark.
    for (const row of all) {
      for (const el of row.querySelectorAll('[data-hl]')) {
        const text = el.dataset.hl === 'ticker' ? row.dataset.ticker : row.dataset.name;
        if (needle) el.innerHTML = highlight(text ?? '', needle);
        else el.textContent = text ?? '';
      }
    }

    const visible = sorted(state.matching, state.sort);

    // A filter or a smaller page size can strand the reader past the last page;
    // clamp rather than reset, so paging back is where they were.
    const last = Math.max(0, Math.ceil(visible.length / state.rowsPerPage) - 1);
    const safePage = Math.min(state.page, last);
    const offset = safePage * state.rowsPerPage;
    const slice = visible.slice(offset, offset + state.rowsPerPage);

    // One fragment, one reflow; replaceChildren detaches whatever fell out.
    const fragment = document.createDocumentFragment();
    for (const row of slice) fragment.append(row);
    body.replaceChildren(fragment);

    table.setAttribute('sort-by', state.sort.column);
    table.setAttribute('sort-order', state.sort.order);
    table.setAttribute('row-offset', String(offset));
    table.setAttribute('row-count', String(visible.length));
    if (visible.length === 0) table.setAttribute('empty', '');
    else table.removeAttribute('empty');

    fillCount(toolbar, 'data-count-template', 'supporting-text', slice.length, visible.length);
    if (pagination) {
      pagination.setAttribute('count', String(visible.length));
      pagination.setAttribute('page', String(safePage));
    }
  }

  /*
   * The three-state cycle ends in `none`, where the table clears its own
   * `sort-by` and reports an empty column. That is "no sort chosen", not "no
   * order at all", so it falls back to the order the page was rendered in — and
   * `setSort` puts the DISPLAY state back where the data actually is, because
   * the table has already blanked its arrow and would otherwise show none while
   * the rows stayed sorted. mdSortChange bubbles from the sort label, so one
   * listener on the table covers every column.
   */
  table.addEventListener('mdSortChange', (event) => {
    const { column: next, order: direction } = event.detail || {};
    const cleared = !next || direction === 'none';
    state.sort = cleared ? { ...defaultSort } : { column: next, order: direction };
    if (cleared) void table.setSort?.(defaultSort.column, defaultSort.order);
    api.onSortChanged(state.sort);
    api.render();
  });

  pagination?.addEventListener('mdPageChange', (event) => {
    state.page = event.detail?.page ?? 0;
    api.render();
  });

  pagination?.addEventListener('mdRowsPerPageChange', (event) => {
    const next = event.detail?.rowsPerPage;
    // The "all" option reports a sentinel rather than a count, and different
    // sentinels are plausible (-1, 0, the total). Anything that is not a usable
    // page size means the whole set.
    state.rowsPerPage = !next || next < 1 || next > total ? total : next;
    // No `page = 0` here: md-table-pagination has already reset the page and
    // emitted mdPageChange, which the handler above consumes. Resetting again is
    // the component's documented anti-pattern.
    api.render();
  });

  const api = {
    rows: all,
    state,
    /** Replaced by the screen binder, which owns the query and the sort menu. */
    render: () => render(''),
    onSortChanged: () => {},
    apply(matching, query) {
      state.matching = matching;
      render(query);
    },
    setSort(next) {
      state.sort = next;
      void table.setSort?.(next.column, next.order);
    },
    resetPage() {
      state.page = 0;
    },
  };
  return api;
}

/* ------------------------------------------------------------------ screen */

export function enhanceHoldings(root = document) {
  const bar = root.querySelector('[data-holdings-filters]');
  if (!bar || bar.hasAttribute('data-bound')) return;

  const containers = [...root.querySelectorAll('md-table-container:has(md-table[data-holdings-table])')];
  const tables = {};
  for (const container of containers) {
    const table = container.querySelector('md-table[data-holdings-table]');
    const bound = bindTable(container);
    if (bound) tables[table.dataset.holdingsTable] = bound;
  }
  if (!tables.positions || !tables.instruments) return;
  bar.setAttribute('data-bound', '');

  /*
   * THE UNIVERSE TABLE IS PARKED UNTIL ITS TAB IS FIRST OPENED.
   *
   * React mounts it on first activation and leaves it mounted, so its document
   * holds ONE table until the reader asks for the second. This document is
   * written with both — deliberately, because a reader without JavaScript can
   * reach neither tab and would simply lose forty instruments if the second
   * panel were empty. Both are therefore SERVER-RENDERED and the extra one is
   * DETACHED here, which is the same rule this file already states for rows
   * that fall out of a filter: detached, never hidden, because a hidden node is
   * still a node in querySelectorAll, in the accessibility tree, and in the
   * census the parity check takes.
   *
   * It is detached AFTER `bindTable`, so its sort, paging and export are all
   * wired before it leaves the document and are still wired when it returns —
   * listeners live on the nodes, not on their being attached.
   */
  const universe = containers.find(
    (c) => c.querySelector('md-table[data-holdings-table]')?.dataset.holdingsTable === 'instruments',
  );
  const universeHome = universe?.parentElement;
  let universeParked = false;
  if (universe && universeHome) {
    universe.remove();
    universeParked = true;
  }

  /* --------------------------------------------------------------- state */

  /*
   * Exactly the React screen's `HoldingsFilterState`, in the same shape and with
   * the same meaning for its empty values: `''` and `null` are "not filtered",
   * never `undefined`, so a patch can always clear a field.
   */
  const filters = { search: '', assetClasses: [], instrumentId: null, region: null, currency: null };
  let tab = 0;

  const search = bar.querySelector('[data-holdings-search]');
  const results = bar.querySelector('[data-holdings-results]');
  const suggestionSpares = bar.querySelector('template[data-suggestions]');
  const classes = bar.querySelector('[data-holdings-classes]');
  const instrumentField = bar.querySelector('[data-holdings-instrument]');
  const split = bar.querySelector('md-split-button');
  const more = bar.querySelector('md-icon-button[id]');
  const exportMenu = bar.querySelector(`md-menu[anchor="${split?.id}"]`);
  const moreMenu = bar.querySelector(`md-menu[anchor="${more?.id}"]`);
  const chipRow = bar.querySelector('[data-holdings-chips]');

  /** Every suggestion the page shipped, keyed by the position it belongs to. */
  const suggestions = new Map();
  for (const item of [...(results?.children ?? [])]) suggestions.set(item.dataset.position, item);
  if (suggestionSpares) {
    for (const item of [...suggestionSpares.content.children]) {
      suggestions.set(item.dataset.position, document.adoptNode(item));
    }
  }

  const isFiltered = () =>
    Boolean(
      filters.search ||
        filters.assetClasses.length ||
        filters.instrumentId ||
        filters.region ||
        filters.currency,
    );

  /* -------------------------------------------------------------- filters */

  /**
   * The rows one table keeps.
   *
   * Each clause is one field of the kit's `PositionFilter` / `InstrumentFilter`,
   * compared against the raw stamp rather than the rendered cell. The asset
   * classes are a UNION, which is what the React screen builds by asking the
   * selector once per chosen class and unioning the answers by id — the same set,
   * reached without a second copy of the rule.
   */
  function matching(rows) {
    const needle = filters.search.trim().toLocaleLowerCase('en');
    return rows.filter((row) => {
      if (filters.assetClasses.length && !filters.assetClasses.includes(row.dataset.class)) return false;
      if (filters.instrumentId && row.dataset.instrument !== filters.instrumentId) return false;
      if (filters.region && row.dataset.region !== filters.region) return false;
      if (filters.currency && row.dataset.currency !== filters.currency) return false;
      if (needle && !haystack(row).includes(needle)) return false;
      return true;
    });
  }

  /**
   * The universe's rows, and the one place the two tables do NOT narrow alike.
   *
   * React short-circuits this tab: picking an instrument is a question about ONE
   * security, and InstrumentFilter has no id field, so the answer comes from
   * getInstrumentById — one row, returned BEFORE any other clause is consulted.
   * The row therefore survives a region, currency, class or query that would
   * otherwise exclude it, which is the honest answer to "show me this one".
   * Reproduced here rather than smoothed over, because the two builds have to
   * put the same rows on screen for the same clicks.
   */
  function instrumentRows() {
    if (filters.instrumentId) {
      return tables.instruments.rows.filter(
        (row) => row.dataset.instrument === filters.instrumentId,
      );
    }
    return matching(tables.instruments.rows);
  }

  /* ---------------------------------------------------------------- chips */

  /**
   * The active-filter row, rebuilt from the filter state.
   *
   * Every label is read back out of the document: an asset class from the
   * multi-select's own option, a region from the menu row that set it, an
   * instrument from the autocomplete option's `data-ticker`. The query labels
   * itself — it is what the reader typed, and a dictionary key could only ever
   * describe it. A currency code is a proper noun and has no key at all.
   */
  function labelFor(kind, value) {
    if (kind === 'class') {
      return classes?.querySelector(`md-select-option[value="${value}"]`)?.getAttribute('label') ?? value;
    }
    if (kind === 'region') {
      return (
        moreMenu?.querySelector(`md-menu-item[data-action="region"][data-value="${value}"]`)
          ?.getAttribute('headline') ?? value
      );
    }
    if (kind === 'instrument') {
      return (
        instrumentField?.querySelector(`md-select-option[value="${value}"]`)?.dataset.ticker ?? value
      );
    }
    return value;
  }

  function activeChips() {
    const chips = [];
    if (filters.search) chips.push({ id: 'search', label: filters.search });
    for (const assetClass of filters.assetClasses) {
      chips.push({ id: `class:${assetClass}`, label: labelFor('class', assetClass) });
    }
    if (filters.instrumentId) {
      chips.push({ id: 'instrument', label: labelFor('instrument', filters.instrumentId) });
    }
    if (filters.region) chips.push({ id: 'region', label: labelFor('region', filters.region) });
    if (filters.currency) chips.push({ id: 'currency', label: filters.currency });
    return chips;
  }

  function renderChips() {
    if (!chipRow) return;
    const chips = activeChips();
    const fragment = document.createDocumentFragment();

    for (const chip of chips) {
      // `variant="input"` with `selectable="false"`: a token whose only action is
      // its ✕. The chip's own accessible name for that button is generated as
      // "Remove {label}", so the row needs no extra wiring.
      const el = document.createElement('md-chip');
      el.dataset.filter = chip.id;
      el.setAttribute('variant', 'input');
      el.setAttribute('appearance', 'outlined');
      el.setAttribute('selectable', 'false');
      el.setAttribute('removable', '');
      el.setAttribute('label', chip.label);
      fragment.append(el);
    }

    if (chips.length) {
      const clear = document.createElement('md-button');
      clear.setAttribute('variant', 'text');
      clear.setAttribute('size', 'xs');
      clear.setAttribute('icon', 'filter_alt_off');
      clear.textContent = chipRow.dataset.clearLabel ?? '';
      fragment.append(clear);
    }

    chipRow.replaceChildren(fragment);

    // The group role is dropped while the row is empty — an empty labelled group
    // is noise in the accessibility tree — but the row keeps its height.
    if (chips.length) {
      chipRow.setAttribute('role', 'group');
      chipRow.setAttribute('aria-label', chipRow.dataset.filterLabel ?? '');
      chipRow.removeAttribute('aria-hidden');
    } else {
      chipRow.removeAttribute('role');
      chipRow.removeAttribute('aria-label');
      chipRow.setAttribute('aria-hidden', 'true');
    }
  }

  /* ------------------------------------------------------- search results */

  /**
   * The first few matching positions, as the items the page already shipped.
   * How many is the build's own SUGGESTION_COUNT, read off the element rather
   * than restated here, so the two can never disagree about the panel's length.
   */
  const suggestionCount = Number(search?.dataset.suggestionCount) || 6;

  function renderSuggestions(rows) {
    if (!results) return;
    const fragment = document.createDocumentFragment();
    for (const row of rows.slice(0, suggestionCount)) {
      const item = suggestions.get(row.getAttribute('value'));
      if (item) fragment.append(item);
    }
    results.replaceChildren(fragment);
    if (search) {
      fillCount(search, 'data-results-template', 'results-label', fragment.childElementCount, rows.length);
      const empty = search.getAttribute('data-no-results-template');
      if (empty) search.setAttribute('no-results-label', empty.replace('%query%', filters.search));
    }
  }

  /* ---------------------------------------------------------------- apply */

  function apply() {
    const positions = matching(tables.positions.rows);
    tables.positions.apply(positions, filters.search);
    tables.instruments.apply(instrumentRows(), filters.search);
    renderSuggestions(sorted(positions, tables.positions.state.sort));
    renderChips();

    const clear = moreMenu?.querySelector('md-menu-item[data-action="clear"]');
    if (clear) {
      if (isFiltered()) clear.removeAttribute('disabled');
      else clear.setAttribute('disabled', '');
    }
  }

  /** A filter change always returns both tables to their first page: the rows
   *  under the reader's page number are not the rows they were looking at. */
  function changed() {
    tables.positions.resetPage();
    tables.instruments.resetPage();
    apply();
  }

  /* ------------------------------------------------------------- controls */

  /*
   * `mdSearch`, and only `mdSearch`. `mdInput` fires on every keystroke,
   * `mdSubmit` on Enter and `mdChange` on a changed blur; binding more than one
   * of them to the same query runs it up to four times per typing burst.
   * `mdSearch` is the debounced, trimmed, de-duplicated one, and both Enter and
   * the clear button flush it — so clearing the field delivers an empty query
   * immediately and needs no separate `mdClear` handler.
   */
  search?.addEventListener('mdSearch', (event) => {
    filters.search = event.detail?.value ?? '';
    changed();
  });

  // The rows are `md-list-item type="button"`, so each one emits `mdClick` and it
  // bubbles: one delegated listener on the list covers every result.
  results?.addEventListener('mdClick', (event) => {
    const row = event.target?.closest?.('md-list-item');
    const instrumentId = row?.dataset.instrument;
    if (!instrumentId) return;
    filters.instrumentId = instrumentId;
    if (instrumentField) {
      instrumentField.value = instrumentId;
      instrumentField.inputValue =
        instrumentField.querySelector(`md-select-option[value="${instrumentId}"]`)?.getAttribute('label') ?? '';
    }
    changed();
    void search?.close?.();
  });

  classes?.addEventListener('mdChange', (event) => {
    filters.assetClasses = event.detail ?? [];
    changed();
  });

  instrumentField?.addEventListener('mdChange', (event) => {
    const value = Array.isArray(event.detail) ? event.detail[0] : event.detail;
    filters.instrumentId = value || null;
    changed();
  });

  /* ---------------------------------------------------------------- chips */

  /*
   * `preventDefault()` IS THE POINT. `mdRemove`'s default action is the chip
   * removing ITSELF from the DOM — a node this file owns and re-renders, and a
   * chip removed twice is a chip that is gone before the state that put it there
   * has changed. Cancel the default and let the re-render drop it. `mdRemove`
   * bubbles, so one listener on the row covers every chip.
   */
  chipRow?.addEventListener('mdRemove', (event) => {
    event.preventDefault();
    const id = event.target?.closest?.('md-chip')?.dataset.filter;
    if (!id) return;
    if (id === 'search') {
      filters.search = '';
      if (search) search.value = '';
    } else if (id.startsWith('class:')) {
      const value = id.slice('class:'.length);
      filters.assetClasses = filters.assetClasses.filter((entry) => entry !== value);
      if (classes) classes.value = filters.assetClasses;
    } else if (id === 'instrument') {
      filters.instrumentId = null;
      if (instrumentField) {
        instrumentField.value = '';
        instrumentField.inputValue = '';
      }
    } else if (id === 'region' || id === 'currency') {
      filters[id] = null;
      selectRadio(id, '');
    }
    changed();
  });

  /*
   * "Clear filters" rides on the SAME container listener rather than a node of
   * its own: the button is created and destroyed with the chip set, and a
   * listener bound to it would go with it. `mdClick` bubbles and is composed,
   * and the chips are `selectable="false"`, so the button is the only thing in
   * here that can emit one.
   */
  chipRow?.addEventListener('mdClick', (event) => {
    if (!event.target?.closest?.('md-button')) return;
    clearAll();
  });

  /** Push a radio group in the overflow menu back to one value. The component
   *  owns exclusivity within its own `md-menu-item-group`, so writing the winner
   *  is enough — the sibling clears itself. */
  function selectRadio(action, value) {
    const rows = moreMenu?.querySelectorAll(`md-menu-item[data-action="${action}"]`) ?? [];
    for (const row of rows) {
      if ((row.dataset.value ?? '') === value) row.setAttribute('selected', '');
      else row.removeAttribute('selected');
    }
  }

  function clearAll() {
    filters.search = '';
    filters.assetClasses = [];
    filters.instrumentId = null;
    filters.region = null;
    filters.currency = null;
    // The three fields own their own value, so the reset has to be written back
    // into each of them by hand — nothing here re-renders them.
    if (search) search.value = '';
    if (classes) classes.value = [];
    if (instrumentField) {
      instrumentField.value = '';
      instrumentField.inputValue = '';
    }
    selectRadio('region', '');
    selectRadio('currency', '');
    changed();
  }

  /* ---------------------------------------------------------------- menus */

  // The default half exports the view you are looking at; the menu is the same
  // verb applied to a different subject, which is what makes this a split button
  // rather than a button standing next to a menu.
  split?.addEventListener('mdLeadingClick', () => exportCsv(tab === 0 ? 'holdings' : 'instruments'));

  // The split button flips `trailing-checked` itself and reports the new state;
  // writing it back here would double-toggle it.
  split?.addEventListener('mdTrailingClick', (event) => {
    void (event.detail?.checked ? exportMenu?.show?.() : exportMenu?.close?.());
  });

  // …but the menu can also close by Escape, an outside click or a pick, and the
  // button cannot see any of those. `mdClose` neither bubbles nor crosses a
  // shadow boundary, so this listener has to sit on the menu itself.
  exportMenu?.addEventListener('mdClose', () => {
    if (split) split.trailingChecked = false;
  });

  exportMenu?.addEventListener('mdClick', (event) => {
    const target = event.target?.closest?.('md-menu-item')?.dataset.export;
    if (target) exportCsv(target);
  });

  more?.addEventListener('mdClick', () => {
    void moreMenu?.show?.();
  });

  /*
   * One delegated listener for the whole overflow tree.
   *
   * `mdClick` bubbles out of the nested submenus too, so the rows carry `data-*`
   * rather than being told apart by position. A click on the `md-sub-menu-item`
   * row itself also lands here and carries no `data-action`, which is exactly
   * right: opening a branch is a hover / ArrowRight gesture, not a command.
   */
  moreMenu?.addEventListener('mdClick', (event) => {
    const row = event.target?.closest?.('md-menu-item');
    const action = row?.dataset.action;
    const value = row?.dataset.value ?? '';
    if (action === 'region') {
      filters.region = value || null;
      changed();
    } else if (action === 'currency') {
      filters.currency = value || null;
      changed();
    } else if (action === 'sort') {
      sortByColumn(value);
    } else if (action === 'clear') {
      clearAll();
    }
  });

  /* ----------------------------------------------------------------- sort */

  const active = () => (tab === 0 ? tables.positions : tables.instruments);

  /**
   * The menu names a column, not a direction, so the direction comes from the
   * same rule the header uses: figures descend, names ascend — which is what the
   * header's own `default-order` already says, so it is read off the label rather
   * than restated here. Re-picking the column already sorted flips it, which is
   * what the header does on its second click.
   */
  function sortByColumn(column) {
    if (!column) return;
    const table = active();
    const label = root.querySelector(
      `md-table[data-holdings-table="${tab === 0 ? 'positions' : 'instruments'}"] md-table-sort-label[column="${column}"]`,
    );
    const fallback = label?.getAttribute('default-order') === 'desc' ? 'desc' : 'asc';
    const current = table.state.sort;
    const next =
      current.column === column
        ? { column, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { column, order: fallback };
    table.setSort(next);
    // `setSort` re-emits mdSortChange, which lands in the table's own handler and
    // settles on the state it has just been given — including the menu update.
  }

  /** Keep the sort group's radio in step with whatever the table is sorted by,
   *  however the sort was asked for. */
  function markSort(which, sort) {
    if (which !== (tab === 0 ? 'positions' : 'instruments')) return;
    const rows = moreMenu?.querySelectorAll('md-menu-item[data-action="sort"]') ?? [];
    for (const row of rows) {
      if (row.dataset.value === sort.column) row.setAttribute('selected', '');
      else row.removeAttribute('selected');
    }
  }

  tables.positions.onSortChanged = (sort) => markSort('positions', sort);
  tables.instruments.onSortChanged = (sort) => markSort('instruments', sort);
  tables.positions.render = () => tables.positions.apply(matching(tables.positions.rows), filters.search);
  tables.instruments.render = () => tables.instruments.apply(instrumentRows(), filters.search);

  /* ------------------------------------------------------------------ tab */

  /*
   * `md-tab-panels` switches the panels itself; this listener is for the side
   * effects only — which table the sort group mirrors, and what the split
   * button's default half exports. The universe's sort group waits in a
   * template, so the swap is a clone-and-replace rather than a rebuild.
   */
  root.querySelector('[data-holdings-tabs]')?.addEventListener('mdTabChange', (event) => {
    tab = event.detail?.index ?? 0;
    // First time the universe tab is opened, the table goes back in — and stays,
    // which is the state React settles into once it has mounted it.
    if (tab === 1 && universeParked) {
      universeHome.append(universe);
      universeParked = false;
    }
    const wanted = tab === 0 ? 'positions' : 'instruments';
    const live = moreMenu?.querySelector('md-menu-item-group[data-sort-group]');
    if (!live || live.dataset.sortGroup === wanted) return;

    const spare = moreMenu?.querySelector(`template[data-sort-group="${wanted}"]`);
    const next = spare?.content.firstElementChild?.cloneNode(true);
    if (!next) return;
    // The group that leaves goes back into the template it came from, so the two
    // can be swapped back and forth without either being rebuilt.
    const home = moreMenu.querySelector(`template[data-sort-group="${live.dataset.sortGroup}"]`);
    live.replaceWith(next);
    if (home) home.content.replaceChildren(live);
    markSort(wanted, active().state.sort);
  });

  /* --------------------------------------------------------------- export */

  /**
   * A REAL FILE, of exactly what is on screen.
   *
   * The rows are the FILTERED set, not the visible page — "export the view"
   * means the selection you made, not the twenty-five rows you happen to be
   * looking at. The cells were written raw at build time in `data-csv`
   * (unformatted numbers survive a spreadsheet import in any locale, where a
   * grouped, localised figure does not) and the headers translated in
   * `data-csv-header`, because a human reads those. The filename carries the
   * fixture's frozen reporting date, so two runs produce two identical files —
   * there is no clock here, as there is nowhere else in this vertical.
   */
  function exportCsv(target) {
    const cell = (value) => {
      const text = String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    let source = null;
    let rows = [];
    if (target === 'concentration') {
      source = root.querySelector('[data-holdings-concentration]');
      rows = [...(source?.querySelectorAll('[data-csv]') ?? [])];
    } else {
      const which = target === 'instruments' ? 'instruments' : 'holdings';
      source = root.querySelector(
        `md-table[data-holdings-table="${which === 'holdings' ? 'positions' : 'instruments'}"]`,
      );
      const table = which === 'holdings' ? tables.positions : tables.instruments;
      /*
       * SORTED, not the order the rows were rendered in. React hands the export
       * the very array the table is showing, which came out of getPositions()
       * already ordered by the current sort — so re-sorting here is not a second
       * opinion about the order, it is the only way to hand over the same rows in
       * the same sequence. `state.matching` is kept unsorted on purpose: the sort
       * is applied at render time, so the set and its order stay independent.
       */
      rows = sorted(table.state.matching, table.state.sort);
    }

    let header;
    try {
      header = JSON.parse(source?.getAttribute('data-csv-header') || '[]');
    } catch {
      // A malformed payload is a build-time mistake, not a runtime condition.
      console.error('[wealth] unreadable data-csv-header on', target);
      return;
    }

    const body = rows.map((row) => {
      try {
        return JSON.parse(row.getAttribute('data-csv') || '[]');
      } catch {
        return [];
      }
    });

    const csv = [header, ...body].map((row) => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${target}-${split?.dataset.exportStamp ?? ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /*
   * Nothing is filtered on arrival, so this first pass changes no row — it is
   * what wires the tables' in-memory row sets to the (empty) filter state and
   * puts the counts, the suggestions and the empty chip row in the state every
   * later change is a delta from.
   */
  apply();
}
