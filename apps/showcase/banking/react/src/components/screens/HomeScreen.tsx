/**
 * Home — what someone opens the app to see.
 *
 * FOUR HEADLINES, THEN THE ACCOUNTS, THEN WHAT NEEDS ATTENTION. The order is
 * the reading order of the question "am I fine?": the net figure first, then
 * where the money physically is, then anything unusual. Everything below the
 * fold is elaboration.
 *
 * NOTHING HERE COMPUTES ANYTHING. Every figure is a field on a kit record or
 * the return value of a kit function: `headlines()` for the tiles,
 * `balanceSeries()` for the curve, `accountSummaries()` for the per-account
 * movement, `budgetOverall()` for the meter, `upcomingCharges()` for the list.
 * The only thing this file decides is what is on screen.
 */

import {
  BASE_CURRENCY,
  accountSummaries,
  balanceSeries,
  budgetOverall,
  getCards,
  getPrimaryAccount,
  getProfile,
  getTotals,
  getTransactions,
  headlines,
  upcomingCharges,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '@/lib/showcase';
import { route, withBase } from '@/lib/routes';
import { Link } from '@/lib/router';
import { Panel, Screen } from '../Shell';
import { AreaChart } from '../elements';
import {
  AccountKindChip,
  CardStateChip,
  CardStateDot,
  BudgetMeter,
  Count,
  CurrencyChip,
  DateText,
  Drill,
  Flow,
  KpiTile,
  Money,
  Percent,
  Signed,
  TxnStatusDot,
  VaultMeter,
} from '../bits';
import { TransactionRow } from './StatementParts';

export function HomeScreen() {
  const t = useT();
  const totals = getTotals();
  const profile = getProfile();
  const primary = getPrimaryAccount();
  const summaries = accountSummaries();
  const curve = balanceSeries();
  const budget = budgetOverall();
  const charges = upcomingCharges(4);
  const cards = getCards();
  /* The last handful of movements, not a filtered set — this is a preview of
     the statement and the statement's own default order is what it previews. */
  const recent = getTransactions({ limit: 6 });

  return (
    <Screen
      title={t('banking.screen.home.title')}
      subtitle={t('banking.screen.home.subtitle')}
      aside={
        <>
          <md-button
            variant="tonal"
            size="sm"
            icon="currency_exchange"
            href={withBase(route.exchange())}
          >
            {t('banking.action.exchange')}
          </md-button>
          <md-button variant="text" size="sm" icon="receipt_long" href={withBase(route.transactions())}>
            {t('banking.action.statement')}
          </md-button>
        </>
      }
    >
      <section className="kpi-grid">
        {headlines().map((h) => (
          <KpiTile
            key={h.labelKey}
            label={t(h.labelKey)}
            value={<Money value={h.valueEur} compact />}
            hint={
              h.changePct === null ? null : (
                <>
                  <Signed value={h.changePct} kind="percent" />{' '}
                  {h.labelKey === 'banking.kpi.spentThisMonth'
                    ? t('banking.common.vsLastMonth')
                    : t('banking.kpi.unrealisedPl')}
                </>
              )
            }
            /* Only the balance tile gets the curve. Four sparklines across a
               KPI row is four competing shapes and none of them is read; the
               one that earns it is the figure the curve is actually of. */
            trend={h.labelKey === 'banking.kpi.balance' ? curve.map((p) => p.balanceEur) : undefined}
            trendLabels={curve.map((p) => t.formatDate(`${p.month}-01`, 'monthYear'))}
            formatTrend={(value) => t.formatCurrency(value ?? 0, { notation: 'compact' })}
          />
        ))}
      </section>

      <div className="grid-2">
        <Panel
          title={t('banking.panel.accounts')}
          subtitle={t('banking.app.baseCurrency', { currency: BASE_CURRENCY })}
          actions={<Count value={totals.accountCount} />}
        >
          <md-list label={t('banking.panel.accounts')} interaction-mode="navigation" list-style="segmented">
            {summaries.map(({ account, transactionCount }) => (
              <md-list-item
                key={account.id}
                type="link"
                href={withBase(route.account(account.id))}
                headline={account.nickname}
                lines="3"
                /* The overline carries the kind and the currency in words, so
                   the chips below repeat rather than solely carry them. */
                overline={`${t(account.kindKey)} · ${account.currency}`}
                supporting-text={t('banking.common.transactions', { count: transactionCount })}
                leading-icon={account.kind === 'vault' ? 'savings' : 'account_balance_wallet'}
              >
                <span slot="trailing" className="account-row__figures">
                  <Money value={account.balance} currency={account.currency} />
                  {/* The EUR twin only when it differs — printing "€4,218.64"
                      under "€4,218.64" is noise on the three EUR accounts. */}
                  {account.currency === BASE_CURRENCY ? null : (
                    <span className="muted">
                      <Money value={account.balanceEur} compact />
                    </span>
                  )}
                </span>
              </md-list-item>
            ))}
          </md-list>

          {/* The vault's progress, under the list it belongs to rather than as
              a sixth row — it is the same account, shown a second way. */}
          {summaries
            .filter(({ account }) => account.goalTarget !== null)
            .map(({ account }) => (
              <div key={account.id} className="budget-row">
                <div className="budget-row__head">
                  <span className="strong">{account.goalName}</span>
                  <span className="muted">
                    {t('banking.hint.vault', {
                      pct: t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                      target: t.formatCurrency(account.goalTarget ?? 0, { notation: 'compact' }),
                    })}
                  </span>
                </div>
                <VaultMeter fraction={account.goalFundedPct ?? 0} label={account.goalName ?? ''} />
              </div>
            ))}
        </Panel>

        <Panel
          title={t('banking.panel.balanceTrend')}
          subtitle={t('banking.common.showing', {
            shown: curve.length,
            total: curve.length,
          })}
        >
          <AreaChart
            class="chart-md"
            series={[
              {
                id: 'balance',
                label: t('banking.kpi.balance'),
                data: curve.map((p) => p.balanceEur),
              },
            ]}
            xAxis={{
              data: curve.map((p) => t.formatDate(`${p.month}-01`, 'monthYear')),
              scale: 'category',
            }}
            valueFormatter={(value: number | null) =>
              t.formatCurrency(value ?? 0, { notation: 'compact' })
            }
            summary={t('banking.panel.balanceTrend')}
            curve="monotone"
            grid="horizontal"
          />
        </Panel>
      </div>

      <div className="grid-2">
        <Panel
          title={t('banking.panel.spending')}
          subtitle={t('banking.common.thisMonth')}
          actions={
            <md-button variant="text" size="sm" href={withBase(route.analytics())}>
              {t('banking.action.viewAll')}
            </md-button>
          }
        >
          <dl className="dl">
            <div>
              <dt>{t('banking.kpi.spentThisMonth')}</dt>
              <dd>
                <Money value={totals.spentThisMonthEur} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.kpi.income')}</dt>
              <dd>
                <Money value={totals.incomeThisMonthEur} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.kpi.netThisMonth')}</dt>
              <dd>
                <Signed value={totals.netThisMonthEur} />
              </dd>
            </div>
          </dl>

          <div className="budget-row">
            <div className="budget-row__head">
              <span>{t('banking.kpi.budgetUsed')}</span>
              <span className="strong">
                <Percent value={budget.usedPct} />
              </span>
            </div>
            {/* The overall meter takes the WORST status of the five, not an
                average: one category 15% over is the thing worth surfacing, and
                averaging it against four calm ones hides exactly that. */}
            <BudgetMeter
              fraction={budget.usedPct}
              status={
                totals.budgetOverCount > 0 ? 'over' : totals.budgetNearCount > 0 ? 'near' : 'under'
              }
            />
            <div className="budget-row__foot">
              <span>
                <Money value={budget.spent} compact /> / <Money value={budget.limit} compact />
              </span>
              {totals.budgetOverCount > 0 ? (
                <span>{t('banking.budgetStatus.over')}</span>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel
          title={t('banking.panel.upcoming')}
          subtitle={t('banking.kpi.subscriptions')}
          actions={<Count value={totals.activeSubscriptionCount} />}
        >
          <md-list label={t('banking.panel.upcoming')} interaction-mode="multi-action" list-style="segmented">
            {charges.map((charge) => (
              <md-list-item
                key={charge.subscriptionId}
                headline={charge.name}
                overline={t(charge.cadenceKey)}
                lines="2"
              >
                <span slot="leading">
                  <md-avatar initials={charge.initials} size="small" />
                </span>
                <span slot="trailing" className="account-row__figures">
                  <Money value={charge.amountEur} />
                  <span className="muted">
                    <DateText value={charge.nextChargeDate} />
                  </span>
                </span>
              </md-list-item>
            ))}
          </md-list>
        </Panel>
      </div>

      <div className="grid-2">
        <Panel
          title={t('banking.panel.recent')}
          actions={
            <md-button variant="text" size="sm" href={withBase(route.transactions())}>
              {t('banking.action.viewAll')}
            </md-button>
          }
        >
          <md-list label={t('banking.panel.recent')} interaction-mode="multi-action" list-style="segmented">
            {recent.map((txn) => (
              <TransactionRow key={txn.id} txn={txn} />
            ))}
          </md-list>
        </Panel>

        <Panel
          title={t('banking.panel.cards')}
          actions={
            <md-button variant="text" size="sm" href={withBase(route.cards())}>
              {t('banking.action.viewAll')}
            </md-button>
          }
        >
          <md-list label={t('banking.panel.cards')} interaction-mode="navigation" list-style="segmented">
            {cards.map((card) => (
              <md-list-item
                key={card.id}
                type="link"
                href={withBase(route.cards())}
                headline={card.label}
                overline={t('banking.unit.endingIn', { last4: card.last4 })}
                supporting-text={`${t(card.kindKey)} · ${t(card.stateKey)}`}
                lines="3"
                leading-icon="credit_card"
              >
                <span slot="trailing" className="row">
                  <CardStateDot state={card.state} />
                  <CardStateChip state={card.state} />
                </span>
              </md-list-item>
            ))}
          </md-list>
        </Panel>
      </div>
    </Screen>
  );
}
