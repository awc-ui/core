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
import { DateText, Flow } from '../bits';

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
export function TransactionRow({
  txn,
  /**
   * Whether the row states its own date.
   *
   * FALSE INSIDE A DAY GROUP, which is where most of these render. The group
   * already has a date heading above it, so an overline repeating it puts the
   * same date on screen seven times under one header — measured on the 31st of
   * August, which has seven rows. The home screen's preview is not grouped, so
   * there the date is the only thing placing the row in time and it stays.
   */
  showDate = true,
}: {
  txn: Transaction;
  showDate?: boolean;
}) {
  const t = useT();

  const meta = [t(txn.typeKey), t(txn.categoryKey)];
  if (txn.status !== 'completed') meta.push(t(txn.statusKey));

  return (
    <md-list-item
      headline={txn.counterparty}
      overline={showDate ? t.formatDate(txn.date, 'medium') : undefined}
      supporting-text={meta.join(' · ')}
      lines={showDate ? '3' : '2'}
      data-status={txn.status}
      /* THE LEADING GLYPH IS THE CATEGORY, via the row's own `leading-icon`
         prop. There is no `md-icon` element in this library — a list item
         renders its glyph itself, which is also why the dot below cannot be
         anchored on top of it and sits with the figures instead. */
      leading-icon={categoryIcon[txn.category] ?? txnTypeIcon[txn.type]}
    >
      <span slot="trailing" className="account-row__figures">
        {/*
          NO STATUS DOT ON THE AMOUNT. `md-status-dot` anchors absolutely to a
          positioned parent's bottom-end corner — right for an avatar rim, and
          on a currency figure it lands across the last two digits. `data-status`
          on the row drives the treatment from `app.css` instead: a pending
          amount is muted, a declined one muted and struck. The row's supporting
          text already names the state in words.
        */}
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
