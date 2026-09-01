/**
 * Screen 5 — the order ticket and the blotter.
 *
 * A transactional screen rather than an analytical one, and it is laid out that
 * way: the thing you came to do is at the top in the wide half of the split,
 * what it is worth is beside it, and the record of everything already raised is
 * underneath. The KPI row is the only part that summarises.
 *
 * NOTHING IS COUNTED OR ADDED UP HERE. Three of the four tiles read a field of
 * `getBookTotals()` and the fourth is the LENGTH of a selector result — which is
 * filtering through the kit, not filtering the kit's answer. There is no
 * `.reduce()` on this screen, and the one figure that would need one (the value
 * of the working orders) is reported upward as a missing aggregate rather than
 * being computed in a component.
 *
 * THE TICKET IS A REAL `<form>`, exactly as in the React build, and for the
 * same reason: `md-autocomplete`, `md-select` and `md-number-field` are all
 * form-associated through `ElementInternals`, so `required` on them genuinely
 * blocks `requestSubmit()` and reports the missing field. `md-split-button` is
 * not form-associated and has no `type`, so it is not a submit button and never
 * pretends to be one — its `mdLeadingClick` is what calls `requestSubmit()`, in
 * the client script. There is no `action` and no `method`: this form has no
 * server to post to in any build, and with the runtime absent none of its
 * fields render at all, so a no-JS reader can never submit it by accident.
 *
 * WHAT THIS FILE WRITES, AND WHAT IT LEAVES FOR THE CLIENT. Every state React
 * holds in `useState` has a DEFAULT, and the default is what a pre-rendered
 * document is: the ticket at `initialTicket()` (buy, first mandate, market
 * order, day, nothing else chosen), the estimate panel in its empty variant,
 * the submit soft-disabled with the tooltip naming the first unmet condition,
 * the menu and the dialog and the sheet and the snackbar all closed, the
 * blotter unfiltered on page one. That is precisely React's first paint. The
 * markup those states have to move to lives in `src/lib/trade-parts.mjs` — one
 * module rendering both the baked state and every later one — so the document
 * this file writes and the DOM `src/client/trade.mjs` swaps in cannot drift.
 *
 * The pieces the client needs are found by `data-*` markers, never by
 * localised text or by DOM position:
 *
 *   [data-trade-form]                   the form, for `requestSubmit()`
 *   [data-field="side|instrument|portfolio|quantity|orderType|tif"]
 *                                       the six controls; the limit field is
 *                                       INSERTED BEFORE `[data-field="tif"]`
 *                                       when the order type asks for one, which
 *                                       is why there is no placeholder element
 *                                       for it (an empty span would be one more
 *                                       element than the React build renders)
 *   [data-trade-estimate]               the estimate card, replaced wholesale
 *   [data-confirm-facts]                the dialog's `<dl>`, replaced in place
 *   [data-trade-dialog] + [data-dialog-cancel] / [data-dialog-send]
 *   [data-trade-sheet] + [data-sheet-close]  (the slotted close button is NOT
 *                                       wired by the sheet — only its built-in
 *                                       `closeable` icon-button is)
 *   [data-trade-snackbar]               one per screen, `.wealth-snackbar`
 *   #trade-submit / #trade-submit-menu  the split button and the menu it opens,
 *                                       anchored by literal id
 *   [data-blotter-*]                    the blotter's table, filters, facet row
 *                                       and its two `<template>`s
 *
 * THE BLOTTER'S FULL BOOK RIDES IN A `<template>`, the same idiom the proposals
 * book uses: the live table holds exactly the ten rows React's first page
 * renders, and the fourteen the filters and the pager work over wait inert
 * beside it. Rows are keyed with `data-*` for every axis `getOrders()` filters
 * on — never with the cell text, which is localised and compacted.
 *
 * ONE HOUSEKEEPING RULE, LEARNED THE HARD WAY IN THIS FILE: no backticks inside
 * an HTML comment. A comment written in the markup is TEXT inside an `html`
 * tagged template, so a backtick there closes the template and turns the rest of
 * the file into different — and usually still parseable — JavaScript. That is
 * check 1 in `scripts/lint.mjs`, and it is why the prose below quotes component
 * and prop names bare. JSDoc blocks and `//` comments inside an `attrs({…})`
 * call are ordinary JavaScript comments and may keep theirs.
 */

import {
  BASE_CURRENCY,
  crumbsFor,
  getAdvisor,
  getBookTotals,
  getInstruments,
  getOrders,
  getPortfolioById,
  getPortfolios,
  REPORTING_DATE,
  route,
  TABLES,
} from '@awc-ui/showcase-kit/wealth';
import { intlTag } from '@awc-ui/showcase-kit/i18n';
import { attrs, html, style } from '../lib/html.mjs';
import {
  blockKeyFor,
  confirmFacts,
  estimatePanel,
  initialTicket,
  sheetChildren,
} from '../lib/trade-parts.mjs';
import {
  dateText,
  drill,
  kpiTile,
  money,
  num,
  orderSideChip,
  orderStatusChip,
} from '../lib/bits.mjs';
import { emptyState, panel, screen } from '../components/shell.mjs';

/* --------------------------------------------------------------- constants */

/** The two sides of the ticket's segmented set, in the React build's order. */
const SIDES = ['buy', 'sell'];
const ORDER_TYPES = ['market', 'limit', 'stop-limit'];
const TIME_IN_FORCE = ['day', 'gtc', 'ioc', 'fok'];

/** Every status the blotter's select offers, in lifecycle order. */
const STATUSES = [
  'draft',
  'staged',
  'submitted',
  'partially-filled',
  'filled',
  'cancelled',
  'rejected',
];

/**
 * The blotter's facets, as data — one list read by the chip row, by the client's
 * delegated handler and by the "any filter on" test.
 *
 * NONE of them duplicates the two selects beside them. Side and Status are
 * already single-choice controls, so a chip on either axis would be a second
 * control fighting the first. These three are the axes the selects do NOT
 * cover: lifecycle (working), ownership (mine), provenance (raised under advice
 * rather than as an ad-hoc ticket).
 */
const FACETS = [
  { id: 'working', labelKey: 'wealth.trade.workingOnly' },
  { id: 'mine', labelKey: 'wealth.trade.filter.mine' },
  { id: 'fromAdvice', labelKey: 'wealth.trade.filter.fromAdvice' },
];

/** React's `useState(10)` and the options its pager offers. */
const DEFAULT_ROWS_PER_PAGE = 10;
const ROWS_PER_PAGE_OPTIONS = '10,25,all';

/** How many of the newest tickets the order-book sheet shows with nothing chosen. */
const BOOK_SHEET_LIMIT = 8;

/**
 * The split button and its menu, anchored by literal id (§21). Both ids are
 * the React build's, unchanged: a menu finds its anchor with
 * `getElementById`, so the pair has to agree and has to be unique per document.
 */
const SUBMIT_ID = 'trade-submit';
const SUBMIT_MENU_ID = 'trade-submit-menu';

/* ------------------------------------------------------------------ screen */

export function tradeScreen(t, locale) {
  const path = route.trade();
  const totals = getBookTotals();

  /*
   * Filtering through the selector, then reading the length of what it returns.
   * `getOrders({ status: 'filled' })` is the kit deciding what "filled" means;
   * `orders.filter(o => o.status === 'filled')` would be this file deciding.
   */
  const filledCount = getOrders({ status: 'filled' }).length;

  const children = html`${kpiRow(t, { totals, filledCount })}

    ${tradeTicket(t, locale)}

    ${blotter(t, locale, totals)}`;

  return screen(t, {
    locale,
    here: path,
    title: t('wealth.screen.trade.title'),
    subtitle: t('wealth.screen.trade.subtitle', { working: totals.workingOrderCount }),
    crumbs: crumbsFor(path),
    /*
     * THE TOOLBAR CARRIES ONE ACTION AND IT WORKS. The shell's manual is
     * explicit that a control which does nothing is worse than an empty corner,
     * so "new order" puts focus in the ticket's first field rather than being a
     * decorative placeholder beside a decorative export. The React screen wires
     * it through a ref the ticket fills in; here the button is marked and the
     * client calls `focusInput()` on the autocomplete — a focus call is
     * behaviour, and behaviour is the one thing a document cannot carry.
     */
    actions: html`<md-button${attrs({
      'data-focus-ticket': true,
      variant: 'text',
      size: 'sm',
      icon: 'edit_note',
    })}>${t('wealth.action.newOrder')}</md-button>`,
    children,
  });
}

/* ----------------------------------------------------------------- KPI row */

/**
 * Four tiles, no sparklines: the fixture carries no history behind a working
 * order count or a cash balance, and drawing a flat line would invent one.
 * Every foot is a bare "n of m" line, which is what keeps the row 136px rather
 * than the 152 a chip in the foot would cost.
 */
function kpiRow(t, { totals, filledCount }) {
  return html`<section class="kpi-grid">
    ${kpiTile(t, {
      label: t('wealth.kpi.workingOrders'),
      value: num(t, totals.workingOrderCount),
      hint: t('wealth.common.of', {
        count: totals.workingOrderCount,
        total: totals.orderCount,
      }),
    })}
    ${kpiTile(t, {
      label: t('wealth.orderStatus.filled'),
      value: num(t, filledCount),
      hint: t('wealth.common.of', { count: filledCount, total: totals.orderCount }),
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.cash'),
      value: money(t, totals.cash, { compact: true }),
      hint: t('wealth.app.baseCurrency', { currency: BASE_CURRENCY }),
    })}
    ${kpiTile(t, {
      label: t('wealth.kpi.instruments'),
      value: num(t, totals.instrumentCount),
      hint: t('wealth.panel.universe'),
    })}
  </section>`;
}

/* ------------------------------------------------------------------ ticket */

/**
 * The ticket, its estimate, and the four overlays that belong to it.
 *
 * THE ONE PIECE OF ARITHMETIC ON THIS SCREEN IS NOT ON THIS SCREEN.
 * `orderEstimate()` in the kit snaps the quantity to the instrument's lot size,
 * strikes the price at the limit or the last close, converts at the frozen
 * fixture FX rate, reports the weight the trade would add to the mandate, and
 * says whether a buy exceeds the mandate's cash. With no instrument chosen
 * there is nothing to price, so the ticket opens with `estimate = null` — which
 * is why the estimate panel ships in its empty variant and the submit is
 * soft-disabled with `wealth.trade.needInstrument` in its tooltip. That is the
 * state React opens in too, and it is the state on purpose: the ticket has a
 * live cash balance to trade against and exactly one thing missing, so the
 * soft-disable and its explanation are the first thing the screen demonstrates
 * rather than something you have to break it to reach.
 */
function tradeTicket(t, locale) {
  const ticket = initialTicket();
  const portfolios = getPortfolios();
  const instruments = getInstruments();
  const portfolio = ticket.portfolioId ? getPortfolioById(ticket.portfolioId) : undefined;

  /* Nothing is chosen, so nothing can be priced. Both stay `undefined`/`null`
     all the way down — the client re-derives them from the kit on every edit. */
  const instrument = undefined;
  const estimate = null;

  const blockKey = blockKeyFor(ticket, estimate);

  /*
   * The instrument picker's option set.
   *
   * `label` is the ticker and `supportingText` the security name because the
   * component's client-side filter matches BOTH: typing `nes` or `Nestlé`
   * narrows to the same row, while the committed field text stays a bare ticker
   * — a single strong-LTR run that cannot reorder under `dir="rtl"` the way a
   * hand-composed `NESN · Nestlé SA` would.
   *
   * THE ARRAY TRAVELS AS JSON, not as `serialized:`. `md-autocomplete.options`
   * documents a JSON-string attribute as its plain-HTML contract — the same one
   * `md-organization-chart.nodes` offers — and parses it itself, so this is the
   * component's own channel rather than the chart helpers' serialiser. The
   * React build assigns the array as a property from an effect; there is no
   * instance here.
   */
  const instrumentOptions = instruments.map((i) => ({
    value: i.id,
    label: i.ticker,
    supportingText: i.name,
  }));

  /*
   * BCP-47, not the bare locale code. This is the one screen in the app that
   * asks for it: `md-number-field` hands `locale` to `Intl.NumberFormat` to
   * group and parse what the reader types, and `ar` alone would give it a
   * different grouping from the `ar-AE` every figure on the page is formatted
   * with. The chart elements elsewhere take the bare code, which is what they
   * document; this is the React build's `intlTag(state.locale)`, verbatim.
   */
  const intl = intlTag(locale);

  return html`<div class="grid-wide">
      ${panel({
        title: t('wealth.panel.ticket'),
        subtitle: t('wealth.trade.ticketHint', { date: t.formatDate(REPORTING_DATE, 'medium') }),
        children: html`<form class="stack" data-trade-form>
          <!-- The set owns selection and has no value prop: selected on a
               child is how the current side is expressed, and a plain
               aria-label names the set, which carries no naming prop of its
               own. Two labelled segments is squarely inside the 2–5 M3 allows. -->
          <md-segmented-button-set${attrs({
            'data-field': 'side',
            'aria-label': t('wealth.table.side'),
          })}>
            ${SIDES.map(
              (side) => html`<md-segmented-button${attrs({
                value: side,
                label: t(`wealth.orderSide.${side}`),
                icon: side === 'buy' ? 'north_east' : 'south_west',
                selected: ticket.side === side,
              })}></md-segmented-button>`,
            )}
          </md-segmented-button-set>

          <div class="ticket__fields">
            <!-- The two empty states say different things, because they ARE
                 different things: an empty universe and a query that matched
                 nothing. The second names what was typed, so its {query} slot
                 is left open for the client to fill as the reader types.

                 virtualize="never": forty instruments is far inside the
                 200-row threshold, but auto is a threshold rather than a
                 promise, and pinning the client-side path keeps the default
                 label/supporting-text filter (which matches the security NAME,
                 not just the ticker) instead of handing matching to the WASM
                 engine. -->
            <md-autocomplete${attrs({
              'data-field': 'instrument',
              name: 'instrument',
              variant: 'outlined',
              required: true,
              label: t('wealth.table.instrument'),
              placeholder: t('wealth.action.search'),
              options: JSON.stringify(instrumentOptions),
              'supporting-text': t('wealth.panel.universe'),
              'value-missing-label': t('wealth.trade.needInstrument'),
              'no-options-text': t('wealth.empty.generic'),
              'no-results-text': t('wealth.empty.search', { query: '' }),
              'data-no-results-template': t('wealth.empty.search', { query: '%query%' }),
              virtualize: 'never',
              'reserve-supporting-space': true,
            })}></md-autocomplete>

            <md-select${attrs({
              'data-field': 'portfolio',
              name: 'portfolio',
              variant: 'outlined',
              required: true,
              label: t('wealth.panel.mandate'),
              value: ticket.portfolioId,
              'value-missing-label': t('wealth.trade.needPortfolio'),
              'supporting-text': portfolio
                ? `${t('wealth.kpi.cash')} · ${t.formatCurrency(portfolio.cashBalance, {
                    notation: 'compact',
                  })}`
                : '',
              'reserve-supporting-space': true,
            })}>
              ${portfolios.map(
                (p) => html`<md-select-option${attrs({
                  value: p.id,
                  label: p.reference,
                  'supporting-text': t(p.strategyKey),
                })}>${p.reference}</md-select-option>`,
              )}
            </md-select>

            <!-- md-number-field, never md-text-field type="number". The
                 steppers step by the instrument's LOT and snap-on-step keeps
                 them on that grid, so the buttons cannot produce a size the
                 security does not trade in — with nothing chosen the step is 1
                 and the client re-writes both step attributes with the
                 instrument. No value: an empty field is what null is, and
                 writing value="0" would put a size on a ticket nobody asked
                 for. -->
            <md-number-field${attrs({
              'data-field': 'quantity',
              name: 'quantity',
              variant: 'outlined',
              required: true,
              label: t('wealth.table.quantity'),
              locale: intl,
              min: 0,
              step: 1,
              // Shift-stepping moves ten lots. A keyboard affordance, not a
              // reported figure — every number this screen SHOWS comes from the
              // kit.
              'large-step': 10,
              'snap-on-step': true,
              steppers: 'inline',
              'increment-label': t('wealth.action.next'),
              'decrement-label': t('wealth.action.back'),
              'value-missing-label': t('wealth.trade.needQuantity'),
              // The lot hint arrives with the instrument; until then the field
              // reserves the line rather than claiming a lot size it has no
              // security to read one from.
              'supporting-text': '',
              'reserve-supporting-space': true,
            })}></md-number-field>

            <md-select${attrs({
              'data-field': 'orderType',
              name: 'orderType',
              variant: 'outlined',
              required: true,
              label: t('wealth.table.orderType'),
              value: ticket.orderType,
              'reserve-supporting-space': true,
            })}>
              ${ORDER_TYPES.map(
                (type) => html`<md-select-option${attrs({
                  value: type,
                  label: t(`wealth.orderType.${type}`),
                })}>${t(`wealth.orderType.${type}`)}</md-select-option>`,
              )}
            </md-select>

            <!-- THE LIMIT PRICE IS NOT HERE, and its absence is the state, not
                 an omission: the ticket opens as a market order, which is struck
                 at the last close and has no limit price at all. React mounts
                 the field for the other two order types and unmounts it again;
                 this build's client inserts limitFieldMarkup() from
                 lib/trade-parts.mjs before [data-field="tif"] and removes it
                 the same way. Revealed, never permanently disabled — a greyed
                 field is a question the reader keeps re-reading. -->

            <md-select${attrs({
              'data-field': 'tif',
              name: 'tif',
              variant: 'outlined',
              required: true,
              label: t('wealth.table.timeInForce'),
              value: ticket.timeInForce,
              'reserve-supporting-space': true,
            })}>
              ${TIME_IN_FORCE.map(
                (tif) => html`<md-select-option${attrs({
                  value: tif,
                  label: t(`wealth.timeInForce.${tif}`),
                })}>${t(`wealth.timeInForce.${tif}`)}</md-select-option>`,
              )}
            </md-select>
          </div>

          <md-divider></md-divider>

          <div class="ticket__actions">
            <!-- The ticket's two ancillary actions. md-button-group writes
                 toggle = true onto every child unconditionally, because its
                 usual job is a set of STATES; these are ACTIONS, so the client
                 vetoes each child's cancelable mdClick and the group's
                 selection stays permanently empty — while the reasons to use a
                 group at all survive: one tab stop, RTL-aware arrow-key movement
                 and the fused press flourish. The identity comes off the
                 event's own detail, which is why each button carries a value. -->
            <md-button-group${attrs({
              'data-ticket-actions': true,
              variant: 'standard',
              size: 'sm',
              'selection-mode': 'multi-select',
              'aria-label': t('wealth.trade.actions'),
            })}>
              <md-button${attrs({ value: 'clear', variant: 'text', icon: 'restart_alt' })}>${t('wealth.trade.clear')}</md-button>
              <md-button${attrs({ value: 'book', variant: 'text', icon: 'receipt_long' })}>${t('wealth.trade.book')}</md-button>
            </md-button-group>

            <!-- A soft-disabled control keeps tabindex="0", so a keyboard
                 reader reaches it and the tooltip tells them what is missing —
                 which a hard disabled would hide entirely. ONE reason, never a
                 list: a tooltip that recites four sentences is not read, so
                 blockKeyFor() returns the first unmet condition and the next
                 appears the moment it is met. disabled on the TOOLTIP is what
                 switches the explanation off once there is nothing to explain —
                 it is absent here because there is. -->
            <md-tooltip${attrs({
              'data-submit-tooltip': true,
              text: blockKey ? t(blockKey) : '',
              position: 'top-end',
            })}>
              <md-split-button${attrs({
                id: SUBMIT_ID,
                variant: 'filled',
                size: 'sm',
                icon: 'send',
                label: t('wealth.action.submit'),
                'menu-label': t('wealth.trade.submitOptions'),
                controls: SUBMIT_MENU_ID,
                'soft-disabled': blockKey !== null,
              })}></md-split-button>
            </md-tooltip>
          </div>
        </form>`,
      })}

      ${estimatePanel(t, { estimate, instrument, portfolio, typedQuantity: ticket.quantity ?? 0 })}
    </div>

    <!-- The split button ships NO MENU — it emits mdTrailingClick and this is
         the menu it opens. open is never written into the initial markup
         (§23): the component wires positioning and dismissal from the open
         CHANGE handler, so a menu that starts open paints unpositioned and
         cannot be clicked away. bottom-end, because a menu belongs BELOW the
         control that opens it and md-menu flips itself when the space is short;
         vibrant to match every other menu surface in this app. -->
    <md-menu${attrs({
      id: SUBMIT_MENU_ID,
      anchor: SUBMIT_ID,
      placement: 'bottom-end',
      variant: 'vibrant',
    })}>
      <md-menu-item${attrs({
        headline: t('wealth.trade.submitDuplicate'),
        'supporting-text': t('wealth.panel.ticket'),
      })}></md-menu-item>
    </md-menu>

    <!-- ONE dialog on this screen, and nothing opens another from inside it
         (§23). The confirmation and the progress indicator share it: the
         indicator is not in the document because nothing is in flight, and the
         client appends progressMarkup() when something is. scrim-dismissible
         is the string form React writes, and it flips to "false" while the
         ticket is in flight — the dismissal and the Cancel button are the same
         abort. The two slotted actions do NOT close the dialog themselves: they
         are our markup, so the close is ours to perform. -->
    <md-dialog${attrs({
      'data-trade-dialog': true,
      headline: t('wealth.trade.confirm'),
      icon: 'fact_check',
      divider: true,
      'scrim-dismissible': 'true',
      'close-label': t('wealth.action.close'),
    })}>
      <p class="muted">${t('wealth.trade.confirmBody')}</p>

      ${confirmFacts(t, { ticket, estimate, instrument, portfolio })}

      <md-button${attrs({ 'data-dialog-cancel': true, slot: 'actions', variant: 'text' })}>${t('wealth.action.cancel')}</md-button>
      <md-button${attrs({ 'data-dialog-send': true, slot: 'actions', variant: 'filled', icon: 'send' })}>${t('wealth.action.submit')}</md-button>
    </md-dialog>

    <!-- The order book for the chosen instrument, and the newest tickets on the
         whole book when nothing is chosen — both straight out of the selector,
         filtered BY it rather than by an array method here. There is no bid/ask
         depth in this console because the fixture carries none, and inventing a
         ladder of prices is the one thing this showcase is not for. -->
    <md-bottom-sheet${attrs({
      'data-trade-sheet': true,
      variant: 'detached',
      closeable: true,
      'top-divider': true,
      headline: t('wealth.trade.bookRecent'),
      'data-headline-template': t('wealth.trade.bookFor', { ticker: '%ticker%' }),
    })}>
      ${sheetChildren(t, { instrument, orders: getOrders({ limit: BOOK_SHEET_LIMIT }) })}
    </md-bottom-sheet>

    <!-- One snackbar, one message (§23). It opens with neither: open and
         message are written by the client when a ticket lands, and a boolean
         false is never written as an attribute value (§21). The offset that
         keeps a bottom toast clear of the dock and — below 900px — the
         navigation bar is .wealth-snackbar, shared with the other two screens
         that toast so none of them can drift on where a toast lands. -->
    <md-snackbar${attrs({
      'data-trade-snackbar': true,
      class: 'wealth-snackbar',
      position: 'bottom',
      closeable: true,
      'dismiss-label': t('wealth.action.close'),
    })}></md-snackbar>`;
}

/* ----------------------------------------------------------------- blotter */

/**
 * Every order the book has raised, filtered and paged.
 *
 * FILTERING GOES THROUGH THE SELECTOR, NEVER THROUGH `.filter()` HERE.
 * `getOrders()` already knows what "working" means (`submitted` plus
 * `partially-filled`) and what a search matches (ticker, security name,
 * household, id). The rows below carry those four fields and the three facet
 * axes as `data-*`, so the client narrows the SAME set the selector would —
 * matching on raw values, never on the localised, compacted cell text.
 *
 * THERE ARE NO SORT HEADERS, and that is deliberate rather than unfinished.
 * `OrderFilter` carries no `sortBy` / `sortDir`; the fixture stores orders
 * newest first and the selector preserves that. A comparator here would be a
 * second ordering the kit knows nothing about, so the headers stay plain and
 * the missing filter fields are reported upward instead.
 */
function blotter(t, locale, totals) {
  const allRows = getOrders();
  const rows = allRows.slice(0, DEFAULT_ROWS_PER_PAGE);

  return panel({
    children: html`<div class="stack">
      <div class="row trade-filters">
        <!-- md-text-field type="search", not md-search: md-search owns a
             results surface of its own, and this box filters a table that is
             already on screen. UNCONTROLLED, exactly as in React — nothing ever
             writes value back into a field the reader is typing in, which is
             why clearing the filters has to push the empty string in by hand. -->
        <md-text-field${attrs({
          'data-blotter-search': true,
          variant: 'outlined',
          type: 'search',
          label: t('wealth.trade.searchOrders'),
          clearable: 'internal',
        })}></md-text-field>

        <!-- value="" is written out rather than left off: with no value the
             picker would fall back to an option's own selected hint, and an
             empty value is what "every side" means here. -->
        <md-select value=""${attrs({
          'data-blotter-side': true,
          variant: 'outlined',
          label: t('wealth.table.side'),
          placeholder: t('wealth.common.all'),
          clearable: true,
          'clear-label': t('wealth.action.clearFilters'),
        })}>
          ${SIDES.map(
            (value) => html`<md-select-option${attrs({
              value,
              label: t(`wealth.orderSide.${value}`),
            })}>${t(`wealth.orderSide.${value}`)}</md-select-option>`,
          )}
        </md-select>

        <md-select value=""${attrs({
          'data-blotter-status': true,
          variant: 'outlined',
          label: t('wealth.table.status'),
          placeholder: t('wealth.common.all'),
          clearable: true,
          'clear-label': t('wealth.action.clearFilters'),
        })}>
          ${STATUSES.map(
            (value) => html`<md-select-option${attrs({
              value,
              label: t(`wealth.orderStatus.${value}`),
            })}>${t(`wealth.orderStatus.${value}`)}</md-select-option>`,
          )}
        </md-select>

        <!-- An icon-only control and the tooltip that supplies the meaning its
             glyph lacks. The aria-label is still required — a tooltip is a
             description, never a name. It sits with the filters rather than in
             the table's toolbar so it survives the empty state, which is
             exactly when a reader wants it. Soft-disabled while nothing is
             filtered, which is how the page opens. -->
        <md-tooltip${attrs({ text: t('wealth.action.clearFilters') })}>
          <md-icon-button${attrs({
            'data-blotter-clear': true,
            icon: 'filter_alt_off',
            'aria-label': t('wealth.action.clearFilters'),
            'soft-disabled': true,
          })}></md-icon-button>
        </md-tooltip>
      </div>

      ${blotterTable(t, locale, { allRows, rows, bookTotal: totals.orderCount })}
    </div>`,
  });
}

/* ------------------------------------------------------------------- table */

/**
 * `md-table-container` WRAPS `md-table`, with the toolbar in its `top` slot and
 * the pagination in its `bottom` slot. Neither goes inside the table, where
 * they would become children of a grid whose columns belong to the rows.
 */
function blotterTable(t, locale, { allRows, rows, bookTotal }) {
  const layout = TABLES.orders;
  const total = allRows.length;

  /*
   * THE THREE FACET FLAGS COME OUT OF THE SELECTOR, not out of a comparison
   * here. `working` is `submitted` plus `partially-filled`, and `fromAdvice` is
   * "has a proposal at all" rather than "has this one" — both are the kit's
   * definitions, and a row that decided them itself would be a second copy to
   * keep in step. Each set is one `getOrders()` call and a membership test, so
   * the stamped attribute says exactly what the client's own re-query would.
   */
  const idsOf = (filter) => new Set(getOrders(filter).map((order) => order.id));
  const working = idsOf({ working: true });
  const mine = idsOf({ advisorId: getAdvisor().id });
  const fromAdvice = idsOf({ fromProposal: true });

  const headers = [
    { key: 'id', label: t('wealth.table.id') },
    { key: 'side', label: t('wealth.table.side') },
    { key: 'ticker', label: t('wealth.table.ticker') },
    { key: 'instrument', label: t('wealth.table.instrument') },
    { key: 'household', label: t('wealth.table.household') },
    { key: 'quantity', label: t('wealth.table.quantity'), numeric: true },
    { key: 'filled', label: t('wealth.table.filled'), numeric: true },
    { key: 'orderType', label: t('wealth.table.orderType') },
    { key: 'limit', label: t('wealth.table.limitPrice'), numeric: true },
    { key: 'tif', label: t('wealth.table.timeInForce') },
    { key: 'value', label: t('wealth.table.estimatedValue'), numeric: true },
    { key: 'status', label: t('wealth.table.status') },
    { key: 'created', label: t('wealth.table.created') },
  ];

  /**
   * One order.
   *
   * The row carries every axis `getOrders()` filters on. The three facet flags
   * are BARE attributes when true and absent when false (§21 — never
   * `data-mine="false"`), so the client tests for presence. The four search
   * fields are stamped raw because the kit's `matches()` folds and joins
   * exactly those four — ticker, security name, household and the id, which
   * rides on the row's own `value` — and the three cells that can show a
   * `<mark>` name the field they hold. The fourth marked run is the household
   * name inside `.drill`, which the client rewrites by that class rather than
   * through the cell, so the anchor survives being marked. Marking a fifth
   * would claim the query hit something it never looked at.
   */
  const row = (order) => html`<md-table-row${attrs({
    value: order.id,
    'data-side': order.side,
    'data-status': order.status,
    'data-working': working.has(order.id),
    'data-mine': mine.has(order.id),
    'data-from-advice': fromAdvice.has(order.id),
    'data-ticker': order.ticker,
    'data-instrument': order.instrumentName,
    'data-household': order.householdName,
  })}>
    <md-table-cell${attrs({ 'data-mark': 'id' })}>${order.id}</md-table-cell>
    <md-table-cell>${orderSideChip(t, order.side)}</md-table-cell>
    <md-table-cell${attrs({ 'data-mark': 'ticker' })}>${order.ticker}</md-table-cell>
    <md-table-cell${attrs({ 'data-mark': 'instrument' })}>${order.instrumentName}</md-table-cell>
    <md-table-cell>
      ${drill(locale, route.household(order.householdId), order.householdName)}
    </md-table-cell>
    <md-table-cell numeric>${num(t, order.quantity)}</md-table-cell>
    <md-table-cell numeric>${num(t, order.filledQuantity)}</md-table-cell>
    <md-table-cell>${t(order.orderTypeKey)}</md-table-cell>
    <md-table-cell numeric>${
      order.limitPrice === null
        ? html`<span class="muted">${t('wealth.common.na')}</span>`
        : money(t, order.limitPrice, { currency: order.currency, digits: 2 })
    }</md-table-cell>
    <md-table-cell>${t(order.timeInForceKey)}</md-table-cell>
    <!-- THE CURRENCY TRAP. estimatedValue is in the security's own currency
         and estimatedValueEur is the converted twin. This column compares
         orders across the book, so the EUR figure LEADS and the local one sits
         under it — the other way round would quietly report a CHF ticket as if
         it were euros. -->
    <md-table-cell numeric>
      ${money(t, order.estimatedValueEur, { compact: true })}${
        order.currency === BASE_CURRENCY
          ? null
          : html`<br /><span class="muted num"${attrs({
              style: style({ font: 'var(--md-sys-typescale-label-small-font)' }),
            })}>${t.formatCurrency(order.estimatedValue, {
              currency: order.currency,
              notation: 'compact',
            })}</span>`
      }
    </md-table-cell>
    <md-table-cell>${orderStatusChip(t, order.status)}</md-table-cell>
    <md-table-cell>${dateText(t, order.createdDate, 'short')}</md-table-cell>
  </md-table-row>`;

  return html`<div class="table-host">
    <md-table-container variant="outlined">
      <!-- The toolbar goes in the CONTAINER's top slot, outside the table's
           scroll port, so it stays put while thirteen columns scroll under it.
           {shown} of {total} with the shown count left open — the client fills
           %shown% as the filters narrow, without re-translating. -->
      <md-table-toolbar${attrs({
        slot: 'top',
        headline: t('wealth.panel.blotter'),
        'supporting-text': t('wealth.common.showing', { shown: total, total: bookTotal }),
        'data-count-template': t('wealth.common.showing', { shown: '%shown%', total: bookTotal }),
      })}></md-table-toolbar>

      <!-- A SECOND top child, under the toolbar. The band is a flex column,
           so the chips stack beneath the headline and stay outside the scroll
           port with it — the sticky header sticks below them, so the two never
           meet. The state these chips drive belongs with the filters above;
           only the row itself lives down here, because this is the only band it
           can render in. -->
      <div${attrs({
        slot: 'top',
        'data-blotter-facets': true,
        class: 'row facet-row',
        role: 'group',
        'aria-label': t('wealth.trade.filter.group'),
      })}>
        ${FACETS.map(
          (facet) => html`<md-chip${attrs({
            'data-facet': facet.id,
            variant: 'filter',
            label: t(facet.labelKey),
          })}></md-chip>`,
        )}
      </div>

      <md-table${attrs({
        'data-blotter-table': true,
        label: t('wealth.panel.blotter'),
        'column-template': layout.columns,
        'min-width': layout.minWidth,
        // `md-table` ratchets its height by default so paging cannot make the
        // page jump, but that baseline is measured once and never recomputed —
        // a density change then strands the taller height as dead space.
        // Pagination already holds the row count steady here, so live density
        // switching is worth more than the ratchet.
        'keep-height': 'false',
        striped: true,
        // Without these, assistive tech announces "row 1 of 10" on every page
        // instead of the row's position in the whole blotter. `row-count` takes
        // the BODY total; the table adds the head and foot rows itself.
        'row-offset': 0,
        'row-count': total,
      })}>
        <md-table-head>
          <md-table-row rowgroup="head">
            ${headers.map(
              (header) => html`<md-table-cell head scope="col"${attrs({
                numeric: header.numeric || undefined,
              })}>${header.label}</md-table-cell>`,
            )}
          </md-table-row>
        </md-table-head>

        <md-table-body>${rows.map(row)}</md-table-body>
      </md-table>

      <md-table-pagination${attrs({
        slot: 'bottom',
        count: total,
        page: 0,
        'rows-per-page': DEFAULT_ROWS_PER_PAGE,
        'rows-per-page-options': ROWS_PER_PAGE_OPTIONS,
        'show-first-last': true,
        'label-rows-per-page': t('wealth.table.rowsPerPage'),
        'label-displayed-rows': t('wealth.table.displayedRows'),
        'label-first-page': t('wealth.table.firstPage'),
        'label-previous-page': t('wealth.table.previousPage'),
        'label-next-page': t('wealth.table.nextPage'),
        'label-last-page': t('wealth.table.lastPage'),
        'label-all': t('wealth.table.all'),
      })}></md-table-pagination>
    </md-table-container>

    <!-- THE WHOLE BOOK, parked where the document tree cannot see it. A
         template's content is inert, so this page holds exactly the ten live
         rows React's first page renders while the client has all fourteen to
         filter and page through. -->
    <template data-blotter-rows>${allRows.map(row)}</template>

    <!-- React renders the empty state INSTEAD of the whole table, not inside
         it, so this waits in a template rather than sitting in a slot="empty"
         that would leave a permanently-present element in the live census.
         hint is true because the blotter is never empty unfiltered: emptiness
         here is always the reader's own filter, and the way out of it is to
         widen — which is exactly what React's hint={filtered} resolves to at
         the only moment this template is ever mounted. -->
    <template data-blotter-empty>${emptyState(t, t('wealth.empty.orders'), { hint: true })}</template>
  </div>`;
}
