/**
 * One account: its details, its month, and its statement.
 *
 * A DRILL, NOT A DESTINATION — there is no `/accounts/` index, so this is only
 * reachable from the home screen's account list, and it renders breadcrumbs
 * because it is one level down.
 *
 * THE GUARD IS HERE, NOT IN THE ROUTER. The id comes off the URL and a
 * component taking a plain string from a URL must not trust its caller — an
 * unknown id renders the empty state rather than throwing on `undefined`.
 */

import {
  BASE_CURRENCY,
  accountSummaries,
  getAccountById,
  getCards,
  getTransactions,
  statementDays,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '@/lib/showcase';
import { usePathname } from '@/lib/router';
import { crumbsFor } from '@awc-ui/showcase-kit/banking';
import { route, withBase } from '@/lib/routes';
import { EmptyState, Panel, Screen } from '../Shell';
import {
  AccountKindChip,
  CardStateChip,
  Count,
  CurrencyChip,
  Money,
  Percent,
  Signed,
  VaultMeter,
} from '../bits';
import { StatementDayHeading, TransactionRow } from './StatementParts';

export function AccountScreen({ accountId }: { accountId: string }) {
  const t = useT();
  const pathname = usePathname();
  const account = getAccountById(accountId);

  if (!account) {
    return (
      <Screen
        crumbs={crumbsFor(pathname, null)}
        title={t('banking.screen.notFound.title')}
        subtitle={t('banking.screen.notFound.body')}
      >
        <EmptyState message={t('banking.screen.notFound.body')} />
      </Screen>
    );
  }

  const summary = accountSummaries().find((s) => s.account.id === account.id);
  const cards = getCards({ accountId: account.id });
  const rows = getTransactions({ accountId: account.id, limit: 40 });
  const days = statementDays(rows);

  return (
    <Screen
      crumbs={crumbsFor(pathname, account.nickname)}
      title={account.nickname}
      subtitle={t('banking.screen.account.subtitle')}
      aside={
        <>
          <AccountKindChip kind={account.kind} />
          <CurrencyChip currency={account.currency} />
        </>
      }
    >
      <div className="grid-2">
        <Panel title={t('banking.panel.details')}>
          <dl className="dl">
            <div>
              <dt>{t('banking.table.balance')}</dt>
              <dd>
                <Money value={account.balance} currency={account.currency} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.table.available')}</dt>
              <dd>
                <Money value={account.available} currency={account.currency} />
              </dd>
            </div>
            {/* The EUR twin only when the account is not already in it. */}
            {account.currency === BASE_CURRENCY ? null : (
              <div>
                <dt>{BASE_CURRENCY}</dt>
                <dd>
                  <Money value={account.balanceEur} />
                </dd>
              </div>
            )}
            <div>
              <dt>{t('banking.table.iban')}</dt>
              {/* `bdi` because an IBAN is a neutral-direction string that must
                  not be re-ordered inside the Arabic layout. */}
              <dd>
                <bdi className="num">{account.iban}</bdi>
              </dd>
            </div>
            {account.interestRate === null ? null : (
              <div>
                <dt>{t('banking.table.interest')}</dt>
                <dd>
                  <Percent value={account.interestRate} />
                </dd>
              </div>
            )}
          </dl>

          {account.goalTarget === null ? null : (
            <div className="budget-row">
              <div className="budget-row__head">
                <span className="strong">{account.goalName}</span>
                <span className="muted">
                  {t('banking.hint.vault', {
                    pct: t.formatPercent(account.goalFundedPct ?? 0, { maximumFractionDigits: 0 }),
                    target: t.formatCurrency(account.goalTarget, { notation: 'compact' }),
                  })}
                </span>
              </div>
              <VaultMeter fraction={account.goalFundedPct ?? 0} label={account.goalName ?? ''} />
            </div>
          )}
        </Panel>

        <Panel title={t('banking.common.thisMonth')}>
          <dl className="dl">
            <div>
              <dt>{t('banking.kpi.income')}</dt>
              <dd>
                <Money value={summary?.inThisMonth ?? 0} currency={account.currency} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.panel.spending')}</dt>
              <dd>
                <Money value={summary?.outThisMonth ?? 0} currency={account.currency} />
              </dd>
            </div>
            <div>
              <dt>{t('banking.kpi.netThisMonth')}</dt>
              <dd>
                <Signed
                  value={(summary?.inThisMonth ?? 0) - (summary?.outThisMonth ?? 0)}
                  currency={account.currency}
                />
              </dd>
            </div>
          </dl>

          {cards.length === 0 ? (
            <EmptyState message={t('banking.empty.cards')} />
          ) : (
            <md-list
              label={t('banking.panel.cards')}
              interaction-mode="navigation"
              list-style="segmented"
            >
              {cards.map((card) => (
                <md-list-item
                  key={card.id}
                  type="link"
                  href={withBase(route.cards())}
                  headline={card.label}
                  overline={t('banking.unit.endingIn', { last4: card.last4 })}
                  lines="2"
                  leading-icon="credit_card"
                >
                  <span slot="trailing">
                    <CardStateChip state={card.state} />
                  </span>
                </md-list-item>
              ))}
            </md-list>
          )}
        </Panel>
      </div>

      <Panel
        title={t('banking.action.statement')}
        actions={<Count value={rows.length} />}
      >
        {days.length === 0 ? (
          <EmptyState message={t('banking.empty.transactions')} />
        ) : (
          days.map((day) => (
            <div key={day.date} className="stack">
              <StatementDayHeading date={day.date} netEur={day.netEur} />
              <md-list
                label={t.formatDate(day.date, 'long')}
                interaction-mode="multi-action"
                list-style="segmented"
              >
                {day.rows.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} />
                ))}
              </md-list>
            </div>
          ))
        )}
      </Panel>
    </Screen>
  );
}
