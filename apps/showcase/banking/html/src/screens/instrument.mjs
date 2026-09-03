/**
 * Screen 8 — one instrument: its price, the position in it, and the trades.
 *
 * THE HOLDING BLOCK IS CONDITIONAL, and that is the shape of the screen: a
 * watched instrument has a price and a chart and nothing else. Rendering an
 * empty position block would say the reader holds zero of it, which is a
 * different claim from not holding it at all.
 *
 * ONE PAGE PER INSTRUMENT, written at build time — see the note on the account
 * drill for why there is no unknown-id guard in this build.
 */

import {
  crumbsFor,
  getHoldingFor,
  getInstrumentById,
  getTrades,
  route,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { areaChart } from '../lib/charts.mjs';
import {
  count,
  instrumentKindChip,
  money,
  num,
  percent,
  signed,
  tradeSideChip,
  tradeStatusChip,
} from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

export function instrumentScreen(t, locale, id) {
  const instrument = getInstrumentById(id);
  const path = route.instrument(id);
  const holding = getHoldingFor(id);
  const trades = getTrades({ instrumentId: id });

  return screen(t, {
    locale,
    here: path,
    crumbs: crumbsFor(path, instrument.name),
    title: instrument.name,
    subtitle: t('banking.screen.instrument.subtitle'),
    aside: instrumentKindChip(t, instrument.kind),
    children: html`${panel({
        children: html`<div class="instrument-head">
            <md-avatar${attrs({ initials: instrument.initials, size: 'large' })}></md-avatar>
            <div class="stack">
              <span class="strong">${instrument.ticker}</span>
              <span class="muted">${
                instrument.sectorKey ? t(instrument.sectorKey) : t(instrument.kindKey)
              }</span>
            </div>
            <div class="instrument-head__figures">
              <span class="kpi__value">${money(t, instrument.price, {
                currency: instrument.currency,
              })}</span>
              ${signed(t, instrument.dayChangePct, { kind: 'percent' })}
            </div>
          </div>

          <dl class="dl">
            <div>
              <dt>${t('banking.table.day')}</dt>
              <dd>${signed(t, instrument.dayChangePct, { kind: 'percent' })}</dd>
            </div>
            <div>
              <dt>${t('banking.table.week')}</dt>
              <dd>${signed(t, instrument.weekChangePct, { kind: 'percent' })}</dd>
            </div>
            <div>
              <dt>${t('banking.table.year')}</dt>
              <dd>${signed(t, instrument.yearChangePct, { kind: 'percent' })}</dd>
            </div>
            <div>
              <dt>${t('banking.table.currency')}</dt>
              <dd>${instrument.currency}</dd>
            </div>
          </dl>`,
      })}

      ${panel({
        title: t('banking.panel.performance'),
        children: areaChart({
          series: [
            { id: instrument.id, label: instrument.ticker, data: instrument.history.map((p) => p.price) },
          ],
          config: {
            xAxis: {
              data: instrument.history.map((p) => t.formatDate(p.date, 'short')),
              scale: 'category',
            },
            format: 'currency',
            currency: instrument.currency,
            digits: 2,
          },
          attributes: {
            class: 'chart-lg',
            locale: t.locale,
            summary: t('banking.panel.performance'),
            curve: 'monotone',
            grid: 'horizontal',
          },
        }),
      })}

      ${holding
        ? panel({
            title: t('banking.panel.holdings'),
            children: html`<dl class="dl">
              <div>
                <dt>${t('banking.table.quantity')}</dt>
                <dd>${num(t, holding.quantity, { digits: instrument.kind === 'crypto' ? 4 : 2 })}</dd>
              </div>
              <div>
                <dt>${t('banking.table.value')}</dt>
                <dd>${money(t, holding.marketValueEur)}</dd>
              </div>
              <div>
                <dt>${t('banking.table.costBasis')}</dt>
                <dd>${money(t, holding.costBasisEur)}</dd>
              </div>
              <div>
                <dt>${t('banking.table.pl')}</dt>
                <dd>${signed(t, holding.unrealisedPlEur)}</dd>
              </div>
              <div>
                <dt>${t('banking.table.plPct')}</dt>
                <dd>${signed(t, holding.unrealisedPlPct, { kind: 'percent' })}</dd>
              </div>
              <div>
                <dt>${t('banking.table.allocation')}</dt>
                <dd>${percent(t, holding.allocation, { digits: 1 })}</dd>
              </div>
            </dl>`,
          })
        : null}

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
                    headline: t.formatDate(trade.date, 'medium'),
                    overline: trade.id,
                    'supporting-text': `${t('banking.table.price')} ${t.formatCurrency(trade.priceEur)}`,
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
      })}`,
  });
}
