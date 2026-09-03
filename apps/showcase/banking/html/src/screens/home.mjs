/**
 * Screen 1 — home, and the head of both drill paths.
 *
 * The layout is the React build's, in the same order: four headlines, the
 * accounts and the balance curve, spending against budget and what is due
 * next, then a preview of the statement beside the cards.
 *
 * NOTHING HERE IS ARITHMETIC. Every figure, series and colour comes from
 * `@awc-ui/showcase-kit/banking`; this file decides layout and nothing else.
 * A `.map()` over a kit series to lift one field out is a projection, not a
 * calculation.
 *
 * WHAT THE CLIENT SCRIPT ADDS: nothing. Every element on this screen is
 * complete as written — the only interactive pieces are links, which work
 * before any JavaScript runs. The charts get their axis config from
 * `client/charts.mjs`, which is true of every screen in this build.
 */

import {
  BASE_CURRENCY,
  accountSummaries,
  balanceSeries,
  budgetOverall,
  cardStateColor,
  getCards,
  getTotals,
  getTransactions,
  headlines,
  route,
  upcomingCharges,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { localeHref } from '../lib/i18n.mjs';
import { areaChart } from '../lib/charts.mjs';
import {
  budgetMeter,
  cardStateChip,
  count,
  dateText,
  kpiTile,
  money,
  percent,
  signed,
  statementRow,
  vaultMeter,
} from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

export function homeScreen(t, locale) {
  const totals = getTotals();
  const summaries = accountSummaries();
  const curve = balanceSeries();
  const budget = budgetOverall();
  const charges = upcomingCharges(4);
  const cards = getCards();
  /* A preview of the statement, in the statement's own default order. */
  const recent = getTransactions({ limit: 6 });
  const vaults = summaries.filter(({ account }) => account.goalTarget !== null);
  const trendLabels = curve.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'));

  /* The overall meter takes the WORST status of the five, not an average: one
     category 15% over is the thing worth surfacing. */
  const budgetStatus =
    totals.budgetOverCount > 0 ? 'over' : totals.budgetNearCount > 0 ? 'near' : 'under';

  const path = route.home();

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.home.title'),
    subtitle: t('banking.screen.home.subtitle'),
    aside: html`<md-button${attrs({
        variant: 'tonal',
        size: 'sm',
        icon: 'currency_exchange',
        href: localeHref(locale, route.exchange()),
      })}>${t('banking.action.exchange')}</md-button>
      <md-button${attrs({
        variant: 'text',
        size: 'sm',
        icon: 'receipt_long',
        href: localeHref(locale, route.transactions()),
      })}>${t('banking.action.statement')}</md-button>`,
    children: html`<section class="kpi-grid">
        ${headlines().map((h) =>
          kpiTile(t, {
            label: t(h.labelKey),
            value: money(t, h.valueEur, { compact: true }),
            hint:
              h.changePct === null
                ? null
                : html`${signed(t, h.changePct, { kind: 'percent' })}
                    ${h.labelKey === 'banking.kpi.spentThisMonth'
                      ? t('banking.common.vsLastMonth')
                      : t('banking.kpi.unrealisedPl')}`,
            /* Only the balance tile gets the curve. Four sparklines across a
               KPI row is four competing shapes and none of them is read. */
            trend: h.labelKey === 'banking.kpi.balance' ? curve.map((p) => p.balanceEur) : undefined,
            trendLabels,
            trendFormat: 'currency',
          }),
        )}
      </section>

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.accounts'),
          subtitle: t('banking.app.baseCurrency', { currency: BASE_CURRENCY }),
          actions: count(t, totals.accountCount),
          children: html`<md-list${attrs({
              label: t('banking.panel.accounts'),
              'interaction-mode': 'navigation',
              'list-style': 'segmented',
            })}>
              ${summaries.map(
                ({ account, transactionCount }) => html`<md-list-item${attrs({
                  type: 'link',
                  href: localeHref(locale, route.account(account.id)),
                  headline: account.nickname,
                  lines: '3',
                  overline: `${t(account.kindKey)} · ${account.currency}`,
                  'supporting-text': t('banking.common.transactions', { count: transactionCount }),
                  'leading-icon': account.kind === 'vault' ? 'savings' : 'account_balance_wallet',
                })}>
                  <span slot="trailing" class="account-row__figures">
                    ${money(t, account.balance, { currency: account.currency })}
                    <!-- The EUR twin only when it differs — the same figure
                         twice is noise on the three EUR accounts. -->
                    ${account.currency === BASE_CURRENCY
                      ? null
                      : html`<span class="muted">${money(t, account.balanceEur, { compact: true })}</span>`}
                  </span>
                </md-list-item>`,
              )}
            </md-list>

            <!-- The vault's progress, under the list it belongs to rather than
                 as a sixth row — the same account, shown a second way. -->
            ${vaults.map(
              ({ account }) => html`<div class="budget-row">
                <div class="budget-row__head">
                  <span class="strong">${account.goalName}</span>
                  <span class="muted">${t('banking.hint.vault', {
                    pct: t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                    target: t.formatCurrency(account.goalTarget ?? 0, { notation: 'compact' }),
                  })}</span>
                </div>
                ${vaultMeter(t, { fraction: account.goalFundedPct ?? 0, label: account.goalName ?? '' })}
              </div>`,
            )}`,
        })}

        ${panel({
          title: t('banking.panel.balanceTrend'),
          subtitle: t('banking.common.showing', { shown: curve.length, total: curve.length }),
          children: areaChart({
            series: [
              { id: 'balance', label: t('banking.kpi.balance'), data: curve.map((p) => p.balanceEur) },
            ],
            config: {
              xAxis: { data: trendLabels, scale: 'category' },
              format: 'currency',
            },
            attributes: {
              class: 'chart-md',
              locale: t.locale,
              summary: t('banking.panel.balanceTrend'),
              curve: 'monotone',
              grid: 'horizontal',
            },
          }),
        })}
      </div>

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.spending'),
          subtitle: t('banking.common.thisMonth'),
          actions: html`<md-button${attrs({
            variant: 'text',
            size: 'sm',
            href: localeHref(locale, route.analytics()),
          })}>${t('banking.action.viewAll')}</md-button>`,
          children: html`<dl class="dl">
              <div>
                <dt>${t('banking.kpi.spentThisMonth')}</dt>
                <dd>${money(t, totals.spentThisMonthEur)}</dd>
              </div>
              <div>
                <dt>${t('banking.kpi.income')}</dt>
                <dd>${money(t, totals.incomeThisMonthEur)}</dd>
              </div>
              <div>
                <dt>${t('banking.kpi.netThisMonth')}</dt>
                <dd>${signed(t, totals.netThisMonthEur)}</dd>
              </div>
            </dl>

            <div class="budget-row">
              <div class="budget-row__head">
                <span>${t('banking.kpi.budgetUsed')}</span>
                <span class="strong">${percent(t, budget.usedPct)}</span>
              </div>
              ${budgetMeter(t, { fraction: budget.usedPct, status: budgetStatus })}
              <div class="budget-row__foot">
                <span>${money(t, budget.spent, { compact: true })} / ${money(t, budget.limit, { compact: true })}</span>
                ${totals.budgetOverCount > 0 ? html`<span>${t('banking.budgetStatus.over')}</span>` : null}
              </div>
            </div>`,
        })}

        ${panel({
          title: t('banking.panel.upcoming'),
          subtitle: t('banking.kpi.subscriptions'),
          actions: count(t, totals.activeSubscriptionCount),
          children: html`<md-list${attrs({
            label: t('banking.panel.upcoming'),
            'interaction-mode': 'multi-action',
            'list-style': 'segmented',
          })}>
            ${charges.map(
              (charge) => html`<md-list-item${attrs({
                headline: charge.name,
                overline: t(charge.cadenceKey),
                lines: '2',
              })}>
                <span slot="leading">
                  <md-avatar${attrs({ initials: charge.initials, size: 'small' })}></md-avatar>
                </span>
                <span slot="trailing" class="account-row__figures">
                  ${money(t, charge.amountEur)}
                  <span class="muted">${dateText(t, charge.nextChargeDate)}</span>
                </span>
              </md-list-item>`,
            )}
          </md-list>`,
        })}
      </div>

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.recent'),
          actions: html`<md-button${attrs({
            variant: 'text',
            size: 'sm',
            href: localeHref(locale, route.transactions()),
          })}>${t('banking.action.viewAll')}</md-button>`,
          children: html`<md-list${attrs({
            label: t('banking.panel.recent'),
            'interaction-mode': 'multi-action',
            'list-style': 'segmented',
          })}>${recent.map((txn) => statementRow(t, txn))}</md-list>`,
        })}

        ${panel({
          title: t('banking.panel.cards'),
          actions: html`<md-button${attrs({
            variant: 'text',
            size: 'sm',
            href: localeHref(locale, route.cards()),
          })}>${t('banking.action.viewAll')}</md-button>`,
          children: html`<md-list${attrs({
            label: t('banking.panel.cards'),
            'interaction-mode': 'navigation',
            'list-style': 'segmented',
          })}>
            ${cards.map(
              (card) => html`<md-list-item${attrs({
                type: 'link',
                href: localeHref(locale, route.cards()),
                headline: card.label,
                overline: t('banking.unit.endingIn', { last4: card.last4 }),
                'supporting-text': `${t(card.kindKey)} · ${t(card.stateKey)}`,
                lines: '3',
                'leading-icon': 'credit_card',
              })}>
                <!-- No status dot: it anchors absolutely with nothing to anchor
                     to, and the chip beside it already says the same word. -->
                <span slot="trailing">${cardStateChip(t, card.state)}</span>
              </md-list-item>`,
            )}
          </md-list>`,
        })}
      </div>`,
  });
}
