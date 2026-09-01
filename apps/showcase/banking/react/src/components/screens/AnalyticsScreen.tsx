/**
 * Where the money went this month.
 *
 * THE RING, THEN THE BUDGETS, THEN THE MERCHANTS — in that order because it is
 * decreasing abstraction. The ring says how the month was shaped; the budgets
 * say whether that shape was the plan; the merchant list says what to actually
 * do about it. "Groceries €456" tells nobody anything they can act on;
 * "Nordmarkt €212 over 6 visits" does.
 *
 * EVERY FIGURE IS A POSITIVE MAGNITUDE HERE, and that is the one place this
 * app's sign convention is deliberately set aside — a ring cannot draw a
 * negative slice. It is set aside by taking the kit's own positive
 * `amountEur`, never by negating anything in a component.
 */

import {
  categoryRing,
  budgetRows,
  flowSeries,
  getTotals,
  spendSeries,
  topMerchants,
  uncappedCategories,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '@/lib/showcase';
import { BarChart, PieChart, Sparkline } from '../elements';
import { EmptyState, Panel, Screen } from '../Shell';
import {
  BudgetMeter,
  BudgetStatusChip,
  CategoryChip,
  Count,
  KpiTile,
  Money,
  Percent,
  Signed,
} from '../bits';

export function AnalyticsScreen() {
  const t = useT();
  const totals = getTotals();
  const ring = categoryRing();
  const budgets = budgetRows();
  const merchants = topMerchants(6);
  const flow = flowSeries();
  const spend = spendSeries();
  const uncapped = uncappedCategories();

  return (
    <Screen
      title={t('banking.screen.analytics.title')}
      subtitle={t('banking.screen.analytics.subtitle')}
      aside={<Count value={totals.monthTransactionCount} />}
    >
      <section className="kpi-grid">
        <KpiTile
          label={t('banking.kpi.spentThisMonth')}
          value={<Money value={totals.spentThisMonthEur} />}
          hint={
            <>
              <Signed value={totals.spendChangePct} kind="percent" />{' '}
              {t('banking.common.vsLastMonth')}
            </>
          }
          trend={spend.map((p) => p.spentEur)}
          trendLabels={spend.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'))}
          formatTrend={(value) => t.formatCurrency(value ?? 0, { notation: 'compact' })}
        />
        <KpiTile
          label={t('banking.kpi.income')}
          value={<Money value={totals.incomeThisMonthEur} />}
          hint={t('banking.common.thisMonth')}
        />
        <KpiTile
          label={t('banking.kpi.netThisMonth')}
          value={<Signed value={totals.netThisMonthEur} />}
          hint={t('banking.common.thisMonth')}
        />
        <KpiTile
          label={t('banking.kpi.subscriptions')}
          value={<Money value={totals.subscriptionMonthlyEur} />}
          hint={t('banking.common.perMonth')}
          trailing={<Count value={totals.activeSubscriptionCount} />}
        />
      </section>

      <div className="grid-2">
        <Panel title={t('banking.panel.byCategory')} subtitle={t('banking.common.thisMonth')}>
          <PieChart
            class="chart-md"
            data={ring.map((slice) => ({
              id: slice.id,
              label: t(slice.labelKey),
              value: slice.value,
            }))}
            valueFormatter={(value: number | null) =>
              t.formatCurrency(value ?? 0, { notation: 'compact' })
            }
            summary={t('banking.panel.byCategory')}
            variant="donut"
            legend="end"
          />
        </Panel>

        <Panel title={t('banking.panel.flow')}>
          {/* Two bars per month rather than one signed bar: in and out are
              different quantities, and a single net bar hides a month where
              both doubled. */}
          <BarChart
            class="chart-md"
            series={[
              { id: 'in', label: t('banking.kpi.income'), data: flow.map((p) => p.inEur) },
              { id: 'out', label: t('banking.panel.spending'), data: flow.map((p) => p.outEur) },
            ]}
            xAxis={{ data: flow.map((p) => t.formatDate(`${p.month}-01`, 'monthYear')) }}
            yAxis={{ min: 0 }}
            valueFormatter={(value: number | null) =>
              t.formatCurrency(value ?? 0, { notation: 'compact' })
            }
            label={t('banking.panel.flow')}
            legend="top-end"
          />
        </Panel>
      </div>

      <Panel
        title={t('banking.panel.budgets')}
        subtitle={t('banking.common.thisMonth')}
        actions={
          totals.budgetOverCount > 0 ? (
            <md-chip
              variant="assist"
              appearance="outlined"
              color="error"
              label={String(totals.budgetOverCount)}
              icon="warning"
            />
          ) : null
        }
      >
        <div className="grid-2">
          {budgets.map((budget) => (
            <md-card key={budget.category} variant="outlined" full-width class="surface-card">
              <div className="budget-row">
                <div className="budget-row__head">
                  <CategoryChip category={budget.category} />
                  <BudgetStatusChip status={budget.status} />
                </div>
                <BudgetMeter fraction={budget.usedPct} status={budget.status} />
                <div className="budget-row__foot">
                  <span>
                    <Money value={budget.spent} /> / <Money value={budget.monthlyLimit} />
                  </span>
                  <span>
                    <Percent value={budget.usedPct} />
                  </span>
                </div>
                {/* The trend is what separates "over for the first time in a
                    year" from "over every month", and the number alone cannot
                    say which. */}
                <Sparkline
                  data={budget.trend}
                  labels={spend.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'))}
                  variant="area"
                  color={budget.status === 'over' ? 'error' : 'primary'}
                  curve="monotone"
                  height="34px"
                  valueFormatter={(value: number | null) =>
                    t.formatCurrency(value ?? 0, { notation: 'compact' })
                  }
                />
              </div>
            </md-card>
          ))}
        </div>

        {uncapped.length === 0 ? null : (
          <div className="row">
            <span className="muted">{t('banking.action.setBudget')}</span>
            {uncapped.map((row) => (
              <CategoryChip key={row.category} category={row.category} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t('banking.panel.byMerchant')} actions={<Count value={merchants.length} />}>
        {merchants.length === 0 ? (
          <EmptyState message={t('banking.empty.transactions')} />
        ) : (
          <md-list
            label={t('banking.panel.byMerchant')}
            interaction-mode="multi-action"
            list-style="segmented"
          >
            {merchants.map((merchant) => (
              <md-list-item
                key={merchant.merchantId}
                headline={merchant.name}
                overline={t(merchant.categoryKey)}
                supporting-text={t('banking.common.visits', { count: merchant.transactionCount })}
                lines="3"
              >
                <span slot="leading">
                  <md-avatar initials={merchant.initials} size="small" />
                </span>
                <span slot="trailing">
                  <Money value={merchant.amountEur} />
                </span>
              </md-list-item>
            ))}
          </md-list>
        )}
      </Panel>
    </Screen>
  );
}
