/**
 * Screen 2 — every holding in the book.
 *
 * THE REACT SCREEN'S SHAPE, VERBATIM: four KPI tiles, a filter bar that is
 * deliberately NOT inside a card (both `md-menu`s and `md-search`'s docked panel
 * are popups, and a card's `overflow: hidden` is what slices one in half), two
 * sibling views of one book behind `md-tabs`, three roll-up panels over what is
 * on screen, and the book-wide concentration list underneath.
 *
 * NOTHING HERE IS ARITHMETIC. Every figure, option list, order and column
 * template comes out of `@awc-ui/showcase-kit/wealth`: the rows from
 * `getPositions()` / `getInstruments()`, the choices from `assetClassTotals()`,
 * `regionTotals()` and `currencyExposure()` over the WHOLE book, the roll-ups
 * from the same three functions plus `topMovers()`, the concentration from
 * `bookHoldings(10)`, the twelve and eleven tracks from `TABLES`.
 *
 * ── WHAT THIS BUILD CAN AND CANNOT HOLD ──────────────────────────────────────
 *
 * The React screen owns five pieces of state — the filter set, a sort per table,
 * the tab, and the "has the universe been opened yet" flag — and answers every
 * change by RE-READING the kit's selectors. A file on disk has no state, so this
 * build writes the DEFAULT of every one of them into the page (no filters, both
 * tables at their default sort, tab 0, both tables fully rendered) and
 * `src/client/holdings.mjs` re-orders, narrows and pages the rows that are
 * already here, off `data-*` stamps carrying the RAW values the kit sorts and
 * matches on — never the localised cell text, which is compacted differently in
 * each of the three languages.
 *
 * That is the same division `src/client/book-table.mjs` draws for the overview's
 * book table, and the same one credit-risk's `client/table.mjs` draws for a
 * PAGED table: the first page is live, the rows it does not hold wait in a
 * `<template data-rows>` beside the table (inert — not rendered, not matched by
 * `querySelectorAll`, no upgraded components), and the client moves rows between
 * the two. No row is ever hidden; rows that fall out are DETACHED, so the live
 * element census is exactly React's.
 *
 * TWO THINGS THE REACT SCREEN DOES THAT A STATIC PAGE HONESTLY CANNOT, both
 * called out where they happen rather than quietly dropped:
 *
 *   1. The three roll-up panels (regions, currency, movers) are computed by
 *      React over the FILTERED rows. Recomputing them here would mean either
 *      shipping the fixture to the browser or summing market values in a client
 *      script — the arithmetic-in-a-component the kit exists to prevent (§22).
 *      They are therefore rendered over the whole book, which is exactly what
 *      React shows at first paint, and they do not follow the live filters.
 *      The concentration panel below them is book-wide in React too, so that one
 *      is exact.
 *
 *   2. `md-tab-panels sizing="active"` lazily mounts the universe table in
 *      React, behind a `TableSkeleton` placeholder. It is written into this
 *      file anyway, because a reader without JavaScript can reach neither tab
 *      and an empty second panel would simply lose them forty instruments.
 *      `client/holdings.mjs` then DETACHES it until the tab is first opened, so
 *      a document with scripting holds exactly the one table React's does and
 *      gains the second at the same moment React mounts it — the file keeps the
 *      no-JS reader whole, the client keeps the census honest.
 *
 * WHAT THE CLIENT ADDS (all progressive; the page is complete without it):
 * search, the asset-class / instrument / region / currency filters, the active
 * filter chips, both menus, both tables' sort and paging, the tab-sensitive sort
 * group and export target, and the CSV export. See `src/client/holdings.mjs`.
 */

import {
  assetClassTotals,
  bookHoldings,
  concentration,
  currencyExposure,
  getBookTotals,
  getHouseholdById,
  getInstrumentById,
  getInstruments,
  getPortfolioById,
  getPositions,
  plColor,
  regionTotals,
  REPORTING_DATE,
  route,
  crumbsFor,
  TABLES,
  topMovers,
} from '@awc-ui/showcase-kit/wealth';
import { attrs, html, style } from '../lib/html.mjs';
import { sparkline } from '../lib/charts.mjs';
import {
  assetClassChip,
  count,
  dateText,
  drill,
  fact,
  instrumentTypeChip,
  kpiTile,
  money,
  num,
  percent,
  ratioMeter,
  signed,
} from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

/* --------------------------------------------------------------- constants */

/** Where each table starts, and where a cleared sort returns to. */
const POSITION_SORT = { column: 'marketValueEur', order: 'desc' };
const INSTRUMENT_SORT = { column: 'ticker', order: 'asc' };

/** How many matches the search panel offers before you commit to the query. */
const SUGGESTION_COUNT = 6;

/** The page both tables open at. `md-table-pagination` offers 10/25/50/all. */
const ROWS_PER_PAGE = 25;

/*
 * Element ids, written out rather than generated.
 *
 * `md-menu` resolves `anchor` with `getElementById`, so the trigger needs a
 * stable id in the document. Exactly one holdings page is ever open, so a
 * literal is both safe and greppable — and unlike React's `useId()` it contains
 * no colons for a later `querySelector('#…')` to trip over.
 */
const EXPORT_TRIGGER = 'wealth-holdings-export';
const EXPORT_MENU = 'wealth-holdings-export-menu';
const MORE_TRIGGER = 'wealth-holdings-more';
const MORE_MENU = 'wealth-holdings-more-menu';

/* ----------------------------------------------------------------- columns */

/**
 * The holdings columns, in `TABLES.positions(true)` order.
 *
 * WEIGHT IS THE MANDATE'S, NOT THE BOOK'S, and the header says so.
 * `Position.weight` is the position's share of its own portfolio; the fixture
 * carries no book-level weight per position and computing one here would be
 * arithmetic in a screen. The book share of an INSTRUMENT is a real number and
 * it lives on the concentration panel, under `table.bookWeight`.
 *
 * `key: null` is a column you cannot sort — it renders its label bare, with no
 * `md-table-sort-label` to promise an order the kit's filter has no field for.
 */
function positionColumns(t) {
  return [
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'instrumentName', label: t('wealth.table.instrument') },
    { key: null, label: t('wealth.table.household') },
    { key: null, label: t('wealth.table.assetClass') },
    { key: null, label: t('wealth.table.currency') },
    { key: null, label: t('wealth.table.quantity'), numeric: true },
    { key: null, label: t('wealth.table.price'), numeric: true },
    { key: 'marketValueEur', label: t('wealth.table.marketValue'), numeric: true },
    { key: 'unrealisedPl', label: t('wealth.table.unrealisedPl'), numeric: true },
    { key: 'unrealisedPlPct', label: t('wealth.table.plPct'), numeric: true },
    { key: 'weight', label: t('wealth.table.weight'), numeric: true },
    { key: 'dayChangePct', label: t('wealth.table.dayChange'), numeric: true },
  ];
}

/** The universe columns, in `TABLES.instruments` order. */
function instrumentColumns(t) {
  return [
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'name', label: t('wealth.table.instrument') },
    { key: null, label: t('wealth.table.type') },
    { key: null, label: t('wealth.table.assetClass') },
    { key: null, label: t('wealth.table.sector') },
    { key: null, label: t('wealth.table.region') },
    { key: null, label: t('wealth.table.currency') },
    { key: 'price', label: t('wealth.table.price'), numeric: true },
    { key: 'dayChangePct', label: t('wealth.table.dayChange'), numeric: true },
    { key: 'twelveMonthReturn', label: t('wealth.table.twelveMonth'), numeric: true },
    { key: null, label: t('wealth.table.trend') },
  ];
}

/**
 * The header row, shared by both tables.
 *
 * The sort labels carry no `active` / `order`: `md-table` declares `sort-by` /
 * `sort-order` above and pushes both down into every label on sync, so a value
 * written here could only ever disagree with it.
 */
function head(columns) {
  return html`<md-table-head>
    <md-table-row rowgroup="head">
      ${columns.map(
        (column) => html`<md-table-cell head scope="col"${attrs({ numeric: column.numeric || undefined })}>${
          column.key
            ? html`<md-table-sort-label${attrs({
                column: column.key,
                // Figures descend on their first click, names ascend — the same
                // rule the kit's own selectors apply when `sortDir` is omitted.
                'default-order': column.numeric ? 'desc' : 'asc',
                'icon-position': column.numeric ? 'start' : 'end',
              })}>${column.label}</md-table-sort-label>`
            : column.label
        }</md-table-cell>`,
      )}
    </md-table-row>
  </md-table-head>`;
}

/**
 * The seven labels `md-table-pagination` would otherwise ship in English.
 * `displayedRows` carries its own `%from%`/`%to%`/`%count%` tokens, which the
 * component fills — the dictionary entry is written that way on purpose.
 */
function paginationLabels(t) {
  return {
    'label-rows-per-page': t('wealth.table.rowsPerPage'),
    'label-displayed-rows': t('wealth.table.displayedRows'),
    'label-first-page': t('wealth.table.firstPage'),
    'label-previous-page': t('wealth.table.previousPage'),
    'label-next-page': t('wealth.table.nextPage'),
    'label-last-page': t('wealth.table.lastPage'),
    'label-all': t('wealth.table.all'),
  };
}

/* ------------------------------------------------------------------ screen */

export function holdingsScreen(t, locale) {
  const path = route.holdings();
  const totals = getBookTotals();

  /*
   * The whole book, unfiltered: these are the CHOICES, and a choice that
   * disappears because you already narrowed past it is a dead end. Same call
   * the React screen memoises once per mount.
   */
  const bookPositions = getPositions();
  const classOptions = assetClassTotals(bookPositions);
  const regionOptions = regionTotals(bookPositions);
  const currencyOptions = currencyExposure(bookPositions);
  const universe = getInstruments();

  // The rows as rendered: the React screen's initial sort, from the selector.
  const positions = getPositions({
    sortBy: POSITION_SORT.column,
    sortDir: POSITION_SORT.order,
  });
  const instruments = getInstruments({
    sortBy: INSTRUMENT_SORT.column,
    sortDir: INSTRUMENT_SORT.order,
  });

  const concentrated = bookHoldings(10);

  const children = html`${kpiRow(t, { totals, currencyOptions, concentrated })}

    ${filterBar(t, {
      classOptions,
      regionOptions,
      currencyOptions,
      universe,
      positions,
      positionSortColumns: positionColumns(t).filter((column) => column.key),
      instrumentSortColumns: instrumentColumns(t).filter((column) => column.key),
    })}

    <!--
      Two views of one book, so md-tabs is legitimate here and only here
      (§7.3): holdings and the instrument universe are sibling views of the same
      data, not destinations — the rail and the bar own those, and the shell owns
      them. md-tabs renders no content of its own; md-tab-panels finds the
      strip and wires the tab↔panel ARIA both ways.

      sizing="active" because the two tables differ in height by hundreds of
      pixels and a region sized to the taller one would leave the shorter view
      sitting in a hole.
    -->
    <md-tabs${attrs({
      'data-holdings-tabs': true,
      'aria-label': t('wealth.screen.holdings.title'),
      'active-tab-index': 0,
      'tab-width': 'auto',
    })}>
      <md-tab${attrs({ label: t('wealth.panel.holdings') })}></md-tab>
      <md-tab${attrs({ label: t('wealth.panel.universe') })}></md-tab>
    </md-tabs>

    <md-tab-panels sizing="active">
      <md-tab-panel>${positionsTable(t, locale, { rows: positions })}</md-tab-panel>
      <md-tab-panel>${instrumentsTable(t, { rows: instruments })}</md-tab-panel>
    </md-tab-panels>

    ${rollups(t, { positions })}

    ${concentrationPanel(t, { concentrated })}`;

  return screen(t, {
    locale,
    here: path,
    title: t('wealth.screen.holdings.title'),
    subtitle: t('wealth.screen.holdings.subtitle', {
      positions: totals.positionCount,
      instruments: totals.instrumentCount,
    }),
    crumbs: crumbsFor(path),
    children,
  });
}

/* ---------------------------------------------------------------- KPI row */

/**
 * The four opening questions. All four are BOOK-WIDE in the React screen too —
 * `getBookTotals()` and `concentration()` take no filter — so nothing here goes
 * stale when the client narrows the tables.
 *
 * No sparklines: these tiles carry a figure, a hint and a count. The sparkline
 * belongs to the overview's tiles, which have a monthly series behind them.
 */
function kpiRow(t, { totals, currencyOptions, concentrated }) {
  const risk = concentration();
  const top = concentrated[0];

  return html`<section class="kpi-grid">
    ${kpiTile(t, {
      label: t('wealth.kpi.securities'),
      value: money(t, totals.securitiesValue, { compact: true }),
      hint: t('wealth.kpi.positions'),
      trailing: count(t, totals.positionCount),
    })}

    <!-- The book's unrealised P/L, with its own percentage from the same
         roll-up. The day's moves have a panel of their own below, built by
         topMovers — summing dayChangeEur across the book here would be
         arithmetic in a screen, and the fixture exposes no book-level figure. -->
    ${kpiTile(t, {
      label: t('wealth.kpi.unrealisedPl'),
      value: signed(t, totals.unrealisedPl, { compact: true }),
      hint: percent(t, totals.unrealisedPlPct, { digits: 1, sign: true }),
    })}

    ${kpiTile(t, {
      label: t('wealth.kpi.topHolding'),
      value: percent(t, risk.topHolding, { digits: 1 }),
      hint: top ? `${top.ticker} · ${top.instrumentName}` : t('wealth.common.na'),
      trailing: top ? count(t, top.portfolioCount) : undefined,
    })}

    ${kpiTile(t, {
      label: t('wealth.kpi.nonBaseCurrency'),
      value: percent(t, risk.nonBaseCurrency, { digits: 1 }),
      // Currency codes are proper nouns; there is no dictionary key for "EUR".
      hint: currencyOptions.map((exposure) => exposure.currency).join(' · '),
    })}
  </section>`;
}

/* -------------------------------------------------------------- filter bar */

/**
 * The bar above the tabs, and the two menus that hang off it.
 *
 * IT SITS ABOVE THE TAB STRIP, not inside one panel: every field it writes —
 * search, asset class, region, currency — exists on BOTH `PositionFilter` and
 * `InstrumentFilter` with the same meaning, so one bar narrows the book and the
 * tabs only choose how you look at what is left. It also keeps the element ids
 * the two menus anchor to unique; a per-table copy would put two
 * `#wealth-holdings-export` triggers in one document and the menus would anchor
 * to whichever the browser found first.
 *
 * IT IS NOT WRAPPED IN A CARD. `md-search`'s docked panel and both `md-menu`s
 * are popups, and a card is the surface most likely to clip one — the same
 * `overflow: hidden` that slices a badge in half.
 *
 * EVERY CONTROL SHIPS IN ITS UNFILTERED STATE, which is exactly React's first
 * render: an empty query, no classes chosen, no instrument, "All" on both radio
 * groups, and an empty (but reserved) chip row.
 */
function filterBar(t, {
  classOptions,
  regionOptions,
  currencyOptions,
  universe,
  positions,
  positionSortColumns,
  instrumentSortColumns,
}) {
  return html`<div class="stack" data-holdings-filters>
    <div class="row">
      ${searchField(t, { positions })}
      ${classField(t, { classOptions })}
      ${instrumentField(t, { universe })}

      <!--
        Export: one default action plus variations of it. The leading half
        exports the view you are looking at; the menu is the same verb applied to
        a different subject, which is what makes this a split button rather than
        a button standing next to a menu.

        menu-label repeats the word "Export" because the dictionary has no
        "more export options" key and a screen may not add one to the kit; the
        trailing button stays distinguishable in the accessibility tree by its
        aria-haspopup="menu" and its live aria-expanded.

        The filename stamp is the fixture's frozen reporting date, so two runs of
        this app produce two identical files. There is no clock in this vertical.
      -->
      <md-split-button${attrs({
        id: EXPORT_TRIGGER,
        'data-export-stamp': REPORTING_DATE,
        controls: EXPORT_MENU,
        variant: 'tonal',
        size: 'sm',
        icon: 'download',
        label: t('wealth.action.export'),
        'menu-label': t('wealth.action.export'),
      })}></md-split-button>

      <!-- The overflow trigger's name is composed from the two things behind it.
           "Screen actions" is already the shell toolbar's name and "Filter"
           alone would hide the sort group; two words joined by a separator stay
           translated and say what the menu holds. -->
      <md-icon-button${attrs({
        'data-holdings-more': true,
        id: MORE_TRIGGER,
        icon: 'more_vert',
        variant: 'standard',
        size: 'sm',
        'aria-label': `${t('wealth.action.filter')} · ${t('wealth.action.sortBy')}`,
      })}></md-icon-button>
    </div>

    ${chipRow(t)}

    ${exportMenu(t)}
    ${moreMenu(t, { regionOptions, currencyOptions, positionSortColumns, instrumentSortColumns })}
  </div>`;
}

/**
 * A SEARCH SURFACE, not a text field with a magnifier.
 *
 * `md-search` earns its keep because it has a results panel: the matches appear
 * as you type and picking one narrows the table to that instrument. The query
 * also drives both tables, so the panel is a shortcut rather than the only way
 * through.
 *
 * The client binds `mdSearch` and ONLY `mdSearch`: `mdInput` fires on every
 * keystroke, `mdSubmit` on Enter and `mdChange` on a changed blur, and binding
 * more than one of them to the same query runs it up to four times per typing
 * burst. `mdSearch` is the debounced, trimmed, de-duplicated one, and both Enter
 * and the clear button flush it.
 *
 * THE SUGGESTIONS ARE ROWS, NOT A DERIVED LIST. The six the page opens with are
 * the first six positions in the selector's own order; the other sixty wait in
 * `<template data-suggestions>` so the client can offer the first six of
 * whatever the query matches without building a single list item itself.
 */
function searchField(t, { positions }) {
  const suggestion = (position) => html`<md-list-item${attrs({
    'data-position': position.id,
    'data-instrument': position.instrumentId,
    type: 'button',
    overline: position.ticker,
    headline: position.instrumentName,
    'supporting-text': t(position.assetClassKey),
    lines: '2',
  })}>
    <span slot="trailing-supporting-text">${money(t, position.marketValueEur, { compact: true })}</span>
  </md-list-item>`;

  const shown = positions.slice(0, SUGGESTION_COUNT);
  const spares = positions.slice(SUGGESTION_COUNT);

  return html`<md-search${attrs({
    'data-holdings-search': true,
    // How many the panel offers, stamped rather than repeated: the client
    // re-slices this list on every query and a second literal there could drift
    // from the one the page was rendered with.
    'data-suggestion-count': SUGGESTION_COUNT,
    layout: 'docked',
    trigger: 'bar',
    variant: 'contained',
    'full-width': true,
    debounce: '250',
    throttle: '1000',
    placeholder: t('wealth.action.searchHoldings'),
    'input-aria-label': t('wealth.action.searchHoldings'),
    'results-label': t('wealth.common.showing', { shown: shown.length, total: positions.length }),
    'no-results-label': t('wealth.empty.search', { query: '' }),
    // Both labels keep their slots open so the client can refill them as the
    // query narrows the book, without re-translating anything.
    'data-results-template': t('wealth.common.showing', { shown: '%shown%', total: '%total%' }),
    'data-no-results-template': t('wealth.empty.search', { query: '%query%' }),
    style: style({
      flex: '1 1 260px',
      // What lets the bar shrink below the component's 360px default, which
      // would otherwise overflow a 420px viewport.
      '--md-search-container-min-inline-size': '240px',
      /*
       * A SHORT DRAWER, DELIBERATELY. The component's default cap is
       * `min(400px, 60vh)`, which on a desktop shows most of a filtered book at
       * once — a panel long enough to cover the table it is filtering. Three
       * rows and a bit is enough to recognise a match or keep typing, and the
       * panel scrolls for the rest.
       */
      '--md-search-panel-max-block-size': '232px',
    }),
  })}>
    <md-list slot="results" data-holdings-results>${shown.map(suggestion)}</md-list>
    <template data-suggestions>${spares.map(suggestion)}</template>
  </md-search>`;
}

/**
 * Several values from a closed list of four — the multi-select row of §5.3.
 * `display-mode="text"` rather than the default chips: the active filters
 * already have a chip row below, and two sets of chips for one selection is two
 * things to keep in step.
 *
 * `value` is a `string[]` with no attribute form. The page's value is the empty
 * array — the component's own default — so there is nothing to serialise; the
 * client assigns the array when it has to push a selection back in (clearing).
 */
function classField(t, { classOptions }) {
  return html`<md-multi-select${attrs({
    'data-holdings-classes': true,
    label: t('wealth.table.assetClass'),
    placeholder: t('wealth.common.all'),
    'display-mode': 'text',
    'no-options-text': t('wealth.empty.generic'),
    density: '-2',
    style: style({ flex: '0 1 220px', 'min-inline-size': '180px' }),
  })}>
    ${classOptions.map(
      (option) => html`<md-select-option${attrs({
        value: option.assetClass,
        label: t(option.assetClassKey),
        /*
          `t.formatCurrency` rather than `money()`: `supporting-text` is a PROP,
          so it has to be a string and a helper that renders a `<span>` cannot go
          in it. This is still the kit's locale-bound formatter, not a raw `Intl`
          call — the rule that stands is "never format a number yourself".
        */
        'supporting-text': t.formatCurrency(option.marketValue, {
          notation: 'compact',
          maximumFractionDigits: 1,
        }),
      })}></md-select-option>`,
    )}
  </md-multi-select>`;
}

/**
 * Type-to-find over forty instruments: `md-autocomplete`, not a select. The
 * label carries the ticker AND the name so substring matching finds either, and
 * the committed value is the instrument id the kit filters by.
 *
 * `data-ticker` rides along so the chip row can label the active filter with the
 * ticker alone, exactly as React does from the picked record.
 */
function instrumentField(t, { universe }) {
  return html`<md-autocomplete${attrs({
    'data-holdings-instrument': true,
    label: t('wealth.table.instrument'),
    variant: 'outlined',
    density: '-2',
    'limit-results': '8',
    /*
      Two different states, two different strings, as the manual asks: an empty
      universe would be "None", a query that matches nothing is "Nothing to
      show". The first is unreachable here — the option list is the whole
      instrument universe — but the pair is what stops one message from covering
      two situations.
    */
    'no-options-text': t('wealth.common.none'),
    'no-results-text': t('wealth.empty.generic'),
    /*
      `{count}` survives on purpose: the kit's translator leaves a token it was
      not given in place, and md-autocomplete substitutes it with the number of
      visible suggestions. So one existing key becomes "12 of 40" without
      inventing a dictionary entry.
    */
    'status-template': t('wealth.common.of', { total: universe.length }),
    style: style({ flex: '1 1 240px', 'min-inline-size': '200px' }),
  })}>
    ${universe.map(
      (instrument) => html`<md-select-option${attrs({
        value: instrument.id,
        'data-ticker': instrument.ticker,
        label: `${instrument.ticker} · ${instrument.name}`,
        'supporting-text': t(instrument.assetClassKey),
      })}></md-select-option>`,
    )}
  </md-autocomplete>`;
}

/**
 * The active-filter row: EMPTY on arrival, and reserving its own height anyway.
 *
 * A row that appears the moment you pick your first filter shoves the tab strip
 * and the whole table down as a side effect of filtering them, which is the
 * thing this reservation exists to prevent. `min-block-size` rather than a fixed
 * height, so a long chip set that wraps to two lines still grows — a change the
 * reader caused directly.
 *
 * The reservation is ONE CHIP TALL (32px), not the 40 an earlier draft used: the
 * row is empty until a filter is picked, and every pixel over the chip it is
 * holding room for pushed the table down for nothing.
 *
 * `aria-hidden` while empty, and no `role="group"`: an empty labelled group is
 * noise in the accessibility tree. The two labels the client needs to build a
 * chip set — the group's name and the clear button's — ride on the row, so the
 * client script contains no English of its own.
 */
function chipRow(t) {
  return html`<div class="row"${attrs({
    'data-holdings-chips': true,
    'aria-hidden': 'true',
    'data-filter-label': t('wealth.action.filter'),
    'data-clear-label': t('wealth.action.clearFilters'),
    style: style({ 'min-block-size': '32px', 'align-items': 'center' }),
  })}></div>`;
}

/**
 * Never rendered `open`: `md-menu` wires positioning and dismissal from the
 * `open` CHANGE handler, and an attribute that is already there at first paint
 * never fires it. Both menus are opened by a method call instead.
 *
 * `variant="vibrant"` on every menu surface in this app, submenus included. The
 * default is `baseline` — square corners on a surface container; `vibrant` is
 * the M3 Expressive vertical menu, 16px corners on tertiary-based colour. A
 * submenu does NOT inherit the parent's variant, because it is its own `md-menu`
 * element, so each one carries it.
 */
function exportMenu(t) {
  return html`<md-menu${attrs({
    'data-menu': 'export',
    id: EXPORT_MENU,
    anchor: EXPORT_TRIGGER,
    placement: 'bottom-end',
    variant: 'vibrant',
  })}>
    <md-menu-item data-export="holdings"${attrs({ headline: t('wealth.panel.holdings') })}></md-menu-item>
    <md-menu-item data-export="instruments"${attrs({ headline: t('wealth.panel.universe') })}></md-menu-item>
    <md-menu-item data-export="concentration"${attrs({ headline: t('wealth.panel.concentration') })}></md-menu-item>
  </md-menu>`;
}

/** One radio row of a submenu. `data-value=""` is the "All" row and is written
 *  literally, because the attribute serialiser drops an empty value. */
function radioRow({ action, value, headline, selected, trailingText }) {
  return html`<md-menu-item data-value="${value}"${attrs({
    'data-action': action,
    type: 'radio',
    selected: selected || undefined,
    headline,
    'trailing-text': trailingText,
  })}></md-menu-item>`;
}

/** The sort group's rows for one table — the column keys the labels emit. */
function sortRows(columns, sortBy) {
  return columns.map((column) =>
    radioRow({
      action: 'sort',
      value: column.key,
      headline: column.label,
      selected: sortBy === column.key,
    }),
  );
}

function moreMenu(t, { regionOptions, currencyOptions, positionSortColumns, instrumentSortColumns }) {
  return html`<md-menu${attrs({
    'data-menu': 'more',
    id: MORE_MENU,
    anchor: MORE_TRIGGER,
    placement: 'bottom-end',
    variant: 'vibrant',
  })}>
    <md-menu-item-group${attrs({ label: t('wealth.action.filter') })}>
      <!--
        EACH BRANCH CARRIES ITS OWN GROUP. md-menu-item resolves radio
        exclusivity with closest('md-menu-item-group'), and a row inside a
        submenu is still a DOM descendant of the OUTER group — so without an
        inner group, picking a region would silently clear the currency.
      -->
      <md-sub-menu-item${attrs({ headline: t('wealth.table.region') })}>
        <md-menu slot="submenu" variant="vibrant">
          <md-menu-item-group${attrs({ label: t('wealth.table.region') })}>
            ${radioRow({
              action: 'region',
              value: '',
              headline: t('wealth.common.all'),
              selected: true,
            })}
            ${regionOptions.map((option) =>
              radioRow({
                action: 'region',
                value: option.region,
                headline: t(option.regionKey),
                trailingText: String(option.positionCount),
              }),
            )}
          </md-menu-item-group>
        </md-menu>
      </md-sub-menu-item>

      <md-sub-menu-item divider${attrs({ headline: t('wealth.table.currency') })}>
        <md-menu slot="submenu" variant="vibrant">
          <md-menu-item-group${attrs({ label: t('wealth.table.currency') })}>
            ${radioRow({
              action: 'currency',
              value: '',
              headline: t('wealth.common.all'),
              selected: true,
            })}
            ${currencyOptions.map((option) =>
              radioRow({
                action: 'currency',
                value: option.currency,
                // A currency code is a proper noun; there is no key for "EUR".
                headline: option.currency,
                trailingText: String(option.positionCount),
              }),
            )}
          </md-menu-item-group>
        </md-menu>
      </md-sub-menu-item>

      <!-- Nothing is narrowing the book on arrival, so the row ships disabled;
           the client turns it on with the first filter. -->
      <md-menu-item${attrs({
        'data-action': 'clear',
        headline: t('wealth.action.clearFilters'),
        disabled: true,
      })}></md-menu-item>
    </md-menu-item-group>

    <!--
      The sort group mirrors whichever table is on screen — its rows are the same
      column keys the sort labels emit, so the menu and the headers can never
      disagree about what is sortable. The page opens on the holdings tab, so the
      holdings columns are live and the universe's wait in a template for the
      client to swap in when the tab changes.
    -->
    <md-menu-item-group${attrs({ label: t('wealth.action.sortBy'), 'data-sort-group': 'positions' })}>
      ${sortRows(positionSortColumns, POSITION_SORT.column)}
    </md-menu-item-group>

    <template data-sort-group="instruments">
      <md-menu-item-group${attrs({ label: t('wealth.action.sortBy'), 'data-sort-group': 'instruments' })}>
        ${sortRows(instrumentSortColumns, INSTRUMENT_SORT.column)}
      </md-menu-item-group>
    </template>
  </md-menu>`;
}

/* ---------------------------------------------------------------- holdings */

/**
 * What sits behind one holding.
 *
 * The fixture books a position as a single lot, so this is that lot: what was
 * paid, what it is worth in its own currency before the FX, when it was opened,
 * and where the instrument has been over twelve months. The household name is a
 * drill, because the next question after "what is this?" is "whose is it?".
 *
 * The panel runs the full width of the row: the facts sit in `.dl`, an auto-fit
 * grid, and the twelve-month series spans the whole panel beneath them.
 */
function positionDetail(t, position) {
  const instrument = getInstrumentById(position.instrumentId);
  const mandate = getPortfolioById(position.portfolioId);

  return html`<div slot="expanded"${attrs({
    style: style({
      display: 'flex',
      'flex-direction': 'column',
      gap: 'var(--md-sys-spacing-gap-lg, 24px)',
      'inline-size': '100%',
    }),
  })}>
    <dl class="dl">
      ${fact(t('wealth.table.quantity'), num(t, position.quantity))}
      ${fact(t('wealth.table.costPerUnit'), money(t, position.costPerUnit, { currency: position.currency, digits: 2 }))}
      ${fact(t('wealth.table.costBasis'), money(t, position.costBasisEur))}
      <!-- The LOCAL amount here, beside the EUR one in the row above it — this
           is the pair a currency question is actually asked of. -->
      ${fact(t('wealth.table.marketValue'), money(t, position.marketValue, { currency: position.currency }))}
      ${fact(t('wealth.table.opened'), dateText(t, position.openedDate))}
      ${fact(t('wealth.table.sector'), t(position.sectorKey))}
      ${fact(t('wealth.table.region'), t(position.regionKey))}
      ${instrument
        ? fact(t('wealth.table.twelveMonth'), signed(t, instrument.twelveMonthReturn, { kind: 'percent' }))
        : null}
      <!-- The mandate reference is a proper noun, and it is the thing an
           operations question is asked with — "which book is this in?". -->
      ${mandate ? fact(t('wealth.panel.mandate'), mandate.reference) : null}
    </dl>

    ${instrument && instrument.priceSeries.length > 1
      ? html`<div${attrs({ style: style({ 'inline-size': '100%' }) })}>
          ${sparkline({
            data: instrument.priceSeries,
            labels: instrument.priceSeriesDates.map((date) => t.formatDate(date, 'monthYear')),
            // The tooltip reads the instrument's OWN currency at two digits, not
            // the compact EUR the KPI tiles use — this is a price, not a total.
            format: 'currency',
            currency: instrument.currency,
            digits: 2,
            attributes: {
              variant: 'area',
              curve: 'monotone',
              color: plColor(instrument.twelveMonthReturn),
              'show-marks': 'extremes',
              height: '56px',
            },
          })}
        </div>`
      : null}
  </div>`;
}

/**
 * One holdings row.
 *
 * The `data-*` stamps are the client's whole vocabulary: the RAW sort keys the
 * kit's comparator uses (never the localised, compacted cell text), the facets
 * it narrows by, the search haystack `getPositions` actually matches on (ticker,
 * instrument name and id — the household name is NOT in it), and the raw CSV
 * cells the export writes out.
 */
function positionRow(t, locale, position) {
  const household = getHouseholdById(position.householdId);

  return html`<md-table-row expandable${attrs({
    value: position.id,
    'data-class': position.assetClass,
    'data-instrument': position.instrumentId,
    'data-region': position.region,
    'data-currency': position.currency,
    'data-ticker': position.ticker,
    'data-name': position.instrumentName,
    // Attribute names are lowercased by the parser, so the client looks them up
    // lowercased too.
    'data-sort-ticker': position.ticker,
    'data-sort-instrumentname': position.instrumentName,
    'data-sort-marketvalueeur': position.marketValueEur,
    'data-sort-unrealisedpl': position.unrealisedPl,
    'data-sort-unrealisedplpct': position.unrealisedPlPct,
    'data-sort-weight': position.weight,
    'data-sort-daychangepct': position.dayChangePct,
    // Values go out RAW: an ISO date and an unformatted number survive a
    // spreadsheet import in any locale, where a grouped, localised figure does
    // not. The headers on the table are translated, because a human reads those.
    'data-csv': JSON.stringify([
      position.ticker,
      position.instrumentName,
      household ? household.name : '',
      t(position.assetClassKey),
      position.currency,
      position.quantity,
      position.price,
      position.marketValueEur,
      position.unrealisedPl,
      position.unrealisedPlPct,
      position.weight,
      position.dayChangePct,
    ]),
  })}>
    <md-table-cell>
      <span class="with-dot">
        <!-- In the ticker cell, not in a cell of its own: the kit owns the
             twelve tracks and a thirteenth would skew every cell after it. The
             label names the row, because twenty toggles all called "Expand row"
             tell a screen-reader user nothing. -->
        <md-table-expand-toggle${attrs({
          'button-label': `${t('wealth.table.instrument')} ${position.ticker}`,
        })}></md-table-expand-toggle>
        <span class="strong" data-hl="ticker">${position.ticker}</span>
      </span>
    </md-table-cell>
    <md-table-cell data-hl="name">${position.instrumentName}</md-table-cell>
    <md-table-cell>${
      household ? drill(locale, route.household(household.id), household.name) : t('wealth.common.na')
    }</md-table-cell>
    <md-table-cell>${assetClassChip(t, position.assetClass)}</md-table-cell>
    <md-table-cell>${position.currency}</md-table-cell>
    <md-table-cell numeric>${num(t, position.quantity)}</md-table-cell>
    <md-table-cell numeric>${money(t, position.price, { currency: position.currency, digits: 2 })}</md-table-cell>
    <md-table-cell numeric>${money(t, position.marketValueEur)}</md-table-cell>
    <md-table-cell numeric>${signed(t, position.unrealisedPl)}</md-table-cell>
    <md-table-cell numeric>${signed(t, position.unrealisedPlPct, { kind: 'percent' })}</md-table-cell>
    <md-table-cell numeric>${percent(t, position.weight, { digits: 1 })}</md-table-cell>
    <md-table-cell numeric>${signed(t, position.dayChangePct, { kind: 'percent' })}</md-table-cell>

    <!-- The detail belongs to the row, in its expanded slot: it follows its
         row in the reading order and goes inert with it, which a sibling detail
         row could not do. -->
    ${positionDetail(t, position)}
  </md-table-row>`;
}

/**
 * Every position in the book, paged.
 *
 * THE TABLE SORTS NOTHING AND PAGES NOTHING. `sort-by` / `sort-order` are
 * display state, `mdSortChange` is a REQUEST and `md-table-pagination` reports
 * intent. React answers by re-reading `getPositions()`; this build answers from
 * the rows themselves — the first page is live and the rest wait in
 * `<template data-rows>`, and `client/holdings.mjs` moves them between the two.
 *
 * THE TEMPLATE HOLDS THE SPARES, NOT A SECOND COPY OF THE BOOK. Rendering all
 * sixty-six rows twice would double the page for nothing; the client merges the
 * live twenty-five with the template's forty-one at bind time and owns the whole
 * set from then on. With JavaScript off the reader has the first page under an
 * inert pagination bar, which is what a paged table degrades to.
 *
 * The empty state belongs INSIDE the table, not instead of it: the toolbar, the
 * headers and the pagination readout all stay on screen, so the reader can see
 * which filters emptied it. It is always in the DOM — only the table's `empty`
 * attribute comes and goes, exactly as React renders it.
 */
function positionsTable(t, locale, { rows }) {
  const layout = TABLES.positions(true);
  const columns = positionColumns(t);
  const shown = rows.slice(0, ROWS_PER_PAGE);
  const spares = rows.slice(ROWS_PER_PAGE);

  return html`<md-table-container${attrs({
    variant: 'outlined',
    'max-height': '70vh',
    class: 'table-host',
  })}>
    <!-- The toolbar goes in the container's top slot and the pagination in its
         bottom slot — outside the scroll region, so both stay put while the
         rows move (§7.1). -->
    <md-table-toolbar${attrs({
      slot: 'top',
      headline: t('wealth.panel.holdings'),
      'supporting-text': t('wealth.common.showing', { shown: shown.length, total: rows.length }),
      // Both counts move as the filters narrow, so both slots stay open.
      'data-count-template': t('wealth.common.showing', { shown: '%shown%', total: '%total%' }),
    })}></md-table-toolbar>

    <md-table${attrs({
      'data-holdings-table': 'positions',
      'data-default-sort': `${POSITION_SORT.column}:${POSITION_SORT.order}`,
      'data-csv-header': JSON.stringify(columns.map((column) => column.label)),
      label: t('wealth.panel.holdings'),
      'column-template': layout.columns,
      'min-width': layout.minWidth,
      'sticky-header': true,
      striped: true,
      // The height ratchet is measured once and never recomputed, so a live
      // density change from the dock strands the taller height as dead space.
      // Pagination already holds the row count steady here.
      'keep-height': 'false',
      'sort-by': POSITION_SORT.column,
      'sort-order': POSITION_SORT.order,
      // Without these, assistive tech announces "row 1 of 25" on every page
      // instead of the row's place in the filtered book. `row-count` takes the
      // BODY total; md-table adds the head rows itself.
      'row-offset': 0,
      'row-count': rows.length,
    })}>
      <div slot="empty">${emptyState(t, t('wealth.empty.holdings'), { hint: true })}</div>

      ${head(columns)}

      <md-table-body>${shown.map((position) => positionRow(t, locale, position))}</md-table-body>
    </md-table>

    <md-table-pagination${attrs({
      slot: 'bottom',
      count: rows.length,
      page: 0,
      'rows-per-page': ROWS_PER_PAGE,
      'rows-per-page-options': '10,25,50,all',
      'show-first-last': true,
      ...paginationLabels(t),
    })}></md-table-pagination>

    <!-- The rows the first page does not hold. A template's content is inert —
         not rendered, not matched by querySelectorAll, no upgraded components
         — so the live page holds exactly the twenty-five rows React's does. -->
    <template data-rows>${spares.map((position) => positionRow(t, locale, position))}</template>
  </md-table-container>`;
}

/* ---------------------------------------------------------------- universe */

function instrumentRow(t, instrument) {
  return html`<md-table-row${attrs({
    value: instrument.id,
    'data-class': instrument.assetClass,
    'data-instrument': instrument.id,
    'data-region': instrument.region,
    'data-currency': instrument.currency,
    'data-ticker': instrument.ticker,
    'data-name': instrument.name,
    'data-sort-ticker': instrument.ticker,
    'data-sort-name': instrument.name,
    'data-sort-price': instrument.price,
    'data-sort-daychangepct': instrument.dayChangePct,
    'data-sort-twelvemonthreturn': instrument.twelveMonthReturn,
    // Ten values, not eleven: the trend column is a picture and a picture does
    // not survive a CSV, so the export drops it from the header too.
    'data-csv': JSON.stringify([
      instrument.ticker,
      instrument.name,
      t(instrument.typeKey),
      t(instrument.assetClassKey),
      t(instrument.sectorKey),
      t(instrument.regionKey),
      instrument.currency,
      instrument.price,
      instrument.dayChangePct,
      instrument.twelveMonthReturn,
    ]),
  })}>
    <md-table-cell><span class="strong" data-hl="ticker">${instrument.ticker}</span></md-table-cell>
    <md-table-cell data-hl="name">${instrument.name}</md-table-cell>
    <md-table-cell>${instrumentTypeChip(t, instrument.type)}</md-table-cell>
    <md-table-cell>${assetClassChip(t, instrument.assetClass)}</md-table-cell>
    <md-table-cell>${t(instrument.sectorKey)}</md-table-cell>
    <md-table-cell>${t(instrument.regionKey)}</md-table-cell>
    <md-table-cell>${instrument.currency}</md-table-cell>
    <md-table-cell numeric>${money(t, instrument.price, { currency: instrument.currency, digits: 2 })}</md-table-cell>
    <md-table-cell numeric>${signed(t, instrument.dayChangePct, { kind: 'percent' })}</md-table-cell>
    <md-table-cell numeric>${signed(t, instrument.twelveMonthReturn, { kind: 'percent' })}</md-table-cell>
    <md-table-cell>
      <div${attrs({ style: style({ 'min-inline-size': '80px' }) })}>
        <!--
          aria-hidden, and deliberately. md-sparkline names itself with a
          generated English sentence, and twenty-five of those would be read out
          in a table whose previous three columns already carry the price, the
          day's move and the twelve-month return in figures. The chart is the
          same fact drawn; hiding the duplicate is the accessible choice, not the
          lazy one.
        -->
        ${sparkline({
          data: instrument.priceSeries,
          labels: instrument.priceSeriesDates.map((date) => t.formatDate(date, 'monthYear')),
          format: 'currency',
          currency: instrument.currency,
          digits: 2,
          attributes: {
            'aria-hidden': 'true',
            variant: 'line',
            curve: 'monotone',
            color: plColor(instrument.twelveMonthReturn),
            'show-marks': 'extremes',
            height: '28px',
          },
        })}
      </div>
    </md-table-cell>
  </md-table-row>`;
}

/**
 * The instrument universe behind the book.
 *
 * WRITTEN INTO THE FILE, not deferred. React mounts this table on the tab's
 * first activation and holds its SHAPE with a `TableSkeleton` until then, so
 * `sizing="active"` never measures an empty panel. A pre-rendered document has
 * no mounting to schedule and no frame at zero to avoid: the table is simply
 * here, which is the state React settles into the moment the tab is opened.
 */
function instrumentsTable(t, { rows }) {
  const layout = TABLES.instruments;
  const columns = instrumentColumns(t);
  const shown = rows.slice(0, ROWS_PER_PAGE);
  const spares = rows.slice(ROWS_PER_PAGE);

  return html`<md-table-container${attrs({
    variant: 'outlined',
    'max-height': '70vh',
    class: 'table-host',
  })}>
    <md-table-toolbar${attrs({
      slot: 'top',
      headline: t('wealth.panel.universe'),
      'supporting-text': t('wealth.common.showing', { shown: shown.length, total: rows.length }),
      'data-count-template': t('wealth.common.showing', { shown: '%shown%', total: '%total%' }),
    })}></md-table-toolbar>

    <md-table${attrs({
      'data-holdings-table': 'instruments',
      'data-default-sort': `${INSTRUMENT_SORT.column}:${INSTRUMENT_SORT.order}`,
      'data-csv-header': JSON.stringify(
        columns
          .filter((column) => column.label !== t('wealth.table.trend'))
          .map((column) => column.label),
      ),
      label: t('wealth.panel.universe'),
      'column-template': layout.columns,
      'min-width': layout.minWidth,
      'sticky-header': true,
      striped: true,
      'keep-height': 'false',
      'sort-by': INSTRUMENT_SORT.column,
      'sort-order': INSTRUMENT_SORT.order,
      'row-offset': 0,
      'row-count': rows.length,
    })}>
      <div slot="empty">${emptyState(t, t('wealth.empty.generic'), { hint: true })}</div>

      ${head(columns)}

      <md-table-body>${shown.map((instrument) => instrumentRow(t, instrument))}</md-table-body>
    </md-table>

    <md-table-pagination${attrs({
      slot: 'bottom',
      count: rows.length,
      page: 0,
      'rows-per-page': ROWS_PER_PAGE,
      'rows-per-page-options': '10,25,50,all',
      'show-first-last': true,
      ...paginationLabels(t),
    })}></md-table-pagination>

    <template data-rows>${spares.map((instrument) => instrumentRow(t, instrument))}</template>
  </md-table-container>`;
}

/* --------------------------------------------------------------- roll-ups */

/**
 * The three breakdowns beneath the tables.
 *
 * THESE ARE BOOK-WIDE ON THIS BUILD, AND THAT IS A REAL DIFFERENCE FROM REACT,
 * stated here rather than papered over. React re-derives all three from the
 * FILTERED rows so they answer questions about what is on screen. Doing that in
 * a browser would mean either shipping the fixture down to re-run
 * `regionTotals()` / `currencyExposure()` / `topMovers()`, or summing market
 * values in a client script — which is exactly the arithmetic-in-a-component the
 * kit exists to prevent (§22), and the one thing no screen in this vertical is
 * allowed to do. So the panels carry the kit's answer for the whole book, which
 * is what React shows at first paint, and they do not follow the live filters.
 */
function rollups(t, { positions }) {
  const regionRows = regionTotals(positions);
  const currencyRows = currencyExposure(positions);
  const movers = topMovers(positions, 5);

  return html`<section class="grid-3">
    ${panel({
      title: t('wealth.panel.regions'),
      children: regionRows.length
        ? html`<div class="stack">
            ${regionRows.map((region) =>
              ratioMeter(t, { label: t(region.regionKey), fraction: region.weight, color: 'primary' }),
            )}
          </div>`
        : html`<p class="muted">${t('wealth.empty.holdings')}</p>`,
    })}

    ${panel({
      title: t('wealth.panel.currency'),
      children: currencyRows.length
        ? html`<div class="stack">
            ${currencyRows.map((exposure) =>
              ratioMeter(t, {
                label: exposure.currency,
                fraction: exposure.weight,
                // The base currency carries no translation risk, so it is not
                // painted in the same colour as the exposures that do.
                color: exposure.isBase ? 'secondary' : 'tertiary',
              }),
            )}
          </div>`
        : html`<p class="muted">${t('wealth.empty.holdings')}</p>`,
    })}

    ${panel({
      title: t('wealth.panel.movers'),
      children: movers.length
        ? html`<ul class="timeline">
            ${movers.map(
              (mover) => html`<li>
                <span class="strong">${mover.position.ticker}</span>
                <span class="muted"${attrs({ style: style({ flex: '1 1 auto', 'min-inline-size': 0 }) })}>${
                  mover.position.instrumentName
                }</span>
                ${signed(t, mover.changePct, { kind: 'percent' })}
                ${signed(t, mover.changeEur, { compact: true })}
              </li>`,
            )}
          </ul>`
        : html`<p class="muted">${t('wealth.empty.holdings')}</p>`,
    })}
  </section>`;
}

/* ---------------------------------------------------------- concentration */

/**
 * BOOK-WIDE ON PURPOSE, and the subtitle says so: two households holding the
 * same ETF are ONE concentration, which is exactly what `bookHoldings()`
 * aggregates and what a position table can never show. React does not filter
 * this panel either, so it is exact here.
 */
function concentrationPanel(t, { concentrated }) {
  const header = [
    t('wealth.table.ticker'),
    t('wealth.table.instrument'),
    t('wealth.table.assetClass'),
    t('wealth.table.currency'),
    t('wealth.table.marketValue'),
    t('wealth.table.bookWeight'),
    t('wealth.table.unrealisedPl'),
    t('wealth.kpi.portfolios'),
  ];

  // The cap is the largest weight there is, not 1: the largest holding is a few
  // per cent of the book, so a 0–1 meter would be an empty bar on every row.
  // Capping at the top row makes the rows comparable with each other, which is
  // the only comparison this panel is for.
  const max = concentrated[0]?.weight || 1;

  return panel({
    title: t('wealth.panel.concentration'),
    subtitle: t('wealth.table.bookWeight'),
    attributes: {
      'data-holdings-concentration': true,
      'data-csv-header': JSON.stringify(header),
    },
    children: html`<div class="grid-2">
      ${concentrated.map(
        (holding) => html`<md-card variant="outlined" full-width class="alloc-row"${attrs({
          'data-csv': JSON.stringify([
            holding.ticker,
            holding.instrumentName,
            t(holding.assetClassKey),
            holding.currency,
            holding.marketValue,
            holding.weight,
            holding.unrealisedPl,
            holding.portfolioCount,
          ]),
        })}>
          <div class="alloc-row__head">
            <p class="alloc-row__name">${holding.ticker} · ${holding.instrumentName}</p>
            ${assetClassChip(t, holding.assetClass)}
          </div>

          <!-- No percentage in the figures row: the meter below carries the
               weight, and a second copy rounded to two digits beside its one
               would read as two different numbers for the same fact. -->
          <div class="alloc-row__figures">
            <span>${money(t, holding.marketValue, { compact: true })}</span>
            <span>${signed(t, holding.unrealisedPl, { compact: true })}</span>
            <span>${t('wealth.kpi.portfolios')} ${num(t, holding.portfolioCount)}</span>
          </div>

          ${ratioMeter(t, {
            label: holding.ticker,
            fraction: holding.weight,
            color: 'primary',
            max,
            thickness: 6,
          })}
        </md-card>`,
      )}
    </div>`,
  });
}
