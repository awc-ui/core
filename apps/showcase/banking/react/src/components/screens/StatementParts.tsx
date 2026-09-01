/**
 * The statement row, shared by the home screen, the account drill and the
 * transactions screen.
 *
 * WHY IT IS SHARED AND NOT COPIED. All three render the same record, and a row
 * that differs by screen is a row a reader has to re-learn. It also has three
 * details that are easy to get wrong once and impossible to get wrong three
 * times consistently: the sign convention, the declined strike-through and the
 * pending dot.
 */

import {
  categoryIcon,
  txnTypeIcon,
  type Transaction,
} from '@awc-ui/showcase-kit/banking';
import { useT } from '@/lib/showcase';
import { DateText, Flow, TxnStatusDot } from '../bits';

/**
 * One movement, as a list row.
 *
 * THE LEADING GLYPH IS THE CATEGORY, NOT THE TYPE. A reader scanning a
 * statement is looking for "the supermarket", not "a card payment" — nine rows
 * in ten are a card payment, so the type glyph would be the same shape down the
 * whole list and carry no information. The type is in the supporting text,
 * where it can be read when it matters.
 *
 * A DECLINED ROW IS STRUCK THROUGH, by `data-status` on the row rather than by
 * a class computed here, so `app.css` owns the appearance and this owns the
 * fact. The amount never left the account; showing it plain would have it read
 * as spent.
 */
export function TransactionRow({ txn, showAccount = false }: { txn: Transaction; showAccount?: boolean }) {
  const t = useT();

  const meta = [t(txn.typeKey), t(txn.categoryKey)];
  if (txn.status !== 'completed') meta.push(t(txn.statusKey));

  return (
    <md-list-item
      headline={txn.counterparty}
      overline={t.formatDate(txn.date, 'medium')}
      supporting-text={meta.join(' · ')}
      lines="3"
      data-status={txn.status}
      /* THE LEADING GLYPH IS THE CATEGORY, via the row's own `leading-icon`
         prop. There is no `md-icon` element in this library — a list item
         renders its glyph itself, which is also why the dot below cannot be
         anchored on top of it and sits with the figures instead. */
      leading-icon={categoryIcon[txn.category] ?? txnTypeIcon[txn.type]}
    >
      <span slot="trailing" className="account-row__figures">
        {/* Only an unsettled row earns a dot. A dot on every completed row is
            a column of green nobody reads. */}
        {txn.status === 'completed' ? null : <TxnStatusDot status={txn.status} />}
        <span className="txn-row__amount">
          <Flow value={txn.amount} currency={txn.currency} />
        </span>
        {/* The EUR twin only on a foreign-currency row, and only when it says
            something the local amount does not. */}
        {txn.currency === 'EUR' ? null : (
          <span className="muted">
            <Flow value={txn.amountEur} />
          </span>
        )}
      </span>
    </md-list-item>
  );
}

/**
 * A day header in the statement.
 *
 * The net for the day is shown beside the date because it is the figure a
 * reader is actually after when they scroll to a day — "what did Tuesday cost
 * me" — and summing six rows by eye is exactly the arithmetic this app exists
 * to avoid.
 */
export function StatementDayHeading({ date, netEur }: { date: string; netEur: number }) {
  return (
    <div className="statement-day">
      <span>
        <DateText value={date} style="long" />
      </span>
      <Flow value={netEur} />
    </div>
  );
}
