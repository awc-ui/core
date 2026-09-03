/**
 * Screen 4 — where the money went this month.
 *
 * THE RING, THEN THE BUDGETS, THEN THE MERCHANTS — decreasing abstraction. The
 * ring says how the month was shaped; the budgets whether that was the plan;
 * the merchant list what to do about it.
 *
 * EVERY FIGURE HERE IS A POSITIVE MAGNITUDE, the one place this app's sign
 * convention is set aside — a ring cannot draw a negative slice. It is set
 * aside by taking the kit's own positive amountEur, never by negating here.
 *
 * WHAT THE CLIENT SCRIPT ADDS: nothing but the chart configuration every screen
 * needs. There is no interaction on this screen — it is a report.
 */

import {
  budgetRows,
  categoryRing,
  flowSeries,
  getTotals,
  route,
  spendSeries,
  topMerchants,
  uncappedCategories,
} from '@awc-ui/showcase-kit/banking';
import { attrs, html } from '../lib/html.mjs';
import { barChart, pieChart, sparkline } from '../lib/charts.mjs';
import {
  budgetMeter,
  budgetStatusChip,
  categoryChip,
  count,
  kpiTile,
  money,
  percent,
  signed,
} from '../lib/bits.mjs';
import { panel, screen } from '../components/shell.mjs';

export function analyticsScreen(t, locale) {
  const path = route.analytics();
  const totals = getTotals();
  const ring = categoryRing();
  const budgets = budgetRows();
  const merchants = topMerchants(6);
  const flow = flowSeries();
  const spend = spendSeries();
  const uncapped = uncappedCategories();
  const monthLabels = spend.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'));

  return screen(t, {
    locale,
    here: path,
    title: t('banking.screen.analytics.title'),
    subtitle: t('banking.screen.analytics.subtitle'),
    aside: count(t, totals.monthTransactionCount),
    children: html`<section class="kpi-grid">
        ${kpiTile(t, {
          label: t('banking.kpi.spentThisMonth'),
          value: money(t, totals.spentThisMonthEur),
          hint: html`${signed(t, totals.spendChangePct, { kind: 'percent' })} ${t('banking.common.vsLastMonth')}`,
          trend: spend.map((p) => p.spentEur),
          trendLabels: monthLabels,
          trendFormat: 'currency',
        })}
        ${kpiTile(t, {
          label: t('banking.kpi.income'),
          value: money(t, totals.incomeThisMonthEur),
          hint: t('banking.common.thisMonth'),
        })}
        ${kpiTile(t, {
          label: t('banking.kpi.netThisMonth'),
          value: signed(t, totals.netThisMonthEur),
          hint: t('banking.common.thisMonth'),
        })}
        ${kpiTile(t, {
          label: t('banking.kpi.subscriptions'),
          value: money(t, totals.subscriptionMonthlyEur),
          hint: t('banking.common.perMonth'),
          trailing: count(t, totals.activeSubscriptionCount),
        })}
      </section>

      <div class="grid-2">
        ${panel({
          title: t('banking.panel.byCategory'),
          subtitle: t('banking.common.thisMonth'),
          children: pieChart({
            data: ring.map((slice) => ({ id: slice.id, label: t(slice.labelKey), value: slice.value })),
            config: { format: 'currency' },
            attributes: {
              class: 'chart-md',
              locale: t.locale,
              summary: t('banking.panel.byCategory'),
              /* inner-radius is what makes it a donut — there is no variant
                 prop. show-labels is off: eight slices, the smallest under 5%,
                 each printing a currency figure in white on a mid-tone fill,
                 the two smallest overlapping outright. */
              'inner-radius': '62%',
              'show-labels': 'false',
              legend: 'bottom',
            },
            children: html`<div slot="center" class="ring-centre">
              <span class="ring-centre__value">${money(t, totals.spentThisMonthEur, { compact: true })}</span>
              <span class="ring-centre__label">${t('banking.common.thisMonth')}</span>
            </div>`,
          }),
        })}

        ${panel({
          title: t('banking.panel.flow'),
          children: barChart({
            series: [
              { id: 'in', label: t('banking.kpi.income'), data: flow.map((p) => p.inEur) },
              { id: 'out', label: t('banking.panel.spending'), data: flow.map((p) => p.outEur) },
            ],
            config: {
              xAxis: { data: flow.map((p) => t.formatDate(`${p.month}-01`, 'monthYear')) },
              yAxis: { min: 0 },
              format: 'currency',
            },
            attributes: {
              class: 'chart-md',
              locale: t.locale,
              label: t('banking.panel.flow'),
              legend: 'top-end',
            },
          }),
        })}
      </div>

      ${panel({
        title: t('banking.panel.budgets'),
        subtitle: t('banking.common.thisMonth'),
        actions:
          totals.budgetOverCount > 0
            ? html`<md-chip${attrs({
                variant: 'assist',
                appearance: 'outlined',
                color: 'error',
                label: String(totals.budgetOverCount),
                icon: 'warning',
              })}></md-chip>`
            : null,
        children: html`<div class="grid-2">
            ${budgets.map(
              (budget) => html`<md-card variant="outlined" full-width class="surface-card">
                <div class="budget-row">
                  <div class="budget-row__head">
                    ${categoryChip(t, budget.category)}
                    ${budgetStatusChip(t, budget.status)}
                  </div>
                  ${budgetMeter(t, { fraction: budget.usedPct, status: budget.status })}
                  <div class="budget-row__foot">
                    <span>${money(t, budget.spent)} / ${money(t, budget.monthlyLimit)}</span>
                    <span>${percent(t, budget.usedPct)}</span>
                  </div>
                  <!-- The trend separates "over for the first time in a year"
                       from "over every month", which the number cannot say. -->
                  ${sparkline({
                    data: budget.trend,
                    labels: monthLabels,
                    format: 'currency',
                    attributes: {
                      variant: 'area',
                      color: budget.status === 'over' ? 'error' : 'primary',
                      curve: 'monotone',
                      height: '34px',
                    },
                  })}
                </div>
              </md-card>`,
            )}
          </div>

          ${uncapped.length === 0
            ? null
            : html`<div class="row">
                <span class="muted">${t('banking.action.setBudget')}</span>
                ${uncapped.map((row) => categoryChip(t, row.category))}
              </div>`}`,
      })}

      ${panel({
        title: t('banking.panel.byMerchant'),
        actions: count(t, merchants.length),
        children:
          merchants.length === 0
            ? html`<div class="empty"><p>${t('banking.empty.transactions')}</p></div>`
            : html`<md-list${attrs({
                label: t('banking.panel.byMerchant'),
                'interaction-mode': 'multi-action',
                'list-style': 'segmented',
              })}>
                ${merchants.map(
                  (merchant) => html`<md-list-item${attrs({
                    headline: merchant.name,
                    overline: t(merchant.categoryKey),
                    'supporting-text': t('banking.common.visits', { count: merchant.transactionCount }),
                    lines: '3',
                  })}>
                    <span slot="leading">
                      <md-avatar${attrs({ initials: merchant.initials, size: 'small' })}></md-avatar>
                    </span>
                    <span slot="trailing">${money(t, merchant.amountEur)}</span>
                  </md-list-item>`,
                )}
              </md-list>`,
      })}`,
  });
}
