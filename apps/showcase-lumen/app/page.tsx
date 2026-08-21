'use client';

// Accounts overview — balance cards with sparklines, a spending donut, and
// the most recent account activity.

import { MdCard, MdDivider, MdList, MdListItem } from '@awc-ui/react/server';
import { ACCOUNTS, RECENT_ACTIVITY, SPENDING, categoryIcon, currency } from '../lib/data';
import { SpendingPie, TrendSparkline } from '../components/Charts';

export default function AccountsPage() {
  const total = SPENDING.reduce((sum, s) => sum + s.value, 0);

  return (
    <>
      <h2 className="section-title">Your accounts</h2>
      <div className="account-grid">
        {ACCOUNTS.map((a) => (
          <MdCard key={a.id} variant="filled">
            <div className="account-card-inner">
              <span className="account-overline">
                {a.name} ··{a.last4}
              </span>
              <span className="account-balance">{currency(Math.abs(a.balance))}</span>
              <span className={`account-delta ${a.direction}`}>{a.deltaLabel}</span>
              <TrendSparkline data={a.trend} color={a.direction === 'down' ? 'error' : 'primary'} />
            </div>
          </MdCard>
        ))}
      </div>

      <h2 className="section-title">Spending</h2>
      <MdCard variant="outlined">
        <div className="chart-card-inner">
          <SpendingPie />
          <p className="muted" style={{ margin: '8px 0 0' }}>
            {currency(total)} spent in August across {SPENDING.length} categories.
          </p>
        </div>
      </MdCard>

      <h2 className="section-title">Recent activity</h2>
      <MdCard variant="outlined">
        <MdList label="Recent activity">
          {RECENT_ACTIVITY.flatMap((t, i) => [
            i > 0 ? <MdDivider key={`div-${t.id}`} /> : null,
            <MdListItem
              key={t.id}
              headline={t.merchant}
              supportingText={`${t.category} · ${t.date}`}
              lines={2}
              leadingIcon={categoryIcon(t.category)}
            >
              <span slot="trailing" className={t.amount > 0 ? 'amount-credit' : 'amount-debit'}>
                {t.amount > 0 ? '+' : ''}
                {currency(t.amount)}
              </span>
            </MdListItem>,
          ])}
        </MdList>
      </MdCard>
    </>
  );
}
