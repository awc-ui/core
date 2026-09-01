/**
 * The trade screen's shared fragments — used by BOTH the build (`src/screens/
 * trade.mjs`, initial state) and the client enhancement (`src/client/trade.mjs`,
 * every state after that).
 *
 * WHY THIS FILE EXISTS. The ticket is the one screen in this build whose
 * document changes shape after load: the estimate panel fills in, the limit
 * field mounts for the order types that carry one, the confirmation facts track
 * the ticket, the order-book sheet re-renders per instrument. The React build
 * re-renders those from one component tree; this build gets the same guarantee
 * by rendering the initial state and every later state from THESE functions, so
 * the markup the build writes and the markup the client swaps in can never
 * drift apart.
 *
 * Nothing here reads the DOM and nothing here formats a figure itself — the
 * translator and the bits do that — so every function is safe to run at build
 * time in Node and at run time in the browser.
 *
 * THE SPARKLINE IS RENDERED BARE, without the `serialized:` attribute the
 * build-time chart helpers use: the filled estimate panel only ever exists
 * client-side (the initial page renders the empty variant), so its `data`,
 * `labels` and `valueFormatter` are assigned as JS properties by the client —
 * the same channel the React wrapper uses — and `src/lib/props.mjs` (whose
 * `serializeProperty` import must never reach the client bundle, where
 * `@awc-ui/core` is external) stays out of the graph.
 */

import { BASE_CURRENCY, getPortfolios } from '@awc-ui/showcase-kit/wealth';
import { attrs, html } from './html.mjs';
import { fact, money, num, orderSideChip, orderStatusChip, signed } from './bits.mjs';
import { panel } from '../components/shell.mjs';

/* ------------------------------------------------------------------ ticket */

/** `market` is struck at the last close; the other two carry a price. */
export const needsLimit = (orderType) => orderType !== 'market';

/**
 * The ticket's starting state — the React build's `initial` memo, verbatim.
 *
 * The mandate is pre-selected and the instrument is not, ON PURPOSE: the
 * ticket opens with a live cash balance to trade against and exactly one thing
 * missing, so the soft-disabled submit and its tooltip are the first thing the
 * screen demonstrates rather than a state you have to break it to reach.
 */
export function initialTicket() {
  return {
    side: 'buy',
    instrumentId: '',
    portfolioId: getPortfolios()[0]?.id ?? '',
    quantity: null,
    orderType: 'market',
    limitPrice: null,
    timeInForce: 'day',
  };
}

/**
 * Why the ticket cannot be sent, in the order a desk would ask.
 *
 * ONE key, not a list: a tooltip that recites four sentences is not read. The
 * first unmet condition is the one the reader can act on, and the next appears
 * the moment it is met. `exceedsCash` comes last because it is the only one
 * that needs every other field before it can be evaluated at all — and it
 * BLOCKS rather than merely warns, because this console has no funding flow to
 * point at, so an order the mandate cannot pay for is not a draft.
 */
export function blockKeyFor(ticket, estimate) {
  if (!ticket.instrumentId) return 'wealth.trade.needInstrument';
  if (!ticket.portfolioId) return 'wealth.trade.needPortfolio';
  if (!estimate || estimate.lots < 1) return 'wealth.trade.needQuantity';
  if (needsLimit(ticket.orderType) && !(ticket.limitPrice !== null && ticket.limitPrice > 0)) {
    return 'wealth.trade.needLimit';
  }
  if (estimate.exceedsCash) return 'wealth.order.exceedsCash';
  return null;
}

/* ------------------------------------------------------------- limit field */

/**
 * `format-options` as the JSON attribute form, re-derived with the instrument,
 * so the field is always denominated in the security's own currency rather
 * than the mandate's reporting currency.
 */
export function limitFormatOptions(instrument) {
  return JSON.stringify({
    style: 'currency',
    currency: instrument?.currency ?? BASE_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function limitSupportingText(t, instrument) {
  return instrument
    ? `${t('wealth.table.price')} · ${t.formatCurrency(instrument.price, {
        currency: instrument.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : '';
}

/**
 * The limit price field, mounted by the client only for the order types that
 * carry one — revealed, not permanently disabled: a market order has no limit
 * price at all, and a greyed field is a question the reader keeps re-reading.
 * Never in the initial document, because the ticket opens as a market order —
 * which is also exactly what the React build renders first.
 */
export function limitFieldMarkup(t, { locale, instrument }) {
  return html`<md-number-field${attrs({
    name: 'limit',
    variant: 'outlined',
    required: true,
    label: t('wealth.table.limitPrice'),
    locale,
    min: 0,
    step: 0.01,
    'small-step': 0.01,
    'large-step': 1,
    'increment-label': t('wealth.action.next'),
    'decrement-label': t('wealth.action.back'),
    'value-missing-label': t('wealth.trade.needLimit'),
    'format-options': limitFormatOptions(instrument),
    'supporting-text': limitSupportingText(t, instrument),
    'reserve-supporting-space': true,
  })}></md-number-field>`;
}

/* ---------------------------------------------------------------- estimate */

/**
 * The live readout beside the ticket. The whole `md-card`, marked
 * `data-trade-estimate` so the client can find and replace it.
 *
 * The sparkline element carries only its display attributes here; the client
 * assigns `data` / `labels` / `valueFormatter` as properties after insertion
 * (see the header note).
 */
export function estimatePanel(t, { estimate, instrument, portfolio, typedQuantity }) {
  if (!estimate || !instrument) {
    return panel({
      title: t('wealth.trade.estimate'),
      attributes: { 'data-trade-estimate': true },
      children: html`<p class="muted">${t('wealth.trade.estimateEmpty')}</p>`,
    });
  }

  return panel({
    title: t('wealth.trade.estimate'),
    subtitle: instrument.name,
    attributes: { 'data-trade-estimate': true },
    children: html`<div class="stack">
      <div>
        <p class="estimate__value">${money(t, estimate.estimatedValue, {
          currency: estimate.currency,
          digits: estimate.currency === BASE_CURRENCY ? 0 : 2,
        })}</p>
        ${estimate.currency === BASE_CURRENCY
          ? null
          : html`<p class="estimate__sub">${money(t, estimate.estimatedValueEur)} · ${BASE_CURRENCY}</p>`}
      </div>

      <div class="estimate__spark">
        <md-sparkline${attrs({
          variant: 'line',
          color: 'primary',
          curve: 'monotone',
          'show-marks': 'extremes',
          height: '56px',
        })}></md-sparkline>
      </div>

      <dl class="dl">
        ${fact(t('wealth.table.price'), money(t, estimate.referencePrice, { currency: estimate.currency, digits: 2 }))}
        ${fact(t('wealth.table.quantity'), num(t, estimate.effectiveQuantity))}
        ${fact(t('wealth.table.weight'), signed(t, estimate.weightImpact, { kind: 'percent' }))}
        ${fact(
          t('wealth.kpi.cash'),
          portfolio ? money(t, portfolio.cashBalance, { compact: true }) : t('wealth.common.na'),
        )}
      </dl>

      <p class="estimate__sub">${t('wealth.trade.lots', {
        lots: t.formatNumber(estimate.lots, { maximumFractionDigits: 0 }),
        size: t.formatNumber(instrument.lotSize, { maximumFractionDigits: 0 }),
      })}</p>

      ${typedQuantity !== estimate.effectiveQuantity
        ? html`<p class="estimate__sub">${t('wealth.trade.snapped', {
            typed: t.formatNumber(typedQuantity, { maximumFractionDigits: 0 }),
          })}</p>`
        : null}

      ${estimate.exceedsCash ? html`<p class="pl-down">${t('wealth.order.exceedsCash')}</p>` : null}
    </div>`,
  });
}

/* ----------------------------------------------------------------- confirm */

/**
 * The confirmation dialog's facts, tracking the live ticket — the build bakes
 * the initial state and the client replaces the `<dl>` whenever the ticket
 * changes, so the document always says what React's would.
 */
export function confirmFacts(t, { ticket, estimate, instrument, portfolio }) {
  return html`<dl class="dl" data-confirm-facts>
    ${fact(t('wealth.table.side'), orderSideChip(t, ticket.side))}
    ${fact(t('wealth.table.instrument'), instrument ? instrument.name : t('wealth.common.na'))}
    ${fact(t('wealth.panel.mandate'), portfolio ? portfolio.reference : t('wealth.common.na'))}
    ${fact(t('wealth.table.quantity'), num(t, estimate?.effectiveQuantity ?? 0))}
    ${fact(t('wealth.table.orderType'), t(`wealth.orderType.${ticket.orderType}`))}
    ${fact(
      t('wealth.table.limitPrice'),
      needsLimit(ticket.orderType) && ticket.limitPrice !== null
        ? money(t, ticket.limitPrice, { currency: instrument?.currency, digits: 2 })
        : t('wealth.common.na'),
    )}
    ${fact(t('wealth.table.timeInForce'), t(`wealth.timeInForce.${ticket.timeInForce}`))}
    ${fact(
      t('wealth.table.estimatedValue'),
      estimate ? money(t, estimate.estimatedValueEur) : t('wealth.common.na'),
    )}
  </dl>`;
}

/**
 * Indeterminate, because there is no measurable progress to report — the desk
 * either has the ticket or it does not. `label` becomes the `aria-label`; the
 * component's own default is the English word "Progress".
 */
export function progressMarkup(t) {
  return html`<md-progress-indicator${attrs({
    variant: 'linear',
    indeterminate: true,
    label: t('wealth.trade.submitting'),
  })}></md-progress-indicator>`;
}

/* -------------------------------------------------------------------- book */

/**
 * The order-book sheet's children: the chosen instrument's facts (when there
 * is one), the orders straight out of the selector, and the slotted close
 * button — which the sheet does NOT wire itself (only the built-in `closeable`
 * icon-button is), so it carries `data-sheet-close` for the client's delegated
 * listener.
 */
export function sheetChildren(t, { instrument, orders }) {
  return html`${instrument
    ? html`<dl class="dl trade-sheet__facts">
        ${fact(t('wealth.table.price'), money(t, instrument.price, { currency: instrument.currency, digits: 2 }))}
        ${fact(t('wealth.table.dayChange'), signed(t, instrument.dayChangePct, { kind: 'percent' }))}
        ${fact(t('wealth.table.twelveMonth'), signed(t, instrument.twelveMonthReturn, { kind: 'percent' }))}
        ${fact(t('wealth.table.quantity'), num(t, instrument.lotSize))}
      </dl>`
    : null}
  ${orders.length === 0
    ? html`<p class="muted">${t('wealth.trade.bookEmpty')}</p>`
    : html`<md-list${attrs({ label: t('wealth.panel.blotter') })}>
        ${orders.map(
          (order) => html`<md-list-item${attrs({
            lines: '3',
            overline: order.id,
            headline: order.instrumentName,
            'supporting-text': t('wealth.order.filledOf', {
              filled: t.formatNumber(order.filledQuantity, { maximumFractionDigits: 0 }),
              quantity: t.formatNumber(order.quantity, { maximumFractionDigits: 0 }),
            }),
            'trailing-supporting-text': t.formatCurrency(order.estimatedValueEur, {
              notation: 'compact',
            }),
          })}>
            <span slot="leading">${orderSideChip(t, order.side)}</span>
            <span slot="trailing">${orderStatusChip(t, order.status)}</span>
          </md-list-item>`,
        )}
      </md-list>`}
  <md-button slot="actions" variant="text" data-sheet-close>${t('wealth.action.close')}</md-button>`;
}
