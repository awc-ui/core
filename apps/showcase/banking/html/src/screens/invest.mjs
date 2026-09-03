/**
 * Screen 6 — the investing account.
 *
 * CONSUMER-GRADE ON PURPOSE. The wealth console next door has an institutional
 * order ticket. This is the other thing: a quantity, an estimate, a button.
 *
 * THE PORTFOLIO CURVE IS LABELLED FOR WHAT IT IS — today's quantities re-priced
 * down the history, not what the portfolio was worth on each day.
 *
 * BOTH HOLDINGS LAYOUTS SHIP AND ONE IS LIVE. The table needs 1040px for its
 * nine columns; below that a list is the honest shape, because value, P/L and
 * weight are exactly the columns a sideways scroll pushes off-screen. The two
 * are different MARKUP, not one rearranged — so the table is in the document
 * and the list rides in a template, and the client swaps them below 720px. Not
 * CSS: hiding one would leave a 1040px table in every phone's accessibility
 * tree, and would put both in the parity census where React renders one.
 *
 * WHAT THE CLIENT SCRIPT ADDS (client/trade.mjs): the ticket's estimate, which
 * re-prices as the instrument or the quantity changes, and that swap. The
 * default estimate is priced at build time, so the ticket arrives correct
 * rather than empty.
 */

import {
  TABLES,
  getTotals,
  getTrades,
  holdingRows,
  portfolioRing,
  portfolioSeries,
  route,
  tradeEstimate,
  watchlistRows,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { areaChart, pieChart } from '../lib/charts.mjs';
import {
  count,
  drill,
  instrumentKindChip,
  kpiTile,
  money,
  num,
  percent,
  signed,
  tradeSideChip,
  tradeStatusChip,
} from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

export function investScreen(t, locale) {
  const path = route.invest();
  const totals = getTotals();
  const holdings = holdingRows();
  const watchlist = watchlistRows();
  const trades = getTrades({ limit: 10 });
  const ring = portfolioRing();
  const curve = portfolioSeries();
  const layout = TABLES.holdings();

  /* Defaults to the largest holding — the one a reader is most likely to act
     on, and never an empty select. */
  const first = holdings[0]?.instrument;
  const estimate = first ? tradeEstimate(first.id, 1) : null;

  const holdingsTable = html`<md-table-container variant="outlined" class="table-host">
    <md-table${attrs({
      label: t('banking.panel.holdings'),
      'column-template': layout.columns,
      'min-width': layout.minWidth,
      'keep-height': 'false',
      striped: true,
    })}>
      <md-table-head>
        <md-table-row rowgroup="head">
          <md-table-cell head scope="col">${t('banking.table.ticker')}</md-table-cell>
          <md-table-cell head scope="col">${t('banking.table.name')}</md-table-cell>
          <md-table-cell head scope="col">${t('banking.table.kind')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('banking.table.quantity')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('banking.table.price')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('banking.table.value')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('banking.table.pl')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('banking.table.plPct')}</md-table-cell>
          <md-table-cell head scope="col" numeric>${t('banking.table.allocation')}</md-table-cell>
        </md-table-row>
      </md-table-head>
      <md-table-body>
        ${holdings.map(
          (h) => html`<md-table-row${attrs({ value: h.instrument.id })}>
            <md-table-cell>${drill(
              locale,
              route.instrument(h.instrument.id),
              html`<span class="strong">${h.instrument.ticker}</span>`,
            )}</md-table-cell>
            <md-table-cell>${h.instrument.name}</md-table-cell>
            <md-table-cell>${instrumentKindChip(t, h.instrument.kind)}</md-table-cell>
            <md-table-cell numeric>${num(t, h.quantity, {
              digits: h.instrument.kind === 'crypto' ? 4 : 2,
            })}</md-table-cell>
            <md-table-cell numeric>${money(t, h.instrument.priceEur)}</md-table-cell>
            <md-table-cell numeric>${money(t, h.marketValueEur, { compact: true })}</md-table-cell>
            <md-table-cell numeric>${signed(t, h.unrealisedPlEur, { compact: true })}</md-table-cell>
            <md-table-cell numeric>${signed(t, h.unrealisedPlPct, { kind: 'percent' })}</md-table-cell>
            <md-table-cell numeric>${percent(t, h.allocation, { digits: 1 })}</md-table-cell>
          </md-table-row>`,
        )}
      </md-table-body>
    </md-table>
  </md-table-container>`;

  const holdingsList = html`<md-list${attrs({
    label: t('banking.panel.holdings'),
    'interaction-mode': 'navigation',
    'list-style': 'segmented',
  })}>
    ${holdings.map(
      (h) => html`<md-list-item${attrs({
        type: 'link',
        href: localeHref(locale, route.instrument(h.instrument.id)),
        headline: h.instrument.name,
        overline: h.instrument.ticker,
        'supporting-text': `${t(h.instrument.kindKey)} · ${t.formatPercent(h.allocation, {
          maximumFractionDigits: 1,
        })}`,
        lines: '3',
      })}>
        <span slot="leading">
          <md-avatar${attrs({ initials: h.instrument.initials, size: 'small' })}></md-avatar>
        </span>
        <span slot="trailing" class="account-row__figures">
          ${money(t, h.marketValueEur)}
          ${signed(t, h.unrealisedPlPct, { kind: 'percent' })}
        </span>
      </md-list-item>`,
    )}
  </md-list>`;

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.invest.title'),
    subtitle: t('banking.screen.invest.subtitle'),
    aside: count(t, totals.holdingCount),
    children: html`<section class="kpi-grid">
        ${kpiTile(t, {
          label: t('banking.kpi.portfolio'),
          value: money(t, totals.portfolioValueEur, { compact: true }),
          hint: signed(t, totals.portfolioReturnPct, { kind: 'percent' }),
        })}
        ${kpiTile(t, {
          label: t('banking.kpi.unrealisedPl'),
          value: signed(t, totals.portfolioUnrealisedPlEur, { compact: true }),
          hint: money(t, totals.portfolioCostBasisEur, { compact: true }),
        })}
        ${kpiTile(t, {
          label: t('banking.kpi.dayChange'),
          value: signed(t, totals.portfolioDayChangeEur),
        })}
        ${kpiTile(t, {
          label: t('banking.panel.holdings'),
          value: num(t, holdings.length),
          hint: t('banking.kpi.watchlist'),
          trailing: count(t, totals.watchlistCount),
        })}
      </section>

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.performance'),
          subtitle: t('banking.hint.portfolioSeries'),
          children:
            curve.length === 0
              ? null
              : areaChart({
                  series: [
                    { id: 'value', label: t('banking.kpi.portfolio'), data: curve.map((p) => p.valueEur) },
                  ],
                  config: {
                    xAxis: { data: curve.map((p) => t.formatDate(p.date, 'short')), scale: 'category' },
                    format: 'currency',
                  },
                  attributes: {
                    class: 'chart-md',
                    locale: t.locale,
                    summary: t('banking.panel.performance'),
                    curve: 'monotone',
                    grid: 'horizontal',
                  },
                }),
        })}

        ${panel({
          title: t('banking.panel.allocation'),
          children: pieChart({
            data: ring.map((slice) => ({ id: slice.id, label: slice.labelKey, value: slice.value })),
            config: { format: 'currency' },
            attributes: {
              class: 'chart-md',
              locale: t.locale,
              summary: t('banking.panel.allocation'),
              'inner-radius': '62%',
              'show-labels': 'false',
              legend: 'bottom',
            },
            children: html`<div slot="center" class="ring-centre">
              <span class="ring-centre__value">${money(t, totals.portfolioValueEur, { compact: true })}</span>
              <span class="ring-centre__label">${t('banking.kpi.portfolio')}</span>
            </div>`,
          }),
        })}
      </div>

      ${panel({
        title: t('banking.panel.tradeTicket'),
        children: html`<div class="stack form-stack">
          <md-select${attrs({
            'data-instrument': true,
            label: t('banking.table.name'),
            value: first?.id,
          })}>
            ${holdings.map(
              (h) => html`<md-select-option${attrs({
                value: h.instrument.id,
                label: `${h.instrument.ticker} — ${h.instrument.name}`,
                'data-price': h.instrument.priceEur,
              })}></md-select-option>`,
            )}
          </md-select>

          <!-- No format-options: a quantity is a bare count of units, and a
               crypto holding is fractional to four places. -->
          <md-number-field${attrs({
            'data-quantity': true,
            label: t('banking.table.quantity'),
            value: 1,
            min: '0',
            step: '1',
            'small-step': '0.1',
            'large-step': '10',
            locale: t.locale,
          })}></md-number-field>

          ${estimate
            ? html`<div class="stack" data-estimate>
                <div class="quote-line">
                  <span>${t('banking.table.price')}</span>
                  <span class="num" data-estimate-price>${money(t, estimate.priceEur)}</span>
                </div>
                <div class="quote-line">
                  <span>${t('banking.table.fee')}</span>
                  <span class="num" data-estimate-fee>${money(t, estimate.feeEur)}</span>
                </div>
                <div class="quote-line quote-line--total">
                  <span>${t('banking.table.total')}</span>
                  <span class="num" data-estimate-total>${money(t, estimate.totalEur)}</span>
                </div>
              </div>`
            : null}

          <div class="row">
            <md-tooltip${attrs({ 'data-trade-tooltip': true, text: '', disabled: true })}>
              <md-button${attrs({
                'data-buy': true,
                'data-message': t('banking.msg.tradePlaced'),
                variant: 'filled',
                icon: 'trending_up',
              })}>${t('banking.action.buy')}</md-button>
            </md-tooltip>
            <md-button${attrs({
              'data-sell': true,
              'data-message': t('banking.msg.tradePlaced'),
              variant: 'tonal',
              icon: 'trending_down',
            })}>${t('banking.action.sell')}</md-button>
            <template data-trade-note><span class="muted">${t('banking.msg.tradePlaced')}</span></template>
          </div>
        </div>`,
      })}

      ${panel({
        title: t('banking.panel.holdings'),
        actions: count(t, holdings.length),
        children:
          holdings.length === 0
            ? html`<div class="empty"><p>${t('banking.empty.holdings')}</p></div>`
            : html`<div data-holdings-table>${holdingsTable}</div>
                <template data-holdings-list>${holdingsList}</template>`,
      })}

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.watchlist'),
          actions: count(t, watchlist.length),
          children:
            watchlist.length === 0
              ? html`<div class="empty"><p>${t('banking.empty.watchlist')}</p></div>`
              : html`<md-list${attrs({
                  label: t('banking.panel.watchlist'),
                  'interaction-mode': 'navigation',
                  'list-style': 'segmented',
                })}>
                  ${watchlist.map(
                    (instrument) => html`<md-list-item${attrs({
                      type: 'link',
                      href: localeHref(locale, route.instrument(instrument.id)),
                      headline: instrument.name,
                      overline: instrument.ticker,
                      'supporting-text': t(instrument.kindKey),
                      lines: '3',
                    })}>
                      <span slot="leading">
                        <md-avatar${attrs({ initials: instrument.initials, size: 'small' })}></md-avatar>
                      </span>
                      <span slot="trailing" class="account-row__figures">
                        ${money(t, instrument.priceEur)}
                        ${signed(t, instrument.dayChangePct, { kind: 'percent' })}
                      </span>
                    </md-list-item>`,
                  )}
                </md-list>`,
        })}

        ${panel({
          title: t('banking.panel.tradeHistory'),
          actions: count(t, trades.length),
          children:
            trades.length === 0
              ? html`<div class="empty"><p>${t('banking.empty.trades')}</p></div>`
              : html`<md-list${attrs({
                  label: t('banking.panel.tradeHistory'),
                  'interaction-mode': 'multi-action',
                  'list-style': 'segmented',
                })}>
                  ${trades.map(
                    (trade) => html`<md-list-item${attrs({
                      headline: trade.instrumentId,
                      overline: t.formatDate(trade.date, 'medium'),
                      'supporting-text': `${t(trade.sideKey)} · ${t(trade.statusKey)}`,
                      lines: '3',
                    })}>
                      <span slot="trailing" class="row">
                        ${tradeSideChip(t, trade.side)}
                        ${tradeStatusChip(t, trade.status)}
                        ${money(t, trade.amountEur)}
                      </span>
                    </md-list-item>`,
                  )}
                </md-list>`,
        })}
      </div>`,
  });
}
