/**
 * Screen 3 — the exchange desk.
 *
 * THE TICKET IS THE SCREEN. Everything else is context for the number in it.
 *
 * WHAT SHIPS IN THE DOCUMENT AND WHAT THE CLIENT ADDS. The desk quotes six
 * pairs and every one of them is priced at build time for the default amount,
 * so the page arrives with a real, correct quote rather than an empty ticket.
 * The client re-prices as the amount changes and as the pair changes; without
 * it, the reader still sees a priced EUR to GBP ticket and the six pair cards.
 *
 * WHY THE QUOTE IS NOT COMPUTED HERE OR THERE. The kit's quote() prices the
 * trade — mid rate, the spread the desk keeps, the fee off the SOURCE side,
 * and the net. Both the build and the client call it.
 *
 * AN INVALID PAIR IS UNREACHABLE, not refused: each select drops the other's
 * current value, and the send side is limited to currencies with an account
 * behind them. RON is quotable and not held: receivable, not sendable.
 */

import {
  getFxPairs,
  getSpendingAccounts,
  quote,
  rateSeries,
  route,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { lineChart } from '../lib/charts.mjs';
import { currencyChip, money, percent, signed } from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

const QUOTED = ['EUR', 'USD', 'GBP', 'RON'];
const DEFAULT_FROM = 'EUR';
const DEFAULT_TO = 'GBP';
const DEFAULT_AMOUNT = 250;

export function exchangeScreen(t, locale) {
  const path = route.exchange();
  const accounts = getSpendingAccounts();
  const pairs = getFxPairs();
  const held = QUOTED.filter((code) => accounts.some((a) => a.currency === code));

  /**
   * What is held in a currency, as the field's supporting text.
   *
   * Always a string, so both boxes keep the same height and the row cannot
   * drift out of alignment. A currency with no account says so in words.
   */
  const balanceIn = (currency) => {
    const account = accounts.find((a) => a.currency === currency);
    return account
      ? t.formatCurrency(account.balance, {
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : t('banking.hint.noAccount');
  };

  const priced = quote(DEFAULT_FROM, DEFAULT_TO, DEFAULT_AMOUNT);
  const charted = pairs.find(
    (p) =>
      (p.base === DEFAULT_FROM && p.quote === DEFAULT_TO) ||
      (p.base === DEFAULT_TO && p.quote === DEFAULT_FROM),
  );
  const history = charted ? rateSeries(charted.id) : [];

  const quoteLine = (label, value, { total = false } = {}) => html`<div${attrs({
    class: total ? 'quote-line quote-line--total' : 'quote-line',
  })}>
    <span>${label}</span>
    <span class="num">${value}</span>
  </div>`;

  /* Priced at build time for the default pair. The client rewrites these four
     values in place rather than re-rendering the block, so the elements the
     parity census counts never change. */
  const breakdown = html`<div class="stack" data-quote>
    ${quoteLine(
      t('banking.table.rate'),
      html`<span data-quote-rate>1 ${DEFAULT_FROM} = ${t.formatNumber(priced.rate, {
        maximumFractionDigits: 4,
      })} ${DEFAULT_TO}</span>`,
    )}
    ${quoteLine(
      t('banking.table.spread'),
      html`<span data-quote-spread>${t('banking.unit.bps', {
        value: t.formatNumber(priced.spreadBps),
      })}</span>`,
    )}
    ${quoteLine(
      t('banking.table.fee'),
      html`<span data-quote-fee>${
        priced.feeFrom === 0 ? t('banking.common.free') : money(t, priced.feeFrom, { currency: DEFAULT_FROM })
      }</span>`,
    )}
    ${quoteLine(
      t('banking.table.receive'),
      html`<span data-quote-net>${money(t, priced.net, { currency: DEFAULT_TO })}</span>`,
      { total: true },
    )}
  </div>`;

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.exchange.title'),
    subtitle: t('banking.screen.exchange.subtitle'),
    children: html`<div class="grid-2">
        ${panel({
          title: t('banking.panel.ticket'),
          children: html`<div class="stack">
            <!-- Both selects carry supporting text: only one having any made
                 the row bottom-align two boxes of different heights. -->
            <div class="ticket">
              <md-select${attrs({
                'data-from': true,
                label: t('banking.table.send'),
                value: DEFAULT_FROM,
                'supporting-text': balanceIn(DEFAULT_FROM),
              })}>
                ${held
                  .filter((code) => code !== DEFAULT_TO)
                  .map((code) => html`<md-select-option${attrs({ value: code, label: code })}></md-select-option>`)}
              </md-select>

              <md-tooltip${attrs({
                'data-swap-tooltip': true,
                text: t('banking.hint.cannotSwap'),
                disabled: true,
              })}>
                <md-icon-button${attrs({
                  'data-swap': true,
                  class: 'ticket__swap',
                  icon: 'swap_horiz',
                  'aria-label': t('banking.action.swap'),
                })}></md-icon-button>
              </md-tooltip>

              <md-select${attrs({
                'data-to': true,
                label: t('banking.table.receive'),
                value: DEFAULT_TO,
                'supporting-text': balanceIn(DEFAULT_TO),
              })}>
                ${QUOTED.filter((code) => code !== DEFAULT_FROM).map(
                  (code) => html`<md-select-option${attrs({ value: code, label: code })}></md-select-option>`,
                )}
              </md-select>
            </div>

            <md-number-field${attrs({
              'data-amount': true,
              label: t('banking.table.amount'),
              value: DEFAULT_AMOUNT,
              min: '0',
              step: '10',
              'small-step': '1',
              'large-step': '100',
              locale: t.locale,
              'format-options': JSON.stringify({
                style: 'currency',
                currency: DEFAULT_FROM,
                maximumFractionDigits: 2,
              }),
            })}></md-number-field>

            ${breakdown}

            <!--
              THE OPTIONS EACH SELECT DOES NOT CURRENTLY OFFER.

              Neither list offers the other side's current value, so sending a
              currency to itself is unreachable rather than refused — the same
              rule the React screen applies, and it means the option lists
              CHANGE when the pair does. A build that writes files cannot
              re-render a list, so the currently-excluded option waits in a
              template and the client moves it between the two. In a template
              rather than hidden inside the select: an option nobody can pick is
              not an option, and the parity census counts md-select-option like
              every other element.
            -->
            <template data-send-options>
              ${held
                .filter((code) => code === DEFAULT_TO)
                .map((code) => html`<md-select-option${attrs({ value: code, label: code })}></md-select-option>`)}
            </template>
            <template data-receive-options>
              ${QUOTED.filter((code) => code === DEFAULT_FROM).map(
                (code) => html`<md-select-option${attrs({ value: code, label: code })}></md-select-option>`,
              )}
            </template>

            <div class="row">
              <!-- The tooltip exists only while the gate does: the default
                   ticket is priced, so it ships disabled and the client turns
                   it on if the amount is cleared. -->
              <md-tooltip${attrs({ 'data-confirm-tooltip': true, text: '', disabled: true })}>
                <md-button${attrs({
                  'data-confirm': true,
                  'data-message': t('banking.msg.exchanged'),
                  variant: 'filled',
                  icon: 'check',
                })}>${t('banking.action.confirm')}</md-button>
              </md-tooltip>
              <template data-confirm-note><span class="muted">${t('banking.msg.exchanged')}</span></template>
            </div>
          </div>`,
        })}

        ${panel({
          attributes: { 'data-history-panel': true },
          title: t('banking.panel.rateHistory'),
          subtitle: charted ? `${charted.base}/${charted.quote}` : t('banking.common.na'),
          actions: charted ? signed(t, charted.thirtyDayChangePct, { kind: 'percent' }) : null,
          children:
            history.length === 0
              ? null
              : lineChart({
                  series: [
                    {
                      id: 'rate',
                      label: `${charted.base}/${charted.quote}`,
                      data: history.map((p) => p.rate),
                    },
                  ],
                  config: {
                    xAxis: { data: history.map((p) => t.formatDate(p.date, 'short')), scale: 'category' },
                    format: 'number',
                    digits: 4,
                  },
                  attributes: {
                    class: 'chart-md',
                    locale: t.locale,
                    summary: t('banking.panel.rateHistory'),
                    curve: 'monotone',
                    grid: 'horizontal',
                  },
                }),
        })}
      </div>

      ${panel({
        title: t('banking.panel.details'),
        subtitle: t('banking.screen.exchange.subtitle'),
        children: html`<div class="grid-3">
          ${pairs.map(
            (pair) => html`<md-card variant="outlined" full-width class="surface-card">
              <div class="row row--between">
                <span class="strong">${pair.base}/${pair.quote}</span>
                ${signed(t, pair.thirtyDayChangePct, { kind: 'percent' })}
              </div>
              <dl class="dl">
                <div>
                  <dt>${t('banking.table.rate')}</dt>
                  <dd class="num">${t.formatNumber(pair.rate, { maximumFractionDigits: 4 })}</dd>
                </div>
                <div>
                  <dt>${t('banking.table.spread')}</dt>
                  <dd class="num">${t('banking.unit.bps', { value: t.formatNumber(pair.spreadBps) })}</dd>
                </div>
                <div>
                  <dt>${t('banking.table.fee')}</dt>
                  <dd class="num">${
                    pair.feePct === 0 ? t('banking.common.free') : percent(t, pair.feePct)
                  }</dd>
                </div>
              </dl>
            </md-card>`,
          )}
        </div>`,
      })}

      ${panel({
        title: t('banking.panel.accounts'),
        children: html`<div class="row">
          ${accounts.map(
            (account) => html`<span class="row">
              ${currencyChip(account.currency)}
              ${money(t, account.balance, { currency: account.currency })}
            </span>`,
          )}
        </div>`,
      })}`,
  });
}
